import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OryzaHeader from '../../components/common/OryzaHeader';
import { analyticsApi } from '../../api/analytics';
import { alertsApi } from '../../api/alerts';
import { diagnosticsApi } from '../../api/diagnostics';
import { COLORS, DISEASE_LABELS, HOTSPOT_STATUS } from '../../utils/constants';
import type { DiseaseHotspot, Alert as OWAlert } from '../../types';

export default function AdminDashboardScreen() {
  const [hotspots, setHotspots] = useState<DiseaseHotspot[]>([]);
  const [alerts, setAlerts] = useState<OWAlert[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [h, a, s] = await Promise.all([
        analyticsApi.getHotspots(),
        alertsApi.getAlerts(),
        diagnosticsApi.getScanHistory(),
      ]);
      setHotspots(h);
      setAlerts(a);
      setScanCount(s.length);
    } catch (e) { console.warn('AdminDashboard error:', e); }
  }, []);

  useEffect(() => { fetchData().finally(() => setLoading(false)); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const criticalCount = hotspots.filter((h) => h.status === 'CRITICAL').length;
  const unreadCount = alerts.filter((a) => !a.is_read).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <OryzaHeader title="MAO Dashboard" />
        <View style={styles.loadingCenter}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <OryzaHeader title="MAO Dashboard" unreadCount={unreadCount} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stats Row ──────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard icon="alert-circle" label="Critical Hotspots" value={criticalCount} color={COLORS.danger} />
          <StatCard icon="scan" label="Total Scans" value={scanCount} color={COLORS.primary} />
          <StatCard icon="notifications" label="Unread Alerts" value={unreadCount} color={COLORS.warning} />
        </View>

        {/* ── Active Hotspots ────────────────────────────── */}
        <Text style={styles.sectionLabel}>ACTIVE HOTSPOTS</Text>
        {hotspots.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color={COLORS.success} />
            <Text style={styles.emptyText}>No active hotspots. All clear!</Text>
          </View>
        ) : (
          hotspots.map((h) => (
            <View key={h.id} style={styles.hotspotCard}>
              <View style={styles.hotspotHeader}>
                <View style={[styles.statusDot, { backgroundColor: HOTSPOT_STATUS[h.status]?.color ?? COLORS.textMuted }]} />
                <Text style={styles.hotspotTitle}>
                  {DISEASE_LABELS[h.scan.detected_disease] || h.scan.detected_disease}
                </Text>
                <Text style={[styles.hotspotStatus, { color: HOTSPOT_STATUS[h.status]?.color ?? COLORS.textMuted }]}>
                  {HOTSPOT_STATUS[h.status]?.label ?? h.status}
                </Text>
              </View>
              <View style={styles.hotspotMeta}>
                <Text style={styles.metaText}>🌡 {h.temperature.toFixed(1)}°C</Text>
                <Text style={styles.metaText}>💧 {h.humidity.toFixed(0)}%</Text>
                <Text style={styles.metaText}>💨 {h.wind_cardinal} {h.wind_speed.toFixed(0)} km/h</Text>
                <Text style={styles.metaText}>📍 Spread: {h.spread_velocity.toFixed(1)} km/day</Text>
              </View>
            </View>
          ))
        )}

        {/* ── Recent Alerts ──────────────────────────────── */}
        <Text style={styles.sectionLabel}>RECENT ALERTS</Text>
        {alerts.slice(0, 5).map((a) => (
          <View key={a.id} style={[styles.alertRow, { opacity: a.is_read ? 0.6 : 1 }]}>
            <Ionicons
              name={a.severity === 'CRITICAL' ? 'alert-circle' : 'warning'}
              size={16}
              color={a.severity === 'CRITICAL' ? COLORS.danger : COLORS.warning}
            />
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>{a.title}</Text>
              <Text style={styles.alertMsg} numberOfLines={1}>{a.message}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; value: number; color: string;
}) {
  return (
    <View style={[statStyles.card, { borderTopColor: color }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 12,
    padding: 14, alignItems: 'center', borderTopWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  value: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginTop: 8 },
  label: { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4, fontWeight: '600' },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1, marginBottom: 10 },
  hotspotCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  hotspotHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  hotspotTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  hotspotStatus: { fontSize: 12, fontWeight: '600' },
  hotspotMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaText: { fontSize: 12, color: COLORS.textSecondary },
  emptyCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 24,
    alignItems: 'center', gap: 10, marginBottom: 24,
  },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  alertRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 10, padding: 12, marginBottom: 8,
  },
  alertInfo: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  alertMsg: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
