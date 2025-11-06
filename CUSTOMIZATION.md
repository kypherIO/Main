# Quick Customization Guide

This guide shows you exactly where to make common changes to the app.

## 🎨 Changing the Welcome Notification

**File**: `NotificationService.js`
**Lines**: 51-52

```javascript
title: 'Welcome to CenterPointe! 👋',
message: 'Check out the app to learn more and connect!',
```

Change to your preferred message. You can remove the emoji if desired.

---

## 📍 Updating Church Coordinates

**File**: `GeofenceService.js`
**Lines**: 12-17

```javascript
const CHURCH_LOCATION = {
  latitude: 36.9903,  // Update this
  longitude: -86.4436, // Update this
  name: 'CenterPointe Church',
  address: '1000 Roselawn Way, Bowling Green, KY 42104',
};
```

**How to get exact coordinates:**
1. Go to [Google Maps](https://www.google.com/maps)
2. Search for your address
3. Right-click on the exact location
4. Click "What's here?"
5. Copy the coordinates shown

---

## 📏 Changing Geofence Radius

**File**: `GeofenceService.js`
**Line**: 21

```javascript
const GEOFENCE_RADIUS_METERS = 100; // Change to desired radius in meters
```

Common values:
- 50 meters = Very close (parking lot)
- 100 meters = Default (nearby area)
- 200 meters = Wider area (approaching church)

---

## ⏰ Notification Frequency

**File**: `GeofenceService.js`
**Line**: 26

```javascript
this.notificationCooldown = 3600000; // Time in milliseconds
```

Common values:
- 1800000 = 30 minutes
- 3600000 = 1 hour (default)
- 7200000 = 2 hours
- 0 = No cooldown (notification every time)

**Note**: Setting to 0 might annoy users who enter/exit the geofence frequently.

---

## 📞 Church Contact Information

**File**: `App.js`

### Phone Number (Line 86)
```javascript
Linking.openURL('tel:2707814545'); // Replace with church phone
```

### Address (Lines 213-214)
```javascript
<Text style={styles.addressText}>1000 Roselawn Way</Text>
<Text style={styles.addressText}>Bowling Green, KY 42104</Text>
```

### Website (Line 78)
```javascript
Linking.openURL('https://centerpointebg.com')
```

---

## 🎨 App Colors

**File**: `App.js`

### Primary Blue Color (Lines 154, 196)
```javascript
backgroundColor: '#2196F3', // Change hex color code
```

### Status Indicators (Lines 143-144)
```javascript
{ backgroundColor: isMonitoring ? '#4CAF50' : '#F44336' }
// #4CAF50 = Green (active)
// #F44336 = Red (inactive)
```

---

## 📱 App Name and Display Name

### Display Name
**File**: `app.json`
```json
{
  "name": "CenterPointeChurch",
  "displayName": "CenterPointe Church"
}
```

### Android
**File**: `android/app/src/main/res/values/strings.xml` (create if needed)
```xml
<string name="app_name">CenterPointe Church</string>
```

### iOS
**File**: `ios/CenterPointeChurch/Info.plist`
```xml
<key>CFBundleDisplayName</key>
<string>CenterPointe Church</string>
```

---

## 📍 Location Check Frequency

**File**: `GeofenceService.js`
**Line**: 20

```javascript
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds
```

Balance between battery life and responsiveness:
- 5000 = 5 seconds (more responsive, uses more battery)
- 10000 = 10 seconds (default)
- 30000 = 30 seconds (battery friendly, less responsive)

---

## 🔔 iOS Notification Permissions Text

**File**: `ios/CenterPointeChurch/Info.plist`
**Lines**: 42-50

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Your custom message here</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Your custom message here</string>
```

---

## 📝 About Section Text

**File**: `App.js`
**Lines**: 223-233

```javascript
<Text style={styles.aboutText}>
  This app uses geofencing technology to welcome you...
</Text>
```

Replace with your custom description.

---

## 🎯 Testing Mode (Disable Cooldown)

For testing purposes, you can temporarily disable the notification cooldown:

**File**: `GeofenceService.js`
**Line**: 53

```javascript
// Comment out or change this condition for testing
if (timeSinceLastNotification >= this.notificationCooldown) {
```

Change to:

```javascript
if (true) { // Always trigger during testing
```

**Remember to change it back before deploying to production!**

---

## 📦 Package Name / Bundle ID

### Android
**File**: `android/app/build.gradle`
```groovy
applicationId "com.centerpointechurch" // Change this
```

### iOS
Open `ios/CenterPointeChurch.xcworkspace` in Xcode
1. Select the project in the left sidebar
2. Go to "Signing & Capabilities"
3. Change "Bundle Identifier"

---

## 🌐 Additional Links/Features

To add more buttons/links in the "Connect With Us" section:

**File**: `App.js`
**After line**: 202

Add a new TouchableOpacity:

```javascript
<TouchableOpacity
  style={styles.linkButton}
  onPress={() => Linking.openURL('YOUR_URL')}>
  <Text style={styles.linkIcon}>🔗</Text>
  <Text style={styles.linkText}>Your Link Text</Text>
</TouchableOpacity>
```

---

## 💡 Tips

1. **Always test** after making changes
2. **Commit to git** before major changes so you can revert if needed
3. **Update both platforms** (iOS and Android) if you change text that appears in permissions
4. **Verify coordinates** are accurate using the "Check My Location" button in the app

---

## ❓ Need Help?

If something breaks after customization:
1. Check the console for error messages
2. Verify syntax (commas, brackets, quotes)
3. Try `npm install` again
4. Clear cache: `npx react-native start --reset-cache`
5. Rebuild: `npm run android` or `npm run ios`

For React Native issues, see: https://reactnative.dev/docs/troubleshooting
