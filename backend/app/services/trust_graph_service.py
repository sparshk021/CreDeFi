"""
Trust Graph Service
====================
Orchestrates: DB reads  →  graph build  →  metric compute  →  DB persist.

Supports two modes:
  • Single-user: compute & persist metrics for one user within the
    full system graph.
  • Full recompute: rebuild the whole graph, recompute every node,
    and bulk-persist.  Designed to run as a periodic job.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.enums import LoanStatus
from app.models.graph import GraphFeatureVector, TrustGraphEdge
from app.models.loan import LoanContract, LoanRequest
from app.models.user import User
from app.services.trust_graph_engine import (
    EdgeRecord,
    GraphBuilder,
    GraphComputeResult,
    MetricComputer,
    NodeMetrics,
    compute_graph_metrics,
)

logger = get_logger(__name__)

# Maps LoanContract.status → edge_type for the graph
_LOAN_STATUS_EDGE: dict[LoanStatus, str] = {
    LoanStatus.REPAID:     "repaid_loan",
    LoanStatus.ACTIVE:     "active_loan",
    LoanStatus.DEFAULTED:  "defaulted_loan",
    LoanStatus.LIQUIDATED: "defaulted_loan",
}


class TrustGraphService:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    # ─── public API ───────────────────────────────────────────────

    async def compute_for_user(
        self, user_id: uuid.UUID
    ) -> tuple[NodeMetrics, GraphComputeResult]:
        """
        Rebuild the full system graph, compute metrics for *every* node,
        persist all, and return (target_node, full_result).
        """
        user = await self._s.scalar(select(User).where(User.id == user_id))
        if not user:
            raise ValueError(f"User {user_id} not found")

        result = await self._build_and_compute()
        uid_str = str(user_id)

        if uid_str not in result.node_metrics:
            nm = NodeMetrics(
                node_id=uid_str,
                pagerank=0.0,
                betweenness_centrality=0.0,
                closeness_centrality=0.0,
                clustering_coeff=0.0,
                degree_in=0,
                degree_out=0,
                reciprocity=0.0,
                edge_diversity=0.0,
                community_id=None,
                reputation_score=0.0,
            )
            result.node_metrics[uid_str] = nm

        await self._persist_all(result)
        target = result.node_metrics[uid_str]
        logger.info(
            "Graph computed: user=%s reputation=%.4f nodes=%d edges=%d",
            user_id, target.reputation_score, result.total_nodes, result.total_edges,
        )
        return target, result

    async def recompute_all(self) -> GraphComputeResult:
        """Full recompute for every node in the system. Returns summary."""
        result = await self._build_and_compute()
        await self._persist_all(result)
        logger.info(
            "Full graph recompute: nodes=%d edges=%d",
            result.total_nodes, result.total_edges,
        )
        return result

    # ─── graph construction ───────────────────────────────────────

    async def _build_and_compute(self) -> GraphComputeResult:
        builder = GraphBuilder()
        builder.add_edges(await self._loan_edges())
        builder.add_edges(await self._trust_edges())
        G = builder.build()
        return MetricComputer(G).compute_all()

    async def _loan_edges(self) -> list[EdgeRecord]:
        """
        Create directed edges from borrower→lender for every loan contract
        that has a lender assigned.  Edge type and weight depend on the
        contract outcome.
        """
        rows = (await self._s.execute(
            select(LoanRequest.borrower_id, LoanContract.lender_id, LoanContract.status)
            .join(LoanContract, LoanContract.loan_request_id == LoanRequest.id)
            .where(LoanContract.lender_id.isnot(None))
        )).all()

        edges: list[EdgeRecord] = []
        for borrower_id, lender_id, status in rows:
            edge_type = _LOAN_STATUS_EDGE.get(status)
            if edge_type is None:
                continue
            edges.append(EdgeRecord(
                source=str(borrower_id),
                target=str(lender_id),
                edge_type=edge_type,
                weight=1.0,
            ))
            # Lender also has an implicit connection back
            edges.append(EdgeRecord(
                source=str(lender_id),
                target=str(borrower_id),
                edge_type=edge_type,
                weight=0.5,
            ))
        return edges

    async def _trust_edges(self) -> list[EdgeRecord]:
        """Read explicit trust / collaboration edges from trust_graph_edges table."""
        rows = (await self._s.scalars(select(TrustGraphEdge))).all()
        return [
            EdgeRecord(
                source=str(r.source_user_id),
                target=str(r.target_user_id),
                edge_type=r.edge_type,
                weight=r.weight,
            )
            for r in rows
        ]

    # ─── persistence ──────────────────────────────────────────────

    async def _persist_all(self, result: GraphComputeResult) -> None:
        for uid_str, nm in result.node_metrics.items():
            try:
                uid = uuid.UUID(uid_str)
            except ValueError:
                continue

            record = GraphFeatureVector(
                user_id=uid,
                pagerank=nm.pagerank,
                betweenness_centrality=nm.betweenness_centrality,
                closeness_centrality=nm.closeness_centrality,
                degree_in=nm.degree_in,
                degree_out=nm.degree_out,
                clustering_coeff=nm.clustering_coeff,
                community_id=nm.community_id,
                model_version=result.model_version,
            )
            self._s.add(record)
        await self._s.flush()
