"""
Property Data Model
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)

    # Identification
    parcel_id = Column(String(100), unique=True, index=True, nullable=False)
    property_id = Column(String(100), index=True)

    # Location
    address = Column(String(500), nullable=False)
    city = Column(String(100), index=True)
    state = Column(String(2))
    zip_code = Column(String(10))
    county = Column(String(100), index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Property Details
    property_type = Column(String(100))  # Residential, Commercial, etc.
    year_built = Column(Integer, index=True)
    building_age = Column(Integer)
    square_footage = Column(Float)
    lot_size = Column(Float)
    bedrooms = Column(Integer)
    bathrooms = Column(Float)
    stories = Column(Integer)

    # Valuation
    assessed_value = Column(Float)
    market_value = Column(Float)
    last_sale_date = Column(DateTime, nullable=True)
    last_sale_price = Column(Float, nullable=True)

    # Owner Information
    owner_name = Column(String(200))
    owner_address = Column(String(500))
    owner_phone = Column(String(20), nullable=True)
    owner_email = Column(String(200), nullable=True)
    ownership_type = Column(String(100))  # Individual, LLC, Trust, etc.

    # HOA Information
    has_hoa = Column(Boolean, default=False)
    hoa_name = Column(String(200), nullable=True)
    hoa_contact = Column(String(200), nullable=True)
    hoa_fee = Column(Float, nullable=True)

    # Building Condition Indicators
    recent_permits = Column(Integer, default=0)  # Count of permits in last 5 years
    last_permit_date = Column(DateTime, nullable=True)
    roof_age_estimate = Column(Integer, nullable=True)
    needs_assessment = Column(Text, nullable=True)

    # Opportunity Analysis
    is_opportunity = Column(Boolean, default=False)
    opportunity_score = Column(Float, nullable=True)  # AI-generated score 0-100
    opportunity_reasons = Column(Text, nullable=True)  # JSON array of reasons
    predicted_remodel_year = Column(Integer, nullable=True)

    # Metadata
    municipality_id = Column(Integer, ForeignKey("municipalities.id"))
    source_url = Column(String(500))
    scraped_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    municipality = relationship("Municipality", back_populates="properties")

    def __repr__(self):
        return f"<Property {self.parcel_id} - {self.address}>"
