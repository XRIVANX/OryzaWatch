// ─────────────────────────────────────────────────────────────────────────────
// AlertsScreen — matches the mockup with CRITICAL / WARNING / INFO cards
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import OryzaHeader from '../../components/common/OryzaHeader';
import { alertsApi } from '../../api/alerts';
import { COLORS } from '../../utils/constants';
import type { Alert as OWAlert, AlertSeverity } from '../../types';

const SEVERITY_CONFIG: Record<AlertSeverity, {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  titleColor: string;
  borderColor: string;
  bg: string;
}> = {
  CRITICAL: {
    icon: 'alert-circle',
    iconColor: COLORS.danger,
    titleColor: COLORS.danger,
    borderColor: COLORS.dangerBorder,
    bg: COLORS.dangerLight,
  },
  WARNING: {
    icon: 'warning',
    iconColor: COLORS.warning,
    titleColor: COLORS.warning,
    borderColor: COLORS.warningBorder,
    bg: COLORS.warningLight,
  },
  INFO: {
    icon: 'information-circle',
    iconColor: COLORS.info,
    titleColor: COLORS.info,
    borderColor: COLORS.infoBorder,
    bg: COLORS.infoLight,
  },
};

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<OWAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await alertsApi.getAlerts();
      setAlerts(data);
    } catch (e) {
      console.warn('AlertsScreen fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchAlerts().finally(() => setLoading(false));
  }, [fetchAlerts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }, [fetchAlerts]);

  const handleMarkRead = async (id: number) => {
    try {
      await alertsApi.markRead(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
      );
    } catch (e) {
      console.warn('Mark read failed:', e);
    }
  };

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <OryzaHeader title={`Alerts`} unreadCount={0} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <OryzaHeader
        title={`Alerts${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
        unreadCount={unreadCount}
      />
      <FlatList
        data={alerts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No alerts at this time.</Text>
            <Text style={styles.emptySubText}>You're all clear! Pull down to refresh.</Text>
          </View>
        }
        ListFooterComponent={
          alerts.length > 0 ? (
            <View style={styles.tipCard}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
              <Text style={styles.tipText}>
                Tip: Turn on push notifications in Profile to get alerts in real-time.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const cfg = SEVERITY_CONFIG[item.severity];
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}
              onPress={() => !item.is_read && handleMarkRead(item.id)}
              activeOpacity={0.8}
            >
              {/* Unread indicator */}
              {!item.is_read && <View style={styles.unreadDot} />}

              <View style={styles.cardHeader}>
                <Ionicons name={cfg.icon} size={18} color={cfg.iconColor} />
                <Text style={[styles.cardTitle, { color: cfg.titleColor }]}>{item.title}</Text>
              </View>
              <Text style={styles.cardMessage}>{item.message}</Text>
              <Text style={styles.cardTime}>{formatTime(item.created_at)}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    borderWidth: 1.5, borderRadius: 14, padding: 16, marginBottom: 12,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute', top: 14, right: 14,
    width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  cardMessage: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 20, marginBottom: 8 },
  cardTime: { fontSize: 11, color: COLORS.textMuted },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary, marginTop: 16 },
  emptySubText: { fontSize: 13, color: COLORS.textMuted, marginTop: 6 },
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.infoLight, borderWidth: 1,
    borderColor: COLORS.infoBorder, borderRadius: 12, padding: 14, marginTop: 4,
  },
  tipText: { flex: 1, fontSize: 12, color: '#1e40af', lineHeight: 18 },
});
