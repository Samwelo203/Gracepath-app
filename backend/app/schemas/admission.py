from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import date, datetime, timezone
from typing import Optional


# ---------- Admission ----------
class AdmissionCreate(BaseModel):
    patient_id: int
    admission_date: Optional[date] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("admission_date")
    @classmethod
    def admission_date_must_not_be_future(cls, value: Optional[date]) -> Optional[date]:
        if value is not None and value > datetime.now(timezone.utc).date():
            raise ValueError("Admission date must be today or earlier")
        return value


class AdmissionRead(BaseModel):
    id: int
    admission_number: str
    patient_id: int
    admitted_at: datetime
    discharged_at: Optional[datetime] = None
    status: str
    reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdmissionWithPatient(AdmissionRead):
    patient_number: Optional[str] = None
    patient_name: Optional[str] = None
    current_bed: Optional[str] = None


class DischargeRequest(BaseModel):
    discharge_notes: Optional[str] = None


# ---------- Bed Assignment ----------
class BedAssignmentCreate(BaseModel):
    admission_id: int
    bed_id: int
    notes: Optional[str] = None


class BedAssignmentRead(BaseModel):
    id: int
    assignment_number: str
    admission_id: int
    bed_id: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    is_active: bool
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BedTransferRequest(BaseModel):
    new_bed_id: int
    notes: Optional[str] = None
