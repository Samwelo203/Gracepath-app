from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.session import Base


class PatientNote(Base):
    __tablename__ = "patient_notes"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", backref="medical_notes")
    author = relationship("User")