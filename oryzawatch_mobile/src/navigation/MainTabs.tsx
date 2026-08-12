import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { COLORS, ROLES } from '../utils/constants';

// Screens
import HomeScreen from '../screens/farmer/HomeScreen';
import MapScreen from '../screens/farmer/MapScreen';
import AlertsScreen from '../screens/farmer/AlertsScreen';
import ProfileScreen from '../screens/farmer/ProfileScreen';
import SubmitReportScreen from '../screens/kagawad/SubmitReportScreen';
import AdminDashboardScreen from '../screens/mao/AdminDashboardScreen';

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  Report: undefined;   // Kagawad only
  Alerts: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Map: { active: 'map', inactive: 'map-outline' },
  Report: { active: 'document-text', inactive: 'document-text-outline' },
  Alerts: { active: 'notifications', inactive: 'notifications-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export default function MainTabs() {
  const { user } = useAuth();
  const role = user?.role;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.active : icons.inactive;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {/* MAO_ADMIN gets a special dashboard as the "Home" tab */}
      {role === ROLES.MAO_ADMIN ? (
        <Tab.Screen
          name="Home"
          component={AdminDashboardScreen}
          options={{ tabBarLabel: 'Dashboard' }}
        />
      ) : (
        <Tab.Screen name="Home" component={HomeScreen} />
      )}

      <Tab.Screen name="Map" component={MapScreen} />

      {/* Kagawad-only "Submit Report" tab */}
      {(role === ROLES.KAGAWAD || role === ROLES.MAO_ADMIN) && (
        <Tab.Screen
          name="Report"
          component={SubmitReportScreen}
          options={{ tabBarLabel: 'Report' }}
        />
      )}

      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
