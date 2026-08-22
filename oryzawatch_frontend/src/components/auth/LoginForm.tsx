import React, { useState, useEffect } from 'react';
import API from '../../utils/api';
import TextInput from './TextInput';
import PasswordInput from './PasswordInput';
import OryzaLogo from '../common/OryzaLogo';
import LeafParticles from '../common/LeafParticles';
import type { User } from '../../types';

interface LoginFormProps {
  onLoginSuccess: (user: User) => void;
}

interface LoginData {
  username: string;
  password: string;
}

interface AdminSetupData {
  username:        string;
  email:           string;
  password:        string;
  confirmPassword: string;
  municipality:    string;
  barangay:        string;
  phone_number:    string;
}

const INITIAL_SETUP: AdminSetupData = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  municipality: 'CARMEN',
  barangay: '',
  phone_number: '',
};

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [loginData, setLoginData]     = useState<LoginData>({ username: '', password: '' });
  const [setupData, setSetupData]     = useState<AdminSetupData>(INITIAL_SETUP);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Check if admin exists on mount
  useEffect(() => {
    API.get<{ admin_exists: boolean }>('auth/admin-exists/')
      .then(res => setAdminExists(res.data.admin_exists))
      .catch(() => setAdminExists(true));
  }, []);

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSetupChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSetupData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await API.post('auth/login/', {
        username: loginData.username,
        password: loginData.password,
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

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (setupData.password !== setupData.confirmPassword) {
      setError('Passwords do not match. Please repeat your password correctly.');
      return;
    }

    if (setupData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username:     setupData.username,
        email:        setupData.email,
        password:     setupData.password,
        municipality: setupData.municipality,
        barangay:     setupData.barangay,
        phone_number: setupData.phone_number,
      };

      const { data } = await API.post('auth/setup/', payload);
      localStorage.setItem('access_token',  data.access);
      localStorage.setItem('refresh_token', data.refresh);
      setSuccess('Primary MAO Admin account created! Redirecting into portal…');
      setTimeout(() => onLoginSuccess(data.user), 1200);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } | Record<string, string | string[]> } };
      if (e.response?.data) {
        if ('detail' in e.response.data && typeof e.response.data.detail === 'string') {
          setError(e.response.data.detail);
        } else {
          const errs = e.response.data as Record<string, string | string[]>;
          const firstKey = Object.keys(errs)[0];
          const val = errs[firstKey];
          const msg = Array.isArray(val) ? val[0] : val;
          setError(`${firstKey}: ${msg}`);
        }
      } else {
        setError('Setup failed. Please check your inputs.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isFreshDeploy = adminExists === false;

  return (
    <div className="leafy-bg" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', position: 'relative' }}>
      <LeafParticles count={14} />

      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: isFreshDeploy ? '480px' : '430px',
          padding: '36px 32px',
          margin: '20px',
          zIndex: 10,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 12px 36px rgba(18, 48, 28, 0.08)',
          maxHeight: '92vh',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', flexShrink: 0 }}>
          <OryzaLogo size={isFreshDeploy ? 95 : 120} showText glow={false} />
        </div>

        <h2 style={{ fontSize: isFreshDeploy ? '20px' : '23px', fontWeight: 800, marginBottom: '4px', color: 'var(--text-primary)', textAlign: 'center', fontFamily: "'Outfit', sans-serif" }}>
          {isFreshDeploy ? 'Initialize MAO Admin' : 'Sign In'}
        </h2>
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px', textAlign: 'center' }}>
          {isFreshDeploy
            ? 'Fresh deployment detected · Register the primary administrator'
            : 'Spatiotemporal Rice Diagnostic Portal'}
        </p>

        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-sm)', color: 'var(--red-text)', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠</span> {error}
          </div>
        )}

        {success && (
          <div style={{ padding: '10px 14px', background: 'var(--green-status-light)', border: '1px solid var(--green-status-border)', borderRadius: 'var(--radius-sm)', color: 'var(--green-status-text)', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✓</span> {success}
          </div>
        )}

        {isFreshDeploy ? (
          /* ── Initial Fresh Deployment Admin Setup Form ── */
          <form onSubmit={handleSetupSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ overflowY: 'auto', maxHeight: '48vh', paddingRight: '4px', marginBottom: '10px' }}>
              <TextInput
                label="Admin Username"
                name="username"
                value={setupData.username}
                onChange={handleSetupChange}
                placeholder="e.g., mao_admin"
              />
              <TextInput
                label="Admin Email"
                name="email"
                type="email"
                value={setupData.email}
                onChange={handleSetupChange}
                placeholder="admin@agriculture.gov.ph"
                required={false}
              />
              <PasswordInput
                label="Password"
                name="password"
                value={setupData.password}
                onChange={handleSetupChange}
                placeholder="Choose admin password"
              />

              {/* Repeat Password */}
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '6px', marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Repeat Password <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPwd ? 'text' : 'password'}
                    name="confirmPassword"
                    value={setupData.confirmPassword}
                    onChange={handleSetupChange}
                    placeholder="Repeat admin password"
                    style={{
                      width: '100%',
                      padding: '10px 42px 10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      backgroundColor: '#ffffff',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd(p => !p)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px' }}
                  >
                    {showConfirmPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {/* Municipality */}
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '6px', marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Municipality</label>
                <select
                  name="municipality"
                  value={setupData.municipality}
                  onChange={handleSetupChange}
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
                label="Station / Barangay"
                name="barangay"
                value={setupData.barangay}
                onChange={handleSetupChange}
                placeholder="e.g., Central / Poblacion"
              />
              <TextInput
                label="Phone Number"
                name="phone_number"
                value={setupData.phone_number}
                onChange={handleSetupChange}
                placeholder="e.g., +639123456789"
                required={false}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-leaf"
              style={{ width: '100%', padding: '12px', fontSize: '14px', flexShrink: 0 }}
            >
              {loading ? 'Initializing System…' : 'Create Admin & Launch Portal'}
            </button>
          </form>
        ) : (
          /* ── Standard Sign In Form ── */
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <TextInput
              label="Username"
              name="username"
              value={loginData.username}
              onChange={handleLoginChange}
              placeholder="Enter your system username"
            />
            <PasswordInput
              label="Password"
              name="password"
              value={loginData.password}
              onChange={handleLoginChange}
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

            {/* Info note — accounts are provisioned by admin */}
            <div style={{ marginTop: '18px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <span>🔒</span>&nbsp;Accounts are provisioned by the MAO Admin.
              <br />Contact your administrator if you need access.
            </div>
          </form>
        )}

        <p style={{ marginTop: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
          MAO Field Operations · Davao del Norte
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
