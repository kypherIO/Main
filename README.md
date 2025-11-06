# CenterPointe Church - Geofencing App

A React Native mobile application that welcomes visitors to CenterPointe Church in Bowling Green, KY using geofencing technology.

## 🌟 Features

- **Automatic Welcome Notifications**: Visitors receive a warm welcome message when they arrive within 100 meters of the church
- **Background Monitoring**: Works even when the app is closed or in the background
- **Cross-Platform**: Runs on both iOS and Android devices
- **Church Information**: Easy access to church website, directions, and contact info
- **Location Testing**: Built-in tools to test geofence functionality

## 📍 Location

**CenterPointe Church**
1000 Roselawn Way
Bowling Green, KY 42104

**Geofence Radius**: 100 meters

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **For iOS** (Mac only):
   ```bash
   cd ios && pod install && cd ..
   npm run ios
   ```

3. **For Android**:
   ```bash
   npm run android
   ```

## 📖 Full Documentation

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete installation, configuration, and deployment instructions.

## ⚙️ Configuration

The app is configured for CenterPointe Church, but you can customize:
- Welcome message text
- Geofence radius
- Church coordinates (verify for accuracy!)
- Notification frequency
- Church contact information

## 🔔 How It Works

1. User installs the app and grants location permissions (set to "Always Allow")
2. App monitors user's location in the background
3. When user enters the 100-meter geofence around the church, a notification appears
4. Notification invites them to open the app and learn more about the church

## 📱 Requirements

- Node.js 18+
- React Native 0.73.2
- For Android: Android Studio, SDK API 33+
- For iOS: Xcode 14+, CocoaPods

## 🛠️ Tech Stack

- **React Native** - Cross-platform mobile framework
- **react-native-geolocation-service** - Location tracking
- **react-native-push-notification** - Local notifications
- **react-native-permissions** - Runtime permissions management

## 📝 Important Notes

### Location Permissions
Users **must** grant "Always Allow" location permission for geofencing to work when the app is closed. The app includes clear prompts and instructions for this.

### Coordinates Verification
The church coordinates in `GeofenceService.js` are estimated. Please verify the exact location using Google Maps and update if necessary.

### Notification Cooldown
By default, notifications are sent once per hour to avoid spam. This can be adjusted in `GeofenceService.js`.

### Reaching New Visitors
Mobile OS restrictions prevent sending notifications to people who don't have the app installed. Consider using QR codes, NFC tags, or physical beacons at the church entrance to encourage downloads.

## 🎯 Publishing

Before publishing to app stores:
1. Test thoroughly on physical devices
2. Verify all permissions are properly requested
3. Prepare privacy policy explaining location data usage
4. For App Store/Play Store, clearly explain why background location is needed

## 📄 License

This project is created for CenterPointe Church, Bowling Green, KY.

## 🤝 Contributing

This is a custom app for CenterPointe Church. For questions or modifications, please contact the church administration.

---

**Built with ❤️ for the CenterPointe Church community**
