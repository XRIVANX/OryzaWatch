import React from 'react';
import { WEATHER } from '../../data/dashbaord.data';
import type { WeatherItem } from '../../data/dashbaord.data';

export const WeatherWidget: React.FC = () => {
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
        <span>🌦</span> WEATHER · ASUNCION
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {WEATHER.map((w: WeatherItem, i: number) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: i < WEATHER.length - 1 ? '1px solid var(--border-light)' : 'none',
              paddingBottom: i < WEATHER.length - 1 ? '12px' : '0',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{w.label}</span>
            <span style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 600, ...w.valueStyle }}>
              {w.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeatherWidget;
