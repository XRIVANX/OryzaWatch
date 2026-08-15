import React from 'react';
import { ACTIVITY } from '../../data/dashbaord.data';
import type { ActivityItem } from '../../data/dashbaord.data';

export const ActivityFeed: React.FC = () => {
  return (
    <div className="glass-card-interactive" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
      <div
        style={{
          fontSize: '10.5px',
          fontWeight: 800,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '18px',
          fontFamily: "'Outfit', sans-serif",
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>📡</span> RECENT ACTIVITY
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {ACTIVITY.map((a: ActivityItem, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                flexShrink: 0,
                background: a.color,
              }}
            />
            <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
              {a.text}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
              {a.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityFeed;
