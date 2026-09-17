from sqlalchemy import Column, Integer, String, Date, DateTime, Text
from sqlalchemy.sql import func

from app.db.session import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_number = Column(String(20), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False, index=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(10), nullable=True)  # male / female / other
    national_id = Column(String(30), nullable=True, index=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(120), nullable=True)
    address = Column(Text, nullable=True)
    next_of_kin_name = Column(String(150), nullable=True)
    next_of_kin_phone = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Patient {self.patient_number} {self.full_name}>"