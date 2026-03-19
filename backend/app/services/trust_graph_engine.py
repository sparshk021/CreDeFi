"""
CreDeFi Trust Graph Engine
===========================
Pure-computation module — no DB, no I/O.

Responsibilities:
  1. Build a weighted DiGraph from heterogeneous edge sources
     (transactions, explicit trust edges, collaborations).
  2. Compute per-node graph metrics (PageRank, centralities, etc.).
  3. Derive a single Graph Reputation Score per user (0 → 1).

The GraphBuilder is intentionally reusable: any subsystem (sybil,
trust-score, analytics) can call `GraphBuilder.build()` with raw
edge data and get a ready-to-query networkx graph back.
"""

from __future__ import annotations

import math
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Sequence

import networkx as nx
import numpy as np

# ═══════════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════════

METRIC_WEIGHTS: dict[str, float] = {
    "pagerank":               0.25,
    "betweenness_centrality": 0.20,
    "closeness_centrality":   0.15,
    "reciprocity":            0.15,
    "edge_diversity":         0.15,
    "clustering_coeff":       0.10,
}
assert abs(sum(METRIC_WEIGHTS.values()) - 1.0) < 1e-9

EDGE_TYPE_BASE_WEIGHT: dict[str, float] = {
    "repaid_loan":     1.0,
    "active_loan":     0.6,
    "defaulted_loan":  -0.5,
    "trust":           0.8,
    "collaboration":   0.7,
    "transaction":     0.3,
}

PAGERANK_ALPHA = 0.85
PAGERANK_CAP = 0.02        # scores above this are normalized to 1.0
BETWEENNESS_CAP = 0.10
CLOSENESS_MIN = 0.01       # below this → 0
EDGE_DIVERSITY_CAP = 5     # max distinct edge types for full score


# ═══════════════════════════════════════════════════════════════════════
# Data Transfer Objects
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class EdgeRecord:
    """One directed edge to add to the trust graph."""
    source: str          # user-id as string
    target: str
    edge_type: str       # key into EDGE_TYPE_BASE_WEIGHT
    weight: float = 1.0  # caller-supplied weight (will be combined with base)
    metadata: dict | None = None


@dataclass
class NodeMetrics:
    node_id: str
    pagerank: float
    betweenness_centrality: float
    closeness_centrality: float
    clustering_coeff: float
    degree_in: int
    degree_out: int
    reciprocity: float
    edge_diversity: float
    community_id: int | None
    reputation_score: float


@dataclass
class GraphComputeResult:
    """Result of a full graph computation run."""
    total_nodes: int
    total_edges: int
    node_metrics: dict[str, NodeMetrics]
    model_version: str = "graph-v1"


# ═══════════════════════════════════════════════════════════════════════
# Reusable Graph Builder
# ═══════════════════════════════════════════════════════════════════════

class GraphBuilder:
    """
    Constructs a weighted networkx DiGraph from heterogeneous edge
    sources.  Designed to be called from any service.

    Usage:
        builder = GraphBuilder()
        builder.add_edges(loan_edges)
        builder.add_edges(trust_edges)
        G = builder.build()
    """

    def __init__(self) -> None:
        self._edges: list[EdgeRecord] = []

    def add_edges(self, edges: Sequence[EdgeRecord]) -> None:
        self._edges.extend(edges)

    def build(self) -> nx.DiGraph:
        G = nx.DiGraph()
        for e in self._edges:
            base_w = EDGE_TYPE_BASE_WEIGHT.get(e.edge_type, 0.3)
            effective_weight = max(e.weight * base_w, 0.01)

            if G.has_edge(e.source, e.target):
                data = G[e.source][e.target]
                data["weight"] += effective_weight
                data["count"] += 1
                data["types"].add(e.edge_type)
            else:
                G.add_edge(
                    e.source, e.target,
                    weight=effective_weight,
                    count=1,
                    types={e.edge_type},
                )
        return G


# ═══════════════════════════════════════════════════════════════════════
# Metric Computations
# ═══════════════════════════════════════════════════════════════════════

class MetricComputer:
    """Computes all per-node metrics from a built DiGraph."""

    def __init__(self, G: nx.DiGraph) -> None:
        self._G = G

    def compute_all(self) -> GraphComputeResult:
        G = self._G
        if G.number_of_nodes() == 0:
            return GraphComputeResult(
                total_nodes=0, total_edges=0, node_metrics={}
            )

        pr = self._pagerank()
        bc = self._betweenness()
        cc = self._closeness()
        clust = self._clustering()
        communities = self._detect_communities()
        recip = self._per_node_reciprocity()
        diversity = self._per_node_edge_diversity()

        metrics: dict[str, NodeMetrics] = {}
        for node in G.nodes:
            nm = NodeMetrics(
                node_id=str(node),
                pagerank=pr.get(node, 0.0),
                betweenness_centrality=bc.get(node, 0.0),
                closeness_centrality=cc.get(node, 0.0),
                clustering_coeff=clust.get(node, 0.0),
                degree_in=G.in_degree(node),
                degree_out=G.out_degree(node),
                reciprocity=recip.get(node, 0.0),
                edge_diversity=diversity.get(node, 0.0),
                community_id=communities.get(node),
                reputation_score=0.0,
            )
            nm.reputation_score = self._reputation_score(nm)
            metrics[str(node)] = nm

        return GraphComputeResult(
            total_nodes=G.number_of_nodes(),
            total_edges=G.number_of_edges(),
            node_metrics=metrics,
        )

    # --- Individual metric methods ---

    def _pagerank(self) -> dict:
        try:
            return nx.pagerank(
                self._G, alpha=PAGERANK_ALPHA, weight="weight"
            )
        except nx.PowerIterationFailedConvergence:
            return nx.pagerank(
                self._G, alpha=PAGERANK_ALPHA, weight="weight", max_iter=500
            )

    def _betweenness(self) -> dict:
        n = self._G.number_of_nodes()
        k = min(n, max(50, int(n * 0.1)))  # sample for scalability
        return nx.betweenness_centrality(
            self._G, k=k, weight="weight", normalized=True
        )

    def _closeness(self) -> dict:
        return nx.closeness_centrality(self._G, wf_improved=True)

    def _clustering(self) -> dict:
        return nx.clustering(self._G, weight="weight")

    def _detect_communities(self) -> dict[str, int]:
        """Louvain on the undirected projection."""
        U = self._G.to_undirected()
        if U.number_of_nodes() == 0:
            return {}
        try:
            partition = nx.community.louvain_communities(U, weight="weight", seed=42)
            mapping: dict[str, int] = {}
            for idx, community in enumerate(partition):
                for node in community:
                    mapping[node] = idx
            return mapping
        except Exception:
            return {}

    def _per_node_reciprocity(self) -> dict[str, float]:
        """
        For each node, fraction of its out-edges that are reciprocated
        (i.e. the target also has an edge back to this node).
        """
        G = self._G
        result: dict[str, float] = {}
        for node in G.nodes:
            out_neighbors = set(G.successors(node))
            if not out_neighbors:
                result[node] = 0.0
                continue
            reciprocated = sum(1 for nb in out_neighbors if G.has_edge(nb, node))
            result[node] = reciprocated / len(out_neighbors)
        return result

    def _per_node_edge_diversity(self) -> dict[str, float]:
        """
        For each node, count how many distinct edge_types it participates
        in (both in and out).  Normalize against EDGE_DIVERSITY_CAP.
        """
        G = self._G
        result: dict[str, float] = {}
        for node in G.nodes:
            types: set[str] = set()
            for _, _, data in G.out_edges(node, data=True):
                types |= data.get("types", set())
            for _, _, data in G.in_edges(node, data=True):
                types |= data.get("types", set())
            result[node] = min(len(types) / EDGE_DIVERSITY_CAP, 1.0)
        return result

    # --- Reputation score ---

    @staticmethod
    def _reputation_score(nm: NodeMetrics) -> float:
        """Weighted combination of normalized metrics → 0-1 reputation."""
        pr_norm = min(nm.pagerank / PAGERANK_CAP, 1.0)
        bc_norm = min(nm.betweenness_centrality / BETWEENNESS_CAP, 1.0)
        cc_norm = (
            min(nm.closeness_centrality / 1.0, 1.0)
            if nm.closeness_centrality > CLOSENESS_MIN else 0.0
        )
        clust_norm = nm.clustering_coeff  # already 0-1

        raw = (
            METRIC_WEIGHTS["pagerank"] * pr_norm
            + METRIC_WEIGHTS["betweenness_centrality"] * bc_norm
            + METRIC_WEIGHTS["closeness_centrality"] * cc_norm
            + METRIC_WEIGHTS["reciprocity"] * nm.reciprocity
            + METRIC_WEIGHTS["edge_diversity"] * nm.edge_diversity
            + METRIC_WEIGHTS["clustering_coeff"] * clust_norm
        )
        return round(float(np.clip(raw, 0.0, 1.0)), 6)


# ═══════════════════════════════════════════════════════════════════════
# Top-level convenience function
# ═══════════════════════════════════════════════════════════════════════

def compute_graph_metrics(edges: Sequence[EdgeRecord]) -> GraphComputeResult:
    """Build graph and compute all metrics in one call."""
    builder = GraphBuilder()
    builder.add_edges(edges)
    G = builder.build()
    return MetricComputer(G).compute_all()
