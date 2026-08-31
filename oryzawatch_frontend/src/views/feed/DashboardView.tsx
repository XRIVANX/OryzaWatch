import React from 'react';
import StatCard from '../../components/common/StatCard';
import AlertChip from '../../components/common/AlertChip';
import ActivityFeed from '../../components/feed/ActivityFeed';
import WeatherWidget from '../../components/feed/WeatherWidget';
import { STATS } from '../../data/dashbaord.data';
import type { StatItem } from '../../data/dashbaord.data';
import type { User } from '../../types';

interface DashboardViewProps { user?: User | null; }

export const DashboardView: React.FC<DashboardViewProps> = ({ user }) => {
  const municipality = user?.municipality || 'ASUNCION';
  const municipalityLabel = municipality.charAt(0).toUpperCase() + municipality.slice(1).toLowerCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="layout-topbar">
        <div>
          <h1 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            Dashboard Overview
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🌱</span>
            <span>{municipalityLabel} · Davao del Norte</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <AlertChip color="#f59e0b" bg="rgba(245, 158, 11, 0.15)" border="rgba(245, 158, 11, 0.35)" icon="💧" label="High Humidity" />
          <AlertChip color="#ef4444" bg="rgba(239, 68, 68, 0.15)" border="rgba(239, 68, 68, 0.35)" icon="🔥" label="2 Hotspots" pulse />
        </div>
      </header>

      <div className="layout-content">
        <div className="grid-stats-4">
          {STATS.map((stat: StatItem, i: number) => (
            <StatCard key={i} value={stat.value} label={stat.label} sub={stat.sub} subColor={stat.subColor}
              icon={i === 0 ? '🔥' : i === 1 ? '🌾' : i === 2 ? '🎯' : '🔔'} />
          ))}
        </div>
        <div className="grid-cols-2">
          <ActivityFeed />
          <WeatherWidget municipality={municipality} />
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
