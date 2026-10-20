from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.schemas.patient import (
    PatientCreate, PatientUpdate, PatientRead, PatientOptionRead, PatientAssignmentUpdate,
    PatientNoteCreate, PatientNoteRead,
)
from app.services import patient_service
from app.core.security import (
    require_admin, require_patient_access, require_patient_options, require_clinician,
)
from app.models.user import User

router = APIRouter(prefix="/api/patients", tags=["Patients"])


@router.post("", response_model=PatientRead, status_code=201)
def register_patient(payload: PatientCreate, db: Session = Depends(get_db),
                     user: User = Depends(require_admin)):
    """Register a new patient. Auto-generates patient_number (GPC-000001)."""
    return patient_service.create_patient(db, payload)


@router.get("", response_model=List[PatientRead])
def list_patients(
    skip: int = 0,
    limit: int = Query(100, le=500),
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_patient_access),
):
    """List or search patients by name, patient_number, phone, or national_id."""
    if q:
        return patient_service.search_patients(db, q, user)
    return patient_service.list_patients(db, user, skip=skip, limit=limit)


@router.get("/options", response_model=List[PatientOptionRead])
def patient_options(
    q: Optional[str] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(require_patient_options),
):
    return patient_service.list_patient_options(db, user, q, limit)


@router.get("/{patient_id}", response_model=PatientRead)
def get_patient(patient_id: int, db: Session = Depends(get_db),
                 user: User = Depends(require_patient_access)):
    return patient_service.get_patient_for_user(db, patient_id, user)


@router.get("/number/{patient_number}", response_model=PatientRead)
def get_patient_by_number(patient_number: str, db: Session = Depends(get_db),
                            user: User = Depends(require_patient_access)):
    return patient_service.get_patient_by_number(db, patient_number, user)


@router.put("/{patient_id}", response_model=PatientRead)
def update_patient(
    patient_id: int, payload: PatientUpdate, db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    return patient_service.update_patient(db, patient_id, payload)


@router.put("/{patient_id}/assignment", response_model=PatientRead)
def assign_patient(
    patient_id: int,
    payload: PatientAssignmentUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return patient_service.assign_clinician(db, patient_id, payload.clinician_id)


@router.delete("/{patient_id}", status_code=204)
def delete_patient(patient_id: int, db: Session = Depends(get_db),
                    user: User = Depends(require_admin)):
    patient_service.delete_patient(db, patient_id)
    return None


@router.get("/{patient_id}/notes", response_model=List[PatientNoteRead])
def list_patient_notes(patient_id: int, db: Session = Depends(get_db),
                       user: User = Depends(require_patient_access)):
    notes = patient_service.list_notes(db, patient_id, user)
    return [
        {
            "id": note.id,
            "patient_id": note.patient_id,
            "author_id": note.author_id,
            "author_name": note.author.full_name,
            "note": note.note,
            "review": note.review,
            "follow_up_date": note.follow_up_date,
            "created_at": note.created_at,
        }
        for note in notes
    ]


@router.post("/{patient_id}/notes", response_model=PatientNoteRead, status_code=201)
def add_patient_note(patient_id: int, payload: PatientNoteCreate,
                     db: Session = Depends(get_db),
                     user: User = Depends(require_clinician)):
    note = patient_service.add_note(db, patient_id, payload, user)
    return {
        "id": note.id,
        "patient_id": note.patient_id,
        "author_id": note.author_id,
        "author_name": user.full_name,
        "note": note.note,
        "review": note.review,
        "follow_up_date": note.follow_up_date,
        "created_at": note.created_at,
    }