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
  Animated,
  Easing,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRoute, useNavigation, useFocusEffect, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import OryzaHeader from '../../components/common/OryzaHeader';
import ThemedDialog from '../../components/common/ThemedDialog';
import { analyticsApi } from '../../api/analytics';
import { farmsApi } from '../../api/farms';
import { getCurrentWeather, CurrentWeather } from '../../api/weather';
import { useAuth } from '../../hooks/useAuth';
import { useAlertsContext } from '../../context/AlertsContext';
import { buildSpreadHeatPoints, destinationPoint } from '../../utils/geo';
import { COLORS, HOTSPOT_STATUS, DISEASE_LABELS, ROLES } from '../../utils/constants';
import type { DiseaseHotspot, Farm } from '../../types';
import type { MainTabParamList } from '../../navigation/MainTabs';
import type { RootStackParamList } from '../../navigation/AppNavigator';

const DEFAULT_CENTER = { latitude: 7.3047, longitude: 125.6839 }; // Davao del Norte
const REFERENCE_DAYS = [1, 3, 5];
// Hotspot polling while the Map tab is on screen. Faster in Heat Map Mode so a
// new outbreak's spread appears within seconds of being reported.
const POLL_MS = 10000;
const HEAT_MAP_POLL_MS = 5000;
// A hotspot whose spread prediction failed is retried after this long, rather
// than on every poll.
const PREDICT_RETRY_MS = 60000;

interface HeatMapCone {
  hotspotId: number;
  lat: number;
  lng: number;
  windDeg: number;
  dailyReachKm: number[];
}

export default function MapScreen() {
  const route = useRoute<RouteProp<MainTabParamList, 'Map'>>();
  const rootNavigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { unreadCount } = useAlertsContext();
  const focusHotspotId = route.params?.focusHotspotId;
  const webViewRef = useRef<WebView>(null);
  const [hotspots, setHotspots] = useState<DiseaseHotspot[]>([]);
  const [myFarm, setMyFarm] = useState<Farm | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [heatMapMode, setHeatMapMode] = useState(false);
  const [cones, setCones] = useState<HeatMapCone[]>([]);
  const [predicting, setPredicting] = useState(false);
  const [heatMapWeather, setHeatMapWeather] = useState<CurrentWeather | null>(null);
  const [notifiedCount, setNotifiedCount] = useState(0);
  const [errorDialog, setErrorDialog] = useState<string | null>(null);
  // Hotspots whose spread has been predicted (or is in flight) this Heat Map
  // session, and when a failed prediction may be retried.
  const predictedIds = useRef(new Set<number>());
  const retryAfter = useRef(new Map<number, number>());
  // Only the first prediction batch after the farmer switches Heat Map Mode on
  // may show an error dialog; background retries stay silent.
  const reportNextFailure = useRef(false);
  // Bumped on every toggle so predictions that finish after Heat Map Mode was
  // switched off (or restarted) are ignored instead of drawing stale cones.
  const heatMapSession = useRef(0);

  const isFarmer = user?.role === ROLES.FARMER;

  const fetchData = useCallback(async () => {
    try {
      const h = await analyticsApi.getHotspots();
      setHotspots(h);
      // Drop any spread cone whose hotspot is no longer active (e.g. a
      // Kagawad/Admin just marked it Safe/Resolved server-side) so a stale
      // heat signature doesn't linger on the map until the next manual toggle.
      const activeIds = new Set(h.map((x) => x.id));
      setCones((prev) => {
        const pruned = prev.filter((c) => activeIds.has(c.hotspotId));
        return pruned.length === prev.length ? prev : pruned;
      });
      if (isFarmer) {
        setMyFarm(await farmsApi.getMine());
      }
    } catch (e) {
      console.warn('MapScreen fetch error:', e);
    }
  }, [isFarmer]);

  // Hotspots stay current while this tab is on screen, without a manual pull:
  // refresh immediately on focus, then keep polling. Resolved hotspots (and
  // their cones) drop off within one tick.
  useFocusEffect(
    useCallback(() => {
      fetchData();
      const interval = setInterval(fetchData, heatMapMode ? HEAT_MAP_POLL_MS : POLL_MS);
      return () => clearInterval(interval);
    }, [fetchData, heatMapMode])
  );

  const predictSpread = useCallback(async (targets: DiseaseHotspot[]) => {
    const session = heatMapSession.current;
    targets.forEach((h) => predictedIds.current.add(h.id));
    setPredicting(true);
    const results = await Promise.allSettled(targets.map((h) => analyticsApi.predict(h.id)));
    setPredicting(false);
    if (session !== heatMapSession.current) return;

    const newCones: HeatMapCone[] = [];
    let notified = 0;
    let firstError: string | null = null;
    results.forEach((result, i) => {
      const hotspot = targets[i];
      if (result.status === 'fulfilled') {
        newCones.push({
          hotspotId: hotspot.id,
          lat: parseFloat(hotspot.latitude),
          lng: parseFloat(hotspot.longitude),
          windDeg: result.value.wind_direction_deg,
          dailyReachKm: result.value.daily_reach_km,
        });
        notified += result.value.notified;
      } else {
        predictedIds.current.delete(hotspot.id);
        retryAfter.current.set(hotspot.id, Date.now() + PREDICT_RETRY_MS);
        firstError = firstError ?? (result.reason?.message || 'Please try again.');
      }
    });

    if (newCones.length) {
      setCones((prev) => [...prev.filter((c) => !newCones.some((n) => n.hotspotId === c.hotspotId)), ...newCones]);
      setNotifiedCount((n) => n + notified);
    }
    if (firstError && reportNextFailure.current) setErrorDialog(firstError);
    reportNextFailure.current = false;
  }, []);

  // While Heat Map Mode is on, every active hotspot gets a spread projection,
  // including ones reported after the mode was switched on: the next poll
  // picks them up and they are drawn straight away.
  useEffect(() => {
    if (!heatMapMode) return;
    const activeIds = new Set(hotspots.map((h) => h.id));
    predictedIds.current.forEach((id) => {
      if (!activeIds.has(id)) predictedIds.current.delete(id);
    });
    const now = Date.now();
    const pending = hotspots.filter(
      (h) => !predictedIds.current.has(h.id) && (retryAfter.current.get(h.id) ?? 0) <= now,
    );
    if (pending.length) {
      void predictSpread(pending);
    }
  }, [heatMapMode, hotspots, predictSpread]);

  // Heat Map Mode is a view, not a one-off prediction: it turns on whether or
  // not there are outbreaks, and stays on until switched off.
  const toggleHeatMap = () => {
    heatMapSession.current += 1;
    if (heatMapMode) {
      setHeatMapMode(false);
      setCones([]);
      setNotifiedCount(0);
      predictedIds.current.clear();
      retryAfter.current.clear();
      return;
    }
    reportNextFailure.current = hotspots.length > 0;
    setHeatMapMode(true);
    fetchData();
    if (user?.municipality) {
      getCurrentWeather(user.municipality).then(setHeatMapWeather).catch(() => undefined);
    }
  };

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
    const lat = myFarm ? parseFloat(myFarm.latitude) : userLocation ? userLocation.latitude : DEFAULT_CENTER.latitude;
    const lng = myFarm ? parseFloat(myFarm.longitude) : userLocation ? userLocation.longitude : DEFAULT_CENTER.longitude;

    const markersScript = hotspots
      .map((h) => {
        const color = h.status === 'CRITICAL' ? '#dc2626' : h.status === 'AT_RISK' ? '#f97316' : '#2563eb';
        const label = DISEASE_LABELS[h.scan.detected_disease] || h.scan.detected_disease;
        const statusLabel = HOTSPOT_STATUS[h.status]?.label ?? h.status;

        return `
          (function() {
            // The hotspot circle marks the outbreak's current extent - kept
            // visually distinct (solid, tight radius) from the dashed,
            // much larger Heat Map Mode spread cone drawn separately below.
            L.circle([${h.latitude}, ${h.longitude}], {
              color: '${color}', fillColor: '${color}', fillOpacity: 0.22, radius: 450, weight: 2
            }).addTo(map);
            var icon = L.divIcon({
              className: 'custom-pin',
              html: '<div style="background-color:${color}; width:24px; height:24px; border-radius:50%; border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.45);"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            var marker = L.marker([${h.latitude}, ${h.longitude}], { icon: icon }).addTo(map);
            marker.bindPopup(\`
              <div style="font-family:-apple-system, system-ui, sans-serif; padding:4px;">
                <div style="font-weight:800; font-size:14px; color:#14261c; margin-bottom:4px;">${label}</div>
                <div style="font-size:11px; font-weight:700; color:${color}; margin-bottom:6px;">${statusLabel}</div>
                <div style="font-size:12px; color:#4a6152;">💨 ${h.wind_cardinal} ${Math.round(h.wind_speed)} km/h</div>
                <div style="font-size:12px; color:#4a6152;">💧 Humidity: ${Math.round(h.humidity)}%</div>
                <div style="font-size:12px; color:#4a6152;">📍 Spread: ${h.spread_velocity.toFixed(1)} km/day</div>
              </div>
            \`);
            ${h.id === focusHotspotId ? `map.setView([${h.latitude}, ${h.longitude}], 16); marker.openPopup();` : ''}
          })();
        `;
      })
      .join('\n');

    // The farmer's real registered farm (pin + drawn boundary) takes priority
    // over the plain live-GPS dot, once it's loaded.
    const userMarkerScript = myFarm
      ? `
        var farmIcon = L.divIcon({
          className: 'user-pin',
          html: '<div style="background-color:#237e46; width:24px; height:24px; border-radius:50%; border:3px solid white; box-shadow:0 0 12px rgba(35,126,70,0.8);"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        L.marker([${myFarm.latitude}, ${myFarm.longitude}], { icon: farmIcon })
          .addTo(map)
          .bindPopup('<div style="font-family:sans-serif; font-weight:bold; color:#14261c;">🌾 Your Rice Field · ${myFarm.size_hectares.toFixed(2)} ha</div>');
        ${myFarm.boundary && myFarm.boundary.length >= 3 ? `
          L.polygon(${JSON.stringify(myFarm.boundary)}, { color: '#237e46', fillColor: '#86efac', fillOpacity: 0.4, weight: 2 }).addTo(map);
        ` : ''}
      `
      : userLocation
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

    // Heat Map Mode: a thermal heat signature of the projected downwind
    // spread (days 1-5), thin dashed reference rings for a few of those
    // days, and an animated arrow pointing the way the wind is heading -
    // rendered separately from the hotspot circle above (that one marks the
    // outbreak's current, actual extent - never mixed in with the forecast).
    const conesScript = heatMapMode
      ? cones
          .map((cone) => {
            const heatPoints = buildSpreadHeatPoints(cone.lat, cone.lng, cone.windDeg, cone.dailyReachKm);
            const ringsScript = REFERENCE_DAYS.map((day) => {
              const reachKm = cone.dailyReachKm[day - 1];
              if (!reachKm) return '';
              const ring: [number, number][] = [];
              for (let deg = 0; deg <= 360; deg += 12) {
                ring.push(destinationPoint(cone.lat, cone.lng, deg, reachKm));
              }
              return `
                L.polygon(${JSON.stringify(ring)}, {
                  color: '#1f2937', weight: 1.5, fill: false, dashArray: '3 5', opacity: 0.55
                }).addTo(map).bindTooltip('Day ${day} front');
              `;
            }).join('\n');

            return `
              L.heatLayer(${JSON.stringify(heatPoints)}, {
                radius: 32, blur: 28, maxZoom: 17, minOpacity: 0.35,
                gradient: { 0.2: '#2563eb', 0.4: '#22c55e', 0.6: '#eab308', 0.8: '#f97316', 1.0: '#dc2626' }
              }).addTo(map);
              ${ringsScript}
              L.marker([${cone.lat}, ${cone.lng}], {
                icon: L.divIcon({
                  className: 'ow-wind-arrow',
                  html: '<div style="transform: rotate(${cone.windDeg - 90}deg);"><div class="ow-wind-arrow-inner">➤</div></div>',
                  iconSize: [34, 34],
                  iconAnchor: [17, 17],
                })
              }).addTo(map);
            `;
          })
          .join('\n')
      : '';

    // Gray out the base imagery so only the heat signature and markers stand
    // out, matching a weather-radar overlay - toggled by a CSS filter on the
    // tile pane rather than swapping tile providers.
    const grayscaleScript = heatMapMode
      ? `
        var _tilePane = map.getPane('tilePane');
        if (_tilePane) { _tilePane.style.filter = 'grayscale(0.9) brightness(1.05) contrast(0.9)'; }
      `
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
        <style>
          body, html, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e1eae3; }
          .leaflet-popup-content-wrapper { border-radius: 14px; box-shadow: 0 6px 18px rgba(18,48,28,0.15); border: 1px solid #e1eae3; }
          /* Wind-direction arrow (Heat Map Mode): the outer div is rotated to
             point downwind; the inner div animates forward along its own
             (rotated) X axis, giving a repeating "flowing toward the spread"
             motion without disturbing the rotation. */
          .ow-wind-arrow-inner {
            font-size: 26px;
            color: #f97316;
            text-shadow: 0 1px 3px rgba(0,0,0,0.4);
            animation: ow-wind-flow 1.1s ease-in-out infinite;
          }
          @keyframes ow-wind-flow {
            0%   { transform: translateX(0); opacity: 0.45; }
            50%  { transform: translateX(10px); opacity: 1; }
            100% { transform: translateX(0); opacity: 0.45; }
          }
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
          ${conesScript}
          ${markersScript}
          ${grayscaleScript}
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
          {heatMapMode && <LegendRow color="#f97316" label="Projected Spread" />}
        </View>

        {/* Heat Map Mode Toggle - any signed-in user can run the spread
            prediction (it's their own safety at stake); everyone sees the
            resulting cone once it's on. */}
        <TouchableOpacity
          style={[styles.heatMapBtn, heatMapMode && styles.heatMapBtnActive]}
          onPress={toggleHeatMap}
          activeOpacity={0.88}
          disabled={predicting}
        >
          {predicting ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="flame" size={16} color={heatMapMode ? COLORS.white : '#f97316'} />
          )}
          <Text style={[styles.heatMapBtnText, heatMapMode && styles.heatMapBtnTextActive]}>
            {heatMapMode ? 'Heat Map: ON' : 'Heat Map Mode'}
          </Text>
        </TouchableOpacity>

        {/* Live weather panel - shown alongside the heat signature so the
            conditions driving the prediction are visible at a glance. */}
        {heatMapMode && heatMapWeather && (
          <View style={styles.weatherCard}>
            <Text style={styles.weatherCardTitle}>LIVE WEATHER</Text>
            <Text style={styles.weatherCardTemp}>{heatMapWeather.temperature.toFixed(1)}°C</Text>
            <Text style={styles.weatherCardDesc}>{heatMapWeather.description}</Text>
            <View style={styles.weatherCardRow}>
              <Ionicons name="water-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.weatherCardRowText}>{heatMapWeather.humidity.toFixed(0)}% humidity</Text>
            </View>
            <View style={styles.weatherCardRow}>
              <Ionicons name="navigate-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.weatherCardRowText}>{heatMapWeather.windDirection} · {heatMapWeather.windSpeed.toFixed(0)} km/h</Text>
            </View>
          </View>
        )}

        {heatMapMode && (
          <HeatMapStatus
            outbreakCount={hotspots.length}
            projecting={predicting && cones.length === 0}
            notifiedCount={notifiedCount}
          />
        )}

        {/* Recenter Button */}
        {userLocation && (
          <TouchableOpacity style={styles.recenterBtn} onPress={handleRecenter} activeOpacity={0.85}>
            <Ionicons name="locate" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* Edit My Farm Button - farmers only, once their farm has loaded */}
        {isFarmer && myFarm && (
          <TouchableOpacity
            style={styles.editFarmBtn}
            onPress={() => rootNavigation.navigate('EditFarm')}
            activeOpacity={0.88}
          >
            <Ionicons name="create-outline" size={16} color={COLORS.white} />
            <Text style={styles.editFarmBtnText}>Edit My Farm</Text>
          </TouchableOpacity>
        )}
      </View>

      <ThemedDialog
        visible={!!errorDialog}
        title="Prediction Failed"
        message={`Couldn't project the spread right now. ${errorDialog ?? ''} The map will keep retrying automatically.`}
        icon="cloud-offline-outline"
        iconColor={COLORS.danger}
        actions={[{ label: 'OK', variant: 'primary', onPress: () => setErrorDialog(null) }]}
        onRequestClose={() => setErrorDialog(null)}
      />
    </View>
  );
}

// Live status for Heat Map Mode: "all clear" while there are no outbreaks,
// otherwise how many are being tracked. The pulsing dot shows the map is
// watching live rather than showing a stale snapshot.
function HeatMapStatus({
  outbreakCount,
  projecting,
  notifiedCount,
}: {
  outbreakCount: number;
  projecting: boolean;
  notifiedCount: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const clear = outbreakCount === 0;
  const accent = clear ? COLORS.success : HOTSPOT_STATUS.CRITICAL.color;
  const title = projecting
    ? 'Projecting spread…'
    : clear
    ? 'All clear'
    : `Tracking ${outbreakCount} outbreak${outbreakCount === 1 ? '' : 's'}`;
  const subtitle = clear
    ? 'No active outbreaks. Watching live, and any new outbreak appears here automatically.'
    : `Projected 5-day spread from live wind.${notifiedCount > 0 ? ` ${notifiedCount} farmer${notifiedCount === 1 ? '' : 's'} notified.` : ''}`;

  return (
    <View style={[styles.statusCard, { borderColor: accent + '55' }]}>
      <View style={[styles.statusIcon, { backgroundColor: accent + '1a' }]}>
        {projecting ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Ionicons name={clear ? 'shield-checkmark' : 'flame'} size={20} color={accent} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.statusTitleRow}>
          <Text style={styles.statusTitle}>{title}</Text>
          <View style={styles.liveBadge}>
            <Animated.View
              style={[
                styles.liveDot,
                {
                  backgroundColor: accent,
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] }) }],
                },
              ]}
            />
            <Text style={[styles.liveText, { color: accent }]}>LIVE</Text>
          </View>
        </View>
        <Text style={styles.statusSubtitle}>{subtitle}</Text>
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
  editFarmBtn: {
    position: 'absolute',
    bottom: 24,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  editFarmBtnText: {
    color: COLORS.white,
    fontSize: 12.5,
    fontWeight: '800',
  },
  heatMapBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  heatMapBtnActive: {
    backgroundColor: '#f97316',
  },
  heatMapBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#f97316',
  },
  heatMapBtnTextActive: {
    color: COLORS.white,
  },
  statusCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    borderWidth: 1.2,
    padding: 12,
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, flexShrink: 1 },
  statusSubtitle: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2, lineHeight: 16 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8 },
  weatherCard: {
    position: 'absolute',
    top: 62,
    right: 14,
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
    minWidth: 128,
  },
  weatherCardTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  weatherCardTemp: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  weatherCardDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  weatherCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  weatherCardRowText: {
    fontSize: 10.5,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
