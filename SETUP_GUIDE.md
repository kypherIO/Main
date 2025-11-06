# CenterPointe Church Geofencing App - Setup Guide

Welcome! This guide will help you set up and run the CenterPointe Church geofencing app on both Android and iOS devices.

## 📱 What This App Does

This app uses geofencing technology to automatically detect when someone enters the church area (within 100 meters) and sends them a welcome notification that says:

**"Welcome to CenterPointe! Check out the app to learn more and connect!"**

The app works in the background, so users don't need to keep it open.

---

## ⚙️ Prerequisites

Before you begin, make sure you have:

### For Development:
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn** package manager
- **React Native CLI** - Install with: `npm install -g react-native-cli`

### For Android:
- **Android Studio** - [Download here](https://developer.android.com/studio)
- **Android SDK** (API level 33 or higher)
- **Java Development Kit (JDK)** 17

### For iOS (Mac only):
- **Xcode** 14 or higher - [Download from Mac App Store](https://apps.apple.com/us/app/xcode/id497799835)
- **CocoaPods** - Install with: `sudo gem install cocoapods`
- **iOS Simulator** or a physical iOS device

---

## 🚀 Installation Steps

### Step 1: Install Dependencies

Open your terminal in the project directory and run:

```bash
npm install
```

Or if you prefer yarn:

```bash
yarn install
```

### Step 2: iOS Setup (Mac only)

Navigate to the iOS directory and install CocoaPods dependencies:

```bash
cd ios
pod install
cd ..
```

### Step 3: Verify Church Coordinates

**IMPORTANT:** The church coordinates in `GeofenceService.js` are estimated. You should verify and update them for accuracy.

1. Open `GeofenceService.js`
2. Go to Google Maps: https://www.google.com/maps
3. Search for "1000 Roselawn Way, Bowling Green, KY 42104"
4. Right-click on the exact church location
5. Click "What's here?" to see coordinates
6. Update the coordinates in the file:

```javascript
const CHURCH_LOCATION = {
  latitude: 36.XXXX,  // Replace with actual latitude
  longitude: -86.XXXX, // Replace with actual longitude
  ...
};
```

---

## 📲 Running the App

### Running on Android:

1. **Start an Android emulator** through Android Studio, or connect a physical Android device via USB

2. **Enable USB debugging** on your Android device:
   - Go to Settings > About phone
   - Tap "Build number" 7 times to enable Developer options
   - Go back to Settings > Developer options
   - Enable "USB debugging"

3. **Run the app:**

```bash
npm run android
```

Or:

```bash
npx react-native run-android
```

### Running on iOS (Mac only):

1. **Start the iOS Simulator** or connect a physical iOS device

2. **Run the app:**

```bash
npm run ios
```

Or:

```bash
npx react-native run-ios
```

---

## 🔑 Setting Up Permissions

### Android Permissions:

When you first launch the app on Android, it will request:
1. **Location permission** - Tap "Allow"
2. **Background location permission** - IMPORTANT: Select **"Allow all the time"** for geofencing to work when the app is closed

If you accidentally deny permissions:
- Go to Settings > Apps > CenterPointe Church > Permissions
- Enable Location and set to "Allow all the time"
- Enable Notifications

### iOS Permissions:

When you first launch the app on iOS, it will request:
1. **Location permission** - Tap "Allow While Using App"
2. **Always Allow location** - The app will prompt you again, select **"Change to Always Allow"** for background geofencing

If you need to change permissions:
- Go to Settings > CenterPointe Church
- Tap Location and select "Always"
- Enable Notifications

---

## 🧪 Testing the Geofence

### Option 1: Mock Location (Easiest for Testing)

**Android:**
1. Enable Developer Options (see above)
2. Go to Settings > Developer Options > Select mock location app > Choose your app
3. Use a mock location app to simulate being at the church coordinates

**iOS:**
1. In Xcode, go to Debug > Simulate Location
2. Add a custom location with the church coordinates
3. The app will trigger when you "move" to that location

### Option 2: Physical Testing

1. Install the app on a physical device
2. Make sure permissions are set to "Always Allow" location
3. Drive to the church or get within 100 meters
4. You should receive a notification automatically!

### Option 3: Test Button in App

The app includes a "Test Notification" button to verify that notifications are working correctly.

---

## 📱 Building for Production

### Android APK:

```bash
cd android
./gradlew assembleRelease
```

The APK will be in: `android/app/build/outputs/apk/release/app-release.apk`

### iOS IPA:

1. Open the project in Xcode: `open ios/CenterPointeChurch.xcworkspace`
2. Select a development team in Signing & Capabilities
3. Select Product > Archive
4. Follow the distribution wizard

---

## 🔧 Customization

### Changing the Welcome Message:

Edit `NotificationService.js` line 51-52:

```javascript
title: 'Your Custom Title',
message: 'Your custom message here!',
```

### Changing the Geofence Radius:

Edit `GeofenceService.js` line 21:

```javascript
const GEOFENCE_RADIUS_METERS = 100; // Change to desired radius
```

### Adding Church Phone Number:

Edit `App.js` line 86:

```javascript
Linking.openURL('tel:YOUR-PHONE-NUMBER');
```

### Changing Notification Cooldown:

Edit `GeofenceService.js` line 26:

```javascript
this.notificationCooldown = 3600000; // Time in milliseconds (currently 1 hour)
```

---

## 🐛 Troubleshooting

### App won't build:
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
```

### Android: "SDK location not found"
Create `android/local.properties`:
```
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

### iOS: "Command PhaseScriptExecution failed"
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Notifications not working:
1. Check that permissions are granted (especially "Always Allow" for location)
2. Make sure the app isn't battery optimized (Android Settings > Battery)
3. Test the notification using the in-app "Test Notification" button

### Geofence not triggering:
1. Verify the coordinates are correct in `GeofenceService.js`
2. Check that location is set to "Always Allow"
3. Use the "Check My Location" button to see your distance from church
4. Make sure you're actually within 100 meters

---

## 📋 Publishing to App Stores

### Google Play Store (Android):

1. Create a Google Play Developer account ($25 one-time fee)
2. Generate a signed APK or App Bundle
3. Create app listing with screenshots and description
4. Submit for review

**Note:** Background location access requires justification and Google's approval.

### Apple App Store (iOS):

1. Join the Apple Developer Program ($99/year)
2. Create an App ID and provisioning profile
3. Archive and upload to App Store Connect
4. Fill out app information and submit for review

**Note:** Apps using background location require a clear explanation in the review notes.

---

## 🎯 Reaching People Without the App

Unfortunately, you **cannot** send notifications to people who don't have the app installed. This is a security/privacy restriction on iOS and Android.

### Alternative Solutions:

1. **QR Code at Church Entrance**
   - Create a QR code linking to the app download page
   - Place signs at the parking lot and entrance

2. **App Clips (iOS) / Instant Apps (Android)**
   - Lightweight versions that load without full installation
   - Requires additional development and setup

3. **Physical Beacons**
   - Bluetooth beacons (like Estimote or Kontakt.io)
   - Can trigger prompts on nearby phones
   - Requires hardware purchase (~$20-50 per beacon)

4. **NFC Tags**
   - Place NFC stickers at entrance
   - Visitors tap their phone to download
   - Inexpensive (~$1-2 per tag)

---

## 📞 Support

If you need help:
- Check the troubleshooting section above
- Review React Native documentation: https://reactnative.dev/
- Check the issues on this project's repository

---

## 🎉 You're Done!

Your CenterPointe Church geofencing app is ready to go! When people install the app and visit the church, they'll automatically receive a warm welcome notification.

**Remember:**
- Users must grant "Always Allow" location permission
- Test thoroughly before deploying to production
- Consider battery usage and optimize as needed

Good luck! 🙏
