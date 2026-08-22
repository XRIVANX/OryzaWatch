import React, { useState } from 'react';
import API from '../../utils/api';
import type { User, UserRole } from '../../types';

interface RegisterUserFormProps {
  adminUser: User;
}

interface FormData {
  username:        string;
  email:           string;
  password:        string;
  confirmPassword: string;
  role:            UserRole;
  municipality:    string;
  barangay:        string;
  phone_number:    string;
}

const INITIAL: FormData = {
  username: '', email: '', password: '', confirmPassword: '',
  role: 'FARMER', municipality: 'CARMEN',
  barangay: '', phone_number: '',
};

export const RegisterUserForm: React.FC<RegisterUserFormProps> = ({ adminUser }) => {
  const [form, setForm]               = useState<FormData>(INITIAL);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);
  const [showPassword, setShowPwd]    = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Kagawad can only register Farmers
  const availableRoles: UserRole[] =
    adminUser.role === 'KAGAWAD' ? ['FARMER'] : ['FARMER', 'KAGAWAD'];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate repeat password
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match. Please re-enter repeat password.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role,
        municipality: form.municipality,
        barangay: form.barangay,
        phone_number: form.phone_number,
      };

      const { data } = await API.post('auth/register/', payload);
      setSuccess(
        `✓ Account created for "${data.user.username}" (${
          data.user.role === 'KAGAWAD' ? 'SK / Agri-Kagawad' : 'Farmer'
        }).`,
      );
      setForm(INITIAL);
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string | string[]> } };
      if (e.response?.data) {
        const errs    = e.response.data;
        const firstKey = Object.keys(errs)[0];
        const val      = errs[firstKey];
        const msg      = Array.isArray(val) ? val[0] : val;
        setError(`${firstKey}: ${msg}`);
      } else {
        setError('Registration failed. Please check your inputs.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12.5px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    marginBottom: '5px',
    display: 'block',
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '14px',
  };

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif", marginBottom: '4px' }}>
          Register New Account
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {adminUser.role === 'KAGAWAD'
            ? 'As an Agri-Kagawad, you can register new Farmer accounts.'
            : 'As MAO Admin, you can register Farmer and Agri-Kagawad accounts.'}
        </p>
      </div>

      {error && (
        <div style={{ padding: '11px 15px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-sm)', color: 'var(--red-text)', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠</span> {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '11px 15px', background: 'var(--green-status-light)', border: '1px solid var(--green-status-border)', borderRadius: 'var(--radius-sm)', color: 'var(--green-status-text)', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {success}
        </div>
      )}

      <div className="glass-panel" style={{ backgroundColor: '#ffffff', padding: '24px' }}>
        <form onSubmit={handleSubmit}>
          {/* Row 1: Username + Role */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Username *</label>
              <input name="username" value={form.username} onChange={handleChange} placeholder="e.g., juan.dela.cruz" style={inputStyle} required />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>System Role *</label>
              <select name="role" value={form.role} onChange={handleChange} style={inputStyle}>
                {availableRoles.map(r => (
                  <option key={r} value={r}>
                    {r === 'FARMER' ? 'Farmer' : 'SK / Agri-Kagawad'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Email */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Email Address</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="juan@example.com" style={inputStyle} />
          </div>

          {/* Password & Repeat Password Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Choose a password"
                  style={{ ...inputStyle, paddingRight: '40px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px' }}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Repeat Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  name="confirmPassword"
                  type={showConfirmPwd ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  style={{ ...inputStyle, paddingRight: '40px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd(p => !p)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px' }}
                >
                  {showConfirmPwd ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Municipality + Barangay */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Municipality *</label>
              <select name="municipality" value={form.municipality} onChange={handleChange} style={inputStyle}>
                <option value="CARMEN">Carmen</option>
                <option value="ASUNCION">Asuncion</option>
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Barangay *</label>
              <input name="barangay" value={form.barangay} onChange={handleChange} placeholder="e.g., Ising, Binungan" style={inputStyle} required />
            </div>
          </div>

          {/* Phone */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Phone Number</label>
            <input name="phone_number" value={form.phone_number} onChange={handleChange} placeholder="+639123456789" style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => { setForm(INITIAL); setError(null); setSuccess(null); }}
              className="btn btn-outline"
              style={{ padding: '10px 20px', fontSize: '13.5px' }}
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-leaf"
              style={{ padding: '10px 24px', fontSize: '13.5px' }}
            >
              {loading ? 'Creating Account…' : 'Register Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterUserForm;
