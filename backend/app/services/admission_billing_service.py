from decimal import Decimal
from datetime import datetime, timezone

from app.models.admission import Admission, BedAssignment
from app.models.bed import Bed
from app.models.invoice import InvoiceItem
from app.services.billing_service import calculate_days, _recalc_totals, get_invoice


def refresh_admission_accommodation(db, invoice_id: int, billing_policy: str = "calendar"):
    """Rebuild daily bed charges from admission through discharge, including transfers."""
    invoice = get_invoice(db, invoice_id)
    if invoice.admission_id is None:
        return invoice

    admission = db.query(Admission).filter(Admission.id == invoice.admission_id).first()
    if not admission:
        return invoice

    # Remove previous accommodation rows so repeated refreshes remain idempotent.
    for item in list(invoice.items):
        if item.description.startswith("Accommodation"):
            db.delete(item)
    db.flush()

    assignments = (
        db.query(BedAssignment)
        .filter(BedAssignment.admission_id == admission.id)
        .order_by(BedAssignment.started_at, BedAssignment.id)
        .all()
    )
    for assignment in assignments:
        bed = db.query(Bed).filter(Bed.id == assignment.bed_id).first()
        if not bed:
            continue
        end = assignment.ended_at or admission.discharged_at or datetime.now(timezone.utc)
        days = calculate_days(assignment.started_at or admission.admitted_at, end, billing_policy)
        rate = Decimal(str(bed.daily_rate))
        quantity = Decimal(days)
        db.add(InvoiceItem(
            invoice_id=invoice.id,
            description=f"Accommodation – {bed.bed_number} ({bed.category}) {days} day(s) @ {rate}",
            quantity=quantity,
            unit_price=rate,
            amount=quantity * rate,
        ))

    db.flush()
    db.refresh(invoice)
    _recalc_totals(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice
