"""
Application Configuration Settings
"""
from pydantic_settings import BaseSettings
from typing import List, Union
import os
from pathlib import Path
from pydantic import field_validator

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Kypher"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = "sqlite:///./data/kypher.db"

    # xAI
    XAI_API_KEY: str = ""
    XAI_BASE_URL: str = "https://api.x.ai/v1"
    XAI_MODEL: str = "grok-beta"

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = ["http://localhost:5173", "http://localhost:3000"]

    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v

    # Scraping
    SCRAPER_USER_AGENT: str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    SCRAPER_DELAY_MIN: int = 2
    SCRAPER_DELAY_MAX: int = 5
    SCRAPER_TIMEOUT: int = 30

    # Target Area
    PRIMARY_CITY: str = "Bowling Green"
    PRIMARY_STATE: str = "KY"
    SEARCH_RADIUS_MILES: int = 100

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/kypher.log"

    # Scheduler
    ENABLE_AUTO_SCRAPING: bool = False
    SCRAPE_SCHEDULE_CRON: str = "0 2 * * *"

    class Config:
        env_file = ".env"
        case_sensitive = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Create necessary directories
        Path("logs").mkdir(exist_ok=True)
        Path("data").mkdir(exist_ok=True)

settings = Settings()
