// ─────────────────────────────────────────────────────────────────────────────
// EditFarmScreen — thin wrapper around FarmOnboardingScreen for a farmer
// updating their already-registered farm (pin, boundary, or size) from the
// Map screen, rather than the mandatory first-login gate.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { farmsApi } from '../../api/farms';
import { COLORS } from '../../utils/constants';
import FarmOnboardingScreen from './FarmOnboardingScreen';
import type { Farm } from '../../types';

export default function EditFarmScreen() {
  const navigation = useNavigation();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    farmsApi.getMine().then(setFarm).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.text}>Loading your farm…</Text>
      </View>
    );
  }

  if (!farm) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>No farm found to edit.</Text>
      </View>
    );
  }

  return <FarmOnboardingScreen existingFarm={farm} onComplete={() => navigation.goBack()} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.background },
  text: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
});
