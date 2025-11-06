/**
 * Give Screen
 * Subsplash Giving integration for online donations
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import SubsplashAPI from '../services/SubsplashAPI';
import { SUBSPLASH_CONFIG } from '../subsplash.config';

const GiveScreen = () => {
  const [loading, setLoading] = useState(true);
  const [givingFunds, setGivingFunds] = useState([]);
  const [showWebView, setShowWebView] = useState(false);
  const [givingURL, setGivingURL] = useState('');

  useEffect(() => {
    loadGivingOptions();
  }, []);

  const loadGivingOptions = async () => {
    try {
      setLoading(true);
      const funds = await SubsplashAPI.getGivingOptions();
      setGivingFunds(funds.items || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading giving options:', error);
      setLoading(false);
      // Use default giving options
      setGivingFunds([
        { id: 'general', name: 'General Fund', description: 'Support the general ministry' },
        { id: 'missions', name: 'Missions', description: 'Support our mission work' },
        { id: 'building', name: 'Building Fund', description: 'Help us grow our facilities' },
      ]);
    }
  };

  const handleGive = (fund) => {
    // Subsplash provides a hosted giving page
    // Format: https://pushpay.com/g/[church_name]
    // OR use the Subsplash Giving API to create a donation session

    const url = `https://pushpay.com/g/${SUBSPLASH_CONFIG.CHURCH_ID}?fund=${fund.id}`;
    setGivingURL(url);
    setShowWebView(true);

    // Alternative: Use in-app giving with Subsplash API
    // handleInAppGiving(fund);
  };

  const handleInAppGiving = async (fund) => {
    // This would integrate with Subsplash Giving API
    // You would collect payment info and submit through the API
    Alert.alert(
      'Give to ' + fund.name,
      'In-app giving integration coming soon. Would you like to give online?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Give Online',
          onPress: () => {
            const url = `https://pushpay.com/g/${SUBSPLASH_CONFIG.CHURCH_ID}`;
            setGivingURL(url);
            setShowWebView(true);
          },
        },
      ]
    );
  };

  if (showWebView) {
    return (
      <View style={styles.container}>
        <View style={styles.webViewHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowWebView(false)}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.webViewTitle}>Secure Giving</Text>
        </View>
        <WebView
          source={{ uri: givingURL }}
          startInLoadingState={true}
          renderLoading={() => (
            <ActivityIndicator
              size="large"
              color={SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR}
              style={styles.webViewLoader}
            />
          )}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>💝</Text>
        <Text style={styles.headerTitle}>Give</Text>
        <Text style={styles.headerSubtitle}>
          Your generosity makes a difference
        </Text>
      </View>

      {/* Verse */}
      <View style={styles.verseCard}>
        <Text style={styles.verseText}>
          "Give, and it will be given to you. A good measure, pressed down, shaken together and
          running over, will be poured into your lap."
        </Text>
        <Text style={styles.verseReference}>— Luke 6:38</Text>
      </View>

      {/* Giving Funds */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ways to Give</Text>

        {givingFunds.map((fund, index) => (
          <TouchableOpacity
            key={index}
            style={styles.fundCard}
            onPress={() => handleGive(fund)}>
            <View style={styles.fundInfo}>
              <Text style={styles.fundName}>{fund.name}</Text>
              {fund.description && (
                <Text style={styles.fundDescription}>{fund.description}</Text>
              )}
            </View>
            <View style={styles.giveButton}>
              <Text style={styles.giveButtonText}>Give</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Quick Give Button */}
        <TouchableOpacity
          style={styles.quickGiveButton}
          onPress={() => handleGive({ id: 'general', name: 'General Fund' })}>
          <Text style={styles.quickGiveText}>Quick Give</Text>
        </TouchableOpacity>
      </View>

      {/* Why Give Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Why Give?</Text>
        <View style={styles.whyGiveCard}>
          <Text style={styles.whyGiveText}>
            ✓ Support our ministry and mission work{'\n'}
            ✓ Help those in need in our community{'\n'}
            ✓ Maintain and grow our facilities{'\n'}
            ✓ Fund youth and children's programs{'\n'}
            ✓ Support our pastoral staff and volunteers
          </Text>
        </View>
      </View>

      {/* Secure Giving Info */}
      <View style={styles.section}>
        <View style={styles.secureCard}>
          <Text style={styles.secureIcon}>🔒</Text>
          <Text style={styles.secureText}>
            Your giving is secure and encrypted. All transactions are processed through
            Subsplash Giving, a trusted and secure payment platform.
          </Text>
        </View>
      </View>

      {/* Tax Deductible */}
      <View style={styles.section}>
        <Text style={styles.taxText}>
          All donations are tax-deductible. You will receive a receipt via email.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR,
    padding: 30,
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  verseCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: SUBSPLASH_CONFIG.THEME.SECONDARY_COLOR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  verseText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#333',
    lineHeight: 22,
    marginBottom: 10,
  },
  verseReference: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'right',
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  fundCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  fundInfo: {
    flex: 1,
  },
  fundName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  fundDescription: {
    fontSize: 13,
    color: '#666',
  },
  giveButton: {
    backgroundColor: SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  giveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  quickGiveButton: {
    backgroundColor: SUBSPLASH_CONFIG.THEME.SECONDARY_COLOR,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  quickGiveText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  whyGiveCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  whyGiveText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 24,
  },
  secureCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  secureIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  secureText: {
    flex: 1,
    fontSize: 13,
    color: '#2E7D32',
    lineHeight: 20,
  },
  taxText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR,
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  webViewTitle: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginRight: 40,
  },
  webViewLoader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
});

export default GiveScreen;
