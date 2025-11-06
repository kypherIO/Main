"""
Scraper Control Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from core.database import get_db
from models.municipality import Municipality
from models.scrape_log import ScrapeLog

router = APIRouter()

@router.post("/start")
async def start_scraping(
    background_tasks: BackgroundTasks,
    municipality_slug: Optional[str] = None,
    data_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Start a scraping task

    Args:
        municipality_slug: Specific municipality to scrape (or all if None)
        data_type: Type of data to scrape: permits, bids, properties (or all if None)
    """
    from services.scraper_service import ScraperService

    # Validate municipality if specified
    if municipality_slug:
        municipality = db.query(Municipality).filter(
            Municipality.slug == municipality_slug,
            Municipality.is_active == True
        ).first()

        if not municipality:
            raise HTTPException(status_code=404, detail=f"Municipality '{municipality_slug}' not found or inactive")

    # Validate data type
    valid_types = ["permits", "bids", "properties"]
    if data_type and data_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid data_type. Must be one of: {', '.join(valid_types)}")

    # Create scrape log
    scrape_log = ScrapeLog(
        municipality_id=municipality.id if municipality_slug else None,
        data_type=data_type or "all",
        status="queued",
        triggered_by="api",
        started_at=datetime.utcnow()
    )
    db.add(scrape_log)
    db.commit()

    # Queue scraping task
    scraper_service = ScraperService(db)
    background_tasks.add_task(
        scraper_service.run_scraping,
        municipality_slug=municipality_slug,
        data_type=data_type,
        log_id=scrape_log.id
    )

    return {
        "message": "Scraping task queued",
        "log_id": scrape_log.id,
        "municipality": municipality_slug or "all",
        "data_type": data_type or "all"
    }

@router.get("/status")
async def get_scraper_status(db: Session = Depends(get_db)):
    """
    Get current scraping status
    """
    # Get running tasks
    running = db.query(ScrapeLog).filter(ScrapeLog.status == "running").all()

    # Get recent completed
    from sqlalchemy import desc
    recent = db.query(ScrapeLog).filter(
        ScrapeLog.status.in_(["success", "failed", "partial"])
    ).order_by(desc(ScrapeLog.completed_at)).limit(10).all()

    return {
        "running_tasks": len(running),
        "running": [
            {
                "id": log.id,
                "municipality_id": log.municipality_id,
                "data_type": log.data_type,
                "started_at": log.started_at,
                "items_found": log.items_found
            } for log in running
        ],
        "recent_completed": [
            {
                "id": log.id,
                "municipality_id": log.municipality_id,
                "data_type": log.data_type,
                "status": log.status,
                "started_at": log.started_at,
                "completed_at": log.completed_at,
                "duration_seconds": log.duration_seconds,
                "items_new": log.items_new,
                "items_updated": log.items_updated
            } for log in recent
        ]
    }

@router.get("/logs")
async def get_scrape_logs(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get scraping logs with pagination
    """
    from sqlalchemy import desc

    query = db.query(ScrapeLog)

    if status:
        query = query.filter(ScrapeLog.status == status)

    query = query.order_by(desc(ScrapeLog.started_at))

    total = query.count()
    logs = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [
            {
                "id": log.id,
                "municipality_id": log.municipality_id,
                "data_type": log.data_type,
                "scraper_type": log.scraper_type,
                "started_at": log.started_at,
                "completed_at": log.completed_at,
                "duration_seconds": log.duration_seconds,
                "status": log.status,
                "items_found": log.items_found,
                "items_new": log.items_new,
                "items_updated": log.items_updated,
                "items_failed": log.items_failed,
                "error_message": log.error_message
            } for log in logs
        ]
    }

@router.get("/municipalities")
async def get_municipalities(db: Session = Depends(get_db)):
    """
    Get list of configured municipalities
    """
    municipalities = db.query(Municipality).filter(
        Municipality.is_active == True
    ).all()

    return {
        "total": len(municipalities),
        "municipalities": [
            {
                "id": m.id,
                "name": m.name,
                "slug": m.slug,
                "city": m.city,
                "state": m.state,
                "distance_from_base": m.distance_from_base,
                "permits_enabled": m.permits_enabled,
                "bids_enabled": m.bids_enabled,
                "properties_enabled": m.properties_enabled,
                "last_scraped_at": m.last_scraped_at,
                "last_scrape_status": m.last_scrape_status,
                "total_permits": m.total_permits,
                "total_bids": m.total_bids,
                "total_properties": m.total_properties
            } for m in municipalities
        ]
    }
