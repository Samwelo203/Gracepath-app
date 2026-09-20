from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from datetime import datetime, date
from typing import Optional, List


class InvoiceItemCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=200)
    quantity: Decimal = Field(1, ge=0)
    unit_price: Decimal = Field(..., ge=0)


class InvoiceItemRead(BaseModel):
    id: int
    description: str
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvoiceRead(BaseModel):
    id: int
    invoice_number: str
    account_reference: str
    admission_id: int
    patient_id: int
    subtotal: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    balance: Decimal
    status: str
    issued_at: datetime
    due_date: Optional[date] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceDetail(InvoiceRead):
    items: List[InvoiceItemRead] = []
    patient_number: Optional[str] = None
    patient_name: Optional[str] = None
    admission_number: Optional[str] = None


class InvoiceFromAdmission(BaseModel):
    admission_id: int
    notes: Optional[str] = None


class ManualCharge(BaseModel):
    description: str
    quantity: Decimal = Field(1, ge=0)
    unit_price: Decimal = Field(..., ge=0)


class PublicInvoiceView(BaseModel):
    """What a payer sees on the payment page — no internal IDs."""
    invoice_number: str
    account_reference: str
    patient_name: str
    patient_number: str
    total_amount: Decimal
    amount_paid: Decimal
    balance: Decimal
    status: str
    items: List[InvoiceItemRead]