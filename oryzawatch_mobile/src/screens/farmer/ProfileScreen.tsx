// ─────────────────────────────────────────────────────────────────────────────
// ProfileScreen — matches the mockup with user info card + settings list
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OryzaHeader from '../../components/common/OryzaHeader';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, ROLES } from '../../utils/constants';

const ROLE_LABELS: Record<string, string> = {
  FARMER: 'REGISTERED FARMER',
  KAGAWAD: 'SK / AGRI-KAGAWAD',
  MAO_ADMIN: 'MAO ADMINISTRATOR',
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  FARMER: '#2563eb',
  KAGAWAD: '#7c3aed',
  MAO_ADMIN: '#dc2626',
};

type SettingsItem = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress?: () => void;
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try { await logout(); } catch (e) { console.warn(e); }
          },
        },
      ]
    );
  };

  if (!user) return null;

  const initials = user.username
    .split(' ')
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join('');

  const roleLabel = ROLE_LABELS[user.role] ?? user.role;
  const badgeColor = ROLE_BADGE_COLORS[user.role] ?? COLORS.primary;

  const settingsItems: SettingsItem[] = [
    { icon: 'notifications-outline', label: 'Notifications' },
    { icon: 'shield-outline', label: 'Privacy & Data' },
    { icon: 'settings-outline', label: 'Account Settings' },
    { icon: 'help-circle-outline', label: 'Help & Support' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <OryzaHeader title="Profile" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── User Info Card ────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || 'U'}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.username}>{user.username}</Text>
              <Text style={styles.location}>
                Brgy. {user.barangay}, {user.municipality.charAt(0) + user.municipality.slice(1).toLowerCase()}
              </Text>
              <View style={[styles.roleBadge, { borderColor: badgeColor }]}>
                <Text style={[styles.roleBadgeText, { color: badgeColor }]}>{roleLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Settings Section ──────────────────────────── */}
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <View style={styles.card}>
          {settingsItems.map((item, idx) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.settingsLeft}>
                  <Ionicons name={item.icon} size={20} color={COLORS.textSecondary} />
                  <Text style={styles.settingsLabel}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
              {idx < settingsItems.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Sign Out ──────────────────────────────────── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.version}>OryzaWatch v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  userInfo: { flex: 1 },
  username: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  location: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  roleBadge: {
    alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1, marginBottom: 10, marginLeft: 4,
  },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  settingsLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  settingsLabel: { fontSize: 15, color: COLORS.textPrimary },
  divider: { height: 1, backgroundColor: COLORS.border },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderColor: COLORS.dangerBorder,
    borderRadius: 12, paddingVertical: 14, marginBottom: 20,
    backgroundColor: COLORS.dangerLight,
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: COLORS.danger },
  version: { textAlign: 'center', fontSize: 12, color: COLORS.textMuted },
});
