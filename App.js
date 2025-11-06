/**
 * CenterPointe Church App
 * Main application component
 */

import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
} from 'react-native';

import GeofenceService from './GeofenceService';
import NotificationService from './NotificationService';

function App() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [locationInfo, setLocationInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Start monitoring when app loads
    startGeofenceMonitoring();

    // Cleanup on unmount
    return () => {
      GeofenceService.stopMonitoring();
    };
  }, []);

  const startGeofenceMonitoring = async () => {
    setLoading(true);
    const success = await GeofenceService.startMonitoring();
    setIsMonitoring(success);
    setLoading(false);

    if (success) {
      Alert.alert(
        'Geofencing Active',
        'You will receive a notification when you enter the church area!'
      );
    }
  };

  const stopGeofenceMonitoring = () => {
    GeofenceService.stopMonitoring();
    setIsMonitoring(false);
  };

  const checkCurrentLocation = async () => {
    try {
      setLoading(true);
      const info = await GeofenceService.getCurrentLocation();
      setLocationInfo(info);
      setLoading(false);

      Alert.alert(
        'Location Info',
        `Distance from church: ${info.distance}m\n${
          info.isInsideGeofence ? '✅ Inside geofence' : '❌ Outside geofence'
        }`
      );
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Could not get current location');
    }
  };

  const testNotification = () => {
    NotificationService.showWelcomeNotification();
    Alert.alert('Test', 'Notification sent!');
  };

  const openWebsite = () => {
    Linking.openURL('https://centerpointebg.com').catch((err) =>
      console.error('Error opening website:', err)
    );
  };

  const openMaps = () => {
    const address = '1000 Roselawn Way, Bowling Green, KY 42104';
    const url = Platform.select({
      ios: `maps://app?address=${encodeURIComponent(address)}`,
      android: `geo:0,0?q=${encodeURIComponent(address)}`,
    });

    Linking.openURL(url).catch(() => {
      // Fallback to Google Maps website
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          address
        )}`
      );
    });
  };

  const callChurch = () => {
    // Replace with actual church phone number
    Linking.openURL('tel:2707814545');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CenterPointe Church</Text>
          <Text style={styles.subtitle}>Bowling Green, KY</Text>
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Geofencing Status</Text>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: isMonitoring ? '#4CAF50' : '#F44336' },
              ]}
            />
            <Text style={styles.statusText}>
              {isMonitoring ? 'Active - Monitoring Location' : 'Inactive'}
            </Text>
          </View>
          <Text style={styles.cardDescription}>
            You'll receive a welcome notification when you arrive at the church!
          </Text>

          {locationInfo && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationText}>
                Distance from church: {locationInfo.distance}m
              </Text>
              <Text
                style={[
                  styles.locationText,
                  { color: locationInfo.isInsideGeofence ? '#4CAF50' : '#F44336' },
                ]}>
                {locationInfo.isInsideGeofence
                  ? '✅ Inside geofence'
                  : '❌ Outside geofence'}
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={checkCurrentLocation}
            disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? 'Loading...' : '📍 Check My Location'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={testNotification}>
            <Text style={styles.buttonText}>🔔 Test Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={
              isMonitoring ? stopGeofenceMonitoring : startGeofenceMonitoring
            }>
            <Text style={styles.buttonText}>
              {isMonitoring ? '⏸️ Stop Monitoring' : '▶️ Start Monitoring'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Church Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connect With Us</Text>

          <TouchableOpacity style={styles.linkButton} onPress={openWebsite}>
            <Text style={styles.linkIcon}>🌐</Text>
            <Text style={styles.linkText}>Visit Our Website</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={openMaps}>
            <Text style={styles.linkIcon}>📍</Text>
            <Text style={styles.linkText}>Get Directions</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={callChurch}>
            <Text style={styles.linkIcon}>📞</Text>
            <Text style={styles.linkText}>Call Us</Text>
          </TouchableOpacity>

          <View style={styles.addressContainer}>
            <Text style={styles.addressText}>1000 Roselawn Way</Text>
            <Text style={styles.addressText}>Bowling Green, KY 42104</Text>
          </View>
        </View>

        {/* About */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About This App</Text>
          <Text style={styles.aboutText}>
            This app uses geofencing technology to welcome you when you arrive at
            CenterPointe Church. When you come within 100 meters of the church,
            you'll automatically receive a welcome notification.
          </Text>
          <Text style={styles.aboutText}>
            The app works in the background, so you don't need to keep it open.
            Just make sure location permissions are set to "Allow all the time".
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  locationInfo: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  buttonsContainer: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#757575',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  linkIcon: {
    fontSize: 20,
    marginRight: 15,
  },
  linkText: {
    fontSize: 16,
    color: '#2196F3',
  },
  addressContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  aboutText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
});

export default App;
