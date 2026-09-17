from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text
from sqlalchemy.sql import func

from app.db.session import Base


class Bed(Base):
    __tablename__ = "beds"

    id = Column(Integer, primary_key=True, index=True)
    bed_number = Column(String(20), unique=True, nullable=False, index=True)
    category = Column(String(50), nullable=False, default="Standard")
    daily_rate = Column(Numeric(10, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="available", index=True)
    # available | occupied | maintenance | reserved
    location = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Bed {self.bed_number} {self.category} {self.status}>"