// ─── Types ───────────────────────────────────────────────────────────────────
// Defined here so Dashboard.tsx .map() callbacks are never implicitly `any`

export interface StatItem {
  value: string;
  label: string;
  sub: string;
  subColor: string;
}

export interface ActivityItem {
  color: string;
  text: string;
  time: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

export const STATS: StatItem[] = [
  { value: '2',   label: 'Active Hotspots',  sub: '↑ +1 this week',     subColor: '#dc2626' },
  { value: '14',  label: 'Farms at Risk',    sub: 'in spread zone',      subColor: '#9ca3af' },
  { value: '—',   label: 'Forecast Accuracy', sub: 'No verified forecasts yet', subColor: '#9ca3af' },
  { value: '312', label: 'Alerts Sent (MTD)',sub: 'farmers notified',     subColor: '#9ca3af' },
];

export const ACTIVITY: ActivityItem[] = [
  { color: '#dc2626', text: 'BLB confirmed — Brgy. Ising, Asuncion', time: '09:14' },
  { color: '#d97706', text: 'Spread cone updated — NE wind shift',   time: '09:02' },
  { color: '#d97706', text: '14 farms entered risk zone in Asuncion',  time: '08:47' },
  { color: '#16a34a', text: 'Alerts dispatched to 14 farmers',       time: '08:47' },
];

