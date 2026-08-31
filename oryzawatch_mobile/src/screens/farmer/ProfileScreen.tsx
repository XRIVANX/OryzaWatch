// ─────────────────────────────────────────────────────────────────────────────
// ProfileScreen — Farmer & Operator Profile with Botanical Styling
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OryzaHeader from '../../components/common/OryzaHeader';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../utils/constants';

const ROLE_LABELS: Record<string, string> = {
  FARMER: 'REGISTERED FARMER',
  KAGAWAD: 'SK / AGRI-KAGAWAD',
  MAO_ADMIN: 'MAO ADMINISTRATOR',
};

const ROLE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  FARMER: { color: COLORS.primary, bg: COLORS.primaryBg, border: COLORS.primaryPastel },
  KAGAWAD: { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  MAO_ADMIN: { color: COLORS.danger, bg: COLORS.dangerLight, border: COLORS.dangerBorder },
};

type SettingsItem = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  subtitle?: string;
  onPress?: () => void;
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of OryzaWatch?',
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
  const roleCfg = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.FARMER;

  const settingsItems: SettingsItem[] = [
    { icon: 'notifications-outline', label: 'Push Notifications', subtitle: 'Real-time outbreak alerts' },
    { icon: 'location-outline', label: 'Field Location & Coordinates', subtitle: `Brgy. ${user.barangay}, ${user.municipality}` },
    { icon: 'shield-checkmark-outline', label: 'Privacy & Crop Data', subtitle: 'Secured by DA-PhilRice standard' },
    { icon: 'help-circle-outline', label: 'MAO Helpdesk & Support', subtitle: 'Davao del Norte Agricultural Office' },
  ];

  return (
    <View style={styles.container}>
      <OryzaHeader title="Account Profile" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
              <View style={[styles.roleBadge, { backgroundColor: roleCfg.bg, borderColor: roleCfg.border }]}>
                <Text style={[styles.roleBadgeText, { color: roleCfg.color }]}>{roleLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Field Station Details ─────────────────────── */}
        <Text style={styles.sectionLabel}>FIELD ASSIGNMENT</Text>
        <View style={styles.card}>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Municipality</Text>
            <Text style={styles.detailValue}>{user.municipality}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Barangay / Cluster</Text>
            <Text style={styles.detailValue}>{user.barangay}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Contact Number</Text>
            <Text style={styles.detailValue}>{user.phone_number || 'Not provided'}</Text>
          </View>
        </View>

        {/* ── Settings Section ──────────────────────────── */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.card}>
          {settingsItems.map((item, idx) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.settingsLeft}>
                  <View style={styles.settingsIconBox}>
                    <Ionicons name={item.icon} size={18} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.settingsLabel}>{item.label}</Text>
                    {item.subtitle && <Text style={styles.settingsSub}>{item.subtitle}</Text>}
                  </View>
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
        <Text style={styles.version}>OryzaWatch Mobile v1.0.0 · MAO Davao del Norte</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  userInfo: { flex: 1 },
  username: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  location: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  roleBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailKey: { fontSize: 13.5, color: COLORS.textSecondary },
  detailValue: { fontSize: 13.5, fontWeight: '700', color: COLORS.textPrimary },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingsLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingsIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  settingsSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.2,
    borderColor: COLORS.dangerBorder,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 16,
    backgroundColor: COLORS.dangerLight,
  },
  signOutText: { fontSize: 15, fontWeight: '800', color: COLORS.danger },
  version: { textAlign: 'center', fontSize: 11, color: COLORS.textMuted },
});
