from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timezone
from typing import Optional

from app.models.admission import Admission, BedAssignment
from app.models.patient import Patient
from app.models.bed import Bed
from app.schemas.admission import (
    AdmissionCreate,
    BedAssignmentCreate,
    BedTransferRequest,
    DischargeRequest,
)
from app.services import code_service


# ---------- helpers ----------
def _now():
    return datetime.now(timezone.utc)


def _sync_invoice(admission_id: int):
    """Called after bed changes. Ensures invoice exists and reflects current bed."""
    from app.db.session import SessionLocal
    from app.services import billing_service
    db = SessionLocal()
    try:
        adm = db.query(Admission).filter(Admission.id == admission_id).first()
        if not adm:
            return
        inv = billing_service.get_by_admission(db, admission_id)
        if not inv:
            billing_service.create_for_admission(db, admission_id)
        else:
            billing_service.refresh_accommodation(db, inv.id)
    except Exception as e:
        print(f"[WARN] _sync_invoice({admission_id}) failed: {e}")
    finally:
        db.close()


def get_admission(db: Session, admission_id: int) -> Admission:
    adm = db.query(Admission).filter(Admission.id == admission_id).first()
    if not adm:
        raise HTTPException(404, f"Admission {admission_id} not found")
    return adm


def get_active_assignment(db: Session, admission_id: int) -> Optional[BedAssignment]:
    return (
        db.query(BedAssignment)
        .filter(
            BedAssignment.admission_id == admission_id,
            BedAssignment.is_active == True,  # noqa: E712
        )
        .first()
    )


def _assert_bed_free(db: Session, bed_id: int) -> Bed:
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if not bed:
        raise HTTPException(404, f"Bed {bed_id} not found")

    conflict = (
        db.query(BedAssignment)
        .filter(
            BedAssignment.bed_id == bed_id,
            BedAssignment.is_active == True,  # noqa: E712
        )
        .first()
    )
    if conflict:
        raise HTTPException(409, f"Bed {bed.bed_number} is already occupied.")
    if bed.status == "maintenance":
        raise HTTPException(400, f"Bed {bed.bed_number} is under maintenance.")
    return bed


# ---------- Admission lifecycle ----------
def create_admission(db: Session, data: AdmissionCreate) -> Admission:
    patient = db.query(Patient).filter(Patient.id == data.patient_id).first()
    if not patient:
        raise HTTPException(404, f"Patient {data.patient_id} not found")

    admission_number = code_service.next_admission_number(db)
    adm = Admission(
        admission_number=admission_number,
        patient_id=patient.id,
        reason=data.reason,
        notes=data.notes,
        status="active",
    )
    db.add(adm)
    db.commit()
    db.refresh(adm)

    # Auto-create invoice for this admission
    try:
        from app.services import billing_service
        billing_service.create_for_admission(db, adm.id)
    except Exception as e:
        print(f"[WARN] Auto-invoice failed for admission {adm.id}: {e}")

    return adm


def list_admissions(
    db: Session,
    status_filter: Optional[str] = None,
    patient_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 200,
):
    q = db.query(Admission)
    if status_filter:
        q = q.filter(Admission.status == status_filter)
    if patient_id:
        q = q.filter(Admission.patient_id == patient_id)
    return q.order_by(Admission.id.desc()).offset(skip).limit(limit).all()


def admission_with_patient(db: Session, adm: Admission) -> dict:
    patient = db.query(Patient).filter(Patient.id == adm.patient_id).first()
    active = get_active_assignment(db, adm.id)
    current_bed = None
    if active:
        bed = db.query(Bed).filter(Bed.id == active.bed_id).first()
        current_bed = bed.bed_number if bed else None

    return {
        "id": adm.id,
        "admission_number": adm.admission_number,
        "patient_id": adm.patient_id,
        "admitted_at": adm.admitted_at,
        "discharged_at": adm.discharged_at,
        "status": adm.status,
        "reason": adm.reason,
        "notes": adm.notes,
        "created_at": adm.created_at,
        "patient_number": patient.patient_number if patient else None,
        "patient_name": patient.full_name if patient else None,
        "current_bed": current_bed,
    }


# ---------- Bed assignment ----------
def assign_bed(db: Session, data: BedAssignmentCreate) -> BedAssignment:
    adm = get_admission(db, data.admission_id)
    if adm.status != "active":
        raise HTTPException(400, f"Cannot assign bed: admission is {adm.status}")

    if get_active_assignment(db, adm.id):
        raise HTTPException(400, "Admission already has an active bed assignment. Use transfer.")

    bed = _assert_bed_free(db, data.bed_id)

    assignment_number = code_service.next_assignment_number(db)
    assignment = BedAssignment(
        assignment_number=assignment_number,
        admission_id=adm.id,
        bed_id=bed.id,
        is_active=True,
        notes=data.notes,
    )
    db.add(assignment)
    bed.status = "occupied"

    db.commit()
    db.refresh(assignment)

    # Sync invoice (add accommodation line)
    _sync_invoice(adm.id)

    return assignment


def close_assignment(db: Session, assignment: BedAssignment, notes: Optional[str] = None):
    assignment.is_active = False
    assignment.ended_at = _now()
    if notes:
        assignment.notes = (assignment.notes or "") + f" | {notes}"
    bed = db.query(Bed).filter(Bed.id == assignment.bed_id).first()
    if bed:
        bed.status = "available"


def transfer_bed(db: Session, admission_id: int, data: BedTransferRequest) -> BedAssignment:
    adm = get_admission(db, admission_id)
    if adm.status != "active":
        raise HTTPException(400, "Cannot transfer: admission is not active")

    current = get_active_assignment(db, adm.id)
    if not current:
        raise HTTPException(400, "No active bed assignment to transfer from")

    new_bed = _assert_bed_free(db, data.new_bed_id)

    close_assignment(db, current, notes=f"Transferred to bed {new_bed.bed_number}")

    assignment_number = code_service.next_assignment_number(db)
    new_assignment = BedAssignment(
        assignment_number=assignment_number,
        admission_id=adm.id,
        bed_id=new_bed.id,
        is_active=True,
        notes=data.notes or f"Transfer from bed {current.bed_id}",
    )
    db.add(new_assignment)
    new_bed.status = "occupied"

    db.commit()
    db.refresh(new_assignment)

    _sync_invoice(adm.id)

    return new_assignment


# ---------- Discharge ----------
def discharge_admission(db: Session, admission_id: int, data: DischargeRequest) -> Admission:
    adm = get_admission(db, admission_id)
    if adm.status != "active":
        raise HTTPException(400, f"Admission already {adm.status}")

    current = get_active_assignment(db, adm.id)
    if current:
        close_assignment(db, current, notes="Discharged")

    adm.status = "discharged"
    adm.discharged_at = _now()
    if data.discharge_notes:
        adm.notes = (adm.notes or "") + f"\nDischarge: {data.discharge_notes}"

    db.commit()
    db.refresh(adm)

    # Final invoice refresh (locks in the completed days)
    _sync_invoice(adm.id)

    return adm


# ---------- History ----------
def bed_history(db: Session, bed_id: int):
    return (
        db.query(BedAssignment)
        .filter(BedAssignment.bed_id == bed_id)
        .order_by(BedAssignment.id.desc())
        .all()
    )