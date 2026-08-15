import React from 'react';
import StatCard from '../../components/common/StatCard';
import AlertChip from '../../components/common/AlertChip';
import ActivityFeed from '../../components/feed/ActivityFeed';
import WeatherWidget from '../../components/feed/WeatherWidget';
import { STATS } from '../../data/dashbaord.data';
import type { StatItem } from '../../data/dashbaord.data';

export const DashboardView: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <header className="layout-topbar">
        <div>
          <h1 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            Dashboard Overview
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🌱</span>
            <span>Asuncion-Carmen Corridor · Davao del Norte</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <AlertChip color="#f59e0b" bg="rgba(245, 158, 11, 0.15)" border="rgba(245, 158, 11, 0.35)" icon="💧" label="High Humidity" />
          <AlertChip color="#ef4444" bg="rgba(239, 68, 68, 0.15)" border="rgba(239, 68, 68, 0.35)" icon="🔥" label="2 Hotspots" pulse />
        </div>
      </header>

      {/* Content */}
      <div className="layout-content">
        {/* Stat Cards */}
        <div className="grid-stats-4">
          {STATS.map((stat: StatItem, i: number) => (
            <StatCard
              key={i}
              value={stat.value}
              label={stat.label}
              sub={stat.sub}
              subColor={stat.subColor}
              icon={i === 0 ? '🔥' : i === 1 ? '🌾' : i === 2 ? '🎯' : '🔔'}
            />
          ))}
        </div>

        {/* Bottom Two Panels */}
        <div className="grid-cols-2">
          <ActivityFeed />
          <WeatherWidget />
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
