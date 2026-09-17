from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from datetime import datetime
from typing import Optional


class STKPushRequest(BaseModel):
    invoice_number: str = Field(..., min_length=5, max_length=30)
    phone: str = Field(
        ..., min_length=9, max_length=15,
        description="Kenyan MSISDN, e.g. 254712345678",
    )
    amount: Optional[Decimal] = Field(
        None, gt=0,
        description="Optional. Defaults to invoice balance.",
    )
    account_reference: Optional[str] = None


class STKPushResponse(BaseModel):
    checkout_request_id: Optional[str] = None
    merchant_request_id: Optional[str] = None
    customer_message: Optional[str] = None
    simulation: bool = False
    raw: Optional[dict] = None


class MpesaTransactionRead(BaseModel):
    id: int
    transaction_id: str
    invoice_id: Optional[int] = None
    invoice_number: Optional[str] = None
    amount: Decimal
    payer_name: Optional[str] = None
    payer_phone: Optional[str] = None
    account_reference: Optional[str] = None
    result_code: Optional[str] = None
    result_desc: Optional[str] = None
    status: str
    received_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SimulationCallback(BaseModel):
    """Convenience endpoint to test callbacks without Safaricom."""
    invoice_number: str
    amount: Decimal = Field(..., gt=0)
    mpesa_receipt: str = Field(..., min_length=6)
    payer_name: str = "Test Payer"
    payer_phone: str = "254700000000"