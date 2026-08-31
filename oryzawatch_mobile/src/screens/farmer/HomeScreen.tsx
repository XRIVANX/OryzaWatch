// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen — Farmer Dashboard with Web Botanical Theme
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import OryzaHeader from '../../components/common/OryzaHeader';
import AlertBanner from '../../components/common/AlertBanner';
import { alertsApi } from '../../api/alerts';
import { analyticsApi } from '../../api/analytics';
import { diagnosticsApi } from '../../api/diagnostics';
import { getCurrentWeather } from '../../api/weather';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, DISEASE_LABELS } from '../../utils/constants';
import type { Alert as OWAlert, DiseaseHotspot, LeafScan } from '../../types';
import type { CurrentWeather } from '../../api/weather';
import type { MainTabParamList } from '../../navigation/MainTabs';

type NavProp = BottomTabNavigationProp<MainTabParamList>;

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();

  const [alerts, setAlerts] = useState<OWAlert[]>([]);
  const [hotspots, setHotspots] = useState<DiseaseHotspot[]>([]);
  const [recentScans, setRecentScans] = useState<LeafScan[]>([]);
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [a, h, s] = await Promise.all([
        alertsApi.getAlerts(),
        analyticsApi.getHotspots(),
        diagnosticsApi.getScanHistory(),
      ]);
      setAlerts(a);
      setHotspots(h);
      setRecentScans(s.slice(0, 5));
    } catch (e) {
      console.warn('HomeScreen fetch error:', e);
    }
  }, []);

  const fetchWeatherData = useCallback(async () => {
    if (!user?.municipality) {
      setWeatherLoading(false);
      return;
    }
    setWeatherLoading(true);
    try {
      setWeather(await getCurrentWeather(user.municipality));
    } catch (e) {
      console.warn('Weather fetch error:', e);
    } finally {
      setWeatherLoading(false);
    }
  }, [user?.municipality]);

  useEffect(() => {
    Promise.all([fetchData(), fetchWeatherData()]).finally(() => setLoading(false));
  }, [fetchData, fetchWeatherData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), fetchWeatherData()]);
    setRefreshing(false);
  }, [fetchData, fetchWeatherData]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const unreadCount = alerts.filter((a) => !a.is_read).length;
  const criticalAlert = alerts.find((a) => a.severity === 'CRITICAL' && !a.is_read);
  const warningAlert = alerts.find((a) => a.severity === 'WARNING' && !a.is_read);
  const bannerAlert = criticalAlert || warningAlert;

  const nearestHotspot = hotspots[0] ?? null;
  const isAtRisk = nearestHotspot?.status === 'CRITICAL';
  const farmCondition = isAtRisk ? 'At Risk' : 'Safe';
  const conditionColor = isAtRisk ? COLORS.danger : COLORS.success;
  const conditionBg = isAtRisk ? COLORS.dangerLight : COLORS.successLight;
  const conditionBorder = isAtRisk ? COLORS.dangerBorder : COLORS.successBorder;

  if (loading) {
    return (
      <View style={styles.container}>
        <OryzaHeader title="OryzaWatch" unreadCount={0} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Syncing farm diagnostics...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OryzaHeader
        title="OryzaWatch"
        unreadCount={unreadCount}
        onNotificationPress={() => navigation.navigate('Alerts')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Urgent Alert Banner ───────────────────────── */}
        {bannerAlert && <AlertBanner message={bannerAlert.message} />}

        {/* ── Welcome Bar ──────────────────────────────── */}
        <View style={styles.welcomeRow}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.farmerName}>{user?.username || 'Rice Farmer'}</Text>
          </View>
          <View style={styles.locationChip}>
            <Ionicons name="location" size={13} color={COLORS.primary} />
            <Text style={styles.locationText}>
              Brgy. {user?.barangay || 'Central'}, {user?.municipality || 'Carmen'}
            </Text>
          </View>
        </View>

        {/* ── Farm Status Card ──────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark" size={16} color={COLORS.primary} />
              <Text style={styles.sectionLabel}>CROP BIOSECURITY STATUS</Text>
            </View>
            <View style={[styles.conditionBadge, { backgroundColor: conditionBg, borderColor: conditionBorder }]}>
              <View style={[styles.statusDot, { backgroundColor: conditionColor }]} />
              <Text style={[styles.conditionBadgeText, { color: conditionColor }]}>{farmCondition}</Text>
            </View>
          </View>

          <View style={styles.statusDivider} />

          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Ionicons name="radio-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.statusKey}>Nearest Hotspot</Text>
            </View>
            <Text style={styles.statusValue}>
              {nearestHotspot
                ? `${nearestHotspot.scan.detected_disease} reported`
                : 'No active threat in range'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Ionicons name="navigate-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.statusKey}>Wind Vector</Text>
            </View>
            <Text style={styles.statusValue}>
              {nearestHotspot
                ? `${nearestHotspot.wind_cardinal} · ${nearestHotspot.wind_speed.toFixed(0)} km/h`
                : 'Calm / Normal'}
            </Text>
          </View>
        </View>

        {/* ── Weather Widget Card ───────────────────────── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cloudy-night-outline" size={16} color={COLORS.gold} />
            <Text style={styles.sectionLabel}>AGRI-METEOROLOGY FORECAST</Text>
          </View>

          <View style={styles.weatherGrid}>
            <WeatherTile
              icon="🌡️"
              label="Temperature"
              value={weatherLoading ? '...' : weather ? `${weather.temperature.toFixed(1)}°C` : '—'}
            />
            <WeatherTile
              icon="💧"
              label="Humidity"
              value={weatherLoading ? '...' : weather ? `${weather.humidity.toFixed(0)}%` : '—'}
            />
            <WeatherTile
              icon="💨"
              label="Wind Speed"
              value={weatherLoading ? '...' : weather ? `${weather.windSpeed.toFixed(1)} km/h` : '—'}
            />
            <WeatherTile
              icon="🧭"
              label="Wind Direction"
              value={weatherLoading ? '...' : weather?.windDirection ?? '—'}
            />
            <WeatherTile
              icon="🌤️"
              label="Conditions"
              value={weatherLoading ? '...' : weather?.description ?? '—'}
            />
          </View>
        </View>

        {/* ── Scan CTA Button ───────────────────────────── */}
        <TouchableOpacity
          style={styles.scanBtn}
          activeOpacity={0.88}
          onPress={() => {
            // Navigate to Kagawad report or Farmer Scan prompt
            if (user?.role === 'KAGAWAD' || user?.role === 'MAO_ADMIN') {
              navigation.navigate('Report');
            } else {
              navigation.navigate('Map');
            }
          }}
        >
          <View style={styles.scanIconCircle}>
            <Ionicons name="camera" size={24} color={COLORS.white} />
          </View>
          <View style={styles.scanBtnTextContainer}>
            <Text style={styles.scanBtnTitle}>Leaf Diagnostic AI Scan</Text>
            <Text style={styles.scanBtnSubtitle}>Instant Spatiotemporal Disease Detection</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
        </TouchableOpacity>

        {/* ── Recent Scans List ─────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Recent Field Scans</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Map')}>
              <Text style={styles.viewAllText}>View Map →</Text>
            </TouchableOpacity>
          </View>

          {recentScans.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="leaf-outline" size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No field scans recorded yet.</Text>
            </View>
          ) : (
            recentScans.map((scan, idx) => (
              <React.Fragment key={scan.id}>
                <RecentScanItem scan={scan} />
                {idx < recentScans.length - 1 && <View style={styles.itemDivider} />}
              </React.Fragment>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Sub-component: WeatherTile ─────────────────────────────────────────────
function WeatherTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.weatherTile}>
      <Text style={styles.weatherTileIcon}>{icon}</Text>
      <Text style={styles.weatherTileValue}>{value}</Text>
      <Text style={styles.weatherTileLabel}>{label}</Text>
    </View>
  );
}

// ── Sub-component: RecentScanItem ──────────────────────────────────────────
function RecentScanItem({ scan }: { scan: LeafScan }) {
  const daysAgo = Math.floor(
    (Date.now() - new Date(scan.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const diseaseLabel = DISEASE_LABELS[scan.detected_disease] || scan.detected_disease;
  const confidencePct = Math.round(scan.confidence_score * 100);
  const isHealthy = scan.detected_disease === 'HEALTHY';

  return (
    <View style={scanStyles.row}>
      <View
        style={[
          scanStyles.iconBox,
          {
            backgroundColor: isHealthy ? COLORS.successLight : COLORS.dangerLight,
            borderColor: isHealthy ? COLORS.successBorder : COLORS.dangerBorder,
          },
        ]}
      >
        <Ionicons
          name={isHealthy ? 'leaf' : 'warning'}
          size={20}
          color={isHealthy ? COLORS.success : COLORS.danger}
        />
      </View>
      <View style={scanStyles.info}>
        <Text style={scanStyles.disease}>{diseaseLabel}</Text>
        <Text style={scanStyles.confidence}>AI Confidence: {confidencePct}%</Text>
      </View>
      <View style={scanStyles.timeBadge}>
        <Text style={scanStyles.time}>{daysAgo <= 0 ? 'Today' : `${daysAgo}d ago`}</Text>
      </View>
    </View>
  );
}

const scanStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  info: { flex: 1 },
  disease: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  confidence: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  timeBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  time: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: { flex: 1 },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  greeting: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  farmerName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primaryPastel,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  conditionBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusKey: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
  },
  statusValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  weatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  weatherTile: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  weatherTileIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  weatherTileValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  weatherTileLabel: {
    fontSize: 9.5,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '600',
  },
  scanBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  scanIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  scanBtnTextContainer: {
    flex: 1,
  },
  scanBtnTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  scanBtnSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  itemDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});
