from sqlalchemy.orm import Session
from fastapi import HTTPException
from decimal import Decimal
from typing import Optional
import uuid

from app.models.mpesa import MpesaTransaction
from app.models.invoice import Invoice
from app.services import billing_service


# ---------- Lookups ----------
def get_transaction(db: Session, tx_id: int) -> MpesaTransaction:
    tx = db.query(MpesaTransaction).filter(MpesaTransaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404, f"Transaction {tx_id} not found")
    return tx


def get_transaction_by_receipt(db: Session, receipt: str) -> Optional[MpesaTransaction]:
    return (
        db.query(MpesaTransaction)
        .filter(MpesaTransaction.transaction_id == receipt)
        .first()
    )


def list_transactions(
    db: Session, status_filter: Optional[str] = None,
    invoice_id: Optional[int] = None, skip: int = 0, limit: int = 200,
):
    q = db.query(MpesaTransaction)
    if status_filter:
        q = q.filter(MpesaTransaction.status == status_filter)
    if invoice_id:
        q = q.filter(MpesaTransaction.invoice_id == invoice_id)
    return q.order_by(MpesaTransaction.id.desc()).offset(skip).limit(limit).all()


# ---------- Core: record a confirmed payment ----------
def record_successful_payment(
    db: Session,
    *,
    transaction_id: str,
    amount: Decimal,
    account_reference: str,
    payer_name: Optional[str] = None,
    payer_phone: Optional[str] = None,
    raw_payload: Optional[dict] = None,
    result_code: str = "0",
    result_desc: str = "Success",
) -> MpesaTransaction:
    """
    Atomically:
      1. Reject duplicate transaction_id (idempotent).
      2. Match AccountReference to an Invoice.
      3. Save MpesaTransaction.
      4. Apply payment to the invoice.
    """
    existing = get_transaction_by_receipt(db, transaction_id)
    if existing:
        return existing

    inv = (
        db.query(Invoice)
        .filter(Invoice.invoice_number == account_reference)
        .first()
    )

    tx = MpesaTransaction(
        transaction_id=transaction_id,
        invoice_id=inv.id if inv else None,
        invoice_number=account_reference,
        amount=Decimal(amount),
        payer_name=payer_name,
        payer_phone=payer_phone,
        account_reference=account_reference,
        result_code=result_code,
        result_desc=result_desc,
        status="success" if inv else "unmatched",
        raw_payload=raw_payload,
    )
    db.add(tx)
    db.flush()

    if inv:
        billing_service.apply_payment(db, inv.id, Decimal(amount))

    db.commit()
    db.refresh(tx)
    return tx


def record_failed_payment(
    db: Session,
    *,
    transaction_id: Optional[str],
    account_reference: Optional[str],
    amount: Optional[Decimal],
    payer_phone: Optional[str],
    result_code: Optional[str],
    result_desc: Optional[str],
    raw_payload: Optional[dict] = None,
) -> MpesaTransaction:
    tx_id = transaction_id or f"FAIL-{uuid.uuid4().hex[:12].upper()}"
    existing = get_transaction_by_receipt(db, tx_id)
    if existing:
        return existing

    tx = MpesaTransaction(
        transaction_id=tx_id,
        invoice_number=account_reference,
        account_reference=account_reference,
        amount=Decimal(amount or 0),
        payer_phone=payer_phone,
        result_code=result_code,
        result_desc=result_desc,
        status="failed",
        raw_payload=raw_payload,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


# ---------- Unmatched queue ----------
def list_unmatched(db: Session):
    return (
        db.query(MpesaTransaction)
        .filter(MpesaTransaction.status == "unmatched")
        .order_by(MpesaTransaction.id.desc())
        .all()
    )


def link_unmatched_to_invoice(
    db: Session, tx_id: int, invoice_number: str
) -> MpesaTransaction:
    tx = get_transaction(db, tx_id)
    if tx.invoice_id:
        raise HTTPException(400, "Transaction is already linked")

    inv = (
        db.query(Invoice)
        .filter(Invoice.invoice_number == invoice_number)
        .first()
    )
    if not inv:
        raise HTTPException(404, f"Invoice {invoice_number} not found")

    tx.invoice_id = inv.id
    tx.invoice_number = inv.invoice_number
    tx.status = "success"

    billing_service.apply_payment(db, inv.id, Decimal(tx.amount))

    db.commit()
    db.refresh(tx)
    return tx