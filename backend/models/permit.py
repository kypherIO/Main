"""
Construction Permit Model
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class Permit(Base):
    __tablename__ = "permits"

    id = Column(Integer, primary_key=True, index=True)

    # Identification
    permit_number = Column(String(100), unique=True, index=True, nullable=False)
    permit_type = Column(String(100), index=True)  # Building, Electrical, Plumbing, etc.

    # Location
    address = Column(String(500))
    city = Column(String(100), index=True)
    state = Column(String(2))
    zip_code = Column(String(10))
    county = Column(String(100))
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Permit Details
    description = Column(Text)
    work_type = Column(String(200))  # New Construction, Remodel, Addition, etc.
    project_value = Column(Float, nullable=True)
    square_footage = Column(Float, nullable=True)

    # Dates
    issue_date = Column(DateTime, index=True)
    expiration_date = Column(DateTime)
    completion_date = Column(DateTime, nullable=True)

    # Applicant/Owner Info
    owner_name = Column(String(200))
    owner_phone = Column(String(20))
    contractor_name = Column(String(200))
    contractor_license = Column(String(100))

    # Status
    status = Column(String(50), index=True)  # Issued, Active, Completed, Expired
    is_opportunity = Column(Boolean, default=False)  # Flagged as potential opportunity
    opportunity_score = Column(Float, nullable=True)  # AI-generated score 0-100

    # Metadata
    municipality_id = Column(Integer, ForeignKey("municipalities.id"))
    source_url = Column(String(500))
    scraped_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    municipality = relationship("Municipality", back_populates="permits")

    def __repr__(self):
        return f"<Permit {self.permit_number} - {self.address}>"
