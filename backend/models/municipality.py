"""
Municipality Configuration Model
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class Municipality(Base):
    __tablename__ = "municipalities"

    id = Column(Integer, primary_key=True, index=True)

    # Basic Info
    name = Column(String(200), nullable=False, index=True)
    slug = Column(String(100), unique=True, nullable=False)  # URL-friendly identifier
    city = Column(String(100))
    county = Column(String(100))
    state = Column(String(2), nullable=False)

    # Geographic Info
    latitude = Column(Float)
    longitude = Column(Float)
    distance_from_base = Column(Float)  # Miles from Bowling Green

    # URLs
    website_url = Column(String(500))
    permits_url = Column(String(500))
    bids_url = Column(String(500))
    property_records_url = Column(String(500))
    gis_url = Column(String(500))

    # Scraping Configuration
    permits_enabled = Column(Boolean, default=True)
    bids_enabled = Column(Boolean, default=True)
    properties_enabled = Column(Boolean, default=True)

    # Scraper type for each data source
    permits_scraper_type = Column(String(50))  # 'html', 'api', 'selenium', 'playwright'
    bids_scraper_type = Column(String(50))
    properties_scraper_type = Column(String(50))

    # Selectors/API info (JSON)
    permits_config = Column(Text)  # JSON configuration for scraping
    bids_config = Column(Text)
    properties_config = Column(Text)

    # Status
    is_active = Column(Boolean, default=True)
    last_scraped_at = Column(DateTime, nullable=True)
    last_scrape_status = Column(String(50))  # success, failed, partial
    scrape_error = Column(Text, nullable=True)

    # Statistics
    total_permits = Column(Integer, default=0)
    total_bids = Column(Integer, default=0)
    total_properties = Column(Integer, default=0)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    permits = relationship("Permit", back_populates="municipality")
    bids = relationship("Bid", back_populates="municipality")
    properties = relationship("Property", back_populates="municipality")
    scrape_logs = relationship("ScrapeLog", back_populates="municipality")

    def __repr__(self):
        return f"<Municipality {self.name}, {self.state}>"
