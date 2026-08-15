import React from 'react';

export interface NavItem {
  id: string;
  label: string;
  iconType: 'dashboard' | 'disease-map' | 'ai-scan' | 'alerts' | 'profile' | 'mao-console';
  group: 'MAIN' | 'ADMIN';
  badge?: number;
}

interface NavGroupProps {
  label: string;
  items: NavItem[];
  activePage: string;
  onNavigate: (page: string) => void;
}

const renderNavIcon = (type: NavItem['iconType'], isActive: boolean) => {
  const strokeColor = isActive ? '#ffffff' : '#9fb7a9';
  const size = 18;

  switch (type) {
    case 'dashboard':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'disease-map':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      );
    case 'ai-scan':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case 'alerts':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'profile':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'mao-console':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    default:
      return null;
  }
};

export const NavGroup: React.FC<NavGroupProps> = ({
  label,
  items,
  activePage,
  onNavigate,
}) => (
  <div style={{ marginBottom: '14px' }}>
    <div
      style={{
        fontSize: '11px',
        fontWeight: 800,
        color: '#5e836f',
        letterSpacing: '0.08em',
        padding: '8px 18px 6px',
        textTransform: 'uppercase',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {label}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 10px' }}>
      {items.map((item) => {
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              width: '100%',
              padding: '10px 14px',
              background: isActive ? '#2a6f4d' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '14px',
              color: isActive ? '#ffffff' : '#9fb7a9',
              fontWeight: isActive ? 700 : 500,
              transition: 'all 0.18s ease',
              position: 'relative',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = '#ffffff';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#9fb7a9';
              }
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', flexShrink: 0 }}>
              {renderNavIcon(item.iconType, isActive)}
            </span>
            <span style={{ flex: 1, fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em' }}>
              {item.label}
            </span>
            {item.badge !== undefined && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '50%',
                  fontSize: '11px',
                  fontWeight: 800,
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                }}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

export default NavGroup;
