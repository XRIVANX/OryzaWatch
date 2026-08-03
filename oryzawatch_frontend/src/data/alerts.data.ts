import { useState } from 'react';
import type { Alert, AlertSeverity } from '../types';

const ALERTS_DATA : Array<Alert> = [
  {
    id: 1,
    type: 'critical',
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
    type: 'warning',
    icon: '💧',
    title: 'High Humidity Advisory',
    time: '2 hours ago',
    message: 'Humidity levels in Carmen exceed 85%. Conditions are optimal for fungal spread over the next 48 hours.',
    actions: [],
    read: false,
  },
  {
    id: 3,
    type: 'info',
    icon: '💨',
    title: 'Wind Shift Notification',
    time: '5 hours ago',
    message: 'Prevailing winds have shifted NE. Spore dispersal cone updated for Asuncion borders.',
    actions: [],
    read: false,
  },
  {
    id: 4,
    type: 'success',
    icon: '✓',
    title: 'Treatment Success',
    time: '1 day ago',
    message: 'Farm P-41 reports 90% recovery from Brown Spot after recommended intervention.',
    actions: [],
    read: true,
  },
];

const TYPE_STYLES: Record<AlertSeverity, {
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  titleColor: string;
}> = {
  critical: {
    bg: 'var(--red-light)',
    border: 'var(--red-border)',
    iconBg: '#fca5a5',
    iconColor: '#991b1b',
    titleColor: '#991b1b',
  },
  warning: {
    bg: 'var(--orange-light)',
    border: 'var(--orange-border)',
    iconBg: '#fcd34d',
    iconColor: '#92400e',
    titleColor: '#92400e',
  },
  info: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    iconBg: '#93c5fd',
    iconColor: '#1e3a8a',
    titleColor: '#1e40af',
  },
  success: {
    bg: 'var(--green-status-light)',
    border: 'var(--green-status-border)',
    iconBg: '#86efac',
    iconColor: '#14532d',
    titleColor: '#15803d',
  },
};
