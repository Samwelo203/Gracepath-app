from sqlalchemy import (
    Column, Integer, String, DateTime, Text, ForeignKey, Boolean
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.session import Base


class Admission(Base):
    __tablename__ = "admissions"

    id = Column(Integer, primary_key=True, index=True)
    admission_number = Column(String(30), unique=True, nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)

    admitted_at = Column(DateTime(timezone=True), server_default=func.now())
    discharged_at = Column(DateTime(timezone=True), nullable=True)

    status = Column(String(20), nullable=False, default="active", index=True)
    # active | discharged | cancelled

    reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", backref="admissions")
    bed_assignments = relationship(
        "BedAssignment", back_populates="admission", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Admission {self.admission_number} patient={self.patient_id} {self.status}>"


class BedAssignment(Base):
    __tablename__ = "bed_assignments"

    id = Column(Integer, primary_key=True, index=True)
    assignment_number = Column(String(30), unique=True, nullable=False, index=True)
    admission_id = Column(Integer, ForeignKey("admissions.id"), nullable=False, index=True)
    bed_id = Column(Integer, ForeignKey("beds.id"), nullable=False, index=True)

    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True, index=True)
    notes = Column(Text, nullable=True)

    admission = relationship("Admission", back_populates="bed_assignments")
    bed = relationship("Bed", backref="assignments")

    def __repr__(self):
        return f"<BedAssignment {self.assignment_number} adm={self.admission_id} bed={self.bed_id} active={self.is_active}>"