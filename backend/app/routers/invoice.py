from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.schemas.invoice import (
    InvoiceRead, InvoiceDetail, InvoiceFromAdmission, ManualCharge,
    PublicInvoiceView,
)
from app.services import billing_service as svc
from app.core.security import require_accounts, require_clinical
from app.models.user import User

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


# ---------- Public payer view (no auth) ----------
@router.get("/public/{invoice_number}", response_model=PublicInvoiceView)
def public_invoice(invoice_number: str, db: Session = Depends(get_db)):
    """Public invoice lookup — used by the payer payment page."""
    return svc.public_view(db, invoice_number)


@router.get("/stats")
def stats(db: Session = Depends(get_db),
           user: User = Depends(require_accounts)):
    return svc.stats(db)


@router.post("", response_model=InvoiceDetail, status_code=201)
def create_invoice(payload: InvoiceFromAdmission, db: Session = Depends(get_db),
                     user: User = Depends(require_accounts)):
    inv = svc.create_for_admission(db, payload.admission_id, payload.notes)
    return svc.invoice_detail(db, inv)


@router.get("", response_model=List[InvoiceRead])
def list_invoices(
    status_filter: Optional[str] = Query(None, alias="status"),
    patient_id: Optional[int] = None,
    skip: int = 0,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(require_accounts),
):
    return svc.list_invoices(db, status_filter, patient_id, skip, limit)


@router.get("/{invoice_id}", response_model=InvoiceDetail)
def get_invoice(invoice_id: int, db: Session = Depends(get_db),
                  user: User = Depends(require_accounts)):
    inv = svc.get_invoice(db, invoice_id)
    return svc.invoice_detail(db, inv)


@router.get("/number/{invoice_number}", response_model=InvoiceDetail)
def get_invoice_by_number(invoice_number: str, db: Session = Depends(get_db),
                            user: User = Depends(require_accounts)):
    inv = svc.get_invoice_by_number(db, invoice_number)
    return svc.invoice_detail(db, inv)


@router.post("/{invoice_id}/items", response_model=InvoiceDetail)
def add_charge(invoice_id: int, payload: ManualCharge, db: Session = Depends(get_db),
                user: User = Depends(require_accounts)):
    inv = svc.add_manual_charge(
        db, invoice_id, payload.description, payload.quantity, payload.unit_price,
    )
    return svc.invoice_detail(db, inv)


@router.delete("/{invoice_id}/items/{item_id}", response_model=InvoiceDetail)
def delete_item(invoice_id: int, item_id: int, db: Session = Depends(get_db),
                 user: User = Depends(require_accounts)):
    inv = svc.delete_item(db, invoice_id, item_id)
    return svc.invoice_detail(db, inv)


@router.post("/{invoice_id}/refresh-accommodation", response_model=InvoiceDetail)
def refresh(
    invoice_id: int,
    billing_policy: str = Query("24hr"),
    db: Session = Depends(get_db),
    user: User = Depends(require_accounts),
):
    inv = svc.refresh_accommodation(db, invoice_id, billing_policy)
    return svc.invoice_detail(db, inv)