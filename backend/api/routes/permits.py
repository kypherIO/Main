"""
Permit Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from typing import List, Optional
from datetime import datetime, timedelta

from core.database import get_db
from models.permit import Permit
from models.municipality import Municipality

router = APIRouter()

@router.get("/")
async def get_permits(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    city: Optional[str] = None,
    status: Optional[str] = None,
    opportunities_only: bool = False,
    min_value: Optional[float] = None,
    days_recent: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get list of construction permits with filtering options
    """
    query = db.query(Permit)

    # Apply filters
    if city:
        query = query.filter(Permit.city.ilike(f"%{city}%"))

    if status:
        query = query.filter(Permit.status == status)

    if opportunities_only:
        query = query.filter(Permit.is_opportunity == True)

    if min_value:
        query = query.filter(Permit.project_value >= min_value)

    if days_recent:
        cutoff_date = datetime.utcnow() - timedelta(days=days_recent)
        query = query.filter(Permit.issue_date >= cutoff_date)

    # Order by most recent first
    query = query.order_by(desc(Permit.issue_date))

    # Pagination
    total = query.count()
    permits = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [
            {
                "id": p.id,
                "permit_number": p.permit_number,
                "permit_type": p.permit_type,
                "address": p.address,
                "city": p.city,
                "state": p.state,
                "description": p.description,
                "work_type": p.work_type,
                "project_value": p.project_value,
                "issue_date": p.issue_date,
                "status": p.status,
                "owner_name": p.owner_name,
                "contractor_name": p.contractor_name,
                "is_opportunity": p.is_opportunity,
                "opportunity_score": p.opportunity_score
            } for p in permits
        ]
    }

@router.get("/{permit_id}")
async def get_permit(permit_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific permit
    """
    permit = db.query(Permit).filter(Permit.id == permit_id).first()

    if not permit:
        raise HTTPException(status_code=404, detail="Permit not found")

    return {
        "id": permit.id,
        "permit_number": permit.permit_number,
        "permit_type": permit.permit_type,
        "address": permit.address,
        "city": permit.city,
        "state": permit.state,
        "zip_code": permit.zip_code,
        "county": permit.county,
        "latitude": permit.latitude,
        "longitude": permit.longitude,
        "description": permit.description,
        "work_type": permit.work_type,
        "project_value": permit.project_value,
        "square_footage": permit.square_footage,
        "issue_date": permit.issue_date,
        "expiration_date": permit.expiration_date,
        "completion_date": permit.completion_date,
        "owner_name": permit.owner_name,
        "owner_phone": permit.owner_phone,
        "contractor_name": permit.contractor_name,
        "contractor_license": permit.contractor_license,
        "status": permit.status,
        "is_opportunity": permit.is_opportunity,
        "opportunity_score": permit.opportunity_score,
        "source_url": permit.source_url,
        "scraped_at": permit.scraped_at
    }

@router.get("/stats/summary")
async def get_permit_stats(db: Session = Depends(get_db)):
    """
    Get summary statistics for permits
    """
    from sqlalchemy import func

    total = db.query(func.count(Permit.id)).scalar()
    opportunities = db.query(func.count(Permit.id)).filter(Permit.is_opportunity == True).scalar()
    avg_value = db.query(func.avg(Permit.project_value)).filter(Permit.project_value > 0).scalar()

    # Recent permits (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent = db.query(func.count(Permit.id)).filter(Permit.issue_date >= thirty_days_ago).scalar()

    # By city
    by_city = db.query(
        Permit.city,
        func.count(Permit.id).label('count')
    ).group_by(Permit.city).order_by(desc('count')).limit(10).all()

    return {
        "total_permits": total,
        "opportunities": opportunities,
        "average_project_value": round(avg_value, 2) if avg_value else 0,
        "recent_permits_30_days": recent,
        "top_cities": [{"city": city, "count": count} for city, count in by_city]
    }
