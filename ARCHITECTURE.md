# Kypher Architecture Documentation

## Overview

Kypher is a contractor intelligence platform designed to help general contractors discover remodeling opportunities through automated municipal data collection and AI-powered analysis.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Dashboard   │  │   Permits    │  │  Properties  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     Bids     │  │Opportunities │  │   Scraper    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST API
┌────────────────────────┴────────────────────────────────────┐
│                    Backend (FastAPI)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  API Routes                           │  │
│  │  /permits  /bids  /properties  /analytics  /scraper  │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────┐  │
│  │              Business Logic Layer                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Scraper    │  │ AI Service  │  │  Analytics  │  │  │
│  │  │  Service    │  │   (xAI)     │  │   Service   │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────┐  │
│  │              Data Access Layer                        │  │
│  │            SQLAlchemy ORM Models                      │  │
│  └──────────────────────┬───────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                  PostgreSQL Database                         │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐│
│  │ Permits  │ │   Bids   │ │ Properties │ │Municipalities││
│  └──────────┘ └──────────┘ └────────────┘ └──────────────┘│
│  ┌──────────────┐                                           │
│  │  Scrape Logs │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘

External Services:
┌──────────────┐
│  xAI Grok    │ ◄── AI Analysis & Opportunity Scoring
└──────────────┘

┌──────────────────────────────────────┐
│  Municipal Websites & Data Sources   │ ◄── Web Scraping
└──────────────────────────────────────┘
```

## Component Details

### Frontend (React + Vite)

**Technology Stack:**
- React 18
- Vite (build tool)
- React Router (routing)
- Axios (HTTP client)
- TailwindCSS (styling)
- Recharts (data visualization)

**Pages:**
1. **Dashboard** - Overview metrics and recent activity
2. **Permits** - Construction permit listings with filters
3. **Bids** - Municipal bid/RFP listings
4. **Properties** - Property data and analysis
5. **Opportunities** - AI-scored leads aggregated view
6. **Scraper** - Scraper control and monitoring

**Key Features:**
- Real-time status updates
- Advanced filtering and search
- Responsive design
- Interactive data visualization

### Backend (Python + FastAPI)

**Technology Stack:**
- Python 3.11+
- FastAPI (web framework)
- SQLAlchemy (ORM)
- Pydantic (validation)
- Playwright (web scraping)
- BeautifulSoup4 (HTML parsing)
- OpenAI SDK (for xAI integration)

**API Endpoints:**

```
GET  /api/v1/health              - Health check
GET  /api/v1/status              - System status

GET  /api/v1/permits/            - List permits
GET  /api/v1/permits/{id}        - Get permit details
GET  /api/v1/permits/stats/summary - Permit statistics

GET  /api/v1/bids/               - List bids
GET  /api/v1/bids/{id}           - Get bid details
GET  /api/v1/bids/stats/summary  - Bid statistics

GET  /api/v1/properties/         - List properties
GET  /api/v1/properties/{id}     - Get property details
GET  /api/v1/properties/stats/summary - Property statistics

GET  /api/v1/analytics/dashboard             - Dashboard data
GET  /api/v1/analytics/trends/permits        - Permit trends
GET  /api/v1/analytics/insights/opportunities - Top opportunities
GET  /api/v1/analytics/correlations/property-age-permits - Correlation analysis
POST /api/v1/analytics/analyze              - AI analysis of item

POST /api/v1/scraper/start       - Start scraping task
GET  /api/v1/scraper/status      - Scraper status
GET  /api/v1/scraper/logs        - Scrape logs
GET  /api/v1/scraper/municipalities - Municipality list
```

### Database Schema

**Tables:**

1. **municipalities**
   - Configuration for each municipality
   - URLs, scraper settings, status
   - Geographic information

2. **permits**
   - Construction permit data
   - Address, owner, contractor info
   - Project value, dates, status
   - AI opportunity scoring

3. **bids**
   - Municipal bid/RFP data
   - Title, description, requirements
   - Dates, agency info
   - AI opportunity scoring

4. **properties**
   - Property assessment data
   - Building age, size, ownership
   - HOA information
   - Remodel opportunity indicators

5. **scrape_logs**
   - Scraping activity history
   - Success/failure tracking
   - Performance metrics

### Scraping System

**Architecture:**

```
ScraperService (Coordinator)
    │
    ├── BowlingGreenScraper (Specialized)
    │       └── BaseScraper
    │
    └── GenericScraper (Configurable)
            └── BaseScraper
```

**Scraper Features:**
- Respects robots.txt
- Rate limiting with random delays
- JavaScript rendering support (Playwright)
- Static HTML parsing (BeautifulSoup)
- Error handling and logging
- Incremental updates (new vs. existing data)

**Scraper Types:**
1. **HTML** - Simple GET requests for static pages
2. **Playwright** - Browser automation for JS-heavy sites
3. **API** - Direct API calls where available

### AI Integration (xAI Grok)

**Purpose:**
- Analyze opportunities for contractor relevance
- Score leads (0-100)
- Extract key insights and recommendations
- Generate market analysis

**Scoring Factors:**
- Project value
- Property age
- Recent permit activity
- Owner information
- Geographic location
- Project type

### Data Flow

**Scraping Flow:**
```
1. User triggers scrape (manual or scheduled)
2. ScraperService queues task
3. Appropriate scraper selected (Bowling Green vs Generic)
4. Scraper fetches data from municipality
5. HTML/API parsing
6. Data validation and cleaning
7. Database upsert (create or update)
8. AI analysis for opportunity scoring
9. Update municipality statistics
10. Log results
```

**User Query Flow:**
```
1. Frontend makes API request
2. FastAPI route handler receives request
3. Query database via SQLAlchemy ORM
4. Apply filters and pagination
5. Format response data
6. Return JSON to frontend
7. Frontend renders data
```

## Configuration

### Municipality Configuration

Each municipality in `backend/config/municipalities.json`:

```json
{
  "name": "City Name",
  "slug": "city-name-st",
  "city": "City",
  "state": "ST",
  "permits_url": "https://...",
  "bids_url": "https://...",
  "permits_enabled": true,
  "permits_scraper_type": "html",
  "permits_config": "{\"row_selector\": \".permit\", ...}"
}
```

### Scraper Configuration

For generic scrapers, configuration includes:
- **row_selector** - CSS selector for data rows
- **selectors** - Field-to-CSS selector mapping
- **pagination** - Pagination handling
- **authentication** - Login/API key if needed

## Scalability Considerations

### Current (POC) Limitations:
- Runs locally
- Single-threaded scraping
- No authentication
- Limited to ~100 mile radius
- Manual scraper configuration

### Production Enhancements:
1. **Multi-threading** - Parallel scraping
2. **Queue System** - Redis/Celery for background tasks
3. **Caching** - Redis for frequently accessed data
4. **CDN** - Static asset delivery
5. **Load Balancing** - Multiple backend instances
6. **Database** - Read replicas, connection pooling
7. **Monitoring** - Prometheus, Grafana
8. **Authentication** - JWT, OAuth
9. **API Rate Limiting** - Per-user quotas

## Security

### Current Implementation:
- CORS configuration
- SQL injection protection (ORM)
- Input validation (Pydantic)
- Environment variable secrets

### Production Requirements:
- HTTPS/TLS encryption
- API authentication/authorization
- Rate limiting per user
- Database encryption at rest
- Secret rotation
- Audit logging
- Input sanitization
- XSS protection

## Development Workflow

### Adding a New Municipality

1. Research the municipality's data sources
2. Identify permit/bid/property URLs
3. Inspect HTML structure (browser dev tools)
4. Add entry to `municipalities.json`
5. Configure selectors
6. Test scraper
7. Run initial scrape
8. Verify data quality

### Adding a New Scraper

1. Create new file in `backend/scrapers/`
2. Extend `BaseScraper`
3. Implement `scrape_permits()`, `scrape_bids()`, etc.
4. Handle municipality-specific parsing
5. Register in `ScraperService._get_scraper()`
6. Test thoroughly

### Modifying AI Prompts

1. Edit `backend/services/ai_service.py`
2. Update `_build_analysis_prompt()`
3. Adjust scoring logic in `_extract_score()`
4. Test with sample data
5. Monitor API costs

## Monitoring & Logging

### Log Locations:
- **Backend:** `backend/logs/kypher.log`
- **Scraper:** Database `scrape_logs` table
- **Frontend:** Browser console

### Key Metrics:
- Scrape success rate
- API response times
- Database query performance
- AI API usage/costs
- Opportunity conversion rates

## Technology Choices Rationale

### Why Python/FastAPI?
- Excellent scraping libraries (Playwright, BeautifulSoup)
- Fast development with async support
- Strong typing with Pydantic
- Great documentation
- M1 Mac compatible

### Why React?
- Component reusability
- Large ecosystem
- Great developer experience
- Fast with Vite

### Why PostgreSQL?
- Robust relational data handling
- JSON support for flexible fields
- Full-text search capabilities
- Proven reliability
- Free and open source

### Why xAI?
- Latest AI model capabilities
- Competitive pricing
- Good for analytical tasks
- API compatibility with OpenAI SDK

---

This architecture is designed for a proof-of-concept that can evolve into a production system with the enhancements outlined above.
