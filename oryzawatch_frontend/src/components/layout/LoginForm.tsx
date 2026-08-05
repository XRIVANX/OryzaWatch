import { useState, useEffect } from 'react';
import API from '../../services/api';
import TextInput from '../input/TextInput';
import Password from '../input/Password';
import OryzaLogo from '../ui/OryzaLogo';
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

// Human-readable labels matching Django's ROLE_CHOICES
const ROLE_LABELS: Record<UserRole, string> = {
  FARMER:    'Farmer',
  KAGAWAD:   'SK / Agri-Kagawad',
  MAO_ADMIN: 'MAO Admin',
};

const LoginForm = ({ onLoginSuccess }: LoginFormProps) => {
  const [isRegister, setIsRegister]           = useState(false);
  const [adminExists, setAdminExists]         = useState<boolean | null>(null); // null = loading
  const [formData, setFormData]               = useState<FormData>({
    username: '', password: '', email: '',
    role: 'FARMER', municipality: 'CARMEN',
    barangay: '', phone_number: '',
  });
  const [error, setError]                     = useState<string | null>(null);
  const [successMessage, setSuccessMessage]   = useState<string | null>(null);
  const [loading, setLoading]                 = useState(false);

  // When the user opens the registration panel, check whether an MAO_ADMIN
  // already exists so we can hide/show that option in the dropdown.
  useEffect(() => {
    if (!isRegister) return;
    API.get<{ admin_exists: boolean }>('auth/admin-exists/')
      .then(res => setAdminExists(res.data.admin_exists))
      .catch(() => setAdminExists(true)); // default to hidden on error (safe side)
  }, [isRegister]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ── Login ──────────────────────────────────────────────────────────────────
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

  // ── Register ───────────────────────────────────────────────────────────────
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

  // Available roles in the dropdown — MAO_ADMIN hidden once an admin exists
  const availableRoles: UserRole[] = adminExists === false
    ? ['FARMER', 'KAGAWAD', 'MAO_ADMIN']
    : ['FARMER', 'KAGAWAD'];

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', flexShrink: 0 }}>
          <OryzaLogo size={120} showText />
        </div>

        <h2 style={s.title}>{isRegister ? 'Create Account' : 'Sign In'}</h2>
        <p style={s.subtitle}>Spatiotemporal Rice Diagnostic Portal</p>

        {error          && <div style={s.errorBox}>{error}</div>}
        {successMessage && <div style={s.successBox}>{successMessage}</div>}

        {!isRegister ? (
          /* ── Sign In ── */
          <form onSubmit={handleLoginSubmit} style={s.form}>
            <TextInput label="Username" name="username" value={formData.username}
              onChange={handleChange} placeholder="Enter your system username" />
            <Password  label="Password" name="password" value={formData.password}
              onChange={handleChange} placeholder="••••••••" />
            <button type="submit" disabled={loading} style={s.btn}>
              {loading ? 'Verifying Credentials…' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* ── Register ── */
          <form onSubmit={handleRegisterSubmit} style={s.form}>
            <div style={s.scrollableFields}>
              <TextInput label="Username" name="username" value={formData.username}
                onChange={handleChange} placeholder="Choose a username" />
              <TextInput label="Email Address" name="email" value={formData.email}
                onChange={handleChange} placeholder="yourname@example.com" required={false} />
              <Password label="Password" name="password" value={formData.password}
                onChange={handleChange} placeholder="Choose a password" />

              {/* System Role — MAO_ADMIN option only shown before first admin */}
              <div style={s.group}>
                <label style={s.label}>System Role</label>
                {adminExists === null ? (
                  <p style={s.fieldHint}>Checking available roles…</p>
                ) : (
                  <select name="role" value={formData.role} onChange={handleChange} style={s.select}>
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                )}
                {formData.role === 'MAO_ADMIN' && (
                  <span style={{ ...s.fieldHint, color: 'var(--red)' }}>
                    ⚠ You are registering as the system MAO Admin. This option will disappear after registration.
                  </span>
                )}
              </div>

              {/* Municipality */}
              <div style={s.group}>
                <label style={s.label}>Municipality</label>
                <select name="municipality" value={formData.municipality} onChange={handleChange} style={s.select}>
                  <option value="CARMEN">Carmen</option>
                  <option value="ASUNCION">Asuncion</option>
                </select>
              </div>

              <TextInput label="Barangay" name="barangay" value={formData.barangay}
                onChange={handleChange} placeholder="e.g., Ising, Binungan, Mangalcal" />
              <TextInput label="Phone Number" name="phone_number" value={formData.phone_number}
                onChange={handleChange} placeholder="e.g., +639123456789" required={false} />
            </div>

            <button type="submit" disabled={loading || adminExists === null} style={s.btn}>
              {loading ? 'Creating Account…' : 'Register'}
            </button>
          </form>
        )}

        <div style={s.toggleContainer}>
          <span style={s.toggleText}>
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          </span>
          <button type="button" onClick={toggleMode} style={s.toggleLinkBtn}>
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </div>
        <p style={s.footer}>MAO Field Operations · Davao del Norte</p>
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page:            { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', background: 'var(--bg)' },
  card:            { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '36px 32px', width: '100%', maxWidth: '400px', boxShadow: '0 8px 24px rgba(0,0,0,0.07)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  title:           { fontSize: '22px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)', flexShrink: 0 },
  subtitle:        { fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', flexShrink: 0 },
  form:            { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflow: 'hidden' },
  scrollableFields:{ flex: 1, overflowY: 'auto', paddingRight: '6px', marginBottom: '12px' },
  errorBox:        { padding: '10px 14px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: '6px', color: 'var(--red)', fontSize: '13px', marginBottom: '16px', flexShrink: 0 },
  successBox:      { padding: '10px 14px', background: 'var(--green-status-light)', border: '1px solid var(--green-status-border)', borderRadius: '6px', color: 'var(--green-status)', fontSize: '13px', marginBottom: '16px', flexShrink: 0 },
  group:           { display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '6px', marginBottom: '14px' },
  label:           { fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 },
  select:          { padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  fieldHint:       { fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' },
  btn:             { marginTop: '8px', width: '100%', padding: '11px', background: 'var(--green-dark)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', flexShrink: 0 },
  toggleContainer: { marginTop: '16px', textAlign: 'center', fontSize: '13px', flexShrink: 0 },
  toggleText:      { color: 'var(--text-secondary)' },
  toggleLinkBtn:   { background: 'none', border: 'none', color: 'var(--green-dark)', fontWeight: 600, cursor: 'pointer', fontSize: '13px', padding: 0, textDecoration: 'underline' },
  footer:          { marginTop: '18px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 },
};

export default LoginForm;