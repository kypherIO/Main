"""
Municipal Bid/RFP Model
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)

    # Identification
    bid_number = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(500), nullable=False)

    # Bid Details
    description = Column(Text)
    category = Column(String(100), index=True)  # Construction, Remodeling, Maintenance, etc.
    project_type = Column(String(200))
    estimated_value = Column(Float, nullable=True)

    # Location
    location = Column(String(500))
    city = Column(String(100), index=True)
    state = Column(String(2))
    county = Column(String(100))

    # Dates
    posted_date = Column(DateTime, index=True)
    due_date = Column(DateTime, index=True)
    project_start_date = Column(DateTime, nullable=True)
    project_end_date = Column(DateTime, nullable=True)

    # Issuing Agency
    agency_name = Column(String(200))
    agency_contact = Column(String(200))
    agency_phone = Column(String(20))
    agency_email = Column(String(200))

    # Status
    status = Column(String(50), index=True)  # Open, Closed, Awarded, Cancelled
    is_opportunity = Column(Boolean, default=False)
    opportunity_score = Column(Float, nullable=True)  # AI-generated score 0-100

    # Requirements
    requirements = Column(Text)  # License requirements, insurance, etc.
    bonding_required = Column(Boolean, default=False)
    prevailing_wage = Column(Boolean, default=False)

    # Documents
    documents_url = Column(String(500))
    submission_url = Column(String(500))

    # Metadata
    municipality_id = Column(Integer, ForeignKey("municipalities.id"))
    source_url = Column(String(500))
    scraped_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    municipality = relationship("Municipality", back_populates="bids")

    def __repr__(self):
        return f"<Bid {self.bid_number} - {self.title}>"
