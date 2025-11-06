/**
 * Subsplash Church App
 * Main application entry point with navigation
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Screens
import HomeScreen from './screens/HomeScreen';
import MediaScreen from './screens/MediaScreen';
import EventsScreen from './screens/EventsScreen';
import GiveScreen from './screens/GiveScreen';
import MoreScreen from './screens/MoreScreen';

import { SUBSPLASH_CONFIG } from './subsplash.config';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const screenOptions = {
  headerStyle: {
    backgroundColor: SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR,
  },
  headerTintColor: '#fff',
  headerTitleStyle: {
    fontWeight: 'bold',
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Media') {
            iconName = focused ? 'play-circle' : 'play-circle-outline';
          } else if (route.name === 'Events') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Give') {
            iconName = focused ? 'hand-heart' : 'hand-heart-outline';
          } else if (route.name === 'More') {
            iconName = focused ? 'menu' : 'menu';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: SUBSPLASH_CONFIG.THEME.PRIMARY_COLOR,
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
      })}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: SUBSPLASH_CONFIG.CHURCH_INFO.NAME,
          ...screenOptions,
        }}
      />

      {SUBSPLASH_CONFIG.FEATURES.MEDIA && (
        <Tab.Screen
          name="Media"
          component={MediaScreen}
          options={{
            headerTitle: 'Messages',
            ...screenOptions,
          }}
        />
      )}

      {SUBSPLASH_CONFIG.FEATURES.EVENTS && (
        <Tab.Screen
          name="Events"
          component={EventsScreen}
          options={{
            headerTitle: 'Events',
            ...screenOptions,
          }}
        />
      )}

      {SUBSPLASH_CONFIG.FEATURES.GIVING && (
        <Tab.Screen
          name="Give"
          component={GiveScreen}
          options={{
            headerTitle: 'Give',
            ...screenOptions,
          }}
        />
      )}

      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          headerTitle: 'More',
          ...screenOptions,
        }}
      />
    </Tab.Navigator>
  );
}

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        {/* Add additional stack screens here for detail views */}
        {/*
        <Stack.Screen name="MediaPlayer" component={MediaPlayerScreen} options={screenOptions} />
        <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={screenOptions} />
        <Stack.Screen name="Live" component={LiveStreamScreen} options={screenOptions} />
        */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
