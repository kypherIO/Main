"""
Health Check Endpoints
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from core.config import settings
import platform

router = APIRouter()

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """
    System health check endpoint
    """
    # Test database connection
    try:
        db.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "operational",
        "version": settings.APP_VERSION,
        "database": db_status,
        "platform": platform.system(),
        "machine": platform.machine()
    }

@router.get("/status")
async def system_status(db: Session = Depends(get_db)):
    """
    Detailed system status
    """
    from models import Municipality, Permit, Bid, Property, ScrapeLog
    from sqlalchemy import func

    # Get counts
    municipalities_count = db.query(func.count(Municipality.id)).scalar()
    permits_count = db.query(func.count(Permit.id)).scalar()
    bids_count = db.query(func.count(Bid.id)).scalar()
    properties_count = db.query(func.count(Property.id)).scalar()

    # Get recent scrape
    last_scrape = db.query(ScrapeLog).order_by(ScrapeLog.started_at.desc()).first()

    return {
        "status": "operational",
        "statistics": {
            "municipalities": municipalities_count,
            "permits": permits_count,
            "bids": bids_count,
            "properties": properties_count
        },
        "last_scrape": {
            "date": last_scrape.started_at if last_scrape else None,
            "status": last_scrape.status if last_scrape else None,
            "type": last_scrape.data_type if last_scrape else None
        } if last_scrape else None
    }
