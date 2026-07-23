import React, { useState } from 'react';
import API from '../../services/api';
import TextInput from '../input/TextInput';
import Password from '../input/Password';
import OryzaLogo from '../ui/OryzaLogo';

const LoginForm = ({ onLoginSuccess }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        email: '',
        role: 'FARMER',
        municipality: 'CARMEN',
        barangay: '',
        phone_number: '',
    });
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setLoading(true);

        try {
            const response = await API.post('auth/login/', {
                username: formData.username,
                password: formData.password,
            });
            const { access, refresh, user } = response.data;

            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);

            if (onLoginSuccess) onLoginSuccess(user);
        } catch (err) {
            setError(err.response?.data?.detail || 'Authentication Failed. Please check inputs.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setLoading(true);

        try {
            const response = await API.post('auth/register/', formData);
            const { access, refresh, user } = response.data;

            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);

            setSuccessMessage('Registration successful! Logging you in...');
            setTimeout(() => {
                if (onLoginSuccess) onLoginSuccess(user);
            }, 1000);
        } catch (err) {
            // Handle serializer errors
            if (err.response?.data) {
                const errors = err.response.data;
                const firstKey = Object.keys(errors)[0];
                const errorVal = errors[firstKey];
                const displayError = Array.isArray(errorVal) ? errorVal[0] : errorVal;
                setError(`${firstKey}: ${displayError}`);
            } else {
                setError('Registration Failed. Please check inputs.');
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsRegister(!isRegister);
        setError(null);
        setSuccessMessage(null);
    };

    return (
        <div style={s.page}>
            <div style={s.card}>
                {/* Logo */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', flexShrink: 0 }}>
                    <OryzaLogo size={120} showText={true} />
                </div>

                <h2 style={s.title}>{isRegister ? 'Create Account' : 'Sign In'}</h2>
                <p style={s.subtitle}>Spatiotemporal Rice Diagnostic Portal</p>

                {error && <div style={s.errorBox}>{error}</div>}
                {successMessage && <div style={s.successBox}>{successMessage}</div>}

                {!isRegister ? (
                    /* Sign In Form */
                    <form onSubmit={handleLoginSubmit} style={s.form}>
                        <TextInput
                            label="Username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="Enter your system username"
                        />
                        <Password
                            label="Password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                        />
                        <button type="submit" disabled={loading} style={s.btn}>
                            {loading ? 'Verifying Credentials…' : 'Sign In'}
                        </button>
                    </form>
                ) : (
                    /* Registration Form */
                    <form onSubmit={handleRegisterSubmit} style={s.form}>
                        <div style={s.scrollableFields}>
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
                            <Password
                                label="Password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Choose a password"
                            />
                            
                            <div style={s.group}>
                                <label style={s.label}>System Role</label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    style={s.select}
                                >
                                    <option value="FARMER">Farmer</option>
                                    <option value="KAGAWAD">SK / Agri-Kagawad</option>
                                    <option value="MAO_ADMIN">MAO Admin</option>
                                </select>
                            </div>

                            <div style={s.group}>
                                <label style={s.label}>Municipality</label>
                                <select
                                    name="municipality"
                                    value={formData.municipality}
                                    onChange={handleChange}
                                    style={s.select}
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

                        <button type="submit" disabled={loading} style={s.btn}>
                            {loading ? 'Creating Account…' : 'Register'}
                        </button>
                    </form>
                )}

                <div style={s.toggleContainer}>
                    <span style={s.toggleText}>
                        {isRegister ? 'Already have an account? ' : " "}
                    </span>
                    <button onClick={toggleMode} style={s.toggleLinkBtn}>
                        {isRegister ? '' : ''}
                    </button>
                </div>

                <p style={s.footer}>
                    MAO Field Operations · Davao del Norte
                </p>
            </div>
        </div>
    );
};

const s = {
    page: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        width: '100%',
        background: 'var(--bg)',
    },
    card: {
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '36px 32px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.07)',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
    },
    logoRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
        flexShrink: 0,
    },
    logoIcon: {
        display: 'flex',
        alignItems: 'center',
    },
    logoText: {
        fontWeight: 700,
        fontSize: '18px',
        color: 'var(--text-primary)',
        letterSpacing: '-0.02em',
    },
    title: {
        fontSize: '22px',
        fontWeight: 700,
        marginBottom: '4px',
        color: 'var(--text-primary)',
        flexShrink: 0,
    },
    subtitle: {
        fontSize: '13px',
        color: 'var(--text-secondary)',
        marginBottom: '20px',
        flexShrink: 0,
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flex: 1,
        overflow: 'hidden',
    },
    scrollableFields: {
        flex: 1,
        overflowY: 'auto',
        paddingRight: '6px',
        marginBottom: '12px',
    },
    errorBox: {
        padding: '10px 14px',
        background: 'var(--red-light)',
        border: '1px solid var(--red-border)',
        borderRadius: '6px',
        color: 'var(--red)',
        fontSize: '13px',
        marginBottom: '16px',
        flexShrink: 0,
    },
    successBox: {
        padding: '10px 14px',
        background: 'var(--green-status-light)',
        border: '1px solid var(--green-status-border)',
        borderRadius: '6px',
        color: 'var(--green-status)',
        fontSize: '13px',
        marginBottom: '16px',
        flexShrink: 0,
    },
    group: {
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        gap: '6px',
        marginBottom: '14px',
    },
    label: {
        fontSize: '13px',
        color: 'var(--text-secondary)',
        fontWeight: '500',
    },
    select: {
        padding: '10px 14px',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
    },
    btn: {
        marginTop: '8px',
        width: '100%',
        padding: '11px',
        background: 'var(--green-dark)',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 600,
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'background 0.15s',
        flexShrink: 0,
    },
    toggleContainer: {
        marginTop: '16px',
        textAlign: 'center',
        fontSize: '13px',
        flexShrink: 0,
    },
    toggleText: {
        color: 'var(--text-secondary)',
    },
    toggleLinkBtn: {
        background: 'none',
        border: 'none',
        color: 'var(--green-dark)',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: '13px',
        padding: 0,
        textDecoration: 'underline',
    },
    footer: {
        marginTop: '18px',
        textAlign: 'center',
        fontSize: '11px',
        color: 'var(--text-muted)',
        flexShrink: 0,
    },
};

export default LoginForm;