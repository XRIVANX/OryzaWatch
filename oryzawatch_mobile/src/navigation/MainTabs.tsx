import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  Report: undefined;   // Kagawad / Admin only
  Alerts: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  Home: { active: 'leaf', inactive: 'leaf-outline' },
  Map: { active: 'map', inactive: 'map-outline' },
  Report: { active: 'document-text', inactive: 'document-text-outline' },
  Alerts: { active: 'notifications', inactive: 'notifications-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export default function MainTabs() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const role = user?.role;

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8);
  const tabHeight = 58 + bottomInset;

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
          paddingBottom: bottomInset,
          paddingTop: 6,
          height: tabHeight,
          elevation: 8,
          shadowColor: '#12301c',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.1,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };
          const iconName = focused ? icons.active : icons.inactive;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {/* MAO_ADMIN gets dashboard as Home */}
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

      {/* Kagawad / Admin "Submit Report" tab */}
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
