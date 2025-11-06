# Subsplash Integration Setup Guide

Complete guide to integrating your app with the Subsplash platform and obtaining API credentials.

---

## Table of Contents

- [What is Subsplash?](#what-is-subsplash)
- [Prerequisites](#prerequisites)
- [Getting API Access](#getting-api-access)
- [API Credentials Explained](#api-credentials-explained)
- [Configuration Steps](#configuration-steps)
- [Testing Your Integration](#testing-your-integration)
- [Common Subsplash Features](#common-subsplash-features)
- [API Endpoints Reference](#api-endpoints-reference)
- [Troubleshooting](#troubleshooting)

---

## What is Subsplash?

Subsplash is a comprehensive church engagement platform that provides:

- **Custom Mobile Apps** - iOS and Android apps
- **Media Hosting** - Sermons, videos, podcasts
- **Live Streaming** - HD video streaming
- **Subsplash Giving** - Online donations and tithing
- **Event Management** - Registration and ticketing
- **Push Notifications** - Engage your congregation
- **Church Management** - Integration with ChMS systems
- **Website Platform** - Responsive church websites

Subsplash serves thousands of churches and organizations worldwide.

---

## Prerequisites

Before requesting API access, ensure you have:

### 1. Active Subsplash Subscription
- Your church must have an active Subsplash account
- Verify which Subsplash products you're subscribed to
- Check with your church administrator if unsure

### 2. Decision Maker Access
- You need approval from someone with Subsplash account admin rights
- This is typically the church's Communications Director or IT Manager

### 3. Technical Knowledge
- Basic understanding of APIs
- React Native development experience
- Ability to handle OAuth authentication

### 4. Development Environment
- See main README.md for full technical requirements
- iOS and/or Android development setup

---

## Getting API Access

### Step 1: Contact Your Client Success Manager

Subsplash API access is not self-service. You must work with Subsplash directly.

**How to reach your CSM:**

1. **Via Subsplash Dashboard**
   - Log into your Subsplash account at https://dashboard.subsplash.com
   - Look for "Support" or "Help" section
   - Find your assigned Client Success Manager's contact info

2. **Via Email**
   - Email: support@subsplash.com
   - Include your church name and account details

3. **Via Phone**
   - Call Subsplash support: Check your account for the current number
   - Ask to be connected to your CSM

### Step 2: Submit API Access Request

When contacting Subsplash, provide:

```
Subject: API Access Request for Mobile App Development

Dear [Client Success Manager Name],

I am reaching out to request API access for our church's mobile app development project.

Church/Organization Details:
- Church Name: [Your Church Name]
- Subsplash Account ID: [If known]
- Primary Contact: [Your Name]
- Email: [Your Email]
- Phone: [Your Phone]

Project Details:
- Project Type: Custom React Native Mobile Application
- Platforms: iOS and Android
- Purpose: Native church engagement app integrated with Subsplash services
- Features Needed:
  * Media/Sermon API
  * Events API
  * Live Streaming API
  * Subsplash Giving Integration
  * Push Notifications
  * [Any other specific features]

Technical Details:
- OAuth Redirect URI: yourchurchapp://oauth/callback
- Development Timeline: [Your timeline]
- Launch Target: [Estimated launch date]

Please provide:
1. API App Key
2. Church/Organization ID
3. OAuth Client ID and Client Secret
4. API documentation access
5. Any setup instructions

Thank you for your assistance!

Best regards,
[Your Name]
[Your Title]
```

### Step 3: Complete Required Forms

Subsplash may require you to:
- Sign API usage agreement
- Provide app details and branding
- Submit OAuth configuration
- Specify which API endpoints you need

### Step 4: Receive Credentials

Subsplash will provide credentials via:
- Secure document sharing
- Email (encrypted)
- Subsplash dashboard

**IMPORTANT:** Keep these credentials secure! Never commit them to public repositories.

---

## API Credentials Explained

You will receive several credentials:

### 1. App Key (Church Key)
```
Format: Usually 8-12 alphanumeric characters
Example: a12b3cd4
```
- Identifies your church/organization
- Required for all API requests
- Sent in request headers: `X-App-Key: your_app_key`

### 2. Church ID (Organization ID)
```
Format: org_XXXXXX or similar
Example: org_123456
```
- Used in API endpoints
- Identifies your specific church account
- Used in URLs like: `/churches/{CHURCH_ID}/media`

### 3. OAuth Client ID
```
Format: Long alphanumeric string
Example: abc123def456ghi789
```
- Used for OAuth authentication flow
- Public identifier (can be in client app)
- Required for user login features

### 4. OAuth Client Secret
```
Format: Long alphanumeric string
Example: xyz987uvw654rst321
```
- **SECRET - NEVER expose publicly**
- Used server-side or secure mobile storage only
- Required for OAuth token exchange

### 5. API Base URL
```
Default: https://api.subsplash.com/v2
```
- Base URL for all API requests
- May vary based on your account type

---

## Configuration Steps

### Step 1: Create Environment File

Create `.env` in your project root (**DO NOT commit this file**):

```bash
# Subsplash API Configuration
SUBSPLASH_APP_KEY=your_app_key_here
SUBSPLASH_CHURCH_ID=your_church_id_here
SUBSPLASH_CLIENT_ID=your_client_id_here
SUBSPLASH_CLIENT_SECRET=your_client_secret_here
```

Add to `.gitignore`:
```
.env
.env.local
.env.production
```

### Step 2: Update Configuration File

Edit `subsplash.config.js`:

```javascript
export const SUBSPLASH_CONFIG = {
  // From Subsplash
  APP_KEY: process.env.SUBSPLASH_APP_KEY || 'YOUR_APP_KEY_HERE',
  CHURCH_ID: process.env.SUBSPLASH_CHURCH_ID || 'YOUR_CHURCH_ID_HERE',

  // API Base URL (provided by Subsplash)
  API_BASE_URL: 'https://api.subsplash.com/v2',

  // OAuth Configuration
  OAUTH: {
    CLIENT_ID: process.env.SUBSPLASH_CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
    CLIENT_SECRET: process.env.SUBSPLASH_CLIENT_SECRET || 'YOUR_CLIENT_SECRET_HERE',
    REDIRECT_URI: 'yourchurchapp://oauth/callback',
    SCOPES: ['openid', 'profile', 'email', 'giving'],
  },

  // ... rest of configuration
};
```

### Step 3: Test API Connection

Create a test script or use the app to verify:

```javascript
import SubsplashAPI from './services/SubsplashAPI';

// Test basic API access
async function testConnection() {
  try {
    const churchInfo = await SubsplashAPI.getChurchInfo();
    console.log('✅ API Connection Successful!');
    console.log('Church Name:', churchInfo.name);
    return true;
  } catch (error) {
    console.error('❌ API Connection Failed:', error.message);
    return false;
  }
}
```

---

## Testing Your Integration

### 1. Test Church Information API

```bash
curl -X GET "https://api.subsplash.com/v2/churches/YOUR_CHURCH_ID" \
  -H "X-App-Key: YOUR_APP_KEY" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "id": "org_123456",
  "name": "Your Church Name",
  "address": "123 Main St...",
  "phone": "(555) 123-4567",
  ...
}
```

### 2. Test Media API

```bash
curl -X GET "https://api.subsplash.com/v2/churches/YOUR_CHURCH_ID/media?limit=5" \
  -H "X-App-Key: YOUR_APP_KEY" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "items": [
    {
      "id": "media_123",
      "title": "Sermon Title",
      "speaker": "Pastor Name",
      "published_at": "2024-01-15T10:00:00Z",
      ...
    }
  ],
  "total": 150,
  "page": 1
}
```

### 3. Test Live Stream Status

```bash
curl -X GET "https://api.subsplash.com/v2/churches/YOUR_CHURCH_ID/live/status" \
  -H "X-App-Key: YOUR_APP_KEY"
```

Expected response:
```json
{
  "isLive": false,
  "nextScheduled": "2024-01-21T10:00:00Z",
  "streamUrl": "https://..."
}
```

---

## Common Subsplash Features

### Media & Sermons

**Capabilities:**
- Browse sermon library
- Filter by series, speaker, date
- Search functionality
- Audio and video playback
- Download for offline viewing

**API Endpoints:**
- `GET /churches/{id}/media` - List media
- `GET /media/{id}` - Get media details
- `GET /churches/{id}/media/search` - Search media

### Events

**Capabilities:**
- View upcoming events
- Event details and descriptions
- Registration and ticketing
- Calendar integration
- Event reminders

**API Endpoints:**
- `GET /churches/{id}/events` - List events
- `GET /events/{id}` - Event details
- `POST /events/{id}/register` - Register for event

### Giving

**Capabilities:**
- Multiple giving funds
- Recurring donations
- One-time gifts
- Payment history
- Tax receipts

**Integration:**
- Hosted giving page (easiest)
- Embedded WebView
- Full API integration (advanced)

**URL Format:**
```
https://pushpay.com/g/{CHURCH_SLUG}?fund={FUND_ID}
```

### Live Streaming

**Capabilities:**
- Live video streaming
- Chat integration
- Viewer count
- Stream recording
- Multi-bitrate streaming

**API Endpoints:**
- `GET /churches/{id}/live` - Get live stream
- `GET /churches/{id}/live/status` - Check if live

### Push Notifications

**Capabilities:**
- Custom messages
- Scheduled notifications
- Targeted messaging
- Deep linking
- Rich media

**Setup Required:**
- Firebase Cloud Messaging (Android)
- Apple Push Notification Service (iOS)
- Register device tokens with Subsplash

---

## API Endpoints Reference

### Base URL
```
https://api.subsplash.com/v2
```

### Authentication Header
```
X-App-Key: YOUR_APP_KEY
Authorization: Bearer YOUR_ACCESS_TOKEN (for authenticated endpoints)
```

### Common Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/churches/{id}` | Church information |
| GET | `/churches/{id}/media` | Media library |
| GET | `/media/{id}` | Media item details |
| GET | `/churches/{id}/media/search` | Search media |
| GET | `/churches/{id}/events` | Events list |
| GET | `/events/{id}` | Event details |
| POST | `/events/{id}/register` | Event registration |
| GET | `/churches/{id}/live` | Live stream info |
| GET | `/churches/{id}/live/status` | Live status |
| GET | `/churches/{id}/giving/funds` | Giving options |
| POST | `/churches/{id}/giving/donate` | Create donation |
| GET | `/churches/{id}/groups` | Small groups |
| GET | `/groups/{id}` | Group details |
| POST | `/groups/{id}/join` | Join group |
| POST | `/notifications/register` | Register push token |
| POST | `/auth/login` | User authentication |
| POST | `/auth/refresh` | Refresh access token |

### Query Parameters

**Pagination:**
```
?page=1&limit=20
```

**Date Filtering:**
```
?start_date=2024-01-01&end_date=2024-12-31
```

**Media Type:**
```
?type=video|audio|podcast
```

### Response Format

All API responses follow this structure:

```json
{
  "items": [...],      // Array of data
  "total": 150,        // Total count
  "page": 1,           // Current page
  "limit": 20,         // Items per page
  "hasMore": true      // More pages available
}
```

### Error Responses

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "The provided API key is invalid",
    "status": 401
  }
}
```

---

## Troubleshooting

### "401 Unauthorized"

**Cause:** Invalid or missing API credentials

**Solutions:**
1. Verify APP_KEY is correct in config
2. Check if API key has been activated by Subsplash
3. Ensure `X-App-Key` header is being sent
4. Contact Subsplash if credentials are new

### "403 Forbidden"

**Cause:** You don't have access to requested resource

**Solutions:**
1. Verify your Subsplash subscription includes this feature
2. Check CHURCH_ID is correct
3. Confirm endpoint is enabled for your account
4. Contact Subsplash to enable feature

### "404 Not Found"

**Cause:** Invalid endpoint or resource ID

**Solutions:**
1. Check API endpoint spelling
2. Verify CHURCH_ID format
3. Ensure resource (media, event) exists
4. Check API version (v2) in base URL

### "429 Too Many Requests"

**Cause:** Rate limiting

**Solutions:**
1. Implement caching (already built into app)
2. Reduce API call frequency
3. Use pagination properly
4. Contact Subsplash about rate limits

### "Empty Response / No Data"

**Cause:** No content available

**Solutions:**
1. Verify content exists in Subsplash dashboard
2. Check date range filters
3. Ensure content is published (not draft)
4. Test with Subsplash support

### OAuth Issues

**Cause:** Authentication flow problems

**Solutions:**
1. Verify redirect URI matches exactly
2. Check CLIENT_ID and CLIENT_SECRET
3. Ensure scopes are correct
4. Test OAuth flow in browser first

---

## Additional Resources

### Official Documentation
- **Subsplash Developer Portal:** https://developer.subsplash.com/
- **API Documentation:** Available after API access granted
- **Support Portal:** https://support.subsplash.com/

### Support Channels
- **Email:** support@subsplash.com
- **Phone:** Check your Subsplash dashboard
- **Client Success Manager:** Your assigned CSM

### Training & Webinars
- Subsplash offers training sessions
- Ask your CSM about developer resources
- Request API integration consultation

### Best Practices
1. **Cache Aggressively** - Reduce API calls
2. **Handle Errors Gracefully** - Network issues happen
3. **Test Thoroughly** - Test all features before launch
4. **Monitor Usage** - Track API call volume
5. **Stay Updated** - Follow Subsplash updates

---

## Security Best Practices

### DO:
✅ Use environment variables for credentials
✅ Enable HTTPS for all API calls
✅ Implement OAuth for user authentication
✅ Store tokens securely (KeyChain/KeyStore)
✅ Validate all API responses
✅ Implement rate limiting client-side
✅ Log errors (but not credentials)

### DON'T:
❌ Commit credentials to version control
❌ Hardcode API keys in source code
❌ Share credentials publicly
❌ Use HTTP instead of HTTPS
❌ Store passwords in plain text
❌ Ignore SSL certificate warnings
❌ Skip input validation

---

## Next Steps

After completing Subsplash setup:

1. ✅ Test all API endpoints
2. ✅ Customize app branding
3. ✅ Add your church content
4. ✅ Test on physical devices
5. ✅ Set up push notifications
6. ✅ Configure analytics
7. ✅ Beta test with small group
8. ✅ Prepare for app store submission

---

**Need Help?**

If you're stuck, reach out to:
- Your Subsplash Client Success Manager
- Subsplash technical support
- Your church's technical team

Good luck with your Subsplash integration! 🚀
