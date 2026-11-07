from decimal import Decimal
from datetime import datetime, timezone

from app.models.admission import Admission, BedAssignment
from app.models.bed import Bed
from app.models.invoice import InvoiceItem
from app.services.billing_service import calculate_days, _recalc_totals, get_invoice


def refresh_admission_accommodation(db, invoice_id: int, billing_policy: str = "calendar"):
    """Refresh accommodation charges only when the billable stay has changed."""
    invoice = get_invoice(db, invoice_id)
    if invoice.admission_id is None:
        return invoice

    admission = db.query(Admission).filter(Admission.id == invoice.admission_id).first()
    if not admission:
        return invoice

    assignments = (
        db.query(BedAssignment)
        .filter(BedAssignment.admission_id == admission.id)
        .order_by(BedAssignment.started_at, BedAssignment.id)
        .all()
    )

    # Build the current expected accommodation lines first. Invoice detail/list
    # endpoints call this refresh, so avoid deleting/recreating rows on every read
    # when the number of billable days and rates have not changed.
    expected_lines = []
    for assignment in assignments:
        bed = db.query(Bed).filter(Bed.id == assignment.bed_id).first()
        if not bed:
            continue
        end = assignment.ended_at or admission.discharged_at or datetime.now(timezone.utc)
        days = calculate_days(assignment.started_at or admission.admitted_at, end, billing_policy)
        rate = Decimal(str(bed.daily_rate))
        quantity = Decimal(days)
        expected_lines.append({
            "description": f"Accommodation – {bed.bed_number} ({bed.category}) {days} day(s) @ {rate}",
            "quantity": quantity,
            "unit_price": rate,
            "amount": quantity * rate,
        })

    current_items = [
        item for item in invoice.items
        if item.description.startswith("Accommodation")
    ]
    current_lines = sorted(
        (
            item.description,
            Decimal(str(item.quantity)),
            Decimal(str(item.unit_price)),
            Decimal(str(item.amount)),
        )
        for item in current_items
    )
    expected_values = sorted(
        (
            line["description"],
            line["quantity"],
            line["unit_price"],
            line["amount"],
        )
        for line in expected_lines
    )

    if current_lines == expected_values:
        return invoice

    # A changed accommodation line (for example, another billable day) is the
    # only reason an automatic refresh should change the invoice total.
    for item in current_items:
        db.delete(item)
    db.flush()

    for line in expected_lines:
        db.add(InvoiceItem(invoice_id=invoice.id, **line))

    db.flush()
    db.refresh(invoice)
    _recalc_totals(invoice)  # total = charges; balance = total - payments
    db.commit()
    db.refresh(invoice)
    return invoice
