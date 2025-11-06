# Subsplash Church App

A comprehensive, production-ready React Native church engagement app with full Subsplash API integration.

## 🌟 Features

This app integrates with Subsplash's church engagement platform to provide:

### Core Features
- ✅ **Church Information** - Display church details, contact info, and location
- ✅ **Media Library** - Browse and play sermons, videos, and podcasts
- ✅ **Live Streaming** - Watch live church services
- ✅ **Events Calendar** - View and register for church events
- ✅ **Online Giving** - Secure donations through Subsplash Giving
- ✅ **Push Notifications** - Stay connected with church updates
- ✅ **Small Groups** - Find and join community groups
- ✅ **Sermon Notes** - Take and save notes during messages
- ✅ **Search** - Find content across all media
- ✅ **Social Media Integration** - Connect via Facebook, Instagram, Twitter, YouTube

### Technical Features
- Cross-platform (iOS & Android)
- Offline caching for improved performance
- Responsive design
- OAuth authentication
- Deep linking support
- Analytics ready

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Subsplash Setup](#subsplash-setup)
- [Running the App](#running-the-app)
- [Project Structure](#project-structure)
- [Customization](#customization)
- [API Integration](#api-integration)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

### Required
- **Node.js** 18+ - [Download](https://nodejs.org/)
- **npm** or **yarn**
- **React Native CLI** - `npm install -g react-native-cli`
- **Git**

### For iOS Development (Mac only)
- **Xcode** 14+ - [Mac App Store](https://apps.apple.com/us/app/xcode/id497799835)
- **CocoaPods** - `sudo gem install cocoapods`

### For Android Development
- **Android Studio** - [Download](https://developer.android.com/studio)
- **Android SDK** (API level 33+)
- **JDK** 17

### Subsplash Account
- Active Subsplash subscription
- API credentials from Subsplash
- Contact your Subsplash Client Success Manager

---

## 📥 Installation

### 1. Clone or Download the Project

```bash
cd subsplash-church-app
```

### 2. Install Dependencies

```bash
npm install
```

Or with yarn:

```bash
yarn install
```

### 3. iOS Setup (Mac only)

```bash
cd ios
pod install
cd ..
```

---

## ⚙️ Configuration

### 1. Subsplash API Credentials

Edit `subsplash.config.js` and add your Subsplash credentials:

```javascript
export const SUBSPLASH_CONFIG = {
  // Get these from your Subsplash Client Success Manager
  APP_KEY: 'your_app_key_here',
  CHURCH_ID: 'your_church_id_here',

  OAUTH: {
    CLIENT_ID: 'your_client_id_here',
    CLIENT_SECRET: 'your_client_secret_here',
  },

  // ... rest of configuration
};
```

### 2. Church Information

Update the church details in `subsplash.config.js`:

```javascript
CHURCH_INFO: {
  NAME: 'Your Church Name',
  TAGLINE: 'Your Tagline',
  ADDRESS: '123 Main St, City, State 12345',
  PHONE: '(555) 123-4567',
  EMAIL: 'info@yourchurch.com',
  WEBSITE: 'https://yourchurch.com',
  TIMEZONE: 'America/Los_Angeles',
},
```

### 3. Branding / Theme

Customize colors in `subsplash.config.js`:

```javascript
THEME: {
  PRIMARY_COLOR: '#1565C0',    // Your brand color
  SECONDARY_COLOR: '#F57C00',  // Accent color
  // ... other colors
},
```

### 4. Social Media

Add your social media links:

```javascript
SOCIAL_MEDIA: {
  FACEBOOK: 'https://facebook.com/yourchurch',
  INSTAGRAM: 'https://instagram.com/yourchurch',
  TWITTER: 'https://twitter.com/yourchurch',
  YOUTUBE: 'https://youtube.com/yourchurch',
},
```

### 5. Feature Flags

Enable/disable features based on your Subsplash subscription:

```javascript
FEATURES: {
  MEDIA: true,
  LIVE_STREAMING: true,
  EVENTS: true,
  GIVING: true,
  GROUPS: true,
  PUSH_NOTIFICATIONS: true,
  MESSAGING: true,
  BIBLE_READER: true,
  NOTES: true,
},
```

---

## 🔐 Subsplash Setup

### Getting Your API Credentials

1. **Contact Subsplash**
   - Reach out to your Client Success Manager
   - Request API access for mobile app development
   - Provide your app details (name, purpose, platform)

2. **Receive Credentials**
   - You'll receive: App Key, Church ID, Client ID, Client Secret
   - These will be shared via secure document

3. **Configure OAuth**
   - Set up OAuth redirect URIs in Subsplash dashboard
   - Example: `yourchurchapp://oauth/callback`

4. **Test API Access**
   - Use the provided credentials to test API connectivity
   - Verify all needed endpoints are accessible

### Required Subsplash Features

Ensure your Subsplash subscription includes:
- ✅ Media API access
- ✅ Events API access
- ✅ Subsplash Giving integration
- ✅ Push notification service
- ✅ Live streaming (if applicable)

**See [SUBSPLASH_SETUP.md](./SUBSPLASH_SETUP.md) for detailed setup instructions.**

---

## 🚀 Running the App

### Start Metro Bundler

```bash
npm start
```

### Run on Android

```bash
npm run android
```

Or:

```bash
npx react-native run-android
```

### Run on iOS (Mac only)

```bash
npm run ios
```

Or:

```bash
npx react-native run-ios
```

---

## 📁 Project Structure

```
subsplash-church-app/
├── App.js                    # Main app with navigation
├── index.js                  # Entry point
├── subsplash.config.js       # Configuration file
│
├── services/
│   └── SubsplashAPI.js       # API service layer
│
├── screens/
│   ├── HomeScreen.js         # Home/dashboard
│   ├── MediaScreen.js        # Sermons/media browse
│   ├── EventsScreen.js       # Events calendar
│   ├── GiveScreen.js         # Online giving
│   └── MoreScreen.js         # Additional features
│
├── android/                  # Android native code
├── ios/                      # iOS native code
├── package.json              # Dependencies
└── README.md                 # This file
```

---

## 🎨 Customization

### Changing App Name

**Android:** Edit `android/app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">Your Church Name</string>
```

**iOS:** Edit `ios/SubsplashChurchApp/Info.plist`:
```xml
<key>CFBundleDisplayName</key>
<string>Your Church Name</string>
```

### Changing App Icon

1. Create app icons in required sizes
2. **Android:** Place in `android/app/src/main/res/mipmap-*/`
3. **iOS:** Use Xcode to add to Assets.xcassets

### Adding More Screens

1. Create new screen component in `screens/`
2. Add route to navigation in `App.js`
3. Update navigation structure as needed

### Modifying API Calls

Edit `services/SubsplashAPI.js` to customize:
- API endpoints
- Request/response handling
- Caching behavior
- Error handling

---

## 🔌 API Integration

### Available API Methods

The `SubsplashAPI` service provides:

#### Authentication
```javascript
SubsplashAPI.authenticate(email, password)
SubsplashAPI.logout()
SubsplashAPI.getCurrentUser()
```

#### Church Info
```javascript
SubsplashAPI.getChurchInfo()
```

#### Media
```javascript
SubsplashAPI.getMediaFeed(options)
SubsplashAPI.getMediaItem(mediaId)
SubsplashAPI.searchMedia(query, options)
```

#### Events
```javascript
SubsplashAPI.getEvents(options)
SubsplashAPI.getEventDetails(eventId)
SubsplashAPI.registerForEvent(eventId, data)
```

#### Live Streaming
```javascript
SubsplashAPI.getLiveStream()
SubsplashAPI.getStreamStatus()
```

#### Giving
```javascript
SubsplashAPI.getGivingOptions()
SubsplashAPI.createDonation(data)
SubsplashAPI.getDonationHistory(options)
```

#### Groups
```javascript
SubsplashAPI.getGroups(options)
SubsplashAPI.getGroupDetails(groupId)
SubsplashAPI.joinGroup(groupId)
```

#### Push Notifications
```javascript
SubsplashAPI.registerPushToken(token, platform)
SubsplashAPI.unregisterPushToken(token)
```

### Adding Custom Endpoints

To add new API endpoints:

1. Open `services/SubsplashAPI.js`
2. Add new method following existing patterns
3. Use the configured `this.api` axios instance
4. Implement caching if needed
5. Add error handling

Example:
```javascript
async getCustomData() {
  try {
    const response = await this.api.get('/custom/endpoint');
    return response.data;
  } catch (error) {
    console.error('Error fetching custom data:', error);
    throw error;
  }
}
```

---

## 📱 Deployment

### Building for Production

#### Android APK/AAB

```bash
cd android
./gradlew assembleRelease
# Or for App Bundle:
./gradlew bundleRelease
```

Output: `android/app/build/outputs/`

#### iOS IPA

1. Open in Xcode: `open ios/SubsplashChurchApp.xcworkspace`
2. Select a development team
3. Product → Archive
4. Follow distribution wizard

### Publishing to App Stores

**Google Play Store:**
1. Create developer account ($25 one-time)
2. Prepare store listing
3. Upload APK/AAB
4. Complete content rating questionnaire
5. Submit for review

**Apple App Store:**
1. Join Apple Developer Program ($99/year)
2. Create App ID in App Store Connect
3. Prepare metadata and screenshots
4. Upload build via Xcode
5. Submit for review

### Environment Variables

For production, use environment variables for sensitive data:

1. Create `.env` file (ignored by git):
```
SUBSPLASH_APP_KEY=your_key
SUBSPLASH_CHURCH_ID=your_id
SUBSPLASH_CLIENT_ID=your_client_id
SUBSPLASH_CLIENT_SECRET=your_secret
```

2. Use `react-native-config` to load variables
3. Never commit credentials to version control

---

## 🐛 Troubleshooting

### Common Issues

**1. "Cannot connect to Subsplash API"**
- Verify your API credentials in `subsplash.config.js`
- Check internet connection
- Ensure Subsplash API is accessible
- Contact Subsplash support if credentials are invalid

**2. "Metro bundler won't start"**
```bash
npx react-native start --reset-cache
```

**3. "Build failed on Android"**
```bash
cd android
./gradlew clean
cd ..
rm -rf node_modules
npm install
```

**4. "CocoaPods error on iOS"**
```bash
cd ios
pod deintegrate
pod install
cd ..
```

**5. "App crashes on launch"**
- Check console logs for errors
- Verify all dependencies are installed
- Ensure API credentials are valid
- Test on different device/simulator

**6. "Media won't play"**
- Check media URL is valid
- Verify device has internet connection
- Ensure proper permissions for media playback

**7. "Giving page not loading"**
- Verify Subsplash Giving is enabled for your church
- Check giving URL configuration
- Test WebView functionality

### Getting Help

- **Subsplash Support:** Contact your Client Success Manager
- **React Native Docs:** https://reactnative.dev/docs/getting-started
- **Subsplash Developer Portal:** https://developer.subsplash.com/
- **Community:** Check Stack Overflow with tags `react-native` and `subsplash`

---

## 📄 License

This project is a template for churches using Subsplash. Customize and deploy for your organization.

---

## 🤝 Contributing

This is a church-specific app template. For questions or custom development:
- Contact your church's technical team
- Reach out to Subsplash for platform support
- Hire a React Native developer for custom features

---

## 📞 Support

For technical support:
- **Subsplash API Issues:** Contact Subsplash support
- **App Development Questions:** Consult React Native documentation
- **Church-Specific Needs:** Contact your church administration

---

## ✅ Checklist Before Launch

- [ ] Subsplash API credentials configured
- [ ] Church information updated
- [ ] Branding/colors customized
- [ ] App icons and splash screens added
- [ ] All features tested on physical devices
- [ ] Push notifications configured
- [ ] Privacy policy and terms of use created
- [ ] App store listings prepared
- [ ] Beta testing completed
- [ ] Analytics configured (optional)
- [ ] Crash reporting set up (optional)
- [ ] Production builds created
- [ ] App store submissions complete

---

**Built with ❤️ for churches using Subsplash**

Ready to engage your congregation like never before!
