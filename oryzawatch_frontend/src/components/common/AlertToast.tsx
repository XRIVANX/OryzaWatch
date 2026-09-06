import React, { useEffect } from 'react';
import type { Alert, AlertSeverity } from '../../types';

interface AlertToastProps {
  alert: Alert | null;
  onDismiss: () => void;
  onView: () => void;
}

const SEVERITY_BG: Record<AlertSeverity, string> = {
  CRITICAL: '#dc2626',
  WARNING: '#d97706',
  INFO: '#2563eb',
  SUCCESS: '#16a34a',
};

const SEVERITY_ICON: Record<AlertSeverity, string> = {
  CRITICAL: '⚠',
  WARNING: '⚠',
  INFO: '💨',
  SUCCESS: '✓',
};

const AUTO_DISMISS_MS = 6000;

// Real-time-ish popup for a freshly-arrived alert (App.tsx polls and diffs
// seen ids). Auto-dismisses; clicking jumps to the Alerts page.
export const AlertToast: React.FC<AlertToastProps> = ({ alert, onDismiss, onView }) => {
  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [alert, onDismiss]);

  if (!alert) return null;
  const bg = SEVERITY_BG[alert.severity] ?? SEVERITY_BG.INFO;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 2000,
        width: 'min(360px, 90vw)',
        background: bg,
        color: '#ffffff',
        borderRadius: '14px',
        padding: '14px 16px',
        boxShadow: '0 12px 28px rgba(0,0,0,0.28)',
        cursor: 'pointer',
        animation: 'ow-toast-in 0.25s ease-out',
      }}
      onClick={onView}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ fontSize: '16px', flexShrink: 0 }}>{SEVERITY_ICON[alert.severity]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 800 }}>{alert.title}</div>
          <div style={{ fontSize: '12px', marginTop: '3px', lineHeight: 1.5, opacity: 0.94 }}>
            {alert.message}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.85)',
            fontSize: '15px',
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default AlertToast;
