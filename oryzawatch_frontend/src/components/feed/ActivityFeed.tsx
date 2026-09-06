import React, { useEffect, useState } from 'react';
import { alertsApi } from '../../utils/api';
import type { Alert, AlertSeverity } from '../../types';

const DOT_COLOR: Record<AlertSeverity, string> = {
  CRITICAL: '#dc2626',
  WARNING: '#d97706',
  INFO: '#2563eb',
  SUCCESS: '#16a34a',
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

const MAX_ITEMS = 5;

// Real recent-activity feed for this account: the same reports, weather
// risks, wind shifts, and broadcasts that populate /alerts, just shown as a
// compact timeline instead of full alert cards.
export const ActivityFeed: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    alertsApi.list()
      .then((res) => setAlerts(res.data.slice(0, MAX_ITEMS)))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="glass-card-interactive" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
      <div
        style={{
          fontSize: '10.5px',
          fontWeight: 800,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '18px',
          fontFamily: "'Outfit', sans-serif",
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>📡</span> RECENT ACTIVITY
      </div>

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading recent activity…</p>
      ) : alerts.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No recent activity yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {alerts.map((alert) => (
            <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: DOT_COLOR[alert.severity] ?? '#9ca3af',
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={alert.message}
              >
                {alert.message}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, flexShrink: 0 }}>
                {formatTime(alert.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
