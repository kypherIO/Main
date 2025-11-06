"""
Scraping Activity Log Model
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class ScrapeLog(Base):
    __tablename__ = "scrape_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Target Information
    municipality_id = Column(Integer, ForeignKey("municipalities.id"))
    data_type = Column(String(50), index=True)  # permits, bids, properties
    scraper_type = Column(String(50))  # html, api, selenium, playwright

    # Execution
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    # Results
    status = Column(String(50), index=True)  # running, success, failed, partial
    items_found = Column(Integer, default=0)
    items_new = Column(Integer, default=0)
    items_updated = Column(Integer, default=0)
    items_failed = Column(Integer, default=0)

    # Error Handling
    error_message = Column(Text, nullable=True)
    error_details = Column(Text, nullable=True)  # Stack trace if needed

    # Metadata
    triggered_by = Column(String(100))  # manual, scheduled, api
    target_url = Column(String(500))

    # Relationships
    municipality = relationship("Municipality", back_populates="scrape_logs")

    def __repr__(self):
        return f"<ScrapeLog {self.data_type} - {self.municipality_id} - {self.status}>"
