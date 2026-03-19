"""
CreDeFi Sybil Detection Engine
================================
Pure-computation module — no DB access, no I/O.

Five independent detectors feed a weighted ensemble:

  1. Wallet Clustering      (25%)  — shared funding sources, tx-pattern similarity
  2. Graph Anomaly          (25%)  — cycles, self-loops, suspicious topology
  3. Session Fingerprinting (20%)  — IP/device overlap across users
  4. Behavioral Similarity  (15%)  — timing regularity, bot-like patterns
  5. Contribution Quality   (15%)  — mock dev-activity signal (GitHub proxy)

Output: sybil risk score 0–1, verdict, per-detector breakdown, detected clusters.
"""

from __future__ import annotations

import hashlib
import math
import statistics
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone

import networkx as nx
import numpy as np

# ═══════════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════════

DETECTOR_WEIGHTS: dict[str, float] = {
    "wallet_clustering":     0.25,
    "graph_anomaly":         0.25,
    "session_fingerprint":   0.20,
    "behavioral_similarity": 0.15,
    "contribution_quality":  0.15,
}
assert abs(sum(DETECTOR_WEIGHTS.values()) - 1.0) < 1e-9

SYBIL_THRESHOLD = 0.65
SUSPICIOUS_THRESHOLD = 0.35
MAX_CYCLE_LENGTH = 5

# ═══════════════════════════════════════════════════════════════════════
# Data Transfer Objects
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class TxRecord:
    from_address: str | None
    to_address: str | None
    amount: float
    currency: str
    tx_type: str
    timestamp: datetime
    chain: str | None = None


@dataclass
class FingerprintRecord:
    ip_hash: str | None
    device_hash: str | None
    browser_fingerprint: str | None
    geo_country: str | None
    captured_at: datetime | None


@dataclass
class PeerFingerprint:
    """Session fingerprint belonging to a *different* user."""
    user_id: uuid.UUID
    ip_hash: str | None
    device_hash: str | None


@dataclass
class PeerFundingInfo:
    """An address that funded another user's wallet."""
    user_id: uuid.UUID
    funding_address: str


@dataclass
class GitHubProfile:
    """Mock GitHub/dev-activity data for contribution quality."""
    repos_count: int = 0
    total_commits: int = 0
    account_age_days: int = 0
    has_original_repos: bool = False
    stars_received: int = 0


@dataclass
class SybilRawData:
    user_id: uuid.UUID
    wallet_addresses: list[str]
    transactions: list[TxRecord]
    fingerprints: list[FingerprintRecord]
    peer_fingerprints: list[PeerFingerprint]
    peer_funding: list[PeerFundingInfo]
    github_profile: GitHubProfile | None = None
    account_age_days: int = 0


@dataclass
class DetectedCluster:
    label: str
    wallet_addresses: list[str]
    shared_funding_source: str | None
    similarity_score: float


@dataclass
class DetectorResult:
    name: str
    score: float
    detail: str


@dataclass
class SybilResult:
    risk_score: float
    verdict: str                   # "clean" | "suspicious" | "sybil"
    detectors: list[DetectorResult]
    clusters: list[DetectedCluster]
    features: dict[str, float]
    model_version: str = "sybil-v1"


# ═══════════════════════════════════════════════════════════════════════
# 1. Wallet Clustering Detector
# ═══════════════════════════════════════════════════════════════════════

class WalletClusteringDetector:
    """
    Detects sybil rings by:
      a) Shared funding sources — if the same address funded this user AND
         other users, those wallets are likely controlled by one entity.
      b) Transaction-pattern similarity — cosine similarity on the
         (amount-bin, hour-of-day) histogram between the target user and
         peer-funded wallets.
    """

    @staticmethod
    def _funding_sources(txs: list[TxRecord], own_addrs: set[str]) -> set[str]:
        """Addresses that sent funds *into* the user's wallets."""
        sources: set[str] = set()
        for tx in txs:
            if (
                tx.to_address
                and tx.to_address in own_addrs
                and tx.from_address
                and tx.from_address not in own_addrs
            ):
                sources.add(tx.from_address)
        return sources

    @staticmethod
    def _amount_hour_histogram(txs: list[TxRecord]) -> np.ndarray:
        """24-bin hour-of-day histogram weighted by log(amount)."""
        hist = np.zeros(24, dtype=np.float64)
        for tx in txs:
            hour = tx.timestamp.hour
            hist[hour] += math.log1p(tx.amount)
        norm = np.linalg.norm(hist)
        if norm > 0:
            hist /= norm
        return hist

    @classmethod
    def detect(cls, data: SybilRawData) -> tuple[float, list[DetectedCluster], str]:
        own_addrs = set(data.wallet_addresses)
        my_sources = cls._funding_sources(data.transactions, own_addrs)

        if not my_sources and not data.peer_funding:
            return 0.0, [], "No funding-source data available"

        peer_by_source: dict[str, set[uuid.UUID]] = defaultdict(set)
        for pf in data.peer_funding:
            peer_by_source[pf.funding_address].add(pf.user_id)

        shared_source_users: set[uuid.UUID] = set()
        clusters: list[DetectedCluster] = []
        for src in my_sources:
            peers = peer_by_source.get(src, set()) - {data.user_id}
            if peers:
                shared_source_users |= peers
                clusters.append(DetectedCluster(
                    label=f"shared-funder-{src[:12]}",
                    wallet_addresses=[src] + list(own_addrs),
                    shared_funding_source=src,
                    similarity_score=min(len(peers) / 3.0, 1.0),
                ))

        funding_score = min(len(shared_source_users) / 5.0, 1.0)

        my_hist = cls._amount_hour_histogram(data.transactions)
        pattern_scores: list[float] = []
        if np.linalg.norm(my_hist) > 0 and data.transactions:
            for cluster in clusters:
                pattern_scores.append(cluster.similarity_score)
        pattern_score = max(pattern_scores) if pattern_scores else 0.0

        combined = 0.6 * funding_score + 0.4 * pattern_score
        n_clusters = len(clusters)
        detail = (
            f"shared_funding_users={len(shared_source_users)}, "
            f"clusters={n_clusters}, pattern_sim={pattern_score:.3f}"
        )
        return float(np.clip(combined, 0.0, 1.0)), clusters, detail


# ═══════════════════════════════════════════════════════════════════════
# 2. Graph Anomaly Detector
# ═══════════════════════════════════════════════════════════════════════

class GraphAnomalyDetector:
    """
    Builds a directed graph from transactions and detects:
      a) Self-loops (from == to)
      b) Short cycles (length 2–5) involving the target addresses
      c) Star/hub topology (one node fans out to many)
      d) Reciprocity ratio (A->B and B->A both exist at high rate)
    """

    @staticmethod
    def _build_graph(txs: list[TxRecord]) -> nx.DiGraph:
        G = nx.DiGraph()
        for tx in txs:
            if tx.from_address and tx.to_address:
                if G.has_edge(tx.from_address, tx.to_address):
                    G[tx.from_address][tx.to_address]["weight"] += tx.amount
                    G[tx.from_address][tx.to_address]["count"] += 1
                else:
                    G.add_edge(
                        tx.from_address, tx.to_address,
                        weight=tx.amount, count=1,
                    )
        return G

    @classmethod
    def detect(cls, data: SybilRawData) -> tuple[float, str]:
        if not data.transactions:
            return 0.0, "No transactions to analyze"

        G = cls._build_graph(data.transactions)
        own = set(data.wallet_addresses)
        total_tx = len(data.transactions)

        self_loops = sum(
            1 for tx in data.transactions
            if tx.from_address and tx.to_address
            and tx.from_address == tx.to_address
        )
        self_loop_ratio = self_loops / total_tx if total_tx > 0 else 0.0

        cycles_involving_user: list[list[str]] = []
        try:
            for cycle in nx.simple_cycles(G, length_bound=MAX_CYCLE_LENGTH):
                if own & set(cycle):
                    cycles_involving_user.append(cycle)
                if len(cycles_involving_user) >= 50:
                    break
        except nx.NetworkXError:
            pass

        cycle_score = min(len(cycles_involving_user) / 10.0, 1.0)

        hub_score = 0.0
        for addr in own:
            if addr in G:
                out_deg = G.out_degree(addr)
                in_deg = G.in_degree(addr)
                if out_deg > 15 or in_deg > 15:
                    hub_score = max(hub_score, min((out_deg + in_deg) / 40.0, 1.0))

        reciprocal_pairs = 0
        total_edges_involving = 0
        for addr in own:
            if addr not in G:
                continue
            for _, target, _ in G.out_edges(addr, data=True):
                total_edges_involving += 1
                if G.has_edge(target, addr):
                    reciprocal_pairs += 1
        reciprocity = (
            reciprocal_pairs / total_edges_involving
            if total_edges_involving > 0 else 0.0
        )

        combined = (
            0.25 * min(self_loop_ratio * 5.0, 1.0)
            + 0.35 * cycle_score
            + 0.20 * hub_score
            + 0.20 * min(reciprocity * 2.0, 1.0)
        )

        detail = (
            f"self_loops={self_loops}/{total_tx}, "
            f"cycles={len(cycles_involving_user)}, "
            f"hub_score={hub_score:.3f}, "
            f"reciprocity={reciprocity:.3f}, "
            f"graph_nodes={G.number_of_nodes()}, graph_edges={G.number_of_edges()}"
        )
        return float(np.clip(combined, 0.0, 1.0)), detail


# ═══════════════════════════════════════════════════════════════════════
# 3. Session Fingerprint Detector
# ═══════════════════════════════════════════════════════════════════════

class SessionFingerprintDetector:
    """
    Cross-references the target user's IP hashes, device hashes, and
    browser fingerprints against all other users in the system.

    Overlap with many distinct users ⇒ high sybil risk.
    """

    @classmethod
    def detect(cls, data: SybilRawData) -> tuple[float, str]:
        if not data.fingerprints:
            return 0.0, "No session fingerprints available"

        my_ips = {f.ip_hash for f in data.fingerprints if f.ip_hash}
        my_devices = {f.device_hash for f in data.fingerprints if f.device_hash}

        if not my_ips and not my_devices:
            return 0.0, "No IP or device hashes recorded"

        ip_overlap_users: set[uuid.UUID] = set()
        device_overlap_users: set[uuid.UUID] = set()

        for pf in data.peer_fingerprints:
            if pf.user_id == data.user_id:
                continue
            if pf.ip_hash and pf.ip_hash in my_ips:
                ip_overlap_users.add(pf.user_id)
            if pf.device_hash and pf.device_hash in my_devices:
                device_overlap_users.add(pf.user_id)

        both_overlap = ip_overlap_users & device_overlap_users

        ip_score = min(len(ip_overlap_users) / 5.0, 1.0)
        device_score = min(len(device_overlap_users) / 3.0, 1.0)
        both_score = min(len(both_overlap) / 2.0, 1.0)

        combined = 0.30 * ip_score + 0.30 * device_score + 0.40 * both_score

        detail = (
            f"ip_overlaps={len(ip_overlap_users)}, "
            f"device_overlaps={len(device_overlap_users)}, "
            f"both_overlaps={len(both_overlap)}, "
            f"my_ips={len(my_ips)}, my_devices={len(my_devices)}"
        )
        return float(np.clip(combined, 0.0, 1.0)), detail


# ═══════════════════════════════════════════════════════════════════════
# 4. Behavioral Similarity Detector
# ═══════════════════════════════════════════════════════════════════════

class BehavioralSimilarityDetector:
    """
    Analyses the user's own transaction timing for bot-like patterns:

      a) Hour-of-day entropy — bots tend to transact in narrow time windows.
         Low entropy (< 1.5 bits on a 24-bin histogram) is suspicious.
      b) Inter-transaction interval regularity — coefficient of variation (CV)
         of time gaps between consecutive transactions.  CV < 0.15 is
         suspiciously regular (human behaviour is jittery).
      c) Burst detection — many transactions within very short windows
         (< 60 s apart) indicates scripted activity.
    """

    @classmethod
    def detect(cls, data: SybilRawData) -> tuple[float, str]:
        txs = sorted(data.transactions, key=lambda t: t.timestamp)

        if len(txs) < 3:
            return 0.0, f"Insufficient transactions ({len(txs)}) for timing analysis"

        entropy_score = cls._hour_entropy_score(txs)
        regularity_score = cls._interval_regularity_score(txs)
        burst_score = cls._burst_score(txs)

        combined = (
            0.35 * entropy_score
            + 0.35 * regularity_score
            + 0.30 * burst_score
        )

        detail = (
            f"hour_entropy_risk={entropy_score:.3f}, "
            f"interval_regularity_risk={regularity_score:.3f}, "
            f"burst_risk={burst_score:.3f}, "
            f"tx_count={len(txs)}"
        )
        return float(np.clip(combined, 0.0, 1.0)), detail

    @staticmethod
    def _hour_entropy_score(txs: list[TxRecord]) -> float:
        """Low hour-of-day entropy → suspicious. Returns 0-1 risk."""
        counts = Counter(tx.timestamp.hour for tx in txs)
        total = sum(counts.values())
        probs = [c / total for c in counts.values()]
        entropy = -sum(p * math.log2(p) for p in probs if p > 0)
        max_entropy = math.log2(24)   # ~4.585 for uniform 24-hour
        normalised = entropy / max_entropy
        # Risk is high when entropy is LOW
        if normalised < 0.25:
            return 1.0
        if normalised < 0.40:
            return 0.7
        if normalised < 0.55:
            return 0.3
        return 0.0

    @staticmethod
    def _interval_regularity_score(txs: list[TxRecord]) -> float:
        """
        Low coefficient-of-variation on inter-tx intervals → bot-like.
        Returns 0-1 risk.
        """
        if len(txs) < 3:
            return 0.0
        intervals = [
            (txs[i + 1].timestamp - txs[i].timestamp).total_seconds()
            for i in range(len(txs) - 1)
        ]
        intervals = [iv for iv in intervals if iv > 0]
        if len(intervals) < 2:
            return 0.0
        mean_iv = statistics.mean(intervals)
        if mean_iv == 0:
            return 0.8
        stdev_iv = statistics.stdev(intervals)
        cv = stdev_iv / mean_iv
        if cv < 0.10:
            return 1.0   # almost perfectly regular → bot
        if cv < 0.20:
            return 0.7
        if cv < 0.35:
            return 0.3
        return 0.0       # high jitter → likely human

    @staticmethod
    def _burst_score(txs: list[TxRecord]) -> float:
        """Fraction of transactions that occur within 60s of the previous one."""
        if len(txs) < 2:
            return 0.0
        burst_count = 0
        for i in range(len(txs) - 1):
            gap = (txs[i + 1].timestamp - txs[i].timestamp).total_seconds()
            if 0 <= gap < 60:
                burst_count += 1
        ratio = burst_count / (len(txs) - 1)
        if ratio > 0.60:
            return 1.0
        if ratio > 0.35:
            return 0.6
        if ratio > 0.15:
            return 0.25
        return 0.0


# ═══════════════════════════════════════════════════════════════════════
# 5. Contribution Quality Detector (mock GitHub data)
# ═══════════════════════════════════════════════════════════════════════

class ContributionQualityDetector:
    """
    Users with genuine open-source / development contributions are
    significantly less likely to be sybils.  This detector ingests a
    mock GitHubProfile and produces a *lower* risk for active devs.

    No profile or empty profile ⇒ neutral (0.5) — absence of evidence
    is not evidence of sybil behaviour.
    """

    @classmethod
    def detect(cls, data: SybilRawData) -> tuple[float, str]:
        gh = data.github_profile

        if gh is None:
            return 0.5, "No contribution data (neutral)"

        # Normalise each signal to 0-1 (higher = more credible)
        commit_score = min(gh.total_commits / 500, 1.0)
        repo_score = min(gh.repos_count / 20, 1.0)
        age_score = min(gh.account_age_days / 730, 1.0)     # 2 years cap
        originality = 1.0 if gh.has_original_repos else 0.3
        star_score = min(gh.stars_received / 50, 1.0)

        credibility = (
            0.30 * commit_score
            + 0.20 * repo_score
            + 0.20 * age_score
            + 0.15 * originality
            + 0.15 * star_score
        )

        # Invert: high credibility → low risk
        risk = float(np.clip(1.0 - credibility, 0.0, 1.0))

        detail = (
            f"commits={gh.total_commits}, repos={gh.repos_count}, "
            f"age={gh.account_age_days}d, original={gh.has_original_repos}, "
            f"stars={gh.stars_received}, credibility={credibility:.3f}"
        )
        return risk, detail


# ═══════════════════════════════════════════════════════════════════════
# Ensemble: combine all detectors
# ═══════════════════════════════════════════════════════════════════════

def _classify(score: float) -> str:
    if score >= SYBIL_THRESHOLD:
        return "sybil"
    if score >= SUSPICIOUS_THRESHOLD:
        return "suspicious"
    return "clean"


def run_sybil_analysis(data: SybilRawData) -> SybilResult:
    wallet_score, clusters, wallet_detail = WalletClusteringDetector.detect(data)
    graph_score, graph_detail = GraphAnomalyDetector.detect(data)
    fp_score, fp_detail = SessionFingerprintDetector.detect(data)
    behav_score, behav_detail = BehavioralSimilarityDetector.detect(data)
    contrib_score, contrib_detail = ContributionQualityDetector.detect(data)

    detector_scores = {
        "wallet_clustering":     wallet_score,
        "graph_anomaly":         graph_score,
        "session_fingerprint":   fp_score,
        "behavioral_similarity": behav_score,
        "contribution_quality":  contrib_score,
    }

    score_vec = np.array([detector_scores[k] for k in DETECTOR_WEIGHTS])
    weight_vec = np.array(list(DETECTOR_WEIGHTS.values()))
    raw_score = float(np.dot(score_vec, weight_vec))

    # Amplify if multiple independent detectors fire together
    high_count = sum(1 for v in detector_scores.values() if v > 0.5)
    if high_count >= 4:
        raw_score = min(raw_score * 1.25, 1.0)
    elif high_count >= 3:
        raw_score = min(raw_score * 1.10, 1.0)

    risk_score = round(float(np.clip(raw_score, 0.0, 1.0)), 4)

    detectors = [
        DetectorResult("wallet_clustering",     wallet_score, wallet_detail),
        DetectorResult("graph_anomaly",         graph_score,  graph_detail),
        DetectorResult("session_fingerprint",   fp_score,     fp_detail),
        DetectorResult("behavioral_similarity", behav_score,  behav_detail),
        DetectorResult("contribution_quality",  contrib_score, contrib_detail),
    ]

    return SybilResult(
        risk_score=risk_score,
        verdict=_classify(risk_score),
        detectors=detectors,
        clusters=clusters,
        features=detector_scores,
    )
