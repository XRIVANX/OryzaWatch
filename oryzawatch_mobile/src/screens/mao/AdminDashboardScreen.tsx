import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
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
    } catch (e) {
      console.warn('AdminDashboard error:', e);
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

  const criticalCount = hotspots.filter((h) => h.status === 'CRITICAL').length;
  const unreadCount = alerts.filter((a) => !a.is_read).length;

  if (loading) {
    return (
      <View style={styles.container}>
        <OryzaHeader title="MAO Portal" />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading MAO command metrics...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OryzaHeader title="MAO Dashboard" unreadCount={unreadCount} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stats Row ──────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard icon="alert-circle" label="Critical Hotspots" value={criticalCount} color={COLORS.danger} />
          <StatCard icon="scan" label="Total Scans" value={scanCount} color={COLORS.primary} />
          <StatCard icon="notifications" label="Field Alerts" value={alerts.length} color={COLORS.warning} />
        </View>

        {/* ── Active Hotspots ────────────────────────────── */}
        <Text style={styles.sectionLabel}>ACTIVE EPIDEMIOLOGICAL HOTSPOTS</Text>
        {hotspots.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={36} color={COLORS.success} />
            <Text style={styles.emptyTitle}>Zero Active Hotspots</Text>
            <Text style={styles.emptyText}>Municipal rice clusters are currently within safe thresholds.</Text>
          </View>
        ) : (
          hotspots.map((h) => {
            const diseaseName = DISEASE_LABELS[h.scan.detected_disease] || h.scan.detected_disease;
            const statusCfg = HOTSPOT_STATUS[h.status] || { label: h.status, color: COLORS.textMuted };
            return (
              <View key={h.id} style={styles.hotspotCard}>
                <View style={styles.hotspotHeader}>
                  <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                  <Text style={styles.hotspotTitle}>{diseaseName}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '15', borderColor: statusCfg.color }]}>
                    <Text style={[styles.hotspotStatus, { color: statusCfg.color }]}>
                      {statusCfg.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.hotspotMeta}>
                  <View style={styles.metaChip}><Text style={styles.metaText}>🌡 {h.temperature.toFixed(1)}°C</Text></View>
                  <View style={styles.metaChip}><Text style={styles.metaText}>💧 {h.humidity.toFixed(0)}% Hum</Text></View>
                  <View style={styles.metaChip}><Text style={styles.metaText}>💨 {h.wind_cardinal} {h.wind_speed.toFixed(0)} km/h</Text></View>
                  <View style={styles.metaChip}><Text style={styles.metaText}>📍 {h.spread_velocity.toFixed(1)} km/d spread</Text></View>
                </View>
              </View>
            );
          })
        )}

        {/* ── Recent Alerts ──────────────────────────────── */}
        <Text style={styles.sectionLabel}>RECENT FIELD BULLETINS</Text>
        {alerts.length === 0 ? (
          <View style={styles.emptyAlertsCard}>
            <Text style={styles.emptyText}>No field bulletins logged.</Text>
          </View>
        ) : (
          alerts.slice(0, 5).map((a) => (
            <View key={a.id} style={[styles.alertRow, { opacity: a.is_read ? 0.7 : 1 }]}>
              <View
                style={[
                  styles.alertIconCircle,
                  {
                    backgroundColor: a.severity === 'CRITICAL' ? COLORS.dangerLight : COLORS.warningLight,
                  },
                ]}
              >
                <Ionicons
                  name={a.severity === 'CRITICAL' ? 'alert-circle' : 'warning'}
                  size={18}
                  color={a.severity === 'CRITICAL' ? COLORS.danger : COLORS.warning}
                />
              </View>
              <View style={styles.alertInfo}>
                <Text style={styles.alertTitle}>{a.title}</Text>
                <Text style={styles.alertMsg} numberOfLines={2}>{a.message}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; value: number; color: string;
}) {
  return (
    <View style={[statStyles.card, { borderTopColor: color }]}>
      <View style={[statStyles.iconCircle, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderTopWidth: 3.5,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  label: { fontSize: 9.5, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 2,
  },
  hotspotCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  hotspotHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  hotspotTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  hotspotStatus: { fontSize: 10, fontWeight: '800' },
  hotspotMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaText: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '600' },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  emptyText: { fontSize: 12.5, color: COLORS.textSecondary, textAlign: 'center' },
  emptyAlertsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertInfo: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  alertMsg: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, lineHeight: 17 },
});
