/**
 * Subsplash API Service
 * Handles all API communication with Subsplash servers
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUBSPLASH_CONFIG } from '../subsplash.config';

class SubsplashAPI {
  constructor() {
    this.baseURL = SUBSPLASH_CONFIG.API_BASE_URL;
    this.appKey = SUBSPLASH_CONFIG.APP_KEY;
    this.churchId = SUBSPLASH_CONFIG.CHURCH_ID;
    this.accessToken = null;

    // Create axios instance with default config
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ChurchApp/1.0',
      },
    });

    // Add request interceptor to attach auth token
    this.api.interceptors.request.use(
      async (config) => {
        if (!this.accessToken) {
          this.accessToken = await AsyncStorage.getItem('subsplash_access_token');
        }

        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }

        // Add app key to all requests
        config.headers['X-App-Key'] = this.appKey;

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          await this.refreshToken();
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * AUTHENTICATION
   */

  async authenticate(email, password) {
    try {
      const response = await this.api.post('/auth/login', {
        email,
        password,
        church_id: this.churchId,
      });

      const { access_token, refresh_token, user } = response.data;

      // Store tokens
      await AsyncStorage.setItem('subsplash_access_token', access_token);
      await AsyncStorage.setItem('subsplash_refresh_token', refresh_token);
      await AsyncStorage.setItem('subsplash_user', JSON.stringify(user));

      this.accessToken = access_token;

      return { success: true, user };
    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, error: error.message };
    }
  }

  async refreshToken() {
    try {
      const refreshToken = await AsyncStorage.getItem('subsplash_refresh_token');

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.api.post('/auth/refresh', {
        refresh_token: refreshToken,
      });

      const { access_token } = response.data;
      await AsyncStorage.setItem('subsplash_access_token', access_token);
      this.accessToken = access_token;

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      await this.logout();
      return false;
    }
  }

  async logout() {
    await AsyncStorage.removeItem('subsplash_access_token');
    await AsyncStorage.removeItem('subsplash_refresh_token');
    await AsyncStorage.removeItem('subsplash_user');
    this.accessToken = null;
  }

  async getCurrentUser() {
    const userStr = await AsyncStorage.getItem('subsplash_user');
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * CHURCH INFORMATION
   */

  async getChurchInfo() {
    try {
      const cacheKey = `church_info_${this.churchId}`;
      const cached = await this.getFromCache(cacheKey, SUBSPLASH_CONFIG.CACHE.CHURCH_INFO_CACHE_TIME);

      if (cached) return cached;

      const response = await this.api.get(`/churches/${this.churchId}`);
      await this.saveToCache(cacheKey, response.data);

      return response.data;
    } catch (error) {
      console.error('Error fetching church info:', error);
      throw error;
    }
  }

  /**
   * MEDIA / SERMONS
   */

  async getMediaFeed(options = {}) {
    try {
      const { page = 1, limit = 20, type = 'all' } = options;

      const cacheKey = `media_feed_${page}_${limit}_${type}`;
      const cached = await this.getFromCache(cacheKey, SUBSPLASH_CONFIG.CACHE.MEDIA_CACHE_TIME);

      if (cached) return cached;

      const response = await this.api.get(`/churches/${this.churchId}/media`, {
        params: {
          page,
          limit,
          type, // video, audio, podcast
        },
      });

      await this.saveToCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching media feed:', error);
      throw error;
    }
  }

  async getMediaItem(mediaId) {
    try {
      const response = await this.api.get(`/media/${mediaId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching media item:', error);
      throw error;
    }
  }

  async searchMedia(query, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;

      const response = await this.api.get(`/churches/${this.churchId}/media/search`, {
        params: {
          q: query,
          page,
          limit,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error searching media:', error);
      throw error;
    }
  }

  /**
   * EVENTS
   */

  async getEvents(options = {}) {
    try {
      const { startDate, endDate, page = 1, limit = 50 } = options;

      const cacheKey = `events_${startDate}_${endDate}_${page}`;
      const cached = await this.getFromCache(cacheKey, SUBSPLASH_CONFIG.CACHE.EVENTS_CACHE_TIME);

      if (cached) return cached;

      const response = await this.api.get(`/churches/${this.churchId}/events`, {
        params: {
          start_date: startDate,
          end_date: endDate,
          page,
          limit,
        },
      });

      await this.saveToCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  async getEventDetails(eventId) {
    try {
      const response = await this.api.get(`/events/${eventId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching event details:', error);
      throw error;
    }
  }

  async registerForEvent(eventId, registrationData) {
    try {
      const response = await this.api.post(`/events/${eventId}/register`, registrationData);
      return response.data;
    } catch (error) {
      console.error('Error registering for event:', error);
      throw error;
    }
  }

  /**
   * LIVE STREAMING
   */

  async getLiveStream() {
    try {
      const response = await this.api.get(`/churches/${this.churchId}/live`);
      return response.data;
    } catch (error) {
      console.error('Error fetching live stream:', error);
      throw error;
    }
  }

  async getStreamStatus() {
    try {
      const response = await this.api.get(`/churches/${this.churchId}/live/status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching stream status:', error);
      return { isLive: false };
    }
  }

  /**
   * GIVING / DONATIONS
   */

  async getGivingOptions() {
    try {
      const response = await this.api.get(`/churches/${this.churchId}/giving/funds`);
      return response.data;
    } catch (error) {
      console.error('Error fetching giving options:', error);
      throw error;
    }
  }

  async createDonation(donationData) {
    try {
      const response = await this.api.post(`/churches/${this.churchId}/giving/donate`, donationData);
      return response.data;
    } catch (error) {
      console.error('Error creating donation:', error);
      throw error;
    }
  }

  async getDonationHistory(options = {}) {
    try {
      const { page = 1, limit = 20 } = options;

      const response = await this.api.get(`/churches/${this.churchId}/giving/history`, {
        params: { page, limit },
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching donation history:', error);
      throw error;
    }
  }

  /**
   * GROUPS
   */

  async getGroups(options = {}) {
    try {
      const { category, page = 1, limit = 50 } = options;

      const response = await this.api.get(`/churches/${this.churchId}/groups`, {
        params: {
          category,
          page,
          limit,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching groups:', error);
      throw error;
    }
  }

  async getGroupDetails(groupId) {
    try {
      const response = await this.api.get(`/groups/${groupId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching group details:', error);
      throw error;
    }
  }

  async joinGroup(groupId) {
    try {
      const response = await this.api.post(`/groups/${groupId}/join`);
      return response.data;
    } catch (error) {
      console.error('Error joining group:', error);
      throw error;
    }
  }

  /**
   * PUSH NOTIFICATIONS
   */

  async registerPushToken(token, platform) {
    try {
      const response = await this.api.post('/notifications/register', {
        token,
        platform, // 'ios' or 'android'
        church_id: this.churchId,
      });

      return response.data;
    } catch (error) {
      console.error('Error registering push token:', error);
      throw error;
    }
  }

  async unregisterPushToken(token) {
    try {
      const response = await this.api.post('/notifications/unregister', {
        token,
      });

      return response.data;
    } catch (error) {
      console.error('Error unregistering push token:', error);
      throw error;
    }
  }

  /**
   * NOTES
   */

  async getNotes(mediaId = null) {
    try {
      const endpoint = mediaId
        ? `/media/${mediaId}/notes`
        : `/churches/${this.churchId}/notes`;

      const response = await this.api.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Error fetching notes:', error);
      throw error;
    }
  }

  async saveNote(noteData) {
    try {
      const response = await this.api.post('/notes', noteData);
      return response.data;
    } catch (error) {
      console.error('Error saving note:', error);
      throw error;
    }
  }

  async updateNote(noteId, noteData) {
    try {
      const response = await this.api.put(`/notes/${noteId}`, noteData);
      return response.data;
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  }

  async deleteNote(noteId) {
    try {
      const response = await this.api.delete(`/notes/${noteId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  /**
   * CACHE HELPERS
   */

  async getFromCache(key, maxAge) {
    try {
      const cached = await AsyncStorage.getItem(`cache_${key}`);

      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age > maxAge) {
        await AsyncStorage.removeItem(`cache_${key}`);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  async saveToCache(key, data) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
      };

      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

export default new SubsplashAPI();
