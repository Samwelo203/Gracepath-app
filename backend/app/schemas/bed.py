from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from datetime import datetime
from typing import Optional, Literal


BedStatus = Literal["available", "occupied", "maintenance", "reserved"]


class BedBase(BaseModel):
    category: str = Field("Standard", min_length=2, max_length=50)
    daily_rate: Decimal = Field(..., ge=0)
    location: Optional[str] = None
    notes: Optional[str] = None


class BedCreate(BedBase):
    pass


class BedUpdate(BaseModel):
    category: Optional[str] = None
    daily_rate: Optional[Decimal] = Field(None, ge=0)
    status: Optional[BedStatus] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class BedRead(BedBase):
    id: int
    bed_number: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)