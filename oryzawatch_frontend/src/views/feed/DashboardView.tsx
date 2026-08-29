import React from 'react';
import StatCard from '../../components/common/StatCard';
import AlertChip from '../../components/common/AlertChip';
import ActivityFeed from '../../components/feed/ActivityFeed';
import WeatherWidget from '../../components/feed/WeatherWidget';
import { STATS } from '../../data/dashbaord.data';
import type { StatItem } from '../../data/dashbaord.data';
import { dashboardApi } from '../../utils/api';

export const DashboardView: React.FC = () => {
  const [stats, setStats] = React.useState(STATS);

  React.useEffect(() => {
    dashboardApi.stats().then(({ data }) => {
      setStats((current) => current.map((stat, index) => index === 2 ? {
        ...stat,
        value: data.forecast_accuracy === null ? '—' : `${data.forecast_accuracy.toFixed(1)}%`,
        sub: data.verified_forecasts === 0 ? 'No verified forecasts yet' : `${data.verified_forecasts} forecasts verified`,
        subColor: '#9ca3af',
      } : stat));
    }).catch(() => undefined);
  }, []);

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
            <span>Asuncion Rice Field · Davao del Norte</span>
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
          {stats.map((stat: StatItem, i: number) => (
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
