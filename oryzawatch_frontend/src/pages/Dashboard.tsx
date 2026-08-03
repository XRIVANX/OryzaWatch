import React from 'react';
import s from '../styles/dashboard.styles';
import { STATS, ACTIVITY, WEATHER } from '../data/dashboard.data';

interface AlertChipProps {
  color: string;
  bg: string;
  border: string;
  icon: string;
  label: string;
}

const AlertChip: React.FC<AlertChipProps> = ({ color, bg, border, icon, label }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '5px',
    background: bg, border: `1px solid ${border}`, borderRadius: '20px',
    padding: '4px 12px', fontSize: '12px', fontWeight: 600, color,
  }}>
    <span>{icon}</span>{label}
  </div>
);

const Dashboard: React.FC = () => {
  return (
    <div style={s.wrapper}>
      {/* Top bar */}
      <div style={s.topbar}>
        <div>
          <div style={s.pageTitle}>Dashboard Overview</div>
          <div style={s.pageSubtitle}>Asuncion-Carmen Corridor · Davao del Norte</div>
        </div>
        <div style={s.topbarRight}>
          <AlertChip color="#d97706" bg="#fffbeb" border="#fde68a" icon="💧" label="High Humidity" />
          <AlertChip color="#dc2626" bg="#fef2f2" border="#fecaca" icon="🔥" label="2 Hotspots" />
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {/* Stat cards */}
        <div style={s.statRow}>
          {STATS.map((stat, i) => (
            <div key={i} className="card" style={s.statCard}>
              <div style={s.statValue}>{stat.value}</div>
              <div style={s.statLabel}>{stat.label}</div>
              <div style={{ ...s.statSub, color: stat.subColor }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Bottom two panels */}
        <div style={s.panelRow}>
          {/* Recent Activity */}
          <div className="card" style={s.activityCard}>
            <div style={s.sectionLabel}>RECENT ACTIVITY</div>
            <div style={s.activityList}>
              {ACTIVITY.map((a, i) => (
                <div key={i} style={s.activityItem}>
                  <span style={{ ...s.activityDot, background: a.color }} />
                  <span style={s.activityText}>{a.text}</span>
                  <span style={s.activityTime}>{a.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weather */}
          <div className="card" style={s.weatherCard}>
            <div style={s.sectionLabel}>WEATHER · ASUNCION</div>
            <div style={s.weatherList}>
              {WEATHER.map((w, i) => (
                <div key={i} style={s.weatherRow}>
                  <span style={s.weatherLabel}>{w.label}</span>
                  <span style={{ ...s.weatherValue, ...w.valueStyle }}>{w.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
