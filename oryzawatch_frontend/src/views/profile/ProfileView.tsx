import React, { useState } from 'react';
import type { User, UserRole } from '../../types';

interface ProfileViewProps {
  user: User;
  onLogOut: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  FARMER:    'REGISTERED FARMER',
  KAGAWAD:   'SK / AGRI-KAGAWAD',
  MAO_ADMIN: 'MAO ADMINISTRATOR',
};

const ROLE_BADGE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  FARMER:    { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  KAGAWAD:   { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  MAO_ADMIN: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onLogOut }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [notificationState, setNotificationState] = useState({
    blbAlerts: true,
    weatherAlerts: true,
    smsDispatches: false,
  });

  const initials = (user.username || 'User')
    .split(' ')
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join('');

  const roleStyle = ROLE_BADGE_COLORS[user.role] || ROLE_BADGE_COLORS.FARMER;
  const roleLabel = ROLE_LABELS[user.role] || user.role;

  const settingsItems = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      label: 'Notifications',
      description: 'Configure real-time disease outbreak & weather SMS/push alerts',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      label: 'Privacy & Data',
      description: 'Manage GPS farm coordinates and diagnostic history visibility',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      label: 'Account Settings',
      description: 'Update username, contact number, and password credentials',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      label: 'Help & Support',
      description: 'Contact Municipal Agriculture Office (MAO) technical desk',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <header className="layout-topbar">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            User Profile
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>👤</span>
            <span>Account management &amp; field credentials</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="layout-content" style={{ maxWidth: '840px', width: '100%' }}>
        {/* ── User Info Card ────────────────────────────── */}
        <div
          className="glass-panel"
          style={{
            padding: '28px',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          {/* Large Avatar */}
          <div
            style={{
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1b6336 0%, #2e9e59 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '28px',
              fontWeight: 800,
              boxShadow: '0 6px 18px rgba(35, 126, 70, 0.25)',
              fontFamily: "'Outfit', sans-serif",
              flexShrink: 0,
            }}
          >
            {initials || 'U'}
          </div>

          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
                {user.username}
              </h2>
              <span
                style={{
                  backgroundColor: roleStyle.bg,
                  color: roleStyle.text,
                  border: `1px solid ${roleStyle.border}`,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                {roleLabel}
              </span>
            </div>

            <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📍</span>
              <span>
                Brgy. {user.barangay || 'Central'}, {user.municipality ? (user.municipality.charAt(0) + user.municipality.slice(1).toLowerCase()) : 'Carmen'}, Davao del Norte
              </span>
            </div>

            {user.email && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                ✉ {user.email}
              </div>
            )}
          </div>
        </div>

        {/* ── Key Statistics Row ─────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div className="glass-card-interactive" style={{ padding: '18px 20px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active District</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: "'Outfit', sans-serif" }}>
              {user.municipality || 'CARMEN'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--leaf-primary)', marginTop: '4px', fontWeight: 600 }}>Corridor Zone 1</div>
          </div>

          <div className="glass-card-interactive" style={{ padding: '18px 20px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>System Status</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginTop: '4px', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
              Verified Active
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>JWT Authenticated</div>
          </div>

          <div className="glass-card-interactive" style={{ padding: '18px 20px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Access Level</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: "'Outfit', sans-serif" }}>
              {user.role === 'MAO_ADMIN' ? 'Full Admin' : 'Field Operator'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Spatiotemporal Engine</div>
          </div>
        </div>

        {/* ── Settings Section (Matching Mobile App) ────── */}
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '12px',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            SETTINGS &amp; PREFERENCES
          </div>

          <div className="glass-panel" style={{ backgroundColor: '#ffffff', overflow: 'hidden' }}>
            {settingsItems.map((item, idx) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '18px 22px',
                  borderBottom: idx < settingsItems.length - 1 ? '1px solid var(--border-light)' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ color: 'var(--leaf-primary)', display: 'flex', alignItems: 'center' }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {item.description}
                    </div>
                  </div>
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
                  ›
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sign Out Button ───────────────────────────── */}
        <button
          onClick={onLogOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            padding: '14px',
            backgroundColor: '#fef2f2',
            border: '1.5px solid #fecaca',
            borderRadius: 'var(--radius-md)',
            color: '#dc2626',
            fontSize: '14.5px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#fee2e2';
            e.currentTarget.style.borderColor = '#f87171';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fef2f2';
            e.currentTarget.style.borderColor = '#fecaca';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out of System
        </button>

        {/* Version footer */}
        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', paddingBottom: '16px' }}>
          OryzaWatch Web v1.0.0 · MAO Spatiotemporal Rice Diagnostic System
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
