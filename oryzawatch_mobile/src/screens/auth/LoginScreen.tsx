// ─────────────────────────────────────────────────────────────────────────────
// LoginScreen — Botanical Theme Matching Web Portal
// ─────────────────────────────────────────────────────────────────────────────
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
import { COLORS, API_BASE_URL } from '../../utils/constants';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your username and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message || 'Invalid credentials. Please try again.');
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
          {/* ── Brand Card ─────────────────────────────────── */}
          <View style={styles.card}>
            {/* Authentic OryzaWatch Web Emblem Logo */}
            <View style={styles.logoWrapper}>
              <OryzaLogo size={110} showText={true} />
            </View>

            {/* Heading */}
            <Text style={styles.heading}>OryzaWatch</Text>
            <Text style={styles.subheading}>
            <Text style={{ color: '#B8860B', fontWeight: 'bold' }}>
            PREDICT. ALERT. PROTECT.
            </Text>
            </Text> 



            {/* Username Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your system username"
                  placeholderTextColor={COLORS.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInBtn, isSubmitting && styles.signInBtnDisabled]}
              onPress={handleLogin}
              disabled={isSubmitting}
              activeOpacity={0.88}
            >
              {isSubmitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.signInText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Register link */}
            <View style={styles.registerRow}>
              <Text style={styles.registerPrompt}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Register</Text>
              </TouchableOpacity>
            </View>

            {/* Footer Notice */}
            <View style={styles.footerNotice}>
              <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.primary} />
              <Text style={styles.footer}>MAO Field Operations · Davao del Norte</Text>
            </View>
            <Text style={styles.apiText}>API: {API_BASE_URL}</Text>
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
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#12301c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    height: 110,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 22,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  eyeBtn: {
    padding: 6,
  },
  signInBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  signInBtnDisabled: {
    opacity: 0.65,
  },
  signInText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  registerPrompt: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  registerLink: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  footerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  footer: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  apiText: {
    textAlign: 'center',
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
    opacity: 0.7,
  },
});
