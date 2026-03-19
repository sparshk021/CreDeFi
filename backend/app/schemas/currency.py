import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ---------- ExchangeRate ----------

class ExchangeRateResponse(BaseModel):
    id: uuid.UUID
    base_currency: str
    quote_currency: str
    rate: float
    source: str
    fetched_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- CurrencyConfig ----------

class CurrencyConfigCreate(BaseModel):
    code: str = Field(max_length=10)
    name: str = Field(max_length=100)
    symbol: str = Field(max_length=10)
    decimals: int = Field(default=2, ge=0)
    is_fiat: bool = True
    is_enabled: bool = True
    chain: str | None = None
    contract_address: str | None = None
    min_loan_amount: float | None = None
    max_loan_amount: float | None = None


class CurrencyConfigResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    symbol: str
    decimals: int
    is_fiat: bool
    is_enabled: bool
    chain: str | None
    contract_address: str | None
    min_loan_amount: float | None
    max_loan_amount: float | None
    created_at: datetime

    model_config = {"from_attributes": True}
