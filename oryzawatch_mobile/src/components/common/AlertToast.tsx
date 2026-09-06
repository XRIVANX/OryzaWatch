// ─────────────────────────────────────────────────────────────────────────────
// AlertToast — slide-down banner for a freshly-arrived alert (see
// AlertsContext). Auto-dismisses after a few seconds; tapping it jumps
// straight to the Alerts tab.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlertsContext } from '../../context/AlertsContext';
import { COLORS } from '../../utils/constants';
import type { AlertSeverity } from '../../types';

const AUTO_DISMISS_MS = 5000;

const SEVERITY_STYLE: Record<AlertSeverity, { bg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  CRITICAL: { bg: COLORS.danger, icon: 'alert-circle' },
  WARNING: { bg: COLORS.warning, icon: 'warning' },
  INFO: { bg: COLORS.info, icon: 'information-circle' },
  SUCCESS: { bg: COLORS.success, icon: 'checkmark-circle' },
};

export default function AlertToast() {
  const { toast, dismissToast } = useAlertsContext();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-140)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    dismissTimer.current = setTimeout(hide, AUTO_DISMISS_MS);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const hide = () => {
    Animated.timing(translateY, { toValue: -140, duration: 220, useNativeDriver: true }).start(() => {
      dismissToast();
    });
  };

  if (!toast) return null;
  const cfg = SEVERITY_STYLE[toast.severity] ?? SEVERITY_STYLE.INFO;

  return (
    <Animated.View
      style={[styles.container, { top: insets.top + 8, transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cfg.bg }]}
        activeOpacity={0.92}
        onPress={() => {
          if (dismissTimer.current) clearTimeout(dismissTimer.current);
          hide();
          navigation.navigate('Alerts');
        }}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={hide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
        <Ionicons name={cfg.icon} size={20} color={COLORS.white} />
        <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
        <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 999,
  },
  card: {
    position: 'relative',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    paddingRight: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  title: {
    color: COLORS.white,
    fontSize: 13.5,
    fontWeight: '800',
    marginTop: 6,
  },
  message: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    marginTop: 3,
    marginRight: 20,
    lineHeight: 16,
  },
});
