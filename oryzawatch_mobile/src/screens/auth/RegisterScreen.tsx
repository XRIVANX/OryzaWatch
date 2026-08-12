import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { useAuth } from '../../hooks/useAuth';
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
    if (!form.username || !form.password || !form.barangay || !form.municipality) {
      Alert.alert('Incomplete', 'Please fill in all required fields.');
      return;
    }
    setIsSubmitting(true);
    try {
      await register(form);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Back Button */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.heading}>Create Account</Text>
            <Text style={styles.subheading}>Register to OryzaWatch · MAO Field Operations</Text>

            {/* Role Selector */}
            <Text style={styles.label}>Account Type</Text>
            <View style={styles.roleRow}>
              {ROLES_LIST.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.roleChip, form.role === r.key && styles.roleChipActive]}
                  onPress={() => update('role')(r.key)}
                >
                  <Text style={[styles.roleChipText, form.role === r.key && styles.roleChipTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Username */}
            <Text style={styles.label}>Username *</Text>
            <TextInput style={styles.input} value={form.username} onChangeText={update('username')}
              placeholder="e.g. jdelacruz" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" />

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={update('email')}
              placeholder="Optional" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" />

            {/* Password */}
            <Text style={styles.label}>Password *</Text>
            <View style={styles.passwordWrapper}>
              <TextInput style={styles.passwordInput} value={form.password} onChangeText={update('password')}
                secureTextEntry={!showPassword} placeholder="Min. 8 characters" placeholderTextColor={COLORS.textMuted} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Municipality */}
            <Text style={styles.label}>Municipality *</Text>
            <View style={styles.roleRow}>
              {MUNICIPALITIES.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.roleChip, form.municipality === m && styles.roleChipActive]}
                  onPress={() => update('municipality')(m)}
                >
                  <Text style={[styles.roleChipText, form.municipality === m && styles.roleChipTextActive]}>
                    {m.charAt(0) + m.slice(1).toLowerCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Barangay */}
            <Text style={styles.label}>Barangay *</Text>
            <TextInput style={styles.input} value={form.barangay} onChangeText={update('barangay')}
              placeholder="e.g. Ising, Binungan, Mangalcal" placeholderTextColor={COLORS.textMuted} />

            {/* Phone */}
            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.input} value={form.phone_number} onChangeText={update('phone_number')}
              placeholder="Optional" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleRegister}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.submitText}>Create Account</Text>
              }
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
  safeArea: { flex: 1, backgroundColor: '#e8ede8' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24 },
  backBtn: { marginBottom: 16, alignSelf: 'flex-start', padding: 4 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
  },
  heading: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  subheading: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: COLORS.textPrimary, marginBottom: 18,
  },
  passwordWrapper: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderColor: COLORS.border, borderRadius: 10, marginBottom: 18,
  },
  passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.textPrimary },
  eyeBtn: { paddingHorizontal: 14 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  roleChip: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  roleChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  roleChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  roleChipTextActive: { color: COLORS.primary },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginBottom: 18,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center' },
  loginPrompt: { fontSize: 13, color: COLORS.textSecondary },
  loginLink: { fontSize: 13, color: COLORS.primary, fontWeight: '700', textDecorationLine: 'underline' },
});
