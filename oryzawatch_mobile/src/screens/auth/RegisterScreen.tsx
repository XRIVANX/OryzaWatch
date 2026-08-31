import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { useAuth } from '../../hooks/useAuth';
import OryzaLogo from '../../components/common/OryzaLogo';
import { COLORS, ROLES } from '../../utils/constants';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'Register'>;
};

const MUNICIPALITIES = ['ASUNCION', 'CARMEN'];
const ROLES_LIST = [
  { key: ROLES.FARMER, label: 'Farmer' },
  { key: ROLES.KAGAWAD, label: 'SK / Agri-Kagawad' },
];

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: ROLES.FARMER,
    municipality: 'ASUNCION',
    barangay: '',
    phone_number: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: keyof typeof form) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleRegister = async () => {
    if (!form.username.trim() || !form.password.trim() || !form.barangay.trim() || !form.municipality.trim()) {
      Alert.alert('Incomplete', 'Please fill in all required fields marked with *.');
      return;
    }
    setIsSubmitting(true);
    try {
      await register({
        ...form,
        username: form.username.trim(),
        barangay: form.barangay.trim(),
      });
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Row: Back button + Mini Brand */}
          <View style={styles.topNavRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={styles.topBrand}>
              <OryzaLogo size={32} showText={false} />
              <Text style={styles.topBrandText}>OryzaWatch</Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Create Account</Text>
            <Text style={styles.subheading}>Register for MAO Field Operations & Crop Diagnostic Alerts</Text>

            {/* Role Selector */}
            <Text style={styles.label}>Account Role *</Text>
            <View style={styles.roleRow}>
              {ROLES_LIST.map((r) => {
                const isActive = form.role === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.roleChip, isActive && styles.roleChipActive]}
                    onPress={() => update('role')(r.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={isActive ? COLORS.primary : COLORS.textMuted}
                    />
                    <Text style={[styles.roleChipText, isActive && styles.roleChipTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username *</Text>
              <TextInput
                style={styles.input}
                value={form.username}
                onChangeText={update('username')}
                placeholder="e.g. jdelacruz"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={update('email')}
                placeholder="Optional (e.g. farmer@gmail.com)"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={form.password}
                  onChangeText={update('password')}
                  secureTextEntry={!showPassword}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={COLORS.textMuted}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Municipality */}
            <Text style={styles.label}>Municipality *</Text>
            <View style={styles.roleRow}>
              {MUNICIPALITIES.map((m) => {
                const isActive = form.municipality === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.roleChip, isActive && styles.roleChipActive]}
                    onPress={() => update('municipality')(m)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="location"
                      size={15}
                      color={isActive ? COLORS.primary : COLORS.textMuted}
                    />
                    <Text style={[styles.roleChipText, isActive && styles.roleChipTextActive]}>
                      {m.charAt(0) + m.slice(1).toLowerCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Barangay */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Barangay *</Text>
              <TextInput
                style={styles.input}
                value={form.barangay}
                onChangeText={update('barangay')}
                placeholder="e.g. Ising, Binungan, Mangalcal"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={form.phone_number}
                onChangeText={update('phone_number')}
                placeholder="Optional (e.g. +639123456789)"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleRegister}
              disabled={isSubmitting}
              activeOpacity={0.88}
            >
              {isSubmitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.submitText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginPrompt}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBrandText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginTop: 4,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryBg,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  roleChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginPrompt: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  loginLink: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
