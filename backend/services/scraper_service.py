"""
Main Scraper Service Coordinator
"""
from sqlalchemy.orm import Session
from loguru import logger
from datetime import datetime
from typing import Optional
import asyncio

from models.municipality import Municipality
from models.scrape_log import ScrapeLog
from scrapers.bowling_green_scraper import BowlingGreenScraper
from scrapers.generic_scraper import GenericScraper


class ScraperService:
    """
    Coordinates scraping activities across municipalities
    """

    def __init__(self, db: Session):
        self.db = db

    async def run_scraping(
        self,
        municipality_slug: Optional[str] = None,
        data_type: Optional[str] = None,
        log_id: Optional[int] = None
    ):
        """
        Execute scraping task

        Args:
            municipality_slug: Specific municipality or None for all
            data_type: Type of data to scrape or None for all
            log_id: Scrape log ID for tracking
        """
        try:
            # Get municipalities to scrape
            query = self.db.query(Municipality).filter(Municipality.is_active == True)

            if municipality_slug:
                query = query.filter(Municipality.slug == municipality_slug)

            municipalities = query.all()

            if not municipalities:
                logger.warning(f"No active municipalities found for slug: {municipality_slug}")
                return

            # Update log status
            if log_id:
                log = self.db.query(ScrapeLog).filter(ScrapeLog.id == log_id).first()
                if log:
                    log.status = "running"
                    self.db.commit()

            total_new = 0
            total_updated = 0

            # Scrape each municipality
            for municipality in municipalities:
                logger.info(f"Scraping {municipality.name}...")

                try:
                    # Select appropriate scraper
                    scraper = self._get_scraper(municipality)

                    # Scrape based on data type
                    if not data_type or data_type == "permits":
                        if municipality.permits_enabled:
                            results = await scraper.scrape_permits()
                            total_new += results.get('new', 0)
                            total_updated += results.get('updated', 0)
                            logger.info(f"Permits: {results.get('new', 0)} new, {results.get('updated', 0)} updated")

                    if not data_type or data_type == "bids":
                        if municipality.bids_enabled:
                            results = await scraper.scrape_bids()
                            total_new += results.get('new', 0)
                            total_updated += results.get('updated', 0)
                            logger.info(f"Bids: {results.get('new', 0)} new, {results.get('updated', 0)} updated")

                    if not data_type or data_type == "properties":
                        if municipality.properties_enabled:
                            results = await scraper.scrape_properties()
                            total_new += results.get('new', 0)
                            total_updated += results.get('updated', 0)
                            logger.info(f"Properties: {results.get('new', 0)} new, {results.get('updated', 0)} updated")

                    # Update municipality stats
                    municipality.last_scraped_at = datetime.utcnow()
                    municipality.last_scrape_status = "success"
                    self.db.commit()

                except Exception as e:
                    logger.error(f"Failed to scrape {municipality.name}: {str(e)}")
                    municipality.last_scrape_status = "failed"
                    municipality.scrape_error = str(e)
                    self.db.commit()

            # Update log
            if log_id:
                log = self.db.query(ScrapeLog).filter(ScrapeLog.id == log_id).first()
                if log:
                    log.status = "success"
                    log.completed_at = datetime.utcnow()
                    log.items_new = total_new
                    log.items_updated = total_updated
                    log.duration_seconds = int((log.completed_at - log.started_at).total_seconds())
                    self.db.commit()

            logger.info(f"Scraping completed: {total_new} new, {total_updated} updated")

        except Exception as e:
            logger.error(f"Scraping task failed: {str(e)}")

            if log_id:
                log = self.db.query(ScrapeLog).filter(ScrapeLog.id == log_id).first()
                if log:
                    log.status = "failed"
                    log.completed_at = datetime.utcnow()
                    log.error_message = str(e)
                    self.db.commit()

    def _get_scraper(self, municipality: Municipality):
        """
        Get appropriate scraper instance for municipality

        Args:
            municipality: Municipality model

        Returns:
            Scraper instance
        """
        # Use specialized scraper for known municipalities
        if municipality.slug == "bowling-green-ky":
            return BowlingGreenScraper(self.db, municipality)

        # Use generic scraper for others
        return GenericScraper(self.db, municipality)

    async def test_scraper(self, municipality_slug: str) -> dict:
        """
        Test scraper for a municipality without saving data

        Args:
            municipality_slug: Municipality slug to test

        Returns:
            Test results
        """
        municipality = self.db.query(Municipality).filter(
            Municipality.slug == municipality_slug
        ).first()

        if not municipality:
            return {"error": "Municipality not found"}

        try:
            scraper = self._get_scraper(municipality)
            results = await scraper.test_connection()

            return {
                "municipality": municipality.name,
                "status": "success",
                "results": results
            }

        except Exception as e:
            logger.error(f"Scraper test failed: {str(e)}")
            return {
                "municipality": municipality.name,
                "status": "failed",
                "error": str(e)
            }
