import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import LoadingOverlay from '../components/common/LoadingOverlay';

export default function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingOverlay />;
  }

  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
