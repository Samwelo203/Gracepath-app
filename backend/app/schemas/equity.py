from decimal import Decimal

from pydantic import BaseModel, Field


class EquityPushRequest(BaseModel):
    invoice_number: str = Field(..., min_length=5, max_length=30)
    phone: str = Field(..., min_length=9, max_length=15)
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)