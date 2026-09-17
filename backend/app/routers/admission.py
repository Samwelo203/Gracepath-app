from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.schemas.admission import (
    AdmissionCreate,
    AdmissionRead,
    AdmissionWithPatient,
    DischargeRequest,
    BedAssignmentCreate,
    BedAssignmentRead,
    BedTransferRequest,
)
from app.services import admission_service as svc

router = APIRouter(prefix="/api/admissions", tags=["Admissions"])


# ---------- Admission CRUD ----------
@router.post("", response_model=AdmissionRead, status_code=201)
def create_admission(payload: AdmissionCreate, db: Session = Depends(get_db)):
    """Admit a patient. Auto-generates admission_number (ADM-YYYY-000001)."""
    return svc.create_admission(db, payload)


@router.get("", response_model=List[AdmissionRead])
def list_admissions(
    status_filter: Optional[str] = Query(None, alias="status"),
    patient_id: Optional[int] = None,
    skip: int = 0,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    return svc.list_admissions(db, status_filter, patient_id, skip, limit)


@router.get("/{admission_id}", response_model=AdmissionWithPatient)
def get_admission(admission_id: int, db: Session = Depends(get_db)):
    adm = svc.get_admission(db, admission_id)
    return svc.admission_with_patient(db, adm)


# ---------- Bed assignment ----------
@router.post("/{admission_id}/assign-bed", response_model=BedAssignmentRead, status_code=201)
def assign_bed(
    admission_id: int,
    bed_id: int = Query(..., description="ID of the bed to assign"),
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Assign a bed to an active admission. Marks bed as occupied."""
    payload = BedAssignmentCreate(admission_id=admission_id, bed_id=bed_id, notes=notes)
    return svc.assign_bed(db, payload)


@router.post("/{admission_id}/transfer-bed", response_model=BedAssignmentRead, status_code=201)
def transfer_bed(
    admission_id: int,
    payload: BedTransferRequest,
    db: Session = Depends(get_db),
):
    """Move a patient to a different bed. Closes old assignment, opens new one."""
    return svc.transfer_bed(db, admission_id, payload)


@router.get("/{admission_id}/current-bed", response_model=Optional[BedAssignmentRead])
def current_bed(admission_id: int, db: Session = Depends(get_db)):
    svc.get_admission(db, admission_id)
    return svc.get_active_assignment(db, admission_id)


# ---------- Discharge ----------
@router.post("/{admission_id}/discharge", response_model=AdmissionRead)
def discharge(
    admission_id: int,
    payload: DischargeRequest = DischargeRequest(),
    db: Session = Depends(get_db),
):
    """Discharge patient. Closes active bed assignment, frees the bed."""
    return svc.discharge_admission(db, admission_id, payload)


# ---------- Bed history ----------
@router.get("/bed/{bed_id}/history", response_model=List[BedAssignmentRead])
def bed_history(bed_id: int, db: Session = Depends(get_db)):
    return svc.bed_history(db, bed_id)