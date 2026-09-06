// ─────────────────────────────────────────────────────────────────────────────
// FarmOnboardingScreen — mandatory first-login farm setup for FARMER accounts.
//
// Pin the farm's location, draw its boundary (tap to add corners; closing the
// loop fills it green), confirm the size in hectares, and submit. Blocks
// access to the rest of the app (see AppNavigator.tsx) until a Farm exists —
// the backend requires it (POST /api/farms/me/), matching "it is required to
// have a location for their farm".
//
// Drawing is implemented as plain injected Leaflet JS inside a WebView (same
// CDN-script pattern as MapScreen.tsx) rather than a native map/drawing
// library — this project has no OTA updates, so any new native module means
// a full rebuild. This needs none.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { farmsApi } from '../../api/farms';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../utils/constants';
import type { Farm } from '../../types';

const DEFAULT_CENTER = { latitude: 7.3047, longitude: 125.6839 }; // Davao del Norte

interface Props {
  onComplete: () => void;
  /** Editing an existing farm (e.g. from the Map screen) rather than the
   * mandatory first-login gate - pre-fills the pin/boundary/hectares, and
   * changes the copy/behavior that only makes sense during onboarding. */
  existingFarm?: Farm | null;
}

type BoundaryEvent =
  | { type: 'pin'; lat: number; lng: number }
  | { type: 'points'; count: number }
  | { type: 'closed'; points: [number, number][]; hectares: number };

export default function FarmOnboardingScreen({ onComplete, existingFarm = null }: Props) {
  const { logout } = useAuth();
  const webViewRef = useRef<WebView>(null);
  const isEditing = !!existingFarm;

  const [mapReady, setMapReady] = useState(false);
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
    existingFarm ? { latitude: parseFloat(existingFarm.latitude), longitude: parseFloat(existingFarm.longitude) } : null
  );
  const [drawing, setDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(existingFarm?.boundary?.length ?? 0);
  const [boundary, setBoundary] = useState<[number, number][] | null>(existingFarm?.boundary ?? null);
  const [hectares, setHectares] = useState(existingFarm ? String(existingFarm.size_hectares) : '');
  const [submitting, setSubmitting] = useState(false);

  // ── Locate the farmer on launch, so the map opens roughly on their farm ──
  // Skipped when editing an existing farm - its own saved location is used.
  React.useEffect(() => {
    if (existingFarm) {
      setMapReady(true);
      return;
    }
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setPin({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        } else {
          setPin(DEFAULT_CENTER);
        }
      } catch {
        setPin(DEFAULT_CENTER);
      } finally {
        setMapReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data: BoundaryEvent = JSON.parse(event.nativeEvent.data);
      if (data.type === 'pin') {
        setPin({ latitude: data.lat, longitude: data.lng });
      } else if (data.type === 'points') {
        setPointCount(data.count);
      } else if (data.type === 'closed') {
        setBoundary(data.points);
        setPointCount(data.points.length);
        setDrawing(false);
        setHectares(data.hectares > 0 ? data.hectares.toFixed(2) : '');
      }
    } catch {
      // ignore malformed messages
    }
  }, []);

  const sendCommand = (js: string) => webViewRef.current?.injectJavaScript(`${js};true;`);

  const toggleDrawing = () => {
    const next = !drawing;
    setDrawing(next);
    sendCommand(`window.setDrawingMode(${next})`);
  };

  const undoPoint = () => sendCommand('window.undoLastPoint()');

  const redrawBoundary = () => {
    setBoundary(null);
    setPointCount(0);
    setDrawing(true);
    sendCommand('window.resetBoundary()');
    sendCommand('window.setDrawingMode(true)');
  };

  const closeShape = () => sendCommand('window.closeShape()');

  const isClosed = boundary !== null && boundary.length >= 3;
  const hectaresValue = parseFloat(hectares);
  const canSubmit = !!pin && isClosed && hectaresValue > 0 && !submitting;

  const handleSubmit = async () => {
    if (!pin || !boundary) return;
    setSubmitting(true);
    try {
      await farmsApi.upsertMine({
        // The backend's DecimalField(9, 6) rejects GPS/map-tap coordinates
        // with more precision than that (same fix as the scan submit flow).
        latitude: Number(pin.latitude.toFixed(6)),
        longitude: Number(pin.longitude.toFixed(6)),
        boundary,
        size_hectares: hectaresValue,
      });
      onComplete();
    } catch (e: any) {
      Alert.alert('Could not save your farm', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const generateHTML = () => {
    const lat = pin?.latitude ?? DEFAULT_CENTER.latitude;
    const lng = pin?.longitude ?? DEFAULT_CENTER.longitude;
    const initialBoundaryJson = JSON.stringify(existingFarm?.boundary ?? []);
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e1eae3; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 17);
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Esri World Imagery'
          }).addTo(map);

          function post(msg) {
            window.ReactNativeWebView.postMessage(JSON.stringify(msg));
          }

          // ── Pin ──────────────────────────────────────────────────────────
          var pinIcon = L.divIcon({
            className: 'pin',
            html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#237e46;border:3px solid white;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
            iconSize: [26, 26],
            iconAnchor: [13, 26],
          });
          var pinMarker = L.marker([${lat}, ${lng}], { icon: pinIcon, draggable: true }).addTo(map);
          pinMarker.on('dragend', function (e) {
            var p = e.target.getLatLng();
            post({ type: 'pin', lat: p.lat, lng: p.lng });
          });

          // ── Boundary drawing ─────────────────────────────────────────────
          var drawingMode = false;
          var points = [];
          var pointMarkers = [];
          var polyline = null;
          var polygon = null;

          window.setDrawingMode = function (on) { drawingMode = on; };

          function redrawLine() {
            if (polyline) { map.removeLayer(polyline); polyline = null; }
            if (points.length > 1) {
              polyline = L.polyline(points, { color: '#237e46', weight: 3, dashArray: '6 6' }).addTo(map);
            }
          }

          window.undoLastPoint = function () {
            if (!points.length) return;
            points.pop();
            var m = pointMarkers.pop();
            if (m) map.removeLayer(m);
            redrawLine();
            post({ type: 'points', count: points.length });
          };

          window.resetBoundary = function () {
            points.forEach(function () {});
            pointMarkers.forEach(function (m) { map.removeLayer(m); });
            pointMarkers = [];
            points = [];
            if (polyline) { map.removeLayer(polyline); polyline = null; }
            if (polygon) { map.removeLayer(polygon); polygon = null; }
            post({ type: 'points', count: 0 });
          };

          // Equirectangular-projected shoelace formula, mirrors the backend's
          // polygon_area_hectares() closely enough for a live preview.
          function areaHectares(pts) {
            if (pts.length < 3) return 0;
            var lat0 = pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length;
            var rad = Math.PI / 180;
            var kmPerLat = rad * 6371;
            var kmPerLng = rad * 6371 * Math.cos(lat0 * rad);
            var xy = pts.map(function (p) { return [p[1] * kmPerLng, p[0] * kmPerLat]; });
            var area = 0;
            for (var i = 0; i < xy.length; i++) {
              var a = xy[i], b = xy[(i + 1) % xy.length];
              area += a[0] * b[1] - b[0] * a[1];
            }
            return Math.abs(area) / 2 * 100; // km^2 -> hectares
          }

          window.closeShape = function () {
            if (points.length < 3) return;
            if (polyline) { map.removeLayer(polyline); polyline = null; }
            if (polygon) { map.removeLayer(polygon); }
            polygon = L.polygon(points, { color: '#237e46', weight: 3, fillColor: '#4ade80', fillOpacity: 0.45 }).addTo(map);
            post({ type: 'closed', points: points, hectares: areaHectares(points) });
          };

          // Editing an existing farm - draw its saved boundary immediately.
          var initialPoints = ${initialBoundaryJson};
          if (initialPoints.length >= 3) {
            points = initialPoints;
            polygon = L.polygon(points, { color: '#237e46', weight: 3, fillColor: '#4ade80', fillOpacity: 0.45 }).addTo(map);
          }

          map.on('click', function (e) {
            if (drawingMode) {
              points.push([e.latlng.lat, e.latlng.lng]);
              var cm = L.circleMarker(e.latlng, { radius: 5, color: '#237e46', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }).addTo(map);
              pointMarkers.push(cm);
              redrawLine();
              post({ type: 'points', count: points.length });
            } else {
              pinMarker.setLatLng(e.latlng);
              post({ type: 'pin', lat: e.latlng.lat, lng: e.latlng.lng });
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  if (!mapReady) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Finding your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Your Farm' : 'Set Up Your Farm'}</Text>
          <Text style={styles.headerSubtitle}>
            {isEditing ? 'Update your pin, boundary, or size' : 'Required before you can use OryzaWatch'}
          </Text>
        </View>
        {!isEditing && (
          <TouchableOpacity onPress={() => logout()} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.mapWrap}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: generateHTML() }}
          style={styles.map}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
        />
        <View style={styles.hintBadge}>
          <Ionicons name={drawing ? 'create' : 'location'} size={13} color={COLORS.white} />
          <Text style={styles.hintText}>
            {drawing ? 'Tap the map to add corners' : 'Drag the pin, or tap the map to move it'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.controls}>
          {!isClosed ? (
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.actionBtn, drawing && styles.actionBtnActive]}
                onPress={toggleDrawing}
                activeOpacity={0.85}
              >
                <Ionicons name="brush-outline" size={16} color={drawing ? COLORS.white : COLORS.primary} />
                <Text style={[styles.actionBtnText, drawing && styles.actionBtnTextActive]}>
                  {drawing ? 'Drawing…' : 'Draw Farm Boundary'}
                </Text>
              </TouchableOpacity>
              {drawing && pointCount > 0 && (
                <TouchableOpacity style={styles.smallBtn} onPress={undoPoint} activeOpacity={0.85}>
                  <Ionicons name="arrow-undo-outline" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
              {drawing && pointCount >= 3 && (
                <TouchableOpacity style={styles.closeBtn} onPress={closeShape} activeOpacity={0.85}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
                  <Text style={styles.closeBtnText}>Close Shape</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.row}>
              <View style={styles.closedBadge}>
                <Ionicons name="checkmark-circle" size={15} color={COLORS.success} />
                <Text style={styles.closedBadgeText}>Boundary drawn ({boundary!.length} points)</Text>
              </View>
              <TouchableOpacity style={styles.smallBtn} onPress={redrawBoundary} activeOpacity={0.85}>
                <Ionicons name="refresh" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.hectaresRow}>
            <Text style={styles.hectaresLabel}>Farm Size (Hectares) *</Text>
            <TextInput
              style={styles.hectaresInput}
              value={hectares}
              onChangeText={setHectares}
              placeholder="e.g. 1.5"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.88}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitText}>{isEditing ? 'Save Changes' : 'Submit Farm Details'}</Text>
            )}
          </TouchableOpacity>
          {!isClosed && (
            <Text style={styles.helperText}>
              Pin your farm, then draw and close its boundary to continue.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  headerSubtitle: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 2, fontWeight: '600' },
  logoutBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  logoutText: { fontSize: 12.5, color: COLORS.danger, fontWeight: '700' },
  mapWrap: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  hintBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20,38,28,0.78)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  hintText: { color: COLORS.white, fontSize: 11.5, fontWeight: '700' },
  controls: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.2,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionBtnActive: { backgroundColor: COLORS.primary },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  actionBtnTextActive: { color: COLORS.white },
  smallBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  closeBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  closedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.successLight,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  closedBadgeText: { fontSize: 12.5, fontWeight: '700', color: COLORS.success },
  hectaresRow: { gap: 6 },
  hectaresLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  hectaresInput: {
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  helperText: { fontSize: 11.5, color: COLORS.textMuted, textAlign: 'center' },
});
