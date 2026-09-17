from sqlalchemy.orm import Session
from fastapi import HTTPException
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
import math

from app.models.invoice import Invoice, InvoiceItem
from app.models.admission import Admission, BedAssignment
from app.models.bed import Bed
from app.models.patient import Patient
from app.services import code_service


# ---------- Billing policy ----------
def calculate_days(start: datetime, end: Optional[datetime], policy: str = "24hr") -> int:
    """
    policy = "24hr"      -> completed 24-hour periods (min 1)
    policy = "calendar"  -> calendar days inclusive (min 1)
    """
    if end is None:
        end = datetime.now(timezone.utc)
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    if policy == "calendar":
        return max(1, (end.date() - start.date()).days + 1)
    return max(1, math.ceil((end - start).total_seconds() / 86400))


# ---------- Lookups ----------
def get_invoice(db: Session, invoice_id: int) -> Invoice:
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, f"Invoice {invoice_id} not found")
    return inv


def get_invoice_by_number(db: Session, invoice_number: str) -> Invoice:
    inv = db.query(Invoice).filter(Invoice.invoice_number == invoice_number).first()
    if not inv:
        raise HTTPException(404, f"Invoice {invoice_number} not found")
    return inv


def get_by_admission(db: Session, admission_id: int) -> Optional[Invoice]:
    return db.query(Invoice).filter(Invoice.admission_id == admission_id).first()


def compute_status(total: Decimal, paid: Decimal) -> str:
    if paid == 0:
        return "unpaid"
    if paid < total:
        return "partially_paid"
    if paid == total:
        return "paid"
    return "overpaid"


def _recalc_totals(inv: Invoice):
    subtotal = sum((item.amount for item in inv.items), Decimal("0"))
    inv.subtotal = subtotal
    inv.total_amount = subtotal
    inv.balance = inv.total_amount - inv.amount_paid
    inv.status = compute_status(inv.total_amount, inv.amount_paid)


# ---------- Invoice creation ----------
def create_for_admission(
    db: Session,
    admission_id: int,
    notes: Optional[str] = None,
    billing_policy: str = "24hr",
) -> Invoice:
    adm = db.query(Admission).filter(Admission.id == admission_id).first()
    if not adm:
        raise HTTPException(404, f"Admission {admission_id} not found")

    existing = get_by_admission(db, admission_id)
    if existing:
        return existing

    invoice_number = code_service.next_invoice_number(db)
    inv = Invoice(
        invoice_number=invoice_number,
        admission_id=adm.id,
        patient_id=adm.patient_id,
        subtotal=Decimal("0"),
        total_amount=Decimal("0"),
        amount_paid=Decimal("0"),
        balance=Decimal("0"),
        status="unpaid",
        notes=notes,
    )
    db.add(inv)
    db.flush()

    # If a bed is already assigned, add accommodation
    active = (
        db.query(BedAssignment)
        .filter(
            BedAssignment.admission_id == adm.id,
            BedAssignment.is_active == True,  # noqa: E712
        )
        .first()
    )
    if active:
        bed = db.query(Bed).filter(Bed.id == active.bed_id).first()
        if bed:
            days = calculate_days(active.started_at, adm.discharged_at, billing_policy)
            qty = Decimal(days)
            rate = Decimal(bed.daily_rate)
            db.add(InvoiceItem(
                invoice_id=inv.id,
                description=f"Accommodation – {bed.bed_number} ({bed.category}) {days} day(s) @ {rate}",
                quantity=qty,
                unit_price=rate,
                amount=qty * rate,
            ))

    db.flush()
    db.refresh(inv)
    _recalc_totals(inv)
    db.commit()
    db.refresh(inv)
    return inv


def refresh_accommodation(db: Session, invoice_id: int, billing_policy: str = "24hr") -> Invoice:
    """Recompute the accommodation line for an active admission."""
    inv = get_invoice(db, invoice_id)
    adm = db.query(Admission).filter(Admission.id == inv.admission_id).first()

    active = (
        db.query(BedAssignment)
        .filter(
            BedAssignment.admission_id == adm.id,
            BedAssignment.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not active:
        return inv

    bed = db.query(Bed).filter(Bed.id == active.bed_id).first()
    if not bed:
        return inv

    # Remove old accommodation line(s)
    for item in list(inv.items):
        if item.description.startswith("Accommodation –"):
            db.delete(item)
    db.flush()

    days = calculate_days(active.started_at, adm.discharged_at, billing_policy)
    qty = Decimal(days)
    rate = Decimal(bed.daily_rate)
    db.add(InvoiceItem(
        invoice_id=inv.id,
        description=f"Accommodation – {bed.bed_number} ({bed.category}) {days} day(s) @ {rate}",
        quantity=qty,
        unit_price=rate,
        amount=qty * rate,
    ))
    db.flush()
    db.refresh(inv)
    _recalc_totals(inv)
    db.commit()
    db.refresh(inv)
    return inv


# ---------- Manual items ----------
def add_manual_charge(
    db: Session, invoice_id: int,
    description: str, quantity: Decimal, unit_price: Decimal,
) -> Invoice:
    inv = get_invoice(db, invoice_id)
    amount = Decimal(quantity) * Decimal(unit_price)
    item = InvoiceItem(
        invoice_id=inv.id,
        description=description,
        quantity=quantity,
        unit_price=unit_price,
        amount=amount,
    )
    db.add(item)
    db.flush()
    db.refresh(inv)
    _recalc_totals(inv)
    db.commit()
    db.refresh(inv)
    return inv


def delete_item(db: Session, invoice_id: int, item_id: int) -> Invoice:
    inv = get_invoice(db, invoice_id)
    item = db.query(InvoiceItem).filter(
        InvoiceItem.id == item_id, InvoiceItem.invoice_id == invoice_id
    ).first()
    if not item:
        raise HTTPException(404, "Item not found on this invoice")
    db.delete(item)
    db.flush()
    db.refresh(inv)
    _recalc_totals(inv)
    db.commit()
    db.refresh(inv)
    return inv


# ---------- Listing / detail ----------
def list_invoices(
    db: Session, status_filter: Optional[str] = None,
    patient_id: Optional[int] = None, skip: int = 0, limit: int = 200,
):
    q = db.query(Invoice)
    if status_filter:
        q = q.filter(Invoice.status == status_filter)
    if patient_id:
        q = q.filter(Invoice.patient_id == patient_id)
    return q.order_by(Invoice.id.desc()).offset(skip).limit(limit).all()


def invoice_detail(db: Session, inv: Invoice) -> dict:
    patient = db.query(Patient).filter(Patient.id == inv.patient_id).first()
    adm = db.query(Admission).filter(Admission.id == inv.admission_id).first()
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "admission_id": inv.admission_id,
        "patient_id": inv.patient_id,
        "subtotal": inv.subtotal,
        "total_amount": inv.total_amount,
        "amount_paid": inv.amount_paid,
        "balance": inv.balance,
        "status": inv.status,
        "issued_at": inv.issued_at,
        "due_date": inv.due_date,
        "notes": inv.notes,
        "items": inv.items,
        "patient_number": patient.patient_number if patient else None,
        "patient_name": patient.full_name if patient else None,
        "admission_number": adm.admission_number if adm else None,
    }


def public_view(db: Session, invoice_number: str) -> dict:
    inv = get_invoice_by_number(db, invoice_number)
    patient = db.query(Patient).filter(Patient.id == inv.patient_id).first()
    return {
        "invoice_number": inv.invoice_number,
        "patient_name": patient.full_name if patient else "—",
        "patient_number": patient.patient_number if patient else "—",
        "total_amount": inv.total_amount,
        "amount_paid": inv.amount_paid,
        "balance": inv.balance,
        "status": inv.status,
        "items": inv.items,
    }


# ---------- Payment application (called by payment module) ----------
def apply_payment(db: Session, invoice_id: int, amount: Decimal) -> Invoice:
    inv = get_invoice(db, invoice_id)
    inv.amount_paid = inv.amount_paid + Decimal(amount)
    inv.balance = inv.total_amount - inv.amount_paid
    inv.status = compute_status(inv.total_amount, inv.amount_paid)
    db.add(inv)
    db.flush()
    return inv


# ---------- Stats ----------
def stats(db: Session) -> dict:
    from sqlalchemy import func
    rows = db.query(Invoice.status, func.count(Invoice.id)).group_by(Invoice.status).all()
    counts = {s: c for s, c in rows}

    total_billed = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).scalar() or 0
    total_paid = db.query(func.coalesce(func.sum(Invoice.amount_paid), 0)).scalar() or 0
    total_outstanding = db.query(func.coalesce(func.sum(Invoice.balance), 0)).scalar() or 0

    return {
        "counts_by_status": counts,
        "total_billed": str(total_billed),
        "total_paid": str(total_paid),
        "total_outstanding": str(total_outstanding),
    }