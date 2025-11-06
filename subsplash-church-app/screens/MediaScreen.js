/**
 * Media Screen
 * Browse and search sermons, videos, and podcasts
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import SubsplashAPI from '../services/SubsplashAPI';
import { SUBSPLASH_CONFIG } from '../subsplash.config';

const MediaScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [media, setMedia] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedType, setSelectedType] = useState('all');

  useEffect(() => {
    loadMedia();
  }, [selectedType]);

  const loadMedia = async (reset = true) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      }

      const currentPage = reset ? 1 : page;
      const response = await SubsplashAPI.getMediaFeed({
        page: currentPage,
        limit: 20,
        type: selectedType,
      });

      const newMedia = response.items || [];

      if (reset) {
        setMedia(newMedia);
      } else {
        setMedia([...media, ...newMedia]);
      }

      setHasMore(newMedia.length === 20);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error loading media:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMedia(true);
      return;
    }

    try {
      setLoading(true);
      const response = await SubsplashAPI.searchMedia(searchQuery);
      setMedia(response.items || []);
      setLoading(false);
    } catch (error) {
      console.error('Search error:', error);
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore && !searchQuery) {
      setPage(page + 1);
      loadMedia(false);
    }
  };

  const handleMediaPress = (item) => {
    navigation.navigate('MediaPlayer', { media: item });
  };

  const onRefresh = () => {
    setRefreshing(true);
    setSearchQuery('');
    loadMedia(true);
  };

  const renderMediaItem = ({ item }) => (
    <TouchableOpacity
      style={styles.mediaCard}
      onPress={() => handleMediaPress(item)}>
      {item.thumbnail && (
        <Image
          source={{ uri: item.thumbnail }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      )}
      <View style={styles.mediaInfo}>
        <Text style={styles.mediaTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.mediaSpeaker}>{item.speaker || 'Speaker'}</Text>
        <Text style={styles.mediaDate}>
          {new Date(item.published_at).toLocaleDateString()}
        </Text>
        {item.duration && (
          <Text style={styles.mediaDuration}>{formatDuration(item.duration)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && page === 1) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, selectedType === 'all' && styles.filterButtonActive]}
          onPress={() => setSelectedType('all')}>
          <Text
            style={[
              styles.filterButtonText,
              selectedType === 'all' && styles.filterButtonTextActive,
            ]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, selectedType === 'video' && styles.filterButtonActive]}
          onPress={() => setSelectedType('video')}>
          <Text
            style={[
              styles.filterButtonText,
              selectedType === 'video' && styles.filterButtonTextActive,
            ]}>
            Videos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, selectedType === 'audio' && styles.filterButtonActive]}
          onPress={() => setSelectedType('audio')}>
          <Text
            style={[
              styles.filterButtonText,
              selectedType === 'audio' && styles.filterButtonTextActive,
            ]}>
            Audio
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, selectedType === 'podcast' && styles.filterButtonActive]}
          onPress={() => setSelectedType('podcast')}>
          <Text
            style={[
              styles.filterButtonText,
              selectedType === 'podcast' && styles.filterButtonTextActive,
            ]}>
            Podcasts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Media List */}
      <FlatList
        data={media}
        renderItem={renderMediaItem}
        keyExtractor={(item, index) => `${item.id || index}`}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No media found</Text>
          </View>
        }
        ListFooterComponent={
          loading && page > 1 ? (
            <ActivityIndicator
              size="small"
              color={SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR}
              style={styles.loader}
            />
          ) : null
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
  searchContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  searchButton: {
    backgroundColor: SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 8,
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  filterButtonActive: {
    backgroundColor: SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR,
  },
  filterButtonText: {
    color: '#666',
    fontSize: 14,
  },
  filterButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  listContent: {
    padding: 10,
  },
  mediaCard: {
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
  thumbnail: {
    width: 140,
    height: 100,
  },
  mediaInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  mediaTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  mediaSpeaker: {
    fontSize: 13,
    color: '#666',
    marginBottom: 3,
  },
  mediaDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 3,
  },
  mediaDuration: {
    fontSize: 11,
    color: '#999',
  },
  emptyContainer: {
    padding: 50,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  loader: {
    paddingVertical: 20,
  },
});

export default MediaScreen;
