// ─────────────────────────────────────────────────────────────────────────────
// MapScreen — Leaflet.js Disease Hotspot Map with Botanical Styling
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
              html: '<div style="background-color:${color}; width:24px; height:24px; border-radius:50%; border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.45);"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            var marker = L.marker([${h.scan.latitude}, ${h.scan.longitude}], { icon: icon }).addTo(map);
            marker.bindPopup(\`
              <div style="font-family:-apple-system, system-ui, sans-serif; padding:4px;">
                <div style="font-weight:800; font-size:14px; color:#14261c; margin-bottom:4px;">${label}</div>
                <div style="font-size:11px; font-weight:700; color:${color}; margin-bottom:6px;">${statusLabel}</div>
                <div style="font-size:12px; color:#4a6152;">💨 ${h.wind_cardinal} ${Math.round(h.wind_speed)} km/h</div>
                <div style="font-size:12px; color:#4a6152;">💧 Humidity: ${Math.round(h.humidity)}%</div>
                <div style="font-size:12px; color:#4a6152;">📍 Spread: ${h.spread_velocity.toFixed(1)} km/day</div>
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
          html: '<div style="background-color:#237e46; width:24px; height:24px; border-radius:50%; border:3px solid white; box-shadow:0 0 12px rgba(35,126,70,0.8);"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        L.marker([${userLocation.latitude}, ${userLocation.longitude}], { icon: userIcon })
          .addTo(map)
          .bindPopup('<div style="font-family:sans-serif; font-weight:bold; color:#14261c;">🌾 Your Rice Field</div>');
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
          body, html, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e1eae3; }
          .leaflet-popup-content-wrapper { border-radius: 14px; box-shadow: 0 6px 18px rgba(18,48,28,0.15); border: 1px solid #e1eae3; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 13);

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
      <View style={styles.container}>
        <OryzaHeader title="Disease Map" unreadCount={0} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading satellite GIS layers...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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

        {/* Legend Overlay Card matching Web Portal */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>HOTSPOT SEVERITY</Text>
          <LegendRow color={HOTSPOT_STATUS.CRITICAL.color} label="Critical Outbreak" />
          <LegendRow color={HOTSPOT_STATUS.AT_RISK.color} label="At-Risk Zone" />
          <LegendRow color={COLORS.primary} label="Your Field" />
        </View>

        {/* Recenter Button */}
        {userLocation && (
          <TouchableOpacity style={styles.recenterBtn} onPress={handleRecenter} activeOpacity={0.85}>
            <Ionicons name="locate" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
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
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  legend: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendLabel: { fontSize: 12, color: COLORS.textPrimary, fontWeight: '600' },
  recenterBtn: {
    position: 'absolute',
    bottom: 24,
    right: 18,
    backgroundColor: COLORS.white,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
});
