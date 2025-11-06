/**
 * Geofence Service
 * Monitors user location and triggers notifications when entering church area
 */

import Geolocation from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import NotificationService from './NotificationService';

// CenterPointe Church location
// 1000 Roselawn Way, Bowling Green, KY 42104
// NOTE: These coordinates are estimated. Verify exact coordinates using Google Maps
const CHURCH_LOCATION = {
  latitude: 36.9903,  // Estimated - please verify
  longitude: -86.4436, // Estimated - please verify
  name: 'CenterPointe Church',
  address: '1000 Roselawn Way, Bowling Green, KY 42104',
};

const GEOFENCE_RADIUS_METERS = 100; // 100 meters as requested
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds

class GeofenceService {
  constructor() {
    this.watchId = null;
    this.isInsideGeofence = false;
    this.lastNotificationTime = 0;
    this.notificationCooldown = 3600000; // 1 hour cooldown between notifications
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in meters
   */
  calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters
    return distance;
  };

  /**
   * Check if user is inside the geofence
   */
  isInsideChurchGeofence = (userLat, userLon) => {
    const distance = this.calculateDistance(
      userLat,
      userLon,
      CHURCH_LOCATION.latitude,
      CHURCH_LOCATION.longitude
    );

    console.log(`Distance from church: ${distance.toFixed(2)} meters`);
    return distance <= GEOFENCE_RADIUS_METERS;
  };

  /**
   * Handle location update
   */
  handleLocationUpdate = (position) => {
    const { latitude, longitude } = position.coords;
    const isInside = this.isInsideChurchGeofence(latitude, longitude);
    const currentTime = Date.now();

    console.log(`Current location: ${latitude}, ${longitude}`);
    console.log(`Inside geofence: ${isInside}`);
    console.log(`Previous state: ${this.isInsideGeofence}`);

    // Trigger notification when entering geofence (transition from outside to inside)
    if (isInside && !this.isInsideGeofence) {
      // Check if enough time has passed since last notification (cooldown)
      const timeSinceLastNotification = currentTime - this.lastNotificationTime;

      if (timeSinceLastNotification >= this.notificationCooldown) {
        console.log('ENTERING GEOFENCE - Triggering notification');
        NotificationService.showWelcomeNotification();
        this.lastNotificationTime = currentTime;
      } else {
        console.log('Notification cooldown active, skipping...');
      }
    }

    // Update state
    this.isInsideGeofence = isInside;
  };

  /**
   * Request location permissions
   */
  requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        ]);

        const fineLocationGranted =
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;

        const backgroundLocationGranted =
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;

        if (fineLocationGranted && backgroundLocationGranted) {
          console.log('Location permissions granted');
          return true;
        } else if (fineLocationGranted) {
          Alert.alert(
            'Background Location Required',
            'Please enable "Allow all the time" for location access in app settings for geofencing to work in the background.'
          );
          return true; // Still allow foreground
        } else {
          Alert.alert(
            'Permission Denied',
            'Location permission is required for this app to work.'
          );
          return false;
        }
      } catch (err) {
        console.warn(err);
        return false;
      }
    } else if (Platform.OS === 'ios') {
      // iOS permissions are handled through Info.plist and runtime requests
      return new Promise((resolve) => {
        Geolocation.requestAuthorization('always')
          .then((status) => {
            console.log('iOS location permission status:', status);
            resolve(status === 'granted' || status === 'authorizedAlways');
          })
          .catch((error) => {
            console.error('iOS permission error:', error);
            resolve(false);
          });
      });
    }
    return true;
  };

  /**
   * Start monitoring geofence
   */
  startMonitoring = async () => {
    const hasPermission = await this.requestLocationPermission();

    if (!hasPermission) {
      console.log('Location permission not granted');
      return false;
    }

    // Request notification permissions
    await NotificationService.requestPermissions();

    console.log('Starting geofence monitoring...');

    // Start watching position
    this.watchId = Geolocation.watchPosition(
      this.handleLocationUpdate,
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // Update every 10 meters
        interval: CHECK_INTERVAL_MS,
        fastestInterval: 5000,
        showLocationDialog: true,
        forceRequestLocation: true,
        forceLocationManager: false,
        showsBackgroundLocationIndicator: true,
      }
    );

    console.log('Geofence monitoring started with watch ID:', this.watchId);
    return true;
  };

  /**
   * Stop monitoring geofence
   */
  stopMonitoring = () => {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      console.log('Geofence monitoring stopped');
    }
  };

  /**
   * Get current location info
   */
  getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const distance = this.calculateDistance(
            latitude,
            longitude,
            CHURCH_LOCATION.latitude,
            CHURCH_LOCATION.longitude
          );
          const isInside = distance <= GEOFENCE_RADIUS_METERS;

          resolve({
            latitude,
            longitude,
            distance: distance.toFixed(2),
            isInsideGeofence: isInside,
            churchLocation: CHURCH_LOCATION,
          });
        },
        (error) => {
          console.error('Error getting current location:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  };
}

export default new GeofenceService();
