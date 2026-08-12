// ─────────────────────────────────────────────────────────────────────────────
// MapScreen — Leaflet.js Disease Hotspot Map
// Renders OpenStreetMap / Esri Satellite map with Leaflet.js via react-native-webview
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import OryzaHeader from '../../components/common/OryzaHeader';
import { analyticsApi } from '../../api/analytics';
import { alertsApi } from '../../api/alerts';
import { COLORS, HOTSPOT_STATUS, DISEASE_LABELS } from '../../utils/constants';
import type { DiseaseHotspot } from '../../types';

const DEFAULT_CENTER = { latitude: 7.3047, longitude: 125.6839 }; // Davao del Norte

export default function MapScreen() {
  const webViewRef = useRef<WebView>(null);
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
      await fetchData();
      setLoading(false);
    })();
  }, [fetchData]);

  // Generate Leaflet.js HTML with Esri World Imagery Satellite Tiles + Hotspot Markers
  const generateLeafletHTML = () => {
    const lat = userLocation ? userLocation.latitude : DEFAULT_CENTER.latitude;
    const lng = userLocation ? userLocation.longitude : DEFAULT_CENTER.longitude;

    const markersScript = hotspots
      .map((h) => {
        const color = h.status === 'CRITICAL' ? '#dc2626' : h.status === 'AT_RISK' ? '#f97316' : '#2563eb';
        const label = DISEASE_LABELS[h.scan.detected_disease] || h.scan.detected_disease;
        const statusLabel = HOTSPOT_STATUS[h.status]?.label ?? h.status;

        return `
          (function() {
            var icon = L.divIcon({
              className: 'custom-pin',
              html: '<div style="background-color:${color}; width:24px; height:24px; border-radius:50%; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            var marker = L.marker([${h.scan.latitude}, ${h.scan.longitude}], { icon: icon }).addTo(map);
            marker.bindPopup(\`
              <div style="font-family:sans-serif; padding:4px;">
                <div style="font-weight:bold; font-size:14px; color:#0f172a; margin-bottom:4px;">${label}</div>
                <div style="font-size:11px; font-weight:bold; color:${color}; margin-bottom:6px;">${statusLabel}</div>
                <div style="font-size:12px; color:#475569;">💨 ${h.wind_cardinal} ${Math.round(h.wind_speed)} km/h</div>
                <div style="font-size:12px; color:#475569;">💧 Humidity: ${Math.round(h.humidity)}%</div>
                <div style="font-size:12px; color:#475569;">📍 Spread: ${h.spread_velocity.toFixed(1)} km/day</div>
              </div>
            \`);
          })();
        `;
      })
      .join('\n');

    const userMarkerScript = userLocation
      ? `
        var userIcon = L.divIcon({
          className: 'user-pin',
          html: '<div style="background-color:#2563eb; width:22px; height:22px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(37,99,235,0.6);"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        L.marker([${userLocation.latitude}, ${userLocation.longitude}], { icon: userIcon })
          .addTo(map)
          .bindPopup('<div style="font-family:sans-serif; font-weight:bold;">🌾 Your Farm</div>');
      `
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e2e8f0; }
          .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 13);

          // Esri World Imagery (Satellite Tiles matching mockup)
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 18,
            attribution: 'Esri World Imagery'
          }).addTo(map);

          ${userMarkerScript}
          ${markersScript}
        </script>
      </body>
      </html>
    `;
  };

  const handleRecenter = () => {
    if (userLocation && webViewRef.current) {
      const js = `map.setView([${userLocation.latitude}, ${userLocation.longitude}], 14);`;
      webViewRef.current.injectJavaScript(js);
    }
  };

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
        {/* Leaflet WebView */}
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: generateLeafletHTML() }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />

        {/* Legend Overlay */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>MAP LEGEND</Text>
          <LegendRow color={HOTSPOT_STATUS.CRITICAL.color} label="High Risk" />
          <LegendRow color={HOTSPOT_STATUS.AT_RISK.color} label="Medium Risk" />
          <LegendRow color={COLORS.info} label="You" />
        </View>

        {/* Recenter Button */}
        {userLocation && (
          <TouchableOpacity style={styles.recenterBtn} onPress={handleRecenter} activeOpacity={0.8}>
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
  recenterBtn: {
    position: 'absolute', bottom: 24, right: 16,
    backgroundColor: COLORS.white, width: 44, height: 44,
    borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
});
