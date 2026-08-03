export const STATS = [
  { value: '2',   label: 'Active Hotspots',   sub: '↑ +1 this week',     subColor: '#dc2626' },
  { value: '14',  label: 'Farms at Risk',      sub: 'in spread zone',     subColor: '#9ca3af' },
  { value: '87%', label: 'Forecast Accuracy',  sub: '↑ 1 vs last season', subColor: '#16a34a' },
  { value: '312', label: 'Alerts Sent (MTD)',   sub: 'farmers notified',   subColor: '#9ca3af' },
];

export const ACTIVITY = [
  { color: '#dc2626', text: 'BLB confirmed — Brgy. Ising, Asuncion', time: '09:14' },
  { color: '#d97706', text: 'Spread cone updated — NE wind shift',    time: '09:02' },
  { color: '#d97706', text: '14 farms entered risk zone in Carmen',    time: '08:47' },
  { color: '#16a34a', text: 'Alerts dispatched to 14 farmers',        time: '08:47' },
];

export const WEATHER = [
  { label: 'Temperature', value: '31.4°C',                 valueStyle: {} },
  { label: 'Humidity',    value: '89% ⚠',                  valueStyle: { color: '#d97706' } },
  { label: 'Wind',        value: 'NE · 12 km/h',           valueStyle: {} },
  { label: 'Forecast',    value: 'Scattered Thunderstorms', valueStyle: { fontWeight: 700 } },
];
