export const FARMERS = [
  { id: 'F-102', name: 'Juan Dela Cruz',  barangay: 'Ising',     status: 'Critical',   disease: 'BLB',        lastReport: 'Today, 09:14 AM' },
  { id: 'F-045', name: 'Maria Santos',    barangay: 'Birungan',  status: 'At Risk',    disease: 'None',       lastReport: 'Yesterday' },
  { id: 'F-218', name: 'Pedro Garcia',    barangay: 'San Pedro', status: 'Safe',       disease: 'None',       lastReport: '3 days ago' },
  { id: 'F-156', name: 'Luis Reyes',      barangay: 'Ising',     status: 'Critical',   disease: 'BLB',        lastReport: 'Today, 06:30 AM' },
  { id: 'F-092', name: 'Elena Cruz',      barangay: 'Mangalcal', status: 'Monitoring', disease: 'Brown Spot', lastReport: '2 days ago' },
];

export const STATUS_BADGE: Record<string, string> = {
  'Critical':   'badge badge-red',
  'At Risk':    'badge badge-orange',
  'Safe':       'badge badge-green',
  'Monitoring': 'badge badge-blue',
};

export const TOTAL = 248;
export const PAGE_SIZE = 5;
export const TOTAL_PAGES = Math.ceil(TOTAL / PAGE_SIZE);