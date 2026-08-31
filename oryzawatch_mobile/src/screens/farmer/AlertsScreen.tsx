// ─────────────────────────────────────────────────────────────────────────────
// AlertsScreen — Field Biosecurity Alerts with Botanical Styling
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
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
  badgeLabel: string;
}> = {
  CRITICAL: {
    icon: 'alert-circle',
    iconColor: COLORS.danger,
    titleColor: COLORS.dangerText,
    borderColor: COLORS.dangerBorder,
    bg: COLORS.dangerLight,
    badgeLabel: 'CRITICAL ALERT',
  },
  WARNING: {
    icon: 'warning',
    iconColor: COLORS.warning,
    titleColor: COLORS.warningText,
    borderColor: COLORS.warningBorder,
    bg: COLORS.warningLight,
    badgeLabel: 'FIELD ADVISORY',
  },
  INFO: {
    icon: 'information-circle',
    iconColor: COLORS.info,
    titleColor: COLORS.infoText,
    borderColor: COLORS.infoBorder,
    bg: COLORS.infoLight,
    badgeLabel: 'MAO BULLETIN',
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
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + ' · ' +
      d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <OryzaHeader title="Alerts" unreadCount={0} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Fetching field advisories...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            <View style={styles.emptyIconCircle}>
              <Ionicons name="checkmark-done" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyText}>All Clear! No Active Alerts</Text>
            <Text style={styles.emptySubText}>Your farm zone has no reported outbreaks. Pull down to refresh.</Text>
          </View>
        }
        ListFooterComponent={
          alerts.length > 0 ? (
            <View style={styles.tipCard}>
              <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.tipText}>
                Tap any unread alert to acknowledge. Urgent warnings are dispatched by Municipal Agriculture Officers.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const cfg = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.INFO;
          return (
            <TouchableOpacity
              style={[
                styles.card,
                {
                  backgroundColor: item.is_read ? COLORS.white : cfg.bg,
                  borderColor: cfg.borderColor,
                },
              ]}
              onPress={() => !item.is_read && handleMarkRead(item.id)}
              activeOpacity={0.85}
            >
              {/* Unread indicator */}
              {!item.is_read && <View style={styles.unreadDot} />}

              <View style={styles.cardHeader}>
                <Ionicons name={cfg.icon} size={18} color={cfg.iconColor} />
                <Text style={[styles.cardTitle, { color: cfg.titleColor }]}>{item.title}</Text>
                <View style={[styles.badge, { backgroundColor: cfg.borderColor }]}>
                  <Text style={[styles.badgeText, { color: cfg.titleColor }]}>{cfg.badgeLabel}</Text>
                </View>
              </View>

              <Text style={styles.cardMessage}>{item.message}</Text>
              <View style={styles.cardFooter}>
                <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.cardTime}>{formatTime(item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 36 },
  card: {
    borderWidth: 1.2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardMessage: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryPastel,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.primaryBg,
    borderWidth: 1,
    borderColor: COLORS.primaryPastel,
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.primary,
    lineHeight: 18,
    fontWeight: '500',
  },
});
