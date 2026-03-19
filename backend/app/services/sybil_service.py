"""
Sybil Detection Service
========================
Orchestrates: DB reads  →  engine analysis  →  DB persistence.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.enums import SybilVerdict
from app.models.loan import LoanContract, LoanRequest, Transaction
from app.models.sybil import SessionFingerprint, SybilAnalysis, WalletCluster
from app.models.user import User
from app.services.sybil_detection_engine import (
    DetectedCluster,
    FingerprintRecord,
    GitHubProfile,
    PeerFingerprint,
    PeerFundingInfo,
    SybilRawData,
    SybilResult,
    TxRecord,
    run_sybil_analysis,
)

logger = get_logger(__name__)


class SybilService:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    # ─── public API ───────────────────────────────────────────────

    async def analyze_user(self, user_id: uuid.UUID) -> SybilResult:
        raw = await self._gather(user_id)
        result = run_sybil_analysis(raw)
        await self._persist(user_id, result)
        logger.info(
            "Sybil analysis: user=%s score=%.4f verdict=%s",
            user_id, result.risk_score, result.verdict,
        )
        return result

    # ─── data gathering ───────────────────────────────────────────

    async def _gather(self, user_id: uuid.UUID) -> SybilRawData:
        user = await self._s.scalar(select(User).where(User.id == user_id))
        if not user:
            raise ValueError(f"User {user_id} not found")

        wallet_addresses = self._collect_addresses(user)
        transactions = await self._fetch_transactions(user_id)
        fingerprints = await self._fetch_fingerprints(user_id)
        peer_fps = await self._fetch_peer_fingerprints(user_id)
        peer_funding = await self._fetch_peer_funding(user_id, wallet_addresses)
        github = await self._fetch_github_profile(user_id)
        age_days = (datetime.now(timezone.utc) - user.created_at).days

        return SybilRawData(
            user_id=user_id,
            wallet_addresses=wallet_addresses,
            transactions=transactions,
            fingerprints=fingerprints,
            peer_fingerprints=peer_fps,
            peer_funding=peer_funding,
            github_profile=github,
            account_age_days=age_days,
        )

    @staticmethod
    def _collect_addresses(user: User) -> list[str]:
        addrs: list[str] = []
        if user.wallet_address:
            addrs.append(user.wallet_address)
        for acct in user.connected_accounts:
            if acct.provider.value in ("metamask", "phantom"):
                addrs.append(acct.account_identifier)
        return addrs

    async def _fetch_transactions(self, uid: uuid.UUID) -> list[TxRecord]:
        contract_ids_q = (
            select(LoanContract.id)
            .join(LoanRequest, LoanContract.loan_request_id == LoanRequest.id)
            .where(LoanRequest.borrower_id == uid)
        )

        lender_contract_ids_q = (
            select(LoanContract.id)
            .where(LoanContract.lender_id == uid)
        )

        from sqlalchemy import union_all
        combined = union_all(contract_ids_q, lender_contract_ids_q).subquery()

        rows = (await self._s.scalars(
            select(Transaction).where(
                Transaction.contract_id.in_(select(combined))
            )
        )).all()

        return [
            TxRecord(
                from_address=tx.from_address,
                to_address=tx.to_address,
                amount=float(tx.amount),
                currency=tx.currency,
                tx_type=tx.tx_type.value,
                timestamp=tx.created_at,
                chain=tx.chain,
            )
            for tx in rows
        ]

    async def _fetch_fingerprints(self, uid: uuid.UUID) -> list[FingerprintRecord]:
        analyses = (await self._s.scalars(
            select(SybilAnalysis).where(SybilAnalysis.user_id == uid)
        )).all()

        records: list[FingerprintRecord] = []
        for analysis in analyses:
            for fp in analysis.fingerprints:
                records.append(FingerprintRecord(
                    ip_hash=fp.ip_hash,
                    device_hash=fp.device_hash,
                    browser_fingerprint=fp.browser_fingerprint,
                    geo_country=fp.geo_country,
                    captured_at=fp.captured_at,
                ))
        return records

    async def _fetch_peer_fingerprints(self, uid: uuid.UUID) -> list[PeerFingerprint]:
        """Fetch fingerprints from ALL other users for cross-referencing."""
        rows = (await self._s.execute(
            select(
                SybilAnalysis.user_id,
                SessionFingerprint.ip_hash,
                SessionFingerprint.device_hash,
            )
            .join(SessionFingerprint, SessionFingerprint.analysis_id == SybilAnalysis.id)
            .where(SybilAnalysis.user_id != uid)
        )).all()

        return [
            PeerFingerprint(user_id=r[0], ip_hash=r[1], device_hash=r[2])
            for r in rows
        ]

    async def _fetch_peer_funding(
        self, uid: uuid.UUID, own_addrs: list[str]
    ) -> list[PeerFundingInfo]:
        """
        Find addresses that funded OTHER users' wallets.
        If any of those addresses also funded the target user, that's a
        shared-funder cluster signal.
        """
        other_contract_ids_q = (
            select(LoanContract.id)
            .join(LoanRequest, LoanContract.loan_request_id == LoanRequest.id)
            .where(LoanRequest.borrower_id != uid)
        )

        rows = (await self._s.execute(
            select(
                LoanRequest.borrower_id,
                Transaction.from_address,
            )
            .join(LoanContract, LoanContract.loan_request_id == LoanRequest.id)
            .join(Transaction, Transaction.contract_id == LoanContract.id)
            .where(
                LoanRequest.borrower_id != uid,
                Transaction.from_address.isnot(None),
            )
        )).all()

        return [
            PeerFundingInfo(user_id=r[0], funding_address=r[1])
            for r in rows
        ]

    async def _fetch_github_profile(
        self, uid: uuid.UUID
    ) -> GitHubProfile | None:
        """
        Placeholder: in production this would call a GitHub API integration
        or read from a cached contribution_profiles table.
        Returns None when no data is available, letting the engine assign
        a neutral score.
        """
        return None

    # ─── persistence ──────────────────────────────────────────────

    async def _persist(self, uid: uuid.UUID, result: SybilResult) -> SybilAnalysis:
        verdict_map = {
            "clean": SybilVerdict.CLEAN,
            "suspicious": SybilVerdict.SUSPICIOUS,
            "sybil": SybilVerdict.SYBIL,
        }

        explanation_lines = [
            f"Sybil risk: {result.risk_score:.4f} ({result.verdict})",
            f"Model: {result.model_version}",
            "",
        ]
        for d in result.detectors:
            explanation_lines.append(f"[{d.name}] score={d.score:.3f} — {d.detail}")

        analysis = SybilAnalysis(
            user_id=uid,
            verdict=verdict_map[result.verdict],
            confidence=result.risk_score,
            model_version=result.model_version,
            features_json=result.features,
            explanation="\n".join(explanation_lines),
            analyzed_at=datetime.now(timezone.utc),
        )
        self._s.add(analysis)
        await self._s.flush()

        for cluster in result.clusters:
            wc = WalletCluster(
                analysis_id=analysis.id,
                cluster_label=cluster.label,
                wallet_addresses=cluster.wallet_addresses,
                shared_funding_source=cluster.shared_funding_source,
                similarity_score=cluster.similarity_score,
                num_wallets=len(cluster.wallet_addresses),
            )
            self._s.add(wc)

        await self._s.flush()
        return analysis
