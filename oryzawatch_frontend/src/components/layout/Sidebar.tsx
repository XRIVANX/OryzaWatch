import React from 'react';
import OryzaLogo from '../common/OryzaLogo';
import NavGroup, { NavItem } from '../navbar/NavGroup';
import type { User, UserRole } from '../../types';
import { ROLE_LABELS } from '../../utils/auth';

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '⊞',  group: 'MAIN' },
  { id: 'disease-map', label: 'Disease Map',  icon: '⊙',  group: 'MAIN' },
  { id: 'ai-scan',     label: 'AI Scan',      icon: '🌿', group: 'MAIN' },
  { id: 'alerts',      label: 'Alerts',       icon: '🔔', group: 'MAIN', badge: 3 },
  { id: 'mao-console', label: 'MAO Console',  icon: '👤', group: 'ADMIN' },
];

interface SidebarProps {
  user: User;
  activePage: string;
  onNavigate: (page: string) => void;
  onLogOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activePage,
  onNavigate,
  onLogOut,
}) => {
  const mainItems = NAV_ITEMS.filter((i) => i.group === 'MAIN');
  const adminItems = user.role === 'MAO_ADMIN'
    ? NAV_ITEMS.filter((i) => i.group === 'ADMIN')
    : [];

  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <aside className="layout-sidebar">
      {/* Brand Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '20px 18px 18px',
          borderBottom: '1px solid var(--border-light)',
          background: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <OryzaLogo size={28} showText={false} glow={false} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '16.5px', color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: "'Outfit', sans-serif" }}>
            OryzaWatch
          </div>
          <div style={{ fontSize: '9.5px', color: 'var(--leaf-primary)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Rice Health AI
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '14px 0', overflowY: 'auto' }}>
        <NavGroup label="MAIN" items={mainItems} activePage={activePage} onNavigate={onNavigate} />
        {adminItems.length > 0 && (
          <NavGroup label="ADMIN" items={adminItems} activePage={activePage} onNavigate={onNavigate} />
        )}
      </nav>

      {/* User Footer Panel */}
      <div
        style={{
          padding: '16px 18px',
          borderTop: '1px solid var(--border-light)',
          background: '#f9fbf9',
        }}
      >
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>
          Logged in as
        </div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {roleLabel} · {user.municipality}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--green-status-text)', fontWeight: 600 }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#16a34a',
                display: 'inline-block',
              }}
            />
            Online
          </div>
          <button
            onClick={onLogOut}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '4px',
              textDecoration: 'underline',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Log Out
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
