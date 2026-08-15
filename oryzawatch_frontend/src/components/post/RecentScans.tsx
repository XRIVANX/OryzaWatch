import React from 'react';
import { RECENT_SCANS } from '../../data/aiscan.data';

export const RecentScans: React.FC = () => {
  return (
    <div style={{ width: '100%', maxWidth: '520px' }}>
      <div
        style={{
          fontSize: '10.5px',
          fontWeight: 800,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '12px',
          fontFamily: "'Outfit', sans-serif",
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>🌾</span> RECENT SCANS
      </div>
      <div className="glass-panel" style={{ overflow: 'hidden', backgroundColor: '#ffffff' }}>
        {RECENT_SCANS.map((scan, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px 20px',
              borderBottom: i < RECENT_SCANS.length - 1 ? '1px solid var(--border-light)' : 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div
              style={{
                fontSize: '20px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--leaf-soft)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {scan.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {scan.disease}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {scan.location} · {scan.daysAgo}
              </div>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--leaf-primary)', fontFamily: "'Outfit', sans-serif" }}>
              {scan.confidence}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentScans;
