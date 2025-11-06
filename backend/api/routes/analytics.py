"""
Analytics and AI-Powered Insights Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from core.database import get_db
from models.permit import Permit
from models.bid import Bid
from models.property import Property

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Get dashboard summary with key metrics
    """
    from sqlalchemy import func, desc

    # Time ranges
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    # Permits
    total_permits = db.query(func.count(Permit.id)).scalar()
    recent_permits = db.query(func.count(Permit.id)).filter(
        Permit.issue_date >= thirty_days_ago
    ).scalar()
    permit_opportunities = db.query(func.count(Permit.id)).filter(
        Permit.is_opportunity == True
    ).scalar()

    # Bids
    total_bids = db.query(func.count(Bid.id)).scalar()
    active_bids = db.query(func.count(Bid.id)).filter(
        Bid.status == "Open",
        Bid.due_date >= datetime.utcnow()
    ).scalar()
    bid_opportunities = db.query(func.count(Bid.id)).filter(
        Bid.is_opportunity == True
    ).scalar()

    # Properties
    total_properties = db.query(func.count(Property.id)).scalar()
    property_opportunities = db.query(func.count(Property.id)).filter(
        Property.is_opportunity == True
    ).scalar()

    # Recent activity
    recent_high_value_permits = db.query(Permit).filter(
        Permit.project_value >= 50000,
        Permit.issue_date >= seven_days_ago
    ).order_by(desc(Permit.project_value)).limit(5).all()

    return {
        "permits": {
            "total": total_permits,
            "recent_30_days": recent_permits,
            "opportunities": permit_opportunities
        },
        "bids": {
            "total": total_bids,
            "active": active_bids,
            "opportunities": bid_opportunities
        },
        "properties": {
            "total": total_properties,
            "opportunities": property_opportunities
        },
        "recent_high_value_permits": [
            {
                "id": p.id,
                "permit_number": p.permit_number,
                "address": p.address,
                "city": p.city,
                "project_value": p.project_value,
                "work_type": p.work_type,
                "issue_date": p.issue_date
            } for p in recent_high_value_permits
        ]
    }

@router.get("/trends/permits")
async def get_permit_trends(
    days: int = Query(30, ge=7, le=365),
    city: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get permit trends over time
    """
    from sqlalchemy import func, cast, Date

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    query = db.query(
        cast(Permit.issue_date, Date).label('date'),
        func.count(Permit.id).label('count'),
        func.sum(Permit.project_value).label('total_value')
    ).filter(Permit.issue_date >= cutoff_date)

    if city:
        query = query.filter(Permit.city.ilike(f"%{city}%"))

    trends = query.group_by('date').order_by('date').all()

    return {
        "period_days": days,
        "city": city,
        "data": [
            {
                "date": str(t.date),
                "count": t.count,
                "total_value": float(t.total_value) if t.total_value else 0
            } for t in trends
        ]
    }

@router.get("/insights/opportunities")
async def get_opportunity_insights(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Get AI-scored opportunities across all data types
    """
    from sqlalchemy import desc

    # Top permit opportunities
    top_permits = db.query(Permit).filter(
        Permit.is_opportunity == True
    ).order_by(desc(Permit.opportunity_score)).limit(limit).all()

    # Top bid opportunities
    top_bids = db.query(Bid).filter(
        Bid.is_opportunity == True,
        Bid.status == "Open"
    ).order_by(desc(Bid.opportunity_score)).limit(limit).all()

    # Top property opportunities
    top_properties = db.query(Property).filter(
        Property.is_opportunity == True
    ).order_by(desc(Property.opportunity_score)).limit(limit).all()

    return {
        "permits": [
            {
                "id": p.id,
                "type": "permit",
                "permit_number": p.permit_number,
                "address": p.address,
                "city": p.city,
                "project_value": p.project_value,
                "work_type": p.work_type,
                "opportunity_score": p.opportunity_score,
                "owner_name": p.owner_name
            } for p in top_permits
        ],
        "bids": [
            {
                "id": b.id,
                "type": "bid",
                "bid_number": b.bid_number,
                "title": b.title,
                "city": b.city,
                "estimated_value": b.estimated_value,
                "due_date": b.due_date,
                "opportunity_score": b.opportunity_score,
                "agency_name": b.agency_name
            } for b in top_bids
        ],
        "properties": [
            {
                "id": p.id,
                "type": "property",
                "address": p.address,
                "city": p.city,
                "building_age": p.building_age,
                "assessed_value": p.assessed_value,
                "opportunity_score": p.opportunity_score,
                "owner_name": p.owner_name,
                "opportunity_reasons": p.opportunity_reasons
            } for p in top_properties
        ]
    }

@router.get("/correlations/property-age-permits")
async def get_age_permit_correlation(db: Session = Depends(get_db)):
    """
    Analyze correlation between property age and permit activity
    """
    from sqlalchemy import func, case

    # Group properties by age ranges and count permits
    current_year = datetime.now().year

    age_ranges = [
        ("0-10", 0, 10),
        ("11-20", 11, 20),
        ("21-30", 21, 30),
        ("31-40", 31, 40),
        ("41-50", 41, 50),
        ("51+", 51, 200)
    ]

    results = []
    for label, min_age, max_age in age_ranges:
        count = db.query(func.count(Property.id)).filter(
            Property.building_age >= min_age,
            Property.building_age <= max_age,
            Property.recent_permits > 0
        ).scalar()

        total = db.query(func.count(Property.id)).filter(
            Property.building_age >= min_age,
            Property.building_age <= max_age
        ).scalar()

        percentage = (count / total * 100) if total > 0 else 0

        results.append({
            "age_range": label,
            "properties_with_permits": count,
            "total_properties": total,
            "percentage": round(percentage, 2)
        })

    return {
        "correlation_data": results,
        "insight": "Properties in certain age ranges are more likely to need remodeling work"
    }

@router.post("/analyze")
async def analyze_with_ai(
    data_type: str = Query(..., regex="^(permit|bid|property)$"),
    item_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get AI-powered analysis of a specific item using xAI
    """
    from services.ai_service import AIService

    # Get the item
    if data_type == "permit":
        item = db.query(Permit).filter(Permit.id == item_id).first()
    elif data_type == "bid":
        item = db.query(Bid).filter(Bid.id == item_id).first()
    else:  # property
        item = db.query(Property).filter(Property.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail=f"{data_type.capitalize()} not found")

    # Get AI analysis
    ai_service = AIService()
    analysis = await ai_service.analyze_opportunity(data_type, item)

    return {
        "data_type": data_type,
        "item_id": item_id,
        "analysis": analysis
    }
