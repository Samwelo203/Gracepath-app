from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models.patient import Patient
from app.models.patient_note import PatientNote
from app.models.admission import Admission, BedAssignment
from app.models.bed import Bed
from app.models.invoice import Invoice, InvoiceItem
from app.models.mpesa import MpesaTransaction
from app.schemas.patient import PatientCreate, PatientUpdate, PatientNoteCreate
from app.models.user import User
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


def _visible_patients(db: Session, user: User):
    if user.role not in {"admin", "clinician"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient access denied")
    query = db.query(Patient)
    if user.role == "clinician":
        query = query.filter(Patient.assigned_clinician_id == user.id)
    return query


def list_patients(db: Session, user: User, skip: int = 0, limit: int = 100):
    return _visible_patients(db, user).offset(skip).limit(limit).all()


def list_patient_options(db: Session, user: User, search: str | None = None, limit: int = 100):
    if user.role not in {"admin", "clinician", "receptionist", "accounts"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient lookup denied")
    query = db.query(Patient)
    if user.role == "clinician":
        query = query.filter(Patient.assigned_clinician_id == user.id)
    query = query.with_entities(
        Patient.id, Patient.patient_number, Patient.full_name
    )
    if search:
        like = f"%{search}%"
        query = query.filter(
            Patient.full_name.ilike(like)
            | Patient.patient_number.ilike(like)
            | Patient.phone.ilike(like)
        )
    return [
        {
            "id": patient_id,
            "patient_number": patient_number,
            "full_name": full_name,
        }
        for patient_id, patient_number, full_name in query.order_by(Patient.full_name).limit(limit).all()
    ]


def search_patients(db: Session, search: str, user: User):
    like = f"%{search}%"
    return (
        _visible_patients(db, user)
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


def get_patient_for_user(db: Session, patient_id: int, user: User) -> Patient:
    if user.role not in {"admin", "clinician"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient access denied")
    patient = _visible_patients(db, user).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return patient


def get_patient_by_number(db: Session, patient_number: str, user: User) -> Patient:
    patient = (
        _visible_patients(db, user)
        .filter(Patient.patient_number == patient_number)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return patient


def assign_clinician(db: Session, patient_id: int, clinician_id: int | None) -> Patient:
    patient = get_patient(db, patient_id)
    if clinician_id is not None:
        clinician = (
            db.query(User)
            .filter(User.id == clinician_id, User.role == "clinician", User.is_active.is_(True))
            .first()
        )
        if not clinician:
            raise HTTPException(status_code=400, detail="Select an active clinician")
    patient.assigned_clinician_id = clinician_id
    db.commit()
    db.refresh(patient)
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
    invoice_ids = [
        invoice_id
        for (invoice_id,) in db.query(Invoice.id).filter(Invoice.patient_id == patient_id).all()
    ]
    admission_ids = [
        admission_id
        for (admission_id,) in db.query(Admission.id).filter(Admission.patient_id == patient_id).all()
    ]

    active_bed_ids = set()
    if admission_ids:
        assignments = db.query(BedAssignment).filter(
            BedAssignment.admission_id.in_(admission_ids)
        ).all()
        active_bed_ids = {
            assignment.bed_id for assignment in assignments if assignment.is_active
        }
        db.query(BedAssignment).filter(
            BedAssignment.admission_id.in_(admission_ids)
        ).delete(synchronize_session=False)

    db.query(PatientNote).filter(PatientNote.patient_id == patient_id).delete(
        synchronize_session=False
    )
    if invoice_ids:
        db.query(MpesaTransaction).filter(
            MpesaTransaction.invoice_id.in_(invoice_ids)
        ).delete(synchronize_session=False)
        db.query(InvoiceItem).filter(
            InvoiceItem.invoice_id.in_(invoice_ids)
        ).delete(synchronize_session=False)
        db.query(Invoice).filter(Invoice.id.in_(invoice_ids)).delete(
            synchronize_session=False
        )
    if admission_ids:
        db.query(Admission).filter(Admission.id.in_(admission_ids)).delete(
            synchronize_session=False
        )
    for bed_id in active_bed_ids:
        bed = db.query(Bed).filter(Bed.id == bed_id).first()
        has_active_assignment = db.query(BedAssignment.id).filter(
            BedAssignment.bed_id == bed_id,
            BedAssignment.is_active.is_(True),
        ).first()
        if bed and not has_active_assignment:
            bed.status = "available"

    db.delete(patient)
    db.commit()


def list_notes(db: Session, patient_id: int, user: User):
    get_patient_for_user(db, patient_id, user)
    return (
        db.query(PatientNote)
        .filter(PatientNote.patient_id == patient_id)
        .order_by(PatientNote.created_at.desc(), PatientNote.id.desc())
        .all()
    )


def add_note(db: Session, patient_id: int, data: PatientNoteCreate, author: User) -> PatientNote:
    get_patient_for_user(db, patient_id, author)
    note_text = data.note.strip()
    if not note_text:
        raise HTTPException(status_code=400, detail="Note cannot be empty")
    note = PatientNote(
        patient_id=patient_id,
        author_id=author.id,
        note=note_text,
        review=data.review.strip() if data.review and data.review.strip() else None,
        follow_up_date=data.follow_up_date,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note