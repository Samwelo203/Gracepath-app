from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.schemas.bed import BedCreate, BedUpdate, BedRead
from app.services import bed_service
from app.core.security import require_admin, require_clinical
from app.models.user import User

router = APIRouter(prefix="/api/beds", tags=["Beds"])


@router.post("", response_model=BedRead, status_code=201)
def create_bed(payload: BedCreate, db: Session = Depends(get_db),
                user: User = Depends(require_admin)):
    """Create a bed. Auto-generates bed_number (B-001, B-002, ...)."""
    return bed_service.create_bed(db, payload)


@router.get("", response_model=List[BedRead])
def list_beds(
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(require_clinical),
):
    """List beds. Optionally filter by status: available/occupied/maintenance/reserved."""
    return bed_service.list_beds(db, status_filter=status_filter, skip=skip, limit=limit)


@router.get("/stats")
def bed_stats(db: Session = Depends(get_db),
               user: User = Depends(require_clinical)):
    """Dashboard counts: total, available, occupied, maintenance, reserved."""
    return bed_service.stats(db)


@router.get("/{bed_id}", response_model=BedRead)
def get_bed(bed_id: int, db: Session = Depends(get_db),
             user: User = Depends(require_clinical)):
    return bed_service.get_bed(db, bed_id)


@router.get("/number/{bed_number}", response_model=BedRead)
def get_bed_by_number(bed_number: str, db: Session = Depends(get_db),
                       user: User = Depends(require_clinical)):
    return bed_service.get_bed_by_number(db, bed_number)


@router.put("/{bed_id}", response_model=BedRead)
def update_bed(bed_id: int, payload: BedUpdate, db: Session = Depends(get_db),
                user: User = Depends(require_admin)):
    return bed_service.update_bed(db, bed_id, payload)


@router.delete("/{bed_id}", status_code=204)
def delete_bed(bed_id: int, db: Session = Depends(get_db),
                user: User = Depends(require_admin)):
    bed_service.delete_bed(db, bed_id)
    return None