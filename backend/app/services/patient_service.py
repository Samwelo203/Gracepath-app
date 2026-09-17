from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models.patient import Patient
from app.schemas.patient import PatientCreate, PatientUpdate
from app.services import code_service


def create_patient(db: Session, data: PatientCreate) -> Patient:
    """
    Register a patient safely:
      1. Reserve the next patient_number from code_sequences.
      2. Insert the row with that number already set.
      3. Commit. On failure, roll back.
    """
    try:
        patient_number = code_service.next_patient_number(db)
        patient = Patient(**data.model_dump(), patient_number=patient_number)
        db.add(patient)
        db.commit()
        db.refresh(patient)
        return patient
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Could not create patient: {str(e.orig)}",
        )


def list_patients(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Patient).offset(skip).limit(limit).all()


def search_patients(db: Session, query: str):
    like = f"%{query}%"
    return (
        db.query(Patient)
        .filter(
            (Patient.full_name.ilike(like))
            | (Patient.patient_number.ilike(like))
            | (Patient.phone.ilike(like))
            | (Patient.national_id.ilike(like))
        )
        .all()
    )


def get_patient(db: Session, patient_id: int) -> Patient:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient {patient_id} not found",
        )
    return patient


def get_patient_by_number(db: Session, patient_number: str) -> Patient:
    patient = (
        db.query(Patient)
        .filter(Patient.patient_number == patient_number)
        .first()
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient {patient_number} not found",
        )
    return patient


def update_patient(db: Session, patient_id: int, data: PatientUpdate) -> Patient:
    patient = get_patient(db, patient_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return patient


def delete_patient(db: Session, patient_id: int) -> None:
    patient = get_patient(db, patient_id)
    db.delete(patient)
    db.commit()