/**
 * Subsplash API Configuration
 *
 * IMPORTANT: You need to obtain these credentials from Subsplash
 * Contact your Subsplash Client Success Manager to get:
 * - App Key (also called Church Key)
 * - Client ID
 * - Client Secret
 * - Church/Organization ID
 *
 * Documentation: https://developer.subsplash.com/
 */

export const SUBSPLASH_CONFIG = {
  // Your Subsplash App Key (required)
  // Example: 'a12b3cd4'
  APP_KEY: process.env.SUBSPLASH_APP_KEY || 'YOUR_APP_KEY_HERE',

  // Your Church/Organization ID (required)
  // Example: 'org_123456'
  CHURCH_ID: process.env.SUBSPLASH_CHURCH_ID || 'YOUR_CHURCH_ID_HERE',

  // API Base URL (default Subsplash endpoint)
  API_BASE_URL: 'https://api.subsplash.com/v2',

  // OAuth Configuration (for authentication features)
  OAUTH: {
    CLIENT_ID: process.env.SUBSPLASH_CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
    CLIENT_SECRET: process.env.SUBSPLASH_CLIENT_SECRET || 'YOUR_CLIENT_SECRET_HERE',
    REDIRECT_URI: 'yourchurchapp://oauth/callback',
    SCOPES: ['openid', 'profile', 'email', 'giving'],
  },

  // Feature Flags (enable/disable features based on your Subsplash subscription)
  FEATURES: {
    MEDIA: true,              // Sermons, videos, podcasts
    LIVE_STREAMING: true,      // Live video streaming
    EVENTS: true,              // Church events and calendar
    GIVING: true,              // Online giving/donations
    GROUPS: true,              // Small groups
    PUSH_NOTIFICATIONS: true,  // Push notifications
    MESSAGING: true,           // In-app messaging
    BIBLE_READER: true,        // Bible integration
    NOTES: true,               // Sermon notes
  },

  // Church Information (customize for your church)
  CHURCH_INFO: {
    NAME: 'Your Church Name',
    TAGLINE: 'Welcome Home',
    ADDRESS: '123 Main St, City, State 12345',
    PHONE: '(555) 123-4567',
    EMAIL: 'info@yourchurch.com',
    WEBSITE: 'https://yourchurch.com',
    TIMEZONE: 'America/Los_Angeles',
  },

  // Social Media Links
  SOCIAL_MEDIA: {
    FACEBOOK: 'https://facebook.com/yourchurch',
    INSTAGRAM: 'https://instagram.com/yourchurch',
    TWITTER: 'https://twitter.com/yourchurch',
    YOUTUBE: 'https://youtube.com/yourchurch',
  },

  // App Customization
  THEME: {
    PRIMARY_COLOR: '#1565C0',    // Main brand color
    SECONDARY_COLOR: '#F57C00',  // Accent color
    BACKGROUND_COLOR: '#F5F5F5', // Background
    TEXT_COLOR: '#333333',       // Primary text
    LIGHT_TEXT_COLOR: '#666666', // Secondary text
  },

  // Cache settings (in milliseconds)
  CACHE: {
    MEDIA_CACHE_TIME: 1800000,    // 30 minutes
    EVENTS_CACHE_TIME: 600000,    // 10 minutes
    CHURCH_INFO_CACHE_TIME: 86400000, // 24 hours
  },
};

export default SUBSPLASH_CONFIG;
