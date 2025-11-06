# Kypher - Contractor Intelligence Platform

A business intelligence platform for general contractors to discover remodeling opportunities through municipal data analysis and web scraping.

## 🎯 What This Does

Kypher automatically scrapes and analyzes municipal data to help general contractors find business opportunities:

- **Construction Permits** - Track new permits in your area
- **Building Bids** - Find upcoming municipal projects
- **Property Data** - Age, deeds, HOA information
- **AI Analysis** - xAI-powered insights and correlations
- **Territory Coverage** - Bowling Green, KY + 100 mile radius

## 🏗️ Architecture

```
kypher/
├── backend/          # Python FastAPI server
│   ├── api/         # API endpoints
│   ├── scrapers/    # Web scraping modules
│   ├── models/      # Database models
│   ├── services/    # Business logic
│   └── ai/          # xAI integration
├── frontend/        # React web application
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Main pages
│   │   └── services/    # API calls
└── data/           # Local database storage
```

## 💻 Technology Stack

### Backend
- **Python 3.11+** - Core language
- **FastAPI** - Modern API framework
- **SQLAlchemy** - Database ORM
- **PostgreSQL** - Database
- **Playwright** - Web scraping (JS-enabled sites)
- **BeautifulSoup4** - HTML parsing
- **xAI SDK** - AI-powered analysis

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Recharts** - Data visualization
- **Axios** - API requests

## 🚀 Quick Start (No Coding Required!)

### Prerequisites

1. **Install Homebrew** (if not already installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Python**:
   ```bash
   brew install python@3.11
   ```

3. **Install Node.js**:
   ```bash
   brew install node
   ```

4. **Install PostgreSQL**:
   ```bash
   brew install postgresql@15
   brew services start postgresql@15
   ```

5. **Get xAI API Key**:
   - Visit https://x.ai/api
   - Sign up and get your API key
   - You'll add this in step 4 below

### Installation

1. **Clone this repository** (if you haven't):
   ```bash
   cd ~/Desktop
   git clone <your-repo-url>
   cd Main
   ```

2. **Set up Backend**:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Set up Frontend**:
   ```bash
   cd ../frontend
   npm install
   ```

4. **Configure Environment**:
   ```bash
   cd ../backend
   cp .env.example .env
   ```

   Open `.env` in a text editor and add your xAI API key:
   ```
   XAI_API_KEY=your-api-key-here
   ```

5. **Initialize Database**:
   ```bash
   # Still in backend directory with venv activated
   python scripts/init_db.py
   ```

### Running the Application

1. **Start Backend** (in one terminal):
   ```bash
   cd backend
   source venv/bin/activate
   python main.py
   ```
   Backend will run at: http://localhost:8000

2. **Start Frontend** (in another terminal):
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend will run at: http://localhost:5173

3. **Open your browser** to http://localhost:5173

## 📊 Features

### Dashboard
- Overview of scraped data
- Recent permits and bids
- AI-generated insights
- Territory map visualization

### Data Collection
- Automated scraping scheduler
- Manual trigger options
- Progress tracking
- Error logging

### Analysis
- Property age correlations
- Permit trends
- Opportunity scoring
- Lead prioritization

### Export
- CSV exports
- PDF reports
- API access for integrations

## 🗺️ Coverage Areas

**Primary:** Bowling Green, KY
**Extended Coverage (100mi radius):**
- Nashville, TN
- Clarksville, TN
- Owensboro, KY
- Elizabethtown, KY
- Glasgow, KY
- Franklin, KY
- And more...

## 🔧 Configuration

Edit `backend/config/municipalities.json` to add/modify data sources:

```json
{
  "bowling_green": {
    "name": "Bowling Green, KY",
    "permits_url": "https://...",
    "bids_url": "https://...",
    "enabled": true
  }
}
```

## 📱 API Documentation

Once running, visit http://localhost:8000/docs for interactive API documentation.

## 🤝 Support

This is a proof of concept running locally. For production deployment or issues:
1. Check logs in `backend/logs/`
2. Review scraper status in dashboard
3. Ensure all services are running

## 📄 License

Proprietary - All rights reserved

## 🔐 Important Notes

- **Legal Compliance**: Ensure scraping complies with each website's robots.txt and terms of service
- **Rate Limiting**: Built-in delays to respect server resources
- **Data Privacy**: All data stored locally on your machine
- **API Costs**: xAI API usage will incur costs based on your plan

---

Built with ❤️ for general contractors
