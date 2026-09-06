// Legend key for the Disease Map's severity colors. The map itself now
// renders real farms (GET /api/farms/) and real hotspots
// (GET /api/analytics/hotspots/) — see views/post/DiseaseMapView.tsx.
export const LEGEND = [
  { color: '#dc2626', label: 'Critical Outbreak' },
  { color: '#f97316', label: 'At-Risk Zone' },
  { color: '#2563eb', label: 'Monitoring' },
  { color: '#6b7280', label: 'Resolved' },
  { color: '#86efac', label: 'Registered Farm' },
];
