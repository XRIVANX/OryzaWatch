import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../hooks/useAuth';
import { farmsApi } from '../api/farms';
import { ROLES } from '../utils/constants';
import { AlertsProvider } from '../context/AlertsContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import FarmOnboardingScreen from '../screens/farmer/FarmOnboardingScreen';
import EditFarmScreen from '../screens/farmer/EditFarmScreen';
import LoadingOverlay from '../components/common/LoadingOverlay';
import AlertToast from '../components/common/AlertToast';

export type RootStackParamList = {
  Tabs: undefined;
  EditFarm: undefined;
};

const RootStack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { user, isLoading } = useAuth();

  // A farmer is gated behind farm setup until `/api/farms/me/` exists. Other
  // roles never need a farm, so they skip this check entirely.
  const [checkingFarm, setCheckingFarm] = useState(false);
  const [hasFarm, setHasFarm] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || user.role !== ROLES.FARMER) {
      setHasFarm(null);
      return;
    }
    let cancelled = false;
    setCheckingFarm(true);
    farmsApi
      .getMine()
      .then((farm) => {
        if (!cancelled) setHasFarm(!!farm);
      })
      .catch(() => {
        // If the check itself fails (offline, server hiccup), don't trap the
        // farmer behind a gate they can't clear — let them into the app.
        if (!cancelled) setHasFarm(true);
      })
      .finally(() => {
        if (!cancelled) setCheckingFarm(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleFarmSetupComplete = useCallback(() => setHasFarm(true), []);

  if (isLoading) {
    return <LoadingOverlay />;
  }

  const needsFarmSetup = !!user && user.role === ROLES.FARMER && hasFarm === false;

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack />
      ) : checkingFarm && hasFarm === null ? (
        <LoadingOverlay />
      ) : needsFarmSetup ? (
        <FarmOnboardingScreen onComplete={handleFarmSetupComplete} />
      ) : (
        <AlertsProvider>
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            <RootStack.Screen name="Tabs" component={MainTabs} />
            <RootStack.Screen
              name="EditFarm"
              component={EditFarmScreen}
              options={{ presentation: 'modal' }}
            />
          </RootStack.Navigator>
          <AlertToast />
        </AlertsProvider>
      )}
    </NavigationContainer>
  );
}
