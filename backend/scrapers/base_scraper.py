"""
Base Scraper Class
"""
from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import requests
import asyncio
import random
from loguru import logger
from datetime import datetime

from core.config import settings
from models.municipality import Municipality


class BaseScraper(ABC):
    """
    Abstract base class for all scrapers
    """

    def __init__(self, db: Session, municipality: Municipality):
        self.db = db
        self.municipality = municipality
        self.headers = {
            'User-Agent': settings.SCRAPER_USER_AGENT
        }

    async def scrape_permits(self) -> dict:
        """Scrape construction permits"""
        return {"new": 0, "updated": 0}

    async def scrape_bids(self) -> dict:
        """Scrape municipal bids"""
        return {"new": 0, "updated": 0}

    async def scrape_properties(self) -> dict:
        """Scrape property data"""
        return {"new": 0, "updated": 0}

    async def test_connection(self) -> dict:
        """Test connection to data source"""
        return {"status": "not_implemented"}

    async def _delay(self):
        """Random delay between requests"""
        delay = random.uniform(settings.SCRAPER_DELAY_MIN, settings.SCRAPER_DELAY_MAX)
        await asyncio.sleep(delay)

    async def _fetch_html(self, url: str) -> str:
        """
        Fetch HTML content from URL

        Args:
            url: URL to fetch

        Returns:
            HTML content as string
        """
        try:
            response = requests.get(
                url,
                headers=self.headers,
                timeout=settings.SCRAPER_TIMEOUT
            )
            response.raise_for_status()
            return response.text

        except Exception as e:
            logger.error(f"Failed to fetch {url}: {str(e)}")
            return ""

    async def _fetch_with_playwright(self, url: str) -> str:
        """
        Fetch page with Playwright (for JavaScript-heavy sites)

        Args:
            url: URL to fetch

        Returns:
            Rendered HTML content
        """
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent=settings.SCRAPER_USER_AGENT
                )
                page = await context.new_page()

                await page.goto(url, wait_until='networkidle', timeout=settings.SCRAPER_TIMEOUT * 1000)
                content = await page.content()

                await browser.close()
                return content

        except Exception as e:
            logger.error(f"Playwright fetch failed for {url}: {str(e)}")
            return ""

    def _parse_html(self, html: str) -> BeautifulSoup:
        """
        Parse HTML with BeautifulSoup

        Args:
            html: HTML string

        Returns:
            BeautifulSoup object
        """
        return BeautifulSoup(html, 'lxml')

    def _clean_text(self, text: str) -> str:
        """Clean extracted text"""
        if not text:
            return ""

        # Remove extra whitespace
        text = ' '.join(text.split())
        return text.strip()

    def _parse_date(self, date_string: str) -> datetime:
        """
        Parse date string to datetime

        Args:
            date_string: Date string in various formats

        Returns:
            datetime object or None
        """
        from dateutil import parser

        try:
            return parser.parse(date_string)
        except:
            return None

    def _parse_currency(self, value_string: str) -> float:
        """
        Parse currency string to float

        Args:
            value_string: Currency string like "$1,234.56"

        Returns:
            Float value or None
        """
        import re

        if not value_string:
            return None

        # Remove currency symbols and commas
        cleaned = re.sub(r'[^\d.]', '', str(value_string))

        try:
            return float(cleaned)
        except:
            return None

    async def _save_permit(self, permit_data: dict) -> tuple:
        """
        Save or update permit in database

        Args:
            permit_data: Dictionary of permit data

        Returns:
            Tuple of (permit, is_new)
        """
        from models.permit import Permit

        # Check if exists
        existing = self.db.query(Permit).filter(
            Permit.permit_number == permit_data.get('permit_number')
        ).first()

        if existing:
            # Update existing
            for key, value in permit_data.items():
                setattr(existing, key, value)
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            return (existing, False)
        else:
            # Create new
            permit = Permit(**permit_data)
            permit.municipality_id = self.municipality.id
            permit.scraped_at = datetime.utcnow()
            self.db.add(permit)
            self.db.commit()
            return (permit, True)

    async def _save_bid(self, bid_data: dict) -> tuple:
        """
        Save or update bid in database

        Args:
            bid_data: Dictionary of bid data

        Returns:
            Tuple of (bid, is_new)
        """
        from models.bid import Bid

        # Check if exists
        existing = self.db.query(Bid).filter(
            Bid.bid_number == bid_data.get('bid_number')
        ).first()

        if existing:
            # Update existing
            for key, value in bid_data.items():
                setattr(existing, key, value)
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            return (existing, False)
        else:
            # Create new
            bid = Bid(**bid_data)
            bid.municipality_id = self.municipality.id
            bid.scraped_at = datetime.utcnow()
            self.db.add(bid)
            self.db.commit()
            return (bid, True)

    async def _save_property(self, property_data: dict) -> tuple:
        """
        Save or update property in database

        Args:
            property_data: Dictionary of property data

        Returns:
            Tuple of (property, is_new)
        """
        from models.property import Property

        # Check if exists
        existing = self.db.query(Property).filter(
            Property.parcel_id == property_data.get('parcel_id')
        ).first()

        if existing:
            # Update existing
            for key, value in property_data.items():
                setattr(existing, key, value)
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            return (existing, False)
        else:
            # Create new
            prop = Property(**property_data)
            prop.municipality_id = self.municipality.id
            prop.scraped_at = datetime.utcnow()
            self.db.add(prop)
            self.db.commit()
            return (prop, True)
