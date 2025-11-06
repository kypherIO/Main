"""
Kypher Backend - Main Application Entry Point
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import sys

from api.routes import permits, bids, properties, scraper, analytics, health
from core.config import settings
from core.database import engine, Base

# Configure logging
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level=settings.LOG_LEVEL
)
logger.add(
    settings.LOG_FILE,
    rotation="500 MB",
    retention="10 days",
    level=settings.LOG_LEVEL
)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Contractor Intelligence Platform - Municipal Data Scraping & Analysis"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
@app.on_event("startup")
async def startup_event():
    logger.info("Starting Kypher Backend...")
    logger.info(f"Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized successfully")

# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(permits.router, prefix="/api/v1/permits", tags=["Permits"])
app.include_router(bids.router, prefix="/api/v1/bids", tags=["Bids"])
app.include_router(properties.router, prefix="/api/v1/properties", tags=["Properties"])
app.include_router(scraper.router, prefix="/api/v1/scraper", tags=["Scraper"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])

@app.get("/")
async def root():
    return {
        "message": "Kypher Contractor Intelligence Platform API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "status": "operational"
    }

if __name__ == "__main__":
    logger.info(f"Starting server on {settings.HOST}:{settings.PORT}")
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
