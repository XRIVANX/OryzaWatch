import React from 'react';

const STATS = [
  { value: '2',   label: 'Active Hotspots',   sub: '↑ +1 this week',  subColor: '#dc2626' },
  { value: '14',  label: 'Farms at Risk',      sub: 'in spread zone',  subColor: '#9ca3af' },
  { value: '87%', label: 'Forecast Accuracy',  sub: '↑ 1 vs last season', subColor: '#16a34a' },
  { value: '312', label: 'Alerts Sent (MTD)',   sub: 'farmers notified', subColor: '#9ca3af' },
];

const ACTIVITY = [
  { color: '#dc2626', text: 'BLB confirmed — Brgy. Ising, Asuncion',    time: '09:14' },
  { color: '#d97706', text: 'Spread cone updated — NE wind shift',       time: '09:02' },
  { color: '#d97706', text: '14 farms entered risk zone in Carmen',       time: '08:47' },
  { color: '#16a34a', text: 'Alerts dispatched to 14 farmers',           time: '08:47' },
];

const WEATHER = [
  { label: 'Temperature', value: '31.4°C',                 valueStyle: {} },
  { label: 'Humidity',    value: '89% ⚠',                  valueStyle: { color: '#d97706' } },
  { label: 'Wind',        value: 'NE · 12 km/h',           valueStyle: {} },
  { label: 'Forecast',    value: 'Scattered Thunderstorms', valueStyle: { fontWeight: 700 } },
];

const Dashboard = () => {
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

const AlertChip = ({ color, bg, border, icon, label }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '5px',
    background: bg, border: `1px solid ${border}`, borderRadius: '20px',
    padding: '4px 12px', fontSize: '12px', fontWeight: 600, color,
  }}>
    <span>{icon}</span>{label}
  </div>
);

const s = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 28px 14px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-card)',
  },
  pageTitle:    { fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' },
  pageSubtitle: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' },
  topbarRight:  { display: 'flex', gap: '8px' },

  content: { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 },

  statRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
  statCard: { padding: '20px 22px' },
  statValue: { fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 },
  statLabel: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500 },
  statSub:   { fontSize: '11px', marginTop: '4px' },

  panelRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  activityCard: { padding: '20px 22px' },
  weatherCard:  { padding: '20px 22px' },

  sectionLabel: {
    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px',
  },
  activityList:  { display: 'flex', flexDirection: 'column', gap: '14px' },
  activityItem:  { display: 'flex', alignItems: 'center', gap: '10px' },
  activityDot:   { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  activityText:  { flex: 1, fontSize: '13px', color: 'var(--text-primary)' },
  activityTime:  { fontSize: '11px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' },

  weatherList:  { display: 'flex', flexDirection: 'column', gap: '14px' },
  weatherRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' },
  weatherLabel: { fontSize: '13px', color: 'var(--text-secondary)' },
  weatherValue: { fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 },
};

export default Dashboard;
