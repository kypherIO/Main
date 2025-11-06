/**
 * More Screen
 * Additional features and settings
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SUBSPLASH_CONFIG } from '../subsplash.config';
import SubsplashAPI from '../services/SubsplashAPI';

const MoreScreen = ({ navigation }) => {
  const handleSocialMedia = (platform) => {
    const url = SUBSPLASH_CONFIG.SOCIAL_MEDIA[platform.toUpperCase()];
    if (url) {
      Linking.openURL(url);
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear the cache? This will remove stored data and may require re-downloading content.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await SubsplashAPI.clearCache();
            Alert.alert('Success', 'Cache cleared successfully');
          },
        },
      ]
    );
  };

  const MenuItem = ({ icon, title, onPress, showArrow = true }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Icon name={icon} size={24} color={SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR} />
      <Text style={styles.menuText}>{title}</Text>
      {showArrow && (
        <Icon name="chevron-right" size={24} color="#CCC" />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Connect Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connect</Text>
        <View style={styles.card}>
          {SUBSPLASH_CONFIG.FEATURES.GROUPS && (
            <MenuItem
              icon="account-group"
              title="Small Groups"
              onPress={() => Alert.alert('Coming Soon', 'Small groups feature coming soon!')}
            />
          )}
          {SUBSPLASH_CONFIG.FEATURES.MESSAGING && (
            <MenuItem
              icon="message-text"
              title="Messages"
              onPress={() => Alert.alert('Coming Soon', 'Messaging feature coming soon!')}
            />
          )}
          <MenuItem
            icon="email"
            title="Contact Us"
            onPress={() => Linking.openURL(`mailto:${SUBSPLASH_CONFIG.CHURCH_INFO.EMAIL}`)}
          />
          <MenuItem
            icon="map-marker"
            title="Visit Us"
            onPress={() => {
              const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                SUBSPLASH_CONFIG.CHURCH_INFO.ADDRESS
              )}`;
              Linking.openURL(url);
            }}
          />
        </View>
      </View>

      {/* Resources Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resources</Text>
        <View style={styles.card}>
          {SUBSPLASH_CONFIG.FEATURES.BIBLE_READER && (
            <MenuItem
              icon="book-open-variant"
              title="Bible"
              onPress={() => Alert.alert('Coming Soon', 'Bible reader coming soon!')}
            />
          )}
          {SUBSPLASH_CONFIG.FEATURES.NOTES && (
            <MenuItem
              icon="note-text"
              title="My Notes"
              onPress={() => Alert.alert('Coming Soon', 'Notes feature coming soon!')}
            />
          )}
          <MenuItem
            icon="download"
            title="Downloads"
            onPress={() => Alert.alert('Coming Soon', 'Downloads feature coming soon!')}
          />
        </View>
      </View>

      {/* Social Media Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Follow Us</Text>
        <View style={styles.socialContainer}>
          {SUBSPLASH_CONFIG.SOCIAL_MEDIA.FACEBOOK && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialMedia('facebook')}>
              <Icon name="facebook" size={32} color="#1877F2" />
              <Text style={styles.socialText}>Facebook</Text>
            </TouchableOpacity>
          )}
          {SUBSPLASH_CONFIG.SOCIAL_MEDIA.INSTAGRAM && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialMedia('instagram')}>
              <Icon name="instagram" size={32} color="#E4405F" />
              <Text style={styles.socialText}>Instagram</Text>
            </TouchableOpacity>
          )}
          {SUBSPLASH_CONFIG.SOCIAL_MEDIA.TWITTER && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialMedia('twitter')}>
              <Icon name="twitter" size={32} color="#1DA1F2" />
              <Text style={styles.socialText}>Twitter</Text>
            </TouchableOpacity>
          )}
          {SUBSPLASH_CONFIG.SOCIAL_MEDIA.YOUTUBE && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialMedia('youtube')}>
              <Icon name="youtube" size={32} color="#FF0000" />
              <Text style={styles.socialText}>YouTube</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.card}>
          <MenuItem
            icon="bell"
            title="Notifications"
            onPress={() => Alert.alert('Coming Soon', 'Notification settings coming soon!')}
          />
          <MenuItem
            icon="account"
            title="My Account"
            onPress={() => Alert.alert('Coming Soon', 'Account settings coming soon!')}
          />
          <MenuItem
            icon="delete-sweep"
            title="Clear Cache"
            onPress={handleClearCache}
            showArrow={false}
          />
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <MenuItem
            icon="information"
            title="About This App"
            onPress={() =>
              Alert.alert(
                'About',
                `${SUBSPLASH_CONFIG.CHURCH_INFO.NAME} Church App\nVersion 1.0.0\n\nPowered by Subsplash`
              )
            }
            showArrow={false}
          />
          <MenuItem
            icon="file-document"
            title="Privacy Policy"
            onPress={() =>
              Linking.openURL(`${SUBSPLASH_CONFIG.CHURCH_INFO.WEBSITE}/privacy`)
            }
          />
          <MenuItem
            icon="file-document-outline"
            title="Terms of Use"
            onPress={() =>
              Linking.openURL(`${SUBSPLASH_CONFIG.CHURCH_INFO.WEBSITE}/terms`)
            }
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © {new Date().getFullYear()} {SUBSPLASH_CONFIG.CHURCH_INFO.NAME}
        </Text>
        <Text style={styles.footerSubText}>Powered by Subsplash</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  socialContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  socialButton: {
    alignItems: 'center',
    padding: 10,
    width: '22%',
  },
  socialText: {
    fontSize: 11,
    color: '#666',
    marginTop: 5,
  },
  footer: {
    alignItems: 'center',
    padding: 30,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
  footerSubText: {
    fontSize: 11,
    color: '#CCC',
    marginTop: 5,
  },
});

export default MoreScreen;
