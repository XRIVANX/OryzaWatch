import React, { useState, useEffect } from 'react';
import API from '../../utils/api';
import TextInput from './TextInput';
import PasswordInput from './PasswordInput';
import OryzaLogo from '../common/OryzaLogo';
import LeafParticles from '../common/LeafParticles';
import type { User, UserRole } from '../../types';

interface LoginFormProps {
  onLoginSuccess: (user: User) => void;
}

interface FormData {
  username: string;
  password: string;
  email: string;
  role: UserRole;
  municipality: string;
  barangay: string;
  phone_number: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  FARMER:    'Farmer',
  KAGAWAD:   'SK / Agri-Kagawad',
  MAO_ADMIN: 'MAO Admin',
};

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister]         = useState(false);
  const [adminExists, setAdminExists]       = useState<boolean | null>(null);
  const [formData, setFormData]             = useState<FormData>({
    username: '', password: '', email: '',
    role: 'FARMER', municipality: 'CARMEN',
    barangay: '', phone_number: '',
  });
  const [error, setError]                   = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading]               = useState(false);

  useEffect(() => {
    if (!isRegister) return;
    API.get<{ admin_exists: boolean }>('auth/admin-exists/')
      .then(res => setAdminExists(res.data.admin_exists))
      .catch(() => setAdminExists(true));
  }, [isRegister]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const { data } = await API.post('auth/login/', {
        username: formData.username,
        password: formData.password,
      });
      localStorage.setItem('access_token',  data.access);
      localStorage.setItem('refresh_token', data.refresh);
      onLoginSuccess(data.user);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const { data } = await API.post('auth/register/', formData);
      localStorage.setItem('access_token',  data.access);
      localStorage.setItem('refresh_token', data.refresh);
      setSuccessMessage('Registration successful! Logging you in…');
      setTimeout(() => onLoginSuccess(data.user), 1000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string | string[]> } };
      if (e.response?.data) {
        const errors   = e.response.data;
        const firstKey = Object.keys(errors)[0];
        const val      = errors[firstKey];
        const msg      = Array.isArray(val) ? val[0] : val;
        setError(`${firstKey}: ${msg}`);
      } else {
        setError('Registration failed. Please check your inputs.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(p => !p);
    setError(null);
    setSuccessMessage(null);
  };

  const availableRoles: UserRole[] = adminExists === false
    ? ['FARMER', 'KAGAWAD', 'MAO_ADMIN']
    : ['FARMER', 'KAGAWAD'];

  return (
    <div className="leafy-bg" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', position: 'relative' }}>
      <LeafParticles count={14} />

      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '430px',
          padding: '40px 36px',
          margin: '20px',
          zIndex: 10,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 12px 36px rgba(18, 48, 28, 0.08)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', flexShrink: 0 }}>
          <OryzaLogo size={130} showText glow={false} />
        </div>

        <h2 style={{ fontSize: '23px', fontWeight: 800, marginBottom: '4px', color: 'var(--text-primary)', textAlign: 'center', fontFamily: "'Outfit', sans-serif" }}>
          {isRegister ? 'Create Account' : 'Sign In'}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', textAlign: 'center' }}>
          Spatiotemporal Rice Diagnostic Portal
        </p>

        {error && (
          <div style={{ padding: '11px 15px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-sm)', color: 'var(--red-text)', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠</span> {error}
          </div>
        )}

        {successMessage && (
          <div style={{ padding: '11px 15px', background: 'var(--green-status-light)', border: '1px solid var(--green-status-border)', borderRadius: 'var(--radius-sm)', color: 'var(--green-status-text)', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✓</span> {successMessage}
          </div>
        )}

        {!isRegister ? (
          /* ── Sign In ── */
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <TextInput
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your system username"
            />
            <PasswordInput
              label="Password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn btn-leaf"
              style={{ marginTop: '12px', width: '100%', padding: '12px', fontSize: '14px' }}
            >
              {loading ? 'Verifying Credentials…' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* ── Register ── */
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ overflowY: 'auto', maxHeight: '45vh', paddingRight: '6px', marginBottom: '12px' }}>
              <TextInput
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose a username"
              />
              <TextInput
                label="Email Address"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="yourname@example.com"
                required={false}
              />
              <PasswordInput
                label="Password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Choose a password"
              />

              {/* System Role */}
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '6px', marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>System Role</label>
                {adminExists === null ? (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Checking available roles…</p>
                ) : (
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      backgroundColor: '#ffffff',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                      width: '100%',
                    }}
                  >
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                )}
                {formData.role === 'MAO_ADMIN' && (
                  <span style={{ fontSize: '11px', color: 'var(--red)', marginTop: '2px' }}>
                    ⚠ You are registering as the system MAO Admin. This option will disappear after registration.
                  </span>
                )}
              </div>

              {/* Municipality */}
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '6px', marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Municipality</label>
                <select
                  name="municipality"
                  value={formData.municipality}
                  onChange={handleChange}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: '#ffffff',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                    width: '100%',
                  }}
                >
                  <option value="CARMEN">Carmen</option>
                  <option value="ASUNCION">Asuncion</option>
                </select>
              </div>

              <TextInput
                label="Barangay"
                name="barangay"
                value={formData.barangay}
                onChange={handleChange}
                placeholder="e.g., Ising, Binungan, Mangalcal"
              />
              <TextInput
                label="Phone Number"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                placeholder="e.g., +639123456789"
                required={false}
              />
            </div>

            <button
              type="submit"
              disabled={loading || adminExists === null}
              className="btn btn-leaf"
              style={{ width: '100%', padding: '12px', fontSize: '14px' }}
            >
              {loading ? 'Creating Account…' : 'Register'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '18px', textAlign: 'center', fontSize: '13px', flexShrink: 0 }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          </span>
          <button
            type="button"
            onClick={toggleMode}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--leaf-deep)',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '13px',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </div>

        <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
          MAO Field Operations · Davao del Norte
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
