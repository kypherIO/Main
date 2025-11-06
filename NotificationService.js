/**
 * Notification Service
 * Handles local push notifications for geofence events
 */

import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { Platform } from 'react-native';

class NotificationService {
  constructor() {
    this.configure();
    this.createDefaultChannel();
  }

  configure = () => {
    PushNotification.configure({
      // Called when a remote or local notification is opened or received
      onNotification: function (notification) {
        console.log('NOTIFICATION:', notification);

        // Required on iOS only
        if (Platform.OS === 'ios') {
          notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      },

      // Android only: GCM or FCM Sender ID
      senderID: 'YOUR_SENDER_ID',

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });
  };

  createDefaultChannel = () => {
    PushNotification.createChannel(
      {
        channelId: 'centerpointe-geofence',
        channelName: 'CenterPointe Geofence Notifications',
        channelDescription: 'Notifications when entering church area',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`Channel created: ${created}`)
    );
  };

  showWelcomeNotification = () => {
    console.log('Showing welcome notification');

    PushNotification.localNotification({
      channelId: 'centerpointe-geofence',
      title: 'Welcome to CenterPointe! 👋',
      message: 'Check out the app to learn more and connect!',
      playSound: true,
      soundName: 'default',
      importance: 'high',
      vibrate: true,
      vibration: 300,
      priority: 'high',
      visibility: 'public',
      ignoreInForeground: false,

      // iOS specific
      ...(Platform.OS === 'ios' && {
        alertAction: 'view',
        category: '',
        userInfo: {},
      }),
    });
  };

  cancelAllNotifications = () => {
    PushNotification.cancelAllLocalNotifications();
  };

  requestPermissions = async () => {
    if (Platform.OS === 'ios') {
      const authStatus = await PushNotificationIOS.requestPermissions({
        alert: true,
        badge: true,
        sound: true,
      });
      return authStatus;
    }
    return true;
  };
}

export default new NotificationService();
