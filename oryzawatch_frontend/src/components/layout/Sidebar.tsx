import React from 'react';
import OryzaLogo from '../common/OryzaLogo';
import NavGroup, { NavItem } from '../navbar/NavGroup';
import type { User, UserRole } from '../../types';
import { ROLE_LABELS } from '../../utils/auth';

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',   label: 'Dashboard',   iconType: 'dashboard',   group: 'MAIN' },
  { id: 'disease-map', label: 'Disease Map',  iconType: 'disease-map',  group: 'MAIN' },
  { id: 'ai-scan',     label: 'AI Scan',      iconType: 'ai-scan',      group: 'MAIN' },
  { id: 'alerts',      label: 'Alerts',       iconType: 'alerts',       group: 'MAIN', badge: 3 },
  { id: 'profile',     label: 'Profile',      iconType: 'profile',      group: 'MAIN' },
  { id: 'mao-console', label: 'MAO Console',  iconType: 'mao-console',  group: 'ADMIN' },
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
  const avatarLetter = (user.username || roleLabel).charAt(0).toUpperCase();
  const municipalityDisplay = user.municipality 
    ? `${user.municipality.charAt(0) + user.municipality.slice(1).toLowerCase()}, Davao del Norte`
    : 'Davao del Norte';

  return (
    <aside
      className="layout-sidebar"
      style={{
        backgroundColor: '#07190f',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}
    >
      {/* ── Brand Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '24px 20px 22px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Circular Big Logo without square wrapper */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35))',
          }}
        >
          <OryzaLogo size={46} showText={false} glow={false} />
        </div>
        <div>
          <div
            style={{
              fontWeight: 800,
              fontSize: '17.5px',
              color: '#ffffff',
              letterSpacing: '-0.02em',
              fontFamily: "'Outfit', 'Inter', sans-serif",
              lineHeight: 1.2,
            }}
          >
            OryzaWatch
          </div>
          <div
            style={{
              fontSize: '12px',
              color: '#7e9988',
              fontWeight: 500,
              marginTop: '3px',
            }}
          >
            Rice Disease Monitor
          </div>
        </div>
      </div>

      {/* ── Navigation Menu ── */}
      <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
        <NavGroup label="MAIN" items={mainItems} activePage={activePage} onNavigate={onNavigate} />
        {adminItems.length > 0 && (
          <NavGroup label="ADMIN" items={adminItems} activePage={activePage} onNavigate={onNavigate} />
        )}
      </nav>

      {/* ── User Footer Panel ── */}
      <div
        style={{
          padding: '18px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#05140c',
        }}
      >
        {/* Avatar + User Role info */}
        <div
          onClick={() => onNavigate('profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '8px',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {/* Avatar Circle */}
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: '#246344',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '15px',
              flexShrink: 0,
            }}
          >
            {avatarLetter}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              {roleLabel}
            </div>
            <div
              style={{
                fontSize: '11.5px',
                color: '#7e9988',
                marginTop: '3px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {municipalityDisplay}
            </div>
          </div>
        </div>

        {/* Online status and Log Out button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '4px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              color: '#22c55e',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
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
              color: '#8da596',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '2px 4px',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f87171';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#8da596';
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
