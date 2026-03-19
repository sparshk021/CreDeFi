import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import SybilVerdict


# ---------- Request ----------

class SybilAnalyzeRequest(BaseModel):
    user_id: uuid.UUID


# ---------- Detector detail ----------

class DetectorDetail(BaseModel):
    name: str
    score: float
    detail: str


# ---------- Cluster ----------

class ClusterDetail(BaseModel):
    label: str
    wallet_addresses: list[str]
    shared_funding_source: str | None
    similarity_score: float


# ---------- Full analysis response ----------

class SybilAnalyzeResponse(BaseModel):
    risk_score: float
    verdict: str
    detectors: list[DetectorDetail]
    clusters: list[ClusterDetail]
    features: dict[str, float]
    model_version: str


# ---------- DB-backed responses ----------

class SybilAnalysisResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    verdict: SybilVerdict
    confidence: float
    model_version: str
    explanation: str | None
    features_json: dict | None
    analyzed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class WalletClusterResponse(BaseModel):
    id: uuid.UUID
    analysis_id: uuid.UUID
    cluster_label: str
    wallet_addresses: list[str]
    shared_funding_source: str | None
    similarity_score: float
    num_wallets: int
    metadata_json: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionFingerprintResponse(BaseModel):
    id: uuid.UUID
    analysis_id: uuid.UUID
    ip_hash: str | None
    device_hash: str | None
    browser_fingerprint: str | None
    geo_country: str | None
    geo_region: str | None
    captured_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SybilAnalysisDetail(SybilAnalysisResponse):
    clusters: list[WalletClusterResponse] = []
    fingerprints: list[SessionFingerprintResponse] = []
