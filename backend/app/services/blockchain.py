"""
Blockchain Abstraction Layer
=============================
Mock implementation.  Every public method returns the same shape a real
chain adapter would.  Swap this module for a real provider (ethers /
solana-py / web3.py) when ready — callers don't change.
"""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class ChainTxReceipt:
    tx_hash: str
    chain: str
    from_address: str
    to_address: str
    amount: float
    currency: str
    block_number: int
    confirmed_at: datetime
    success: bool


def _mock_hash() -> str:
    return "0x" + hashlib.sha256(uuid.uuid4().bytes).hexdigest()


def _mock_block() -> int:
    return 19_000_000 + int(uuid.uuid4().int % 100_000)


class BlockchainClient:
    """
    Stateless mock.  In production, __init__ would receive an RPC URL /
    signer / etc.
    """

    async def lock_collateral(
        self,
        borrower_address: str,
        escrow_address: str,
        amount: float,
        currency: str,
        chain: str = "ethereum",
    ) -> ChainTxReceipt:
        logger.info(
            "MOCK lock_collateral: %s -> %s  %s %s on %s",
            borrower_address, escrow_address, amount, currency, chain,
        )
        return ChainTxReceipt(
            tx_hash=_mock_hash(),
            chain=chain,
            from_address=borrower_address,
            to_address=escrow_address,
            amount=amount,
            currency=currency,
            block_number=_mock_block(),
            confirmed_at=datetime.now(timezone.utc),
            success=True,
        )

    async def disburse(
        self,
        escrow_address: str,
        borrower_address: str,
        amount: float,
        currency: str,
        chain: str = "ethereum",
    ) -> ChainTxReceipt:
        logger.info(
            "MOCK disburse: %s -> %s  %s %s on %s",
            escrow_address, borrower_address, amount, currency, chain,
        )
        return ChainTxReceipt(
            tx_hash=_mock_hash(),
            chain=chain,
            from_address=escrow_address,
            to_address=borrower_address,
            amount=amount,
            currency=currency,
            block_number=_mock_block(),
            confirmed_at=datetime.now(timezone.utc),
            success=True,
        )

    async def record_repayment(
        self,
        borrower_address: str,
        escrow_address: str,
        amount: float,
        currency: str,
        chain: str = "ethereum",
    ) -> ChainTxReceipt:
        logger.info(
            "MOCK record_repayment: %s -> %s  %s %s on %s",
            borrower_address, escrow_address, amount, currency, chain,
        )
        return ChainTxReceipt(
            tx_hash=_mock_hash(),
            chain=chain,
            from_address=borrower_address,
            to_address=escrow_address,
            amount=amount,
            currency=currency,
            block_number=_mock_block(),
            confirmed_at=datetime.now(timezone.utc),
            success=True,
        )

    async def release_collateral(
        self,
        escrow_address: str,
        borrower_address: str,
        amount: float,
        currency: str,
        chain: str = "ethereum",
    ) -> ChainTxReceipt:
        logger.info(
            "MOCK release_collateral: %s -> %s  %s %s on %s",
            escrow_address, borrower_address, amount, currency, chain,
        )
        return ChainTxReceipt(
            tx_hash=_mock_hash(),
            chain=chain,
            from_address=escrow_address,
            to_address=borrower_address,
            amount=amount,
            currency=currency,
            block_number=_mock_block(),
            confirmed_at=datetime.now(timezone.utc),
            success=True,
        )


# Singleton — replace with DI / provider pattern in production
blockchain_client = BlockchainClient()
