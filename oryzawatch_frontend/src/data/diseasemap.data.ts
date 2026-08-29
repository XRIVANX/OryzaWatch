export const TABS = ['Carmen Rice Fields', 'Asuncion Rice Fields'];

export const LEGEND = [
  { color: '#dc2626', label: 'Confirmed Hotspot (P1)' },
  { color: '#f87171', label: '24h Forecast Zone' },
  { color: '#fb923c', label: '48h Forecast Zone' },
  { color: '#fbbf24', label: 'Farms at Risk' },
  { color: '#86efac', label: 'Safe Farms (Low Risk)' },
];

export const FIELD_AREAS = {
  carmen: {
    title: 'Carmen Overview',
    subtitle: 'Real-time disease spread analysis',
    primaryThreat: 'Bacterial Leaf Blight',
    severity: 'High (Level 4)',
    spreadVelocity: '4.2 km / day',
    center: [7.3607, 125.7067] as [number, number],
    hotspot: [7.3589, 125.7009] as [number, number],
    fieldName: 'Carmen Rice Fields',
  },
  asuncion: {
    title: 'Asuncion Overview',
    subtitle: 'Real-time disease spread analysis',
    primaryThreat: 'Bacterial Leaf Blight',
    severity: 'Moderate (Level 2)',
    spreadVelocity: '1.8 km / day',
    center: [7.5859, 125.7526] as [number, number],
    hotspot: [7.5838, 125.7485] as [number, number],
    fieldName: 'Asuncion Rice Fields',
  },
} as const;

export type FieldAreaKey = keyof typeof FIELD_AREAS;
