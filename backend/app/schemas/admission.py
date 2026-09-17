from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional


# ---------- Admission ----------
class AdmissionCreate(BaseModel):
    patient_id: int
    reason: Optional[str] = None
    notes: Optional[str] = None


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