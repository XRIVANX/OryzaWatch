import React, { useEffect, useMemo, useState } from 'react';
import StatCard from '../../components/common/StatCard';
import AlertChip from '../../components/common/AlertChip';
import ActivityFeed from '../../components/feed/ActivityFeed';
import WeatherWidget from '../../components/feed/WeatherWidget';
import { farmApi, analyticsApi, dashboardApi } from '../../utils/api';
import type { StatItem } from '../../data/dashbaord.data';
import type { User, Farm, DiseaseHotspot, DashboardStatsSummary } from '../../types';

interface DashboardViewProps { user?: User | null; }

export const DashboardView: React.FC<DashboardViewProps> = ({ user }) => {
  const municipality = user?.municipality || 'ASUNCION';
  const municipalityLabel = municipality.charAt(0).toUpperCase() + municipality.slice(1).toLowerCase();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [hotspots, setHotspots] = useState<DiseaseHotspot[]>([]);
  const [forecast, setForecast] = useState<DashboardStatsSummary | null>(null);

  useEffect(() => {
    // Farms list is Kagawad/Admin-only server-side - a Farmer viewing their
    // own dashboard simply won't get it, and the stat below degrades to 0.
    farmApi.list().then((res) => setFarms(res.data)).catch(() => undefined);
    analyticsApi.getHotspots().then((res) => setHotspots(res.data)).catch(() => undefined);
    dashboardApi.stats().then((res) => setForecast(res.data)).catch(() => undefined);
  }, []);

  const activeHotspots = useMemo(() => hotspots.filter((h) => h.is_active), [hotspots]);
  const farmsAtRisk = useMemo(() => {
    const atRiskUsernames = new Set(activeHotspots.map((h) => h.scan.reporter_username));
    return farms.filter((f) => atRiskUsernames.has(f.farmer_username)).length;
  }, [activeHotspots, farms]);

  const stats: StatItem[] = [
    {
      value: String(activeHotspots.length),
      label: 'Active Hotspots',
      sub: activeHotspots.length ? 'requires attention' : 'no active outbreaks',
      subColor: activeHotspots.length ? '#dc2626' : '#9ca3af',
    },
    {
      value: String(farmsAtRisk),
      label: 'Farms at Risk',
      sub: 'in an active hotspot',
      subColor: '#9ca3af',
    },
    {
      value: String(farms.length),
      label: 'Registered Farms',
      sub: 'with GPS + boundary on file',
      subColor: '#9ca3af',
    },
    {
      value: forecast?.forecast_accuracy != null ? `${forecast.forecast_accuracy}%` : '—',
      label: 'Forecast Accuracy',
      sub: forecast?.verified_forecasts ? `${forecast.verified_forecasts} verified forecasts` : 'No verified forecasts yet',
      subColor: '#9ca3af',
    },
  ];

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
        {activeHotspots.length > 0 && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <AlertChip
              color="#ef4444"
              bg="rgba(239, 68, 68, 0.15)"
              border="rgba(239, 68, 68, 0.35)"
              icon="🔥"
              label={`${activeHotspots.length} Active Hotspot${activeHotspots.length === 1 ? '' : 's'}`}
              pulse
            />
          </div>
        )}
      </header>

      <div className="layout-content">
        <div className="grid-stats-4">
          {stats.map((stat: StatItem, i: number) => (
            <StatCard key={i} value={stat.value} label={stat.label} sub={stat.sub} subColor={stat.subColor}
              icon={i === 0 ? '🔥' : i === 1 ? '🌾' : i === 2 ? '🗺️' : '🎯'} />
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
