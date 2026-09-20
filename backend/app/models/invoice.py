from sqlalchemy import (
    Column, Integer, String, Numeric, DateTime, Text, ForeignKey, Date
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.session import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(30), unique=True, nullable=False, index=True)
    admission_id = Column(Integer, ForeignKey("admissions.id"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)

    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0)
    balance = Column(Numeric(12, 2), nullable=False, default=0)

    status = Column(String(20), nullable=False, default="unpaid", index=True)
    # unpaid | partially_paid | paid | overpaid | cancelled

    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    items = relationship(
        "InvoiceItem", back_populates="invoice",
        cascade="all, delete-orphan", lazy="selectin"
    )
    admission = relationship("Admission", backref="invoices")
    patient = relationship("Patient", backref="invoices")

    def __repr__(self):
        return f"<Invoice {self.invoice_number} total={self.total_amount} paid={self.amount_paid} status={self.status}>"

    account_reference = Column(String(5), unique=True, nullable=False, index=True)
# 5-character code used as the M-Pesa account number for Equity Paybill


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    description = Column(String(200), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, default=1)
    unit_price = Column(Numeric(12, 2), nullable=False, default=0)
    amount = Column(Numeric(12, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("Invoice", back_populates="items")

    def __repr__(self):
        return f"<InvoiceItem {self.description} qty={self.quantity} x {self.unit_price} = {self.amount}>"