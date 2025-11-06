"""
Database Initialization Script

Run this to create the database and load initial municipality data
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import engine, Base
from core.config import settings
from models import Municipality, Permit, Bid, Property, ScrapeLog
import json
from loguru import logger
from sqlalchemy.orm import Session
from core.database import SessionLocal


def init_database():
    """Initialize database tables"""
    logger.info("Creating database tables...")

    # Create all tables
    Base.metadata.create_all(bind=engine)

    logger.info("Database tables created successfully!")


def load_municipalities():
    """Load initial municipality configuration"""
    logger.info("Loading municipality configuration...")

    config_file = Path(__file__).parent.parent / "config" / "municipalities.json"

    if not config_file.exists():
        logger.warning(f"Municipality config not found at {config_file}")
        return

    with open(config_file, 'r') as f:
        municipalities = json.load(f)

    db = SessionLocal()

    try:
        for muni_data in municipalities:
            # Check if already exists
            existing = db.query(Municipality).filter(
                Municipality.slug == muni_data['slug']
            ).first()

            if existing:
                logger.info(f"Municipality {muni_data['name']} already exists, skipping...")
                continue

            # Create new municipality
            municipality = Municipality(**muni_data)
            db.add(municipality)
            logger.info(f"Added municipality: {muni_data['name']}")

        db.commit()
        logger.info(f"Loaded {len(municipalities)} municipalities")

    except Exception as e:
        logger.error(f"Failed to load municipalities: {str(e)}")
        db.rollback()

    finally:
        db.close()


def create_sample_data():
    """Create sample data for testing"""
    logger.info("Creating sample data...")

    db = SessionLocal()

    try:
        from datetime import datetime, timedelta

        # Get Bowling Green municipality
        bg = db.query(Municipality).filter(Municipality.slug == "bowling-green-ky").first()

        if not bg:
            logger.warning("Bowling Green municipality not found, skipping sample data")
            return

        # Sample permit
        sample_permit = Permit(
            permit_number="2024-001-SAMPLE",
            permit_type="Building",
            address="123 Main Street",
            city="Bowling Green",
            state="KY",
            zip_code="42101",
            county="Warren",
            description="Kitchen and bathroom remodel",
            work_type="Remodel",
            project_value=45000.00,
            square_footage=1200,
            issue_date=datetime.utcnow() - timedelta(days=5),
            expiration_date=datetime.utcnow() + timedelta(days=175),
            owner_name="John Smith",
            owner_phone="270-555-0100",
            contractor_name="Sample Contractors LLC",
            status="Active",
            is_opportunity=True,
            opportunity_score=78.5,
            municipality_id=bg.id,
            source_url="https://www.bgky.org/permits"
        )

        # Sample bid
        sample_bid = Bid(
            bid_number="RFP-2024-001-SAMPLE",
            title="City Hall Renovation Project",
            description="Renovation of city hall main entrance and lobby area",
            category="Construction",
            project_type="Renovation",
            estimated_value=150000.00,
            location="City Hall, Bowling Green",
            city="Bowling Green",
            state="KY",
            county="Warren",
            posted_date=datetime.utcnow() - timedelta(days=10),
            due_date=datetime.utcnow() + timedelta(days=20),
            agency_name="City of Bowling Green",
            agency_contact="Purchasing Department",
            agency_phone="270-555-0200",
            status="Open",
            is_opportunity=True,
            opportunity_score=82.0,
            bonding_required=True,
            municipality_id=bg.id,
            source_url="https://www.bgky.org/bids"
        )

        # Sample property
        sample_property = Property(
            parcel_id="SAMPLE-001-2024",
            address="456 Oak Avenue",
            city="Bowling Green",
            state="KY",
            zip_code="42101",
            county="Warren",
            property_type="Residential",
            year_built=1985,
            building_age=2024 - 1985,
            square_footage=2400,
            lot_size=0.25,
            bedrooms=4,
            bathrooms=2.5,
            stories=2,
            assessed_value=185000.00,
            market_value=205000.00,
            last_sale_date=datetime(2015, 6, 15),
            last_sale_price=145000.00,
            owner_name="Jane Doe",
            ownership_type="Individual",
            has_hoa=True,
            hoa_name="Oak Hills HOA",
            recent_permits=0,
            roof_age_estimate=15,
            is_opportunity=True,
            opportunity_score=71.2,
            opportunity_reasons='["Building is 39 years old", "No recent permits", "Roof likely needs replacement", "In HOA neighborhood"]',
            predicted_remodel_year=2025,
            municipality_id=bg.id
        )

        # Check if samples already exist
        if not db.query(Permit).filter(Permit.permit_number == sample_permit.permit_number).first():
            db.add(sample_permit)
            logger.info("Added sample permit")

        if not db.query(Bid).filter(Bid.bid_number == sample_bid.bid_number).first():
            db.add(sample_bid)
            logger.info("Added sample bid")

        if not db.query(Property).filter(Property.parcel_id == sample_property.parcel_id).first():
            db.add(sample_property)
            logger.info("Added sample property")

        db.commit()
        logger.info("Sample data created successfully!")

    except Exception as e:
        logger.error(f"Failed to create sample data: {str(e)}")
        db.rollback()

    finally:
        db.close()


if __name__ == "__main__":
    logger.info("=== Kypher Database Initialization ===")
    logger.info(f"Database: {settings.DATABASE_URL}")

    init_database()
    load_municipalities()
    create_sample_data()

    logger.info("=== Initialization Complete ===")
    logger.info("You can now start the backend server with: python main.py")
