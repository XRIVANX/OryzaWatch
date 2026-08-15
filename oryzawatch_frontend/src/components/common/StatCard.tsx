import React from 'react';

interface StatCardProps {
  value: string;
  label: string;
  sub: string;
  subColor: string;
  icon?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  sub,
  subColor,
  icon,
}) => (
  <div
    className="glass-card-interactive"
    style={{
      padding: '22px 24px',
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: '#ffffff',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-sm)',
    }}
  >
    {/* Subtle leaf ambient background silhouette */}
    <div
      style={{
        position: 'absolute',
        right: '-10px',
        bottom: '-10px',
        opacity: 0.05,
        pointerEvents: 'none',
        color: '#2e9e59',
      }}
    >
      <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
      </svg>
    </div>

    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, fontFamily: "'Outfit', sans-serif" }}>
        {value}
      </div>
      {icon && <span style={{ fontSize: '20px', opacity: 0.9 }}>{icon}</span>}
    </div>

    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', fontWeight: 600 }}>
      {label}
    </div>

    <div style={{ fontSize: '11.5px', marginTop: '6px', color: subColor, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span>{sub}</span>
    </div>
  </div>
);

export default StatCard;
