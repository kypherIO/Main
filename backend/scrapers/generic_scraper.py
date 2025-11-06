"""
Generic Scraper for Municipalities
"""
from .base_scraper import BaseScraper
from loguru import logger
import json


class GenericScraper(BaseScraper):
    """
    Generic scraper that uses configuration to scrape any municipality

    Uses the municipality's config JSON to determine selectors and parsing logic
    """

    async def scrape_permits(self) -> dict:
        """
        Scrape permits using configuration from municipality.permits_config
        """
        logger.info(f"Scraping permits for {self.municipality.name} (generic scraper)")

        if not self.municipality.permits_url:
            logger.warning(f"No permits URL configured for {self.municipality.name}")
            return {"new": 0, "updated": 0}

        new_count = 0
        updated_count = 0

        try:
            # Load configuration
            config = self._load_config(self.municipality.permits_config)
            if not config:
                logger.warning("No configuration available for permits")
                return {"new": 0, "updated": 0}

            # Fetch content based on scraper type
            if self.municipality.permits_scraper_type == "playwright":
                html = await self._fetch_with_playwright(self.municipality.permits_url)
            else:
                html = await self._fetch_html(self.municipality.permits_url)

            if not html:
                return {"new": 0, "updated": 0}

            soup = self._parse_html(html)

            # Use configured selectors
            row_selector = config.get('row_selector', '.permit-row')
            permit_rows = soup.select(row_selector)

            selectors = config.get('selectors', {})

            for row in permit_rows[:50]:  # Limit to 50 per scrape for POC
                try:
                    permit_data = {
                        'city': self.municipality.city,
                        'state': self.municipality.state,
                        'county': self.municipality.county,
                        'source_url': self.municipality.permits_url,
                        'status': 'Active'
                    }

                    # Extract data using configured selectors
                    for field, selector in selectors.items():
                        element = row.select_one(selector)
                        if element:
                            value = self._clean_text(element.text)

                            # Parse based on field type
                            if 'date' in field.lower():
                                permit_data[field] = self._parse_date(value)
                            elif 'value' in field.lower() or 'cost' in field.lower():
                                permit_data[field] = self._parse_currency(value)
                            else:
                                permit_data[field] = value

                    # Ensure required fields
                    if not permit_data.get('permit_number'):
                        continue

                    permit, is_new = await self._save_permit(permit_data)

                    if is_new:
                        new_count += 1
                    else:
                        updated_count += 1

                except Exception as e:
                    logger.error(f"Failed to parse permit: {str(e)}")
                    continue

                await self._delay()

        except Exception as e:
            logger.error(f"Generic permit scraping failed: {str(e)}")

        return {"new": new_count, "updated": updated_count}

    async def scrape_bids(self) -> dict:
        """
        Scrape bids using configuration
        """
        logger.info(f"Scraping bids for {self.municipality.name} (generic scraper)")

        if not self.municipality.bids_url:
            return {"new": 0, "updated": 0}

        new_count = 0
        updated_count = 0

        try:
            config = self._load_config(self.municipality.bids_config)
            if not config:
                return {"new": 0, "updated": 0}

            # Fetch content
            if self.municipality.bids_scraper_type == "playwright":
                html = await self._fetch_with_playwright(self.municipality.bids_url)
            else:
                html = await self._fetch_html(self.municipality.bids_url)

            if not html:
                return {"new": 0, "updated": 0}

            soup = self._parse_html(html)

            row_selector = config.get('row_selector', '.bid-row')
            bid_rows = soup.select(row_selector)

            selectors = config.get('selectors', {})

            for row in bid_rows[:50]:
                try:
                    bid_data = {
                        'city': self.municipality.city,
                        'state': self.municipality.state,
                        'county': self.municipality.county,
                        'source_url': self.municipality.bids_url,
                        'status': 'Open',
                        'agency_name': self.municipality.name
                    }

                    # Extract using selectors
                    for field, selector in selectors.items():
                        element = row.select_one(selector)
                        if element:
                            value = self._clean_text(element.text)

                            if 'date' in field.lower():
                                bid_data[field] = self._parse_date(value)
                            elif 'value' in field.lower() or 'estimate' in field.lower():
                                bid_data[field] = self._parse_currency(value)
                            else:
                                bid_data[field] = value

                    if not bid_data.get('bid_number'):
                        continue

                    bid, is_new = await self._save_bid(bid_data)

                    if is_new:
                        new_count += 1
                    else:
                        updated_count += 1

                except Exception as e:
                    logger.error(f"Failed to parse bid: {str(e)}")
                    continue

                await self._delay()

        except Exception as e:
            logger.error(f"Generic bid scraping failed: {str(e)}")

        return {"new": new_count, "updated": updated_count}

    async def scrape_properties(self) -> dict:
        """
        Scrape properties using configuration
        """
        logger.info(f"Property scraping for {self.municipality.name} requires specific configuration")
        # Property scraping typically requires API access or GIS portals
        return {"new": 0, "updated": 0}

    def _load_config(self, config_json: str) -> dict:
        """
        Load scraper configuration from JSON string

        Args:
            config_json: JSON string with configuration

        Returns:
            Configuration dictionary
        """
        if not config_json:
            return {}

        try:
            return json.loads(config_json)
        except Exception as e:
            logger.error(f"Failed to parse config JSON: {str(e)}")
            return {}

    async def test_connection(self) -> dict:
        """Test all configured URLs"""

        results = {}

        for data_type in ['permits', 'bids', 'properties']:
            url = getattr(self.municipality, f'{data_type}_url', None)

            if url:
                try:
                    html = await self._fetch_html(url)
                    results[data_type] = "accessible" if html else "failed"
                except Exception as e:
                    results[data_type] = f"error: {str(e)}"

        return results
