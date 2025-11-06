/**
 * Events Screen
 * Display church events and allow registration
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import SubsplashAPI from '../services/SubsplashAPI';
import { SUBSPLASH_CONFIG } from '../subsplash.config';
import { format, addDays, startOfDay } from 'date-fns';

const EventsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);

      const startDate = format(startOfDay(new Date()), 'yyyy-MM-dd');
      const endDate = format(addDays(new Date(), 90), 'yyyy-MM-dd');

      const response = await SubsplashAPI.getEvents({
        startDate,
        endDate,
        limit: 50,
      });

      setEvents(response.items || []);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error loading events:', error);
      setLoading(false);
      setRefreshing(false);
      // Set mock data if API fails
      setEvents([]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const handleEventPress = (event) => {
    navigation.navigate('EventDetails', { event });
  };

  const renderEventItem = ({ item }) => (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => handleEventPress(item)}>
      <View style={styles.eventHeader}>
        <View style={styles.eventDateBox}>
          <Text style={styles.eventMonth}>
            {new Date(item.start_time).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
          </Text>
          <Text style={styles.eventDay}>
            {new Date(item.start_time).getDate()}
          </Text>
        </View>
        <View style={styles.eventTitleContainer}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <Text style={styles.eventTime}>
            {new Date(item.start_time).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
          {item.location && (
            <Text style={styles.eventLocation}>📍 {item.location}</Text>
          )}
        </View>
      </View>

      {item.description && (
        <Text style={styles.eventDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      {item.requires_registration && (
        <View style={styles.registrationBadge}>
          <Text style={styles.registrationText}>Registration Required</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        renderItem={renderEventItem}
        keyExtractor={(item, index) => `${item.id || index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>No upcoming events</Text>
            <Text style={styles.emptySubText}>Check back soon!</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 15,
  },
  eventCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  eventDateBox: {
    width: 70,
    height: 70,
    backgroundColor: SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  eventMonth: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventDay: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  eventTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  eventTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  eventLocation: {
    fontSize: 13,
    color: '#888',
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 5,
  },
  registrationBadge: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: SUBSPLASH_CONFIG.THEME.SECONDARY_COLOR,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  registrationText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 50,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
  },
});

export default EventsScreen;
