/**
 * Home Screen
 * Displays church welcome, live stream status, upcoming events, and latest sermons
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import SubsplashAPI from '../services/SubsplashAPI';
import { SUBSPLASH_CONFIG } from '../subsplash.config';

const HomeScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [churchInfo, setChurchInfo] = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [latestSermons, setLatestSermons] = useState([]);

  useEffect(() => {
    loadHomeData();
    checkLiveStatus();

    // Check live status every minute
    const interval = setInterval(checkLiveStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadHomeData = async () => {
    try {
      setLoading(true);

      // Load church info
      try {
        const info = await SubsplashAPI.getChurchInfo();
        setChurchInfo(info);
      } catch (error) {
        console.log('Using config church info');
        setChurchInfo(SUBSPLASH_CONFIG.CHURCH_INFO);
      }

      // Load upcoming events
      if (SUBSPLASH_CONFIG.FEATURES.EVENTS) {
        try {
          const events = await SubsplashAPI.getEvents({ limit: 3 });
          setUpcomingEvents(events.items || []);
        } catch (error) {
          console.error('Error loading events:', error);
        }
      }

      // Load latest sermons
      if (SUBSPLASH_CONFIG.FEATURES.MEDIA) {
        try {
          const media = await SubsplashAPI.getMediaFeed({ limit: 3 });
          setLatestSermons(media.items || []);
        } catch (error) {
          console.error('Error loading sermons:', error);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading home data:', error);
      setLoading(false);
    }
  };

  const checkLiveStatus = async () => {
    if (!SUBSPLASH_CONFIG.FEATURES.LIVE_STREAMING) return;

    try {
      const status = await SubsplashAPI.getStreamStatus();
      setIsLive(status.isLive || false);
    } catch (error) {
      console.error('Error checking live status:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHomeData();
    await checkLiveStatus();
    setRefreshing(false);
  };

  const handleWatchLive = () => {
    navigation.navigate('Live');
  };

  const handleOpenWebsite = () => {
    Linking.openURL(churchInfo?.website || SUBSPLASH_CONFIG.CHURCH_INFO.WEBSITE);
  };

  const handleCall = () => {
    Linking.openURL(`tel:${churchInfo?.phone || SUBSPLASH_CONFIG.CHURCH_INFO.PHONE}`);
  };

  const handleDirections = () => {
    const address = churchInfo?.address || SUBSPLASH_CONFIG.CHURCH_INFO.ADDRESS;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      {/* Church Header */}
      <View style={styles.header}>
        <Text style={styles.churchName}>
          {churchInfo?.name || SUBSPLASH_CONFIG.CHURCH_INFO.NAME}
        </Text>
        <Text style={styles.tagline}>
          {churchInfo?.tagline || SUBSPLASH_CONFIG.CHURCH_INFO.TAGLINE}
        </Text>
      </View>

      {/* Live Stream Banner */}
      {isLive && SUBSPLASH_CONFIG.FEATURES.LIVE_STREAMING && (
        <TouchableOpacity
          style={styles.liveBanner}
          onPress={handleWatchLive}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE NOW</Text>
          </View>
          <Text style={styles.liveBannerText}>
            We're live! Tap to watch the service
          </Text>
        </TouchableOpacity>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleOpenWebsite}>
            <Text style={styles.actionIcon}>🌐</Text>
            <Text style={styles.actionText}>Website</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDirections}>
            <Text style={styles.actionIcon}>📍</Text>
            <Text style={styles.actionText}>Directions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCall}>
            <Text style={styles.actionIcon}>📞</Text>
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>

          {SUBSPLASH_CONFIG.FEATURES.GIVING && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Give')}>
              <Text style={styles.actionIcon}>💝</Text>
              <Text style={styles.actionText}>Give</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Upcoming Events */}
      {SUBSPLASH_CONFIG.FEATURES.EVENTS && upcomingEvents.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Events')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {upcomingEvents.map((event, index) => (
            <TouchableOpacity
              key={index}
              style={styles.eventCard}
              onPress={() => navigation.navigate('EventDetails', { event })}>
              <View style={styles.eventDate}>
                <Text style={styles.eventDateMonth}>
                  {new Date(event.start_time).toLocaleDateString('en-US', { month: 'short' })}
                </Text>
                <Text style={styles.eventDateDay}>
                  {new Date(event.start_time).getDate()}
                </Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventTime}>
                  {new Date(event.start_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Latest Sermons */}
      {SUBSPLASH_CONFIG.FEATURES.MEDIA && latestSermons.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Latest Messages</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Media')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {latestSermons.map((sermon, index) => (
            <TouchableOpacity
              key={index}
              style={styles.sermonCard}
              onPress={() => navigation.navigate('MediaPlayer', { media: sermon })}>
              {sermon.thumbnail && (
                <Image
                  source={{ uri: sermon.thumbnail }}
                  style={styles.sermonThumbnail}
                />
              )}
              <View style={styles.sermonInfo}>
                <Text style={styles.sermonTitle}>{sermon.title}</Text>
                <Text style={styles.sermonSpeaker}>{sermon.speaker || 'Speaker'}</Text>
                <Text style={styles.sermonDate}>
                  {new Date(sermon.published_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Contact Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <View style={styles.contactCard}>
          <Text style={styles.contactText}>
            {churchInfo?.address || SUBSPLASH_CONFIG.CHURCH_INFO.ADDRESS}
          </Text>
          <Text style={styles.contactText}>
            {churchInfo?.phone || SUBSPLASH_CONFIG.CHURCH_INFO.PHONE}
          </Text>
          <Text style={styles.contactText}>
            {churchInfo?.email || SUBSPLASH_CONFIG.CHURCH_INFO.EMAIL}
          </Text>
        </View>
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
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR,
    padding: 30,
    alignItems: 'center',
  },
  churchName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 5,
  },
  liveBanner: {
    backgroundColor: '#D32F2F',
    padding: 15,
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 8,
  },
  liveText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  liveBannerText: {
    color: 'white',
    fontSize: 16,
  },
  section: {
    padding: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    color: SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR,
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  actionButton: {
    alignItems: 'center',
    padding: 15,
    width: '22%',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 5,
  },
  actionText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventDate: {
    backgroundColor: SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    width: 60,
  },
  eventDateMonth: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventDateDay: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  eventInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  eventTime: {
    fontSize: 14,
    color: '#666',
  },
  sermonCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sermonThumbnail: {
    width: 120,
    height: 90,
  },
  sermonInfo: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  sermonTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  sermonSpeaker: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  sermonDate: {
    fontSize: 11,
    color: '#999',
  },
  contactCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
});

export default HomeScreen;
