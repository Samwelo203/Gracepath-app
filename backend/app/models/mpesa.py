from sqlalchemy import (
    Column, Integer, String, Numeric, DateTime, ForeignKey, JSON
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.session import Base


class MpesaTransaction(Base):
    __tablename__ = "mpesa_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(64), unique=True, nullable=False, index=True)
    # M-Pesa receipt number, e.g. "QWE123XYZ"

    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True, index=True)
    invoice_number = Column(String(30), nullable=True, index=True)

    amount = Column(Numeric(12, 2), nullable=False, default=0)
    payer_name = Column(String(150), nullable=True)
    payer_phone = Column(String(20), nullable=True)
    account_reference = Column(String(50), nullable=True, index=True)

    result_code = Column(String(10), nullable=True)
    result_desc = Column(String(200), nullable=True)
    status = Column(String(30), nullable=False, default="pending", index=True)
    # pending | success | failed | unmatched

    raw_payload = Column(JSON, nullable=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("Invoice", backref="mpesa_transactions")

    def __repr__(self):
        return f"<MpesaTransaction {self.transaction_id} {self.amount} {self.status}>"