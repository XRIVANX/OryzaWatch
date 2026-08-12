// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen — Farmer Dashboard
// Shows: alert banner, farm status card, scan CTA, recent scans list
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import OryzaHeader from '../../components/common/OryzaHeader';
import AlertBanner from '../../components/common/AlertBanner';
import { alertsApi } from '../../api/alerts';
import { analyticsApi } from '../../api/analytics';
import { diagnosticsApi } from '../../api/diagnostics';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, DISEASE_LABELS, HOTSPOT_STATUS } from '../../utils/constants';
import type { Alert as OWAlert, DiseaseHotspot, LeafScan } from '../../types';
import type { MainTabParamList } from '../../navigation/MainTabs';

type NavProp = BottomTabNavigationProp<MainTabParamList>;

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();

  const [alerts, setAlerts] = useState<OWAlert[]>([]);
  const [hotspots, setHotspots] = useState<DiseaseHotspot[]>([]);
  const [recentScans, setRecentScans] = useState<LeafScan[]>([]);
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

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const unreadCount = alerts.filter((a) => !a.is_read).length;
  const criticalAlert = alerts.find((a) => a.severity === 'CRITICAL' && !a.is_read);
  const warningAlert = alerts.find((a) => a.severity === 'WARNING' && !a.is_read);
  const bannerAlert = criticalAlert || warningAlert;

  // Nearest active hotspot by ID order (closest first from backend)
  const nearestHotspot = hotspots[0] ?? null;

  // Farm condition: CRITICAL if any hotspot within radius, else Safe
  const farmCondition = nearestHotspot?.status === 'CRITICAL' ? 'At Risk' : 'Safe';
  const conditionColor = farmCondition === 'Safe' ? COLORS.success : COLORS.danger;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <OryzaHeader title="OryzaWatch" unreadCount={0} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <OryzaHeader title="OryzaWatch" unreadCount={unreadCount} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Alert Banner ──────────────────────────────── */}
        {bannerAlert && <AlertBanner message={bannerAlert.message} />}

        {/* ── Farm Status Card ──────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>FARM STATUS</Text>

          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Ionicons name="checkmark-circle-outline" size={18} color={conditionColor} />
              <Text style={styles.statusKey}>Condition</Text>
            </View>
            <Text style={[styles.statusValue, { color: conditionColor }]}>{farmCondition}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Ionicons name="location-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.statusKey}>Closest Hotspot</Text>
            </View>
            <Text style={styles.statusValue}>
              {nearestHotspot
                ? `${nearestHotspot.scan.detected_disease} reported`
                : 'None detected'}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Ionicons name="git-branch-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.statusKey}>Wind Data</Text>
            </View>
            <Text style={styles.statusValue}>
              {nearestHotspot
                ? `${nearestHotspot.wind_cardinal} · ${nearestHotspot.wind_speed.toFixed(0)} km/h`
                : '—'}
            </Text>
          </View>
        </View>

        {/* ── Scan CTA ──────────────────────────────────── */}
        <TouchableOpacity style={styles.scanBtn} activeOpacity={0.85}>
          <Ionicons name="camera-outline" size={22} color={COLORS.white} />
          <Text style={styles.scanBtnText}>Scan a Leaf Now</Text>
        </TouchableOpacity>

        {/* ── Recent Scans ──────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Scans</Text>
          {recentScans.length === 0 ? (
            <Text style={styles.emptyText}>No scans yet. Tap "Scan a Leaf Now" to get started.</Text>
          ) : (
            recentScans.map((scan) => <RecentScanItem key={scan.id} scan={scan} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
      <View style={[scanStyles.iconBox, { backgroundColor: isHealthy ? COLORS.successLight : '#fee2e2' }]}>
        <Ionicons name={isHealthy ? 'leaf' : 'alert-circle'} size={22}
          color={isHealthy ? COLORS.success : COLORS.danger} />
      </View>
      <View style={scanStyles.info}>
        <Text style={scanStyles.disease}>{diseaseLabel} — {confidencePct}%</Text>
        <Text style={scanStyles.location}>Brgy. {/* barangay from reporter—available in full profile */}</Text>
      </View>
      <Text style={scanStyles.time}>{daysAgo}d ago</Text>
    </View>
  );
}

const scanStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info: { flex: 1 },
  disease: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  location: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  time: { fontSize: 12, color: COLORS.textMuted },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1, marginBottom: 14 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusKey: { fontSize: 14, color: COLORS.textPrimary },
  statusValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  divider: { height: 1, backgroundColor: COLORS.border },
  scanBtn: {
    backgroundColor: '#3b82f6', borderRadius: 14, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginBottom: 16,
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  scanBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, paddingVertical: 12, textAlign: 'center' },
});
