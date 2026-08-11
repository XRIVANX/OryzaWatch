import type { Alert, AlertSeverity } from '../types';

export const ALERTS_DATA: Alert[] = [
  {
    id: 1,
    type: 'CRITICAL',
    icon: '⚠',
    title: 'Bacterial Leaf Blight Detected',
    time: '10 minutes ago',
    message: 'Multiple farms in Brgy. Ising have reported symptoms matching BLB. Implement quarantine measures.',
    actions: [
      { label: 'View on Map', style: 'primary' },
      { label: 'Broadcast Alert', style: 'outline' },
    ],
    read: false,
  },
  {
    id: 2,
    type: 'WARNING',
    icon: '💧',
    title: 'High Humidity Advisory',
    time: '2 hours ago',
    message: 'Humidity levels in Carmen exceed 85%. Conditions are optimal for fungal spread over the next 48 hours.',
    actions: [],
    read: false,
  },
  {
    id: 3,
    type: 'INFO',
    icon: '💨',
    title: 'Wind Shift Notification',
    time: '5 hours ago',
    message: 'Prevailing winds have shifted NE. Spore dispersal cone updated for Asuncion borders.',
    actions: [],
    read: false,
  },
  {
    id: 4,
    type: 'SUCCESS',
    icon: '✓',
    title: 'Treatment Success',
    time: '1 day ago',
    message: 'Farm P-41 reports 90% recovery from Brown Spot after recommended intervention.',
    actions: [],
    read: true,
  },
];

export const TYPE_STYLES: Record<AlertSeverity, {
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  titleColor: string;
}> = {
  CRITICAL: {
    bg: 'var(--red-light)',
    border: 'var(--red-border)',
    iconBg: '#fca5a5',
    iconColor: '#991b1b',
    titleColor: '#991b1b',
  },
  WARNING: {
    bg: 'var(--orange-light)',
    border: 'var(--orange-border)',
    iconBg: '#fcd34d',
    iconColor: '#92400e',
    titleColor: '#92400e',
  },
  INFO: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    iconBg: '#93c5fd',
    iconColor: '#1e3a8a',
    titleColor: '#1e40af',
  },
  SUCCESS: {
    bg: 'var(--green-status-light)',
    border: 'var(--green-status-border)',
    iconBg: '#86efac',
    iconColor: '#14532d',
    titleColor: '#15803d',
  },
};
