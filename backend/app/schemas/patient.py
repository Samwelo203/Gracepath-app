from pydantic import BaseModel, Field, ConfigDict
from datetime import date, datetime
from typing import Optional


class PatientBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    national_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None
    notes: Optional[str] = None


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    national_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None
    notes: Optional[str] = None


class PatientRead(PatientBase):
    id: int
    patient_number: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PatientNoteCreate(BaseModel):
    note: str = Field(..., min_length=1, max_length=5000)


class PatientNoteRead(BaseModel):
    id: int
    patient_id: int
    author_id: int
    author_name: str
    note: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)