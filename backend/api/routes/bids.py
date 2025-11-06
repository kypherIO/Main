"""
Bid/RFP Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime, timedelta

from core.database import get_db
from models.bid import Bid

router = APIRouter()

@router.get("/")
async def get_bids(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    city: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    opportunities_only: bool = False,
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    """
    Get list of municipal bids with filtering options
    """
    query = db.query(Bid)

    # Apply filters
    if city:
        query = query.filter(Bid.city.ilike(f"%{city}%"))

    if status:
        query = query.filter(Bid.status == status)

    if category:
        query = query.filter(Bid.category.ilike(f"%{category}%"))

    if opportunities_only:
        query = query.filter(Bid.is_opportunity == True)

    if active_only:
        query = query.filter(Bid.status == "Open")
        query = query.filter(Bid.due_date >= datetime.utcnow())

    # Order by due date
    query = query.order_by(desc(Bid.posted_date))

    # Pagination
    total = query.count()
    bids = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [
            {
                "id": b.id,
                "bid_number": b.bid_number,
                "title": b.title,
                "category": b.category,
                "city": b.city,
                "state": b.state,
                "estimated_value": b.estimated_value,
                "posted_date": b.posted_date,
                "due_date": b.due_date,
                "status": b.status,
                "agency_name": b.agency_name,
                "is_opportunity": b.is_opportunity,
                "opportunity_score": b.opportunity_score
            } for b in bids
        ]
    }

@router.get("/{bid_id}")
async def get_bid(bid_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific bid
    """
    bid = db.query(Bid).filter(Bid.id == bid_id).first()

    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")

    return {
        "id": bid.id,
        "bid_number": bid.bid_number,
        "title": bid.title,
        "description": bid.description,
        "category": bid.category,
        "project_type": bid.project_type,
        "estimated_value": bid.estimated_value,
        "location": bid.location,
        "city": bid.city,
        "state": bid.state,
        "county": bid.county,
        "posted_date": bid.posted_date,
        "due_date": bid.due_date,
        "project_start_date": bid.project_start_date,
        "project_end_date": bid.project_end_date,
        "agency_name": bid.agency_name,
        "agency_contact": bid.agency_contact,
        "agency_phone": bid.agency_phone,
        "agency_email": bid.agency_email,
        "status": bid.status,
        "is_opportunity": bid.is_opportunity,
        "opportunity_score": bid.opportunity_score,
        "requirements": bid.requirements,
        "bonding_required": bid.bonding_required,
        "prevailing_wage": bid.prevailing_wage,
        "documents_url": bid.documents_url,
        "submission_url": bid.submission_url,
        "source_url": bid.source_url,
        "scraped_at": bid.scraped_at
    }

@router.get("/stats/summary")
async def get_bid_stats(db: Session = Depends(get_db)):
    """
    Get summary statistics for bids
    """
    from sqlalchemy import func

    total = db.query(func.count(Bid.id)).scalar()
    active = db.query(func.count(Bid.id)).filter(
        Bid.status == "Open",
        Bid.due_date >= datetime.utcnow()
    ).scalar()
    opportunities = db.query(func.count(Bid.id)).filter(Bid.is_opportunity == True).scalar()
    avg_value = db.query(func.avg(Bid.estimated_value)).filter(Bid.estimated_value > 0).scalar()

    # By category
    by_category = db.query(
        Bid.category,
        func.count(Bid.id).label('count')
    ).group_by(Bid.category).order_by(desc('count')).limit(10).all()

    return {
        "total_bids": total,
        "active_bids": active,
        "opportunities": opportunities,
        "average_estimated_value": round(avg_value, 2) if avg_value else 0,
        "top_categories": [{"category": cat, "count": count} for cat, count in by_category]
    }
