import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import AccountProvider, IncomeFrequency, RiskTier


# ---------- ConnectedAccount ----------

class ConnectedAccountCreate(BaseModel):
    provider: AccountProvider
    account_identifier: str = Field(max_length=256)
    metadata_json: dict | None = None


class ConnectedAccountResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    provider: AccountProvider
    account_identifier: str
    is_verified: bool
    metadata_json: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- IncomeSource ----------

class IncomeSourceCreate(BaseModel):
    source_name: str = Field(max_length=200)
    frequency: IncomeFrequency
    currency: str = Field(default="USD", max_length=10)
    monthly_amount: float = Field(gt=0)
    verification_source: str | None = None


class IncomeSourceResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    source_name: str
    frequency: IncomeFrequency
    currency: str
    monthly_amount: float
    is_verified: bool
    verification_source: str | None
    last_verified_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- TrustScore ----------

class TrustScoreResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    score: float
    risk_tier: RiskTier
    repayment_component: float
    identity_component: float
    social_component: float
    income_component: float
    model_version: str
    explanation: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
