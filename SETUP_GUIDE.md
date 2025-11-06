# Kypher Setup Guide

Complete step-by-step guide to get Kypher running on your MacBook Pro M1.

## Prerequisites

Before starting, ensure you have:
- macOS (running on M1 Mac)
- Internet connection
- Terminal access
- Admin privileges on your Mac

## Step 1: Install Homebrew

Homebrew is a package manager for macOS that will help us install other tools.

Open Terminal (press Cmd+Space, type "Terminal", press Enter) and run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the on-screen instructions. You may need to enter your password.

## Step 2: Install Python 3.11

```bash
brew install python@3.11
```

Verify installation:
```bash
python3 --version
```

You should see something like "Python 3.11.x"

## Step 3: Install Node.js

```bash
brew install node
```

Verify installation:
```bash
node --version
npm --version
```

## Step 4: Install PostgreSQL (Database)

```bash
brew install postgresql@15
```

Start PostgreSQL:
```bash
brew services start postgresql@15
```

Create a database for Kypher:
```bash
createdb kypher
```

## Step 5: Get an xAI API Key

1. Visit https://x.ai/api
2. Sign up for an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (you'll need it in Step 7)

## Step 6: Clone/Download the Kypher Project

If you're reading this, you probably already have the code. If not:

```bash
cd ~/Desktop
# (Your git clone command here)
cd Main
```

## Step 7: Set Up the Backend

Navigate to the backend directory:
```bash
cd backend
```

Create a Python virtual environment:
```bash
python3 -m venv venv
```

Activate the virtual environment:
```bash
source venv/bin/activate
```

Your terminal prompt should now show `(venv)` at the beginning.

Install Python dependencies:
```bash
pip install -r requirements.txt
```

This may take a few minutes.

Install Playwright browsers (for web scraping):
```bash
playwright install chromium
```

Configure environment variables:
```bash
cp .env.example .env
```

Now edit the .env file:
```bash
nano .env
```

Update these values:
- `XAI_API_KEY=your-actual-api-key-here` (paste the key from Step 5)
- `DATABASE_URL=postgresql://localhost/kypher` (or keep SQLite default)

Press Ctrl+X, then Y, then Enter to save and exit.

Initialize the database:
```bash
python scripts/init_db.py
```

You should see messages about creating tables and loading municipalities.

## Step 8: Set Up the Frontend

Open a NEW terminal window (keep the backend one open).

Navigate to the frontend directory:
```bash
cd ~/Desktop/Main/frontend  # Adjust path as needed
```

Install Node dependencies:
```bash
npm install
```

This will take a few minutes.

## Step 9: Start the Application

### Terminal 1 - Backend

```bash
cd backend
source venv/bin/activate  # If not already activated
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

## Step 10: Access the Application

Open your web browser and go to:

**http://localhost:5173**

You should see the Kypher dashboard!

## Step 11: Test the Scraper

1. Click on "Scraper" in the navigation menu
2. Click "Scrape All Permits" or choose a specific municipality
3. Watch the scraper status update
4. Navigate to "Permits", "Bids", or "Properties" to see collected data
5. Check "Opportunities" for AI-scored leads

## Troubleshooting

### Backend won't start

**Error: "ModuleNotFoundError"**
- Solution: Make sure you activated the virtual environment
  ```bash
  source venv/bin/activate
  ```

**Error: "Database connection failed"**
- Solution: Make sure PostgreSQL is running
  ```bash
  brew services start postgresql@15
  ```

### Frontend won't start

**Error: "Cannot find module"**
- Solution: Reinstall dependencies
  ```bash
  rm -rf node_modules
  npm install
  ```

**Error: "Port 5173 already in use"**
- Solution: Kill the process on that port or use a different port
  ```bash
  lsof -ti:5173 | xargs kill -9
  ```

### Scraper not working

**No data being collected:**
1. Check that the backend is running
2. Look at the "Scrape Logs" for error messages
3. Some municipalities may not have data available or may require specific configuration
4. Try the sample data first (loaded during database initialization)

### xAI Integration not working

**Error: "Invalid API key"**
- Solution: Check your .env file has the correct XAI_API_KEY
- Restart the backend after updating the .env file

## Usage Tips

### Daily Use

1. **Start Backend:**
   ```bash
   cd backend
   source venv/bin/activate
   python main.py
   ```

2. **Start Frontend:** (in a new terminal)
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access:** Open http://localhost:5173

### Stopping the Application

- Press Ctrl+C in each terminal window
- To stop PostgreSQL (if desired):
  ```bash
  brew services stop postgresql@15
  ```

### Running Scrapers Automatically

To enable automatic scraping:
1. Edit `backend/.env`
2. Change `ENABLE_AUTO_SCRAPING=True`
3. Adjust `SCRAPE_SCHEDULE_CRON` as needed (default: 2 AM daily)
4. Restart the backend

## Next Steps

### Customizing for Your Area

1. **Edit Municipality Configuration:**
   - File: `backend/config/municipalities.json`
   - Add your local municipalities
   - Update URLs for permits, bids, property records

2. **Configure Scraper Selectors:**
   - Each municipality may have different website structures
   - You'll need to inspect their websites and update selectors
   - See `backend/scrapers/bowling_green_scraper.py` for examples

3. **Tune AI Scoring:**
   - Modify `backend/services/ai_service.py`
   - Adjust prompts and scoring logic for your needs

### Production Deployment

This is a proof-of-concept running locally. For production:
- Deploy backend to a cloud server (AWS, DigitalOcean, etc.)
- Deploy frontend to a hosting service (Vercel, Netlify, etc.)
- Use a production database (hosted PostgreSQL)
- Add authentication/authorization
- Set up proper logging and monitoring
- Implement rate limiting and error handling

## Support

If you encounter issues:
1. Check the logs in `backend/logs/kypher.log`
2. Check browser console for frontend errors (F12 in browser)
3. Verify all services are running
4. Review this guide for missed steps

## Legal & Ethical Considerations

- Always respect robots.txt files
- Comply with each website's terms of service
- Implement appropriate rate limiting
- Only scrape public data
- Consider reaching out to municipalities for API access
- Some data may be subject to licensing or restrictions

---

**Congratulations!** You now have Kypher running on your Mac. Start discovering contractor opportunities!
