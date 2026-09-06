// ─────────────────────────────────────────────────────────────────────────────
// ThemedDialog — a botanical-theme replacement for RN's native Alert.alert,
// so confirmations and advisories match the rest of the app instead of the
// bare OS dialog. Supports an optional highlighted "callout" block (used for
// the treat-it-now recommendation) and 1–3 actions.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface ThemedDialogAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger';
}

interface ThemedDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  icon?: IoniconName;
  iconColor?: string;
  /** Optional emphasised block, e.g. the treatment recommendation. */
  highlight?: { label: string; text: string };
  actions: ThemedDialogAction[];
  onRequestClose?: () => void;
}

export default function ThemedDialog({
  visible,
  title,
  message,
  icon,
  iconColor = COLORS.primary,
  highlight,
  actions,
  onRequestClose,
}: ThemedDialogProps) {
  const row = actions.length > 1;
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onRequestClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {icon && (
            <View style={[styles.iconCircle, { backgroundColor: iconColor + '18' }]}>
              <Ionicons name={icon} size={26} color={iconColor} />
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          {highlight && (
            <View style={styles.highlight}>
              <Text style={styles.highlightLabel}>{highlight.label}</Text>
              <Text style={styles.highlightText}>{highlight.text}</Text>
            </View>
          )}

          <View style={[styles.actions, { flexDirection: row ? 'row' : 'column' }]}>
            {actions.map((a, i) => {
              const variant = a.variant ?? 'primary';
              const filled = variant === 'primary' || variant === 'danger';
              return (
                <TouchableOpacity
                  key={`${a.label}-${i}`}
                  style={[
                    styles.btn,
                    row && styles.btnFlex,
                    variant === 'primary' && styles.btnPrimary,
                    variant === 'danger' && styles.btnDanger,
                    variant === 'outline' && styles.btnOutline,
                  ]}
                  onPress={a.onPress}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.btnText, filled ? styles.btnTextFilled : styles.btnTextOutline]}>
                    {a.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 20, 12, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 22,
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },
  highlight: {
    backgroundColor: COLORS.primaryBg,
    borderWidth: 1,
    borderColor: COLORS.primaryPastel,
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  highlightLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: COLORS.primary,
    marginBottom: 4,
  },
  highlightText: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  actions: {
    gap: 10,
    marginTop: 18,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFlex: { flex: 1 },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnDanger: { backgroundColor: COLORS.danger },
  btnOutline: { borderWidth: 1.4, borderColor: COLORS.border, backgroundColor: COLORS.white },
  btnText: { fontSize: 13.5, fontWeight: '800', letterSpacing: 0.2 },
  btnTextFilled: { color: COLORS.white },
  btnTextOutline: { color: COLORS.textSecondary },
});
