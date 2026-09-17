from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.code_sequence import CodeSequence
from app.utils.code_generator import (
    generate_patient_number,
    generate_admission_number,
    generate_bed_number,
    generate_invoice_number,
    generate_payment_reference,
    generate_assignment_number,
)


def _next_value(db: Session, name: str) -> int:
    """
    Atomically reserve the next integer for a given sequence name.
    """
    seq = db.query(CodeSequence).filter(CodeSequence.name == name).first()

    if seq is None:
        seq = CodeSequence(name=name, last_value=0)
        db.add(seq)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            seq = db.query(CodeSequence).filter(CodeSequence.name == name).first()

    seq.last_value += 1
    db.flush()
    return seq.last_value


def next_patient_number(db: Session) -> str:
    return generate_patient_number(_next_value(db, "patient"))


def next_admission_number(db: Session) -> str:
    return generate_admission_number(_next_value(db, "admission"))


def next_bed_number(db: Session) -> str:
    return generate_bed_number(_next_value(db, "bed"))


def next_invoice_number(db: Session) -> str:
    return generate_invoice_number(_next_value(db, "invoice"))


def next_payment_reference(db: Session) -> str:
    return generate_payment_reference(_next_value(db, "payment"))


def next_assignment_number(db: Session) -> str:
    return generate_assignment_number(_next_value(db, "assignment"))