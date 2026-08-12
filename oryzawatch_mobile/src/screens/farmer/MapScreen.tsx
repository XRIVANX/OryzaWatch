// ─────────────────────────────────────────────────────────────────────────────
// MapScreen — Disease Hotspot Map
// Shows hotspot markers on react-native-maps matching the mockup.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import OryzaHeader from '../../components/common/OryzaHeader';
import { analyticsApi } from '../../api/analytics';
import { alertsApi } from '../../api/alerts';
import { COLORS, HOTSPOT_STATUS, DISEASE_LABELS } from '../../utils/constants';
import type { DiseaseHotspot } from '../../types';

// Default center: Davao del Norte, Philippines
const DEFAULT_REGION = {
  latitude: 7.3047,
  longitude: 125.6839,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export default function MapScreen() {
  const [hotspots, setHotspots] = useState<DiseaseHotspot[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [h, a] = await Promise.all([analyticsApi.getHotspots(), alertsApi.getAlerts()]);
      setHotspots(h);
      setUnreadCount(a.filter((x) => !x.is_read).length);
    } catch (e) {
      console.warn('MapScreen fetch error:', e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
      await fetchData();
      setLoading(false);
    })();
  }, [fetchData]);

  const markerColor = (status: string) => HOTSPOT_STATUS[status]?.color ?? COLORS.info;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <OryzaHeader title="Disease Map" unreadCount={0} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <OryzaHeader title="Disease Map" unreadCount={unreadCount} />

      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={
            userLocation
              ? { ...userLocation, latitudeDelta: 0.12, longitudeDelta: 0.12 }
              : DEFAULT_REGION
          }
          showsUserLocation={true}
          showsMyLocationButton={false}
        >
          {/* Hotspot Markers */}
          {hotspots.map((h) => (
            <Marker
              key={h.id}
              coordinate={{
                latitude: parseFloat(h.scan.latitude),
                longitude: parseFloat(h.scan.longitude),
              }}
              pinColor={markerColor(h.status)}
            >
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>
                    {DISEASE_LABELS[h.scan.detected_disease] || h.scan.detected_disease}
                  </Text>
                  <Text style={styles.calloutSub}>
                    {HOTSPOT_STATUS[h.status]?.label ?? h.status}
                  </Text>
                  <Text style={styles.calloutSub}>
                    💨 {h.wind_cardinal} · {h.wind_speed.toFixed(0)} km/h
                  </Text>
                  <Text style={styles.calloutSub}>
                    💧 Humidity: {h.humidity.toFixed(0)}%
                  </Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        {/* ── Legend ───────────────────────────────────── */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>MAP LEGEND</Text>
          <LegendRow color={HOTSPOT_STATUS.CRITICAL.color} label="High Risk" />
          <LegendRow color={HOTSPOT_STATUS.AT_RISK.color} label="Medium Risk" />
          <LegendRow color={COLORS.info} label="You" />
        </View>

        {/* ── Recenter Button ──────────────────────────── */}
        {userLocation && (
          <TouchableOpacity style={styles.recenterBtn} activeOpacity={0.8}>
            <Ionicons name="navigate-outline" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  legend: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  legendTitle: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1, marginBottom: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  legendLabel: { fontSize: 12, color: COLORS.textPrimary, fontWeight: '500' },
  callout: {
    backgroundColor: COLORS.white, borderRadius: 10, padding: 12,
    minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  calloutTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  calloutSub: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 2 },
  recenterBtn: {
    position: 'absolute', bottom: 24, right: 16,
    backgroundColor: COLORS.white, width: 44, height: 44,
    borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
});
