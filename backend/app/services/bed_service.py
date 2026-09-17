from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from typing import Optional

from app.models.bed import Bed
from app.schemas.bed import BedCreate, BedUpdate
from app.services import code_service


def create_bed(db: Session, data: BedCreate) -> Bed:
    """Create a bed and assign a unique bed_number (B-001, B-002, ...)."""
    try:
        bed_number = code_service.next_bed_number(db)
        bed = Bed(**data.model_dump(), bed_number=bed_number, status="available")
        db.add(bed)
        db.commit()
        db.refresh(bed)
        return bed
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Could not create bed: {str(e.orig)}",
        )


def list_beds(
    db: Session,
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
):
    q = db.query(Bed)
    if status_filter:
        q = q.filter(Bed.status == status_filter)
    return q.order_by(Bed.bed_number).offset(skip).limit(limit).all()


def get_bed(db: Session, bed_id: int) -> Bed:
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if not bed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bed {bed_id} not found",
        )
    return bed


def get_bed_by_number(db: Session, bed_number: str) -> Bed:
    bed = db.query(Bed).filter(Bed.bed_number == bed_number).first()
    if not bed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bed {bed_number} not found",
        )
    return bed


def update_bed(db: Session, bed_id: int, data: BedUpdate) -> Bed:
    bed = get_bed(db, bed_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(bed, field, value)
    db.commit()
    db.refresh(bed)
    return bed


def delete_bed(db: Session, bed_id: int) -> None:
    bed = get_bed(db, bed_id)
    if bed.status == "occupied":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a bed that is currently occupied.",
        )
    db.delete(bed)
    db.commit()


def stats(db: Session) -> dict:
    """Return counts by status — useful for the dashboard."""
    from sqlalchemy import func
    rows = (
        db.query(Bed.status, func.count(Bed.id))
        .group_by(Bed.status)
        .all()
    )
    counts = {status_name: count for status_name, count in rows}
    total = sum(counts.values())
    return {
        "total": total,
        "available": counts.get("available", 0),
        "occupied": counts.get("occupied", 0),
        "maintenance": counts.get("maintenance", 0),
        "reserved": counts.get("reserved", 0),
    }