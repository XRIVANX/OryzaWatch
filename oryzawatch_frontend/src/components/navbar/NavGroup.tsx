import React from 'react';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  group: 'MAIN' | 'ADMIN';
  badge?: number;
}

interface NavGroupProps {
  label: string;
  items: NavItem[];
  activePage: string;
  onNavigate: (page: string) => void;
}

export const NavGroup: React.FC<NavGroupProps> = ({
  label,
  items,
  activePage,
  onNavigate,
}) => (
  <div style={{ marginBottom: '8px' }}>
    <div
      style={{
        fontSize: '10.5px',
        fontWeight: 800,
        color: 'var(--text-muted)',
        letterSpacing: '0.08em',
        padding: '10px 20px 4px',
        textTransform: 'uppercase',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {label}
    </div>
    {items.map((item) => {
      const isActive = activePage === item.id;
      return (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: 'calc(100% - 16px)',
            margin: '2px 8px',
            padding: '9px 14px',
            background: isActive ? '#eaf5ee' : 'transparent',
            border: isActive ? '1px solid #cce8d5' : '1px solid transparent',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '13.5px',
            color: isActive ? '#154326' : 'var(--text-secondary)',
            fontWeight: isActive ? 700 : 500,
            transition: 'all 0.15s ease',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = '#14261c';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
        >
          {/* Active side indicator */}
          {isActive && (
            <div
              style={{
                position: 'absolute',
                left: '-8px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '3.5px',
                height: '18px',
                background: 'var(--leaf-vibrant)',
                borderRadius: '0 4px 4px 0',
              }}
            />
          )}

          <span style={{ fontSize: '15px', width: '20px', textAlign: 'center', flexShrink: 0 }}>
            {item.icon}
          </span>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.badge && (
            <span
              style={{
                background: '#dc2626',
                color: '#fff',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 6px',
                minWidth: '18px',
                textAlign: 'center',
              }}
            >
              {item.badge}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default NavGroup;
