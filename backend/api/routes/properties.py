"""
Property Data Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from typing import Optional
from datetime import datetime

from core.database import get_db
from models.property import Property

router = APIRouter()

@router.get("/")
async def get_properties(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    city: Optional[str] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    has_hoa: Optional[bool] = None,
    opportunities_only: bool = False,
    min_score: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """
    Get list of properties with filtering options
    """
    query = db.query(Property)

    # Apply filters
    if city:
        query = query.filter(Property.city.ilike(f"%{city}%"))

    if min_age:
        max_year = datetime.now().year - min_age
        query = query.filter(Property.year_built <= max_year)

    if max_age:
        min_year = datetime.now().year - max_age
        query = query.filter(Property.year_built >= min_year)

    if has_hoa is not None:
        query = query.filter(Property.has_hoa == has_hoa)

    if opportunities_only:
        query = query.filter(Property.is_opportunity == True)

    if min_score:
        query = query.filter(Property.opportunity_score >= min_score)

    # Order by opportunity score
    query = query.order_by(desc(Property.opportunity_score))

    # Pagination
    total = query.count()
    properties = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [
            {
                "id": p.id,
                "parcel_id": p.parcel_id,
                "address": p.address,
                "city": p.city,
                "state": p.state,
                "zip_code": p.zip_code,
                "property_type": p.property_type,
                "year_built": p.year_built,
                "building_age": p.building_age,
                "square_footage": p.square_footage,
                "assessed_value": p.assessed_value,
                "owner_name": p.owner_name,
                "has_hoa": p.has_hoa,
                "recent_permits": p.recent_permits,
                "is_opportunity": p.is_opportunity,
                "opportunity_score": p.opportunity_score
            } for p in properties
        ]
    }

@router.get("/{property_id}")
async def get_property(property_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific property
    """
    property = db.query(Property).filter(Property.id == property_id).first()

    if not property:
        raise HTTPException(status_code=404, detail="Property not found")

    return {
        "id": property.id,
        "parcel_id": property.parcel_id,
        "property_id": property.property_id,
        "address": property.address,
        "city": property.city,
        "state": property.state,
        "zip_code": property.zip_code,
        "county": property.county,
        "latitude": property.latitude,
        "longitude": property.longitude,
        "property_type": property.property_type,
        "year_built": property.year_built,
        "building_age": property.building_age,
        "square_footage": property.square_footage,
        "lot_size": property.lot_size,
        "bedrooms": property.bedrooms,
        "bathrooms": property.bathrooms,
        "stories": property.stories,
        "assessed_value": property.assessed_value,
        "market_value": property.market_value,
        "last_sale_date": property.last_sale_date,
        "last_sale_price": property.last_sale_price,
        "owner_name": property.owner_name,
        "owner_address": property.owner_address,
        "owner_phone": property.owner_phone,
        "owner_email": property.owner_email,
        "ownership_type": property.ownership_type,
        "has_hoa": property.has_hoa,
        "hoa_name": property.hoa_name,
        "hoa_contact": property.hoa_contact,
        "hoa_fee": property.hoa_fee,
        "recent_permits": property.recent_permits,
        "last_permit_date": property.last_permit_date,
        "roof_age_estimate": property.roof_age_estimate,
        "needs_assessment": property.needs_assessment,
        "is_opportunity": property.is_opportunity,
        "opportunity_score": property.opportunity_score,
        "opportunity_reasons": property.opportunity_reasons,
        "predicted_remodel_year": property.predicted_remodel_year,
        "source_url": property.source_url,
        "scraped_at": property.scraped_at
    }

@router.get("/stats/summary")
async def get_property_stats(db: Session = Depends(get_db)):
    """
    Get summary statistics for properties
    """
    from sqlalchemy import func

    total = db.query(func.count(Property.id)).scalar()
    opportunities = db.query(func.count(Property.id)).filter(Property.is_opportunity == True).scalar()
    avg_age = db.query(func.avg(Property.building_age)).filter(Property.building_age > 0).scalar()
    with_hoa = db.query(func.count(Property.id)).filter(Property.has_hoa == True).scalar()

    # Age distribution
    current_year = datetime.now().year
    age_ranges = [
        ("0-10 years", current_year - 10, current_year),
        ("11-20 years", current_year - 20, current_year - 10),
        ("21-30 years", current_year - 30, current_year - 20),
        ("31+ years", 1900, current_year - 30)
    ]

    age_distribution = []
    for label, min_year, max_year in age_ranges:
        count = db.query(func.count(Property.id)).filter(
            and_(Property.year_built >= min_year, Property.year_built < max_year)
        ).scalar()
        age_distribution.append({"range": label, "count": count})

    return {
        "total_properties": total,
        "opportunities": opportunities,
        "average_building_age": round(avg_age, 1) if avg_age else 0,
        "properties_with_hoa": with_hoa,
        "age_distribution": age_distribution
    }
