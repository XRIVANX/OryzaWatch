import React, { useCallback, useEffect, useState } from 'react';
import { alertsApi, analyticsApi } from '../../utils/api';
import type { Alert, AlertSeverity, User } from '../../types';

interface AlertsViewProps {
  user?: User | null;
  onViewOnMap?: (hotspotId: number) => void;
}

const TYPE_STYLES: Record<AlertSeverity, { border: string; iconBg: string; iconColor: string; titleColor: string; icon: string }> = {
  CRITICAL: { border: 'var(--red-border)', iconBg: '#fca5a5', iconColor: '#991b1b', titleColor: '#991b1b', icon: '⚠' },
  WARNING: { border: 'var(--orange-border)', iconBg: '#fcd34d', iconColor: '#92400e', titleColor: '#92400e', icon: '💧' },
  INFO: { border: '#bfdbfe', iconBg: '#93c5fd', iconColor: '#1e3a8a', titleColor: '#1e40af', icon: '💨' },
  SUCCESS: { border: 'var(--green-status-border)', iconBg: '#86efac', iconColor: '#14532d', titleColor: '#15803d', icon: '✓' },
};

const BROADCAST_SCOPES: { value: 'BARANGAY' | 'MUNICIPALITY' | 'ALL'; label: string }[] = [
  { value: 'BARANGAY', label: 'This Barangay' },
  { value: 'MUNICIPALITY', label: 'This Municipality' },
  { value: 'ALL', label: 'All Farmers' },
];

const formatTime = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

export const AlertsView: React.FC<AlertsViewProps> = ({ user, onViewOnMap }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [broadcastFor, setBroadcastFor] = useState<Alert | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  const canBroadcast = user?.role === 'KAGAWAD' || user?.role === 'MAO_ADMIN';
  const unread = alerts.filter((a) => !a.is_read).length;

  const fetchAlerts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await alertsApi.list();
      setAlerts(res.data);
    } catch {
      if (!silent) setError('Unable to load alerts. Please check your connection or login session.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Real-time-ish: re-poll in the background while this page is open, so new
  // reports/broadcasts/weather advisories show up without a manual refresh,
  // plus an immediate refresh whenever the tab regains focus.
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => fetchAlerts(true), 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchAlerts(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchAlerts]);

  const markAllRead = async () => {
    const unreadAlerts = alerts.filter((a) => !a.is_read);
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    await Promise.all(unreadAlerts.map((a) => alertsApi.markRead(a.id).catch(() => undefined)));
  };

  const markOneRead = async (alert: Alert) => {
    if (alert.is_read) return;
    setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, is_read: true } : a)));
    try {
      await alertsApi.markRead(alert.id);
    } catch {
      // best-effort; leave it marked read locally
    }
  };

  const handleBroadcast = async (scope: 'BARANGAY' | 'MUNICIPALITY' | 'ALL') => {
    if (!broadcastFor?.hotspot) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await analyticsApi.broadcast(broadcastFor.hotspot, scope);
      setBroadcastResult(`Broadcast sent to ${res.data.notified} farmer${res.data.notified === 1 ? '' : 's'}.`);
    } catch (err: any) {
      setBroadcastResult(err?.response?.data?.detail ?? 'Could not send broadcast.');
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="layout-topbar">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            System Alerts
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🔔</span>
            <span>{unread} unread notification{unread !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <button onClick={markAllRead} className="btn btn-outline" style={{ padding: '8px 16px' }} disabled={unread === 0}>
          <span>✓</span> Mark all read
        </button>
      </header>

      <div className="layout-content" style={{ maxWidth: '820px', width: '100%' }}>
        {error && (
          <div style={{ padding: '12px 16px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-sm)', color: 'var(--red-text)', fontSize: '13px', marginBottom: '16px' }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading alerts…</div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔔</div>
            <p style={{ fontSize: '13px' }}>No alerts yet. Outbreak reports, broadcasts and weather advisories will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {alerts.map((alert) => {
              const ts = TYPE_STYLES[alert.severity];
              return (
                <div
                  key={alert.id}
                  className="glass-panel"
                  style={{
                    padding: '20px 24px',
                    border: `1px solid ${ts.border}`,
                    backgroundColor: alert.is_read ? '#fafdfb' : '#ffffff',
                    opacity: alert.is_read ? 0.8 : 1,
                    boxShadow: alert.is_read ? 'none' : 'var(--shadow-sm)',
                  }}
                  onClick={() => markOneRead(alert)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', background: ts.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: ts.iconColor, flexShrink: 0 }}>
                      {ts.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14.5px', fontWeight: 700, color: ts.titleColor }}>{alert.title}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{formatTime(alert.created_at)}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: alert.hotspot ? '14px' : '0' }}>
                    {alert.message}
                  </div>

                  {alert.hotspot && (
                    <div style={{ display: 'flex', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '6px 14px', fontSize: '12.5px' }}
                        onClick={() => onViewOnMap?.(alert.hotspot as number)}
                      >
                        View on Map
                      </button>
                      {canBroadcast && (
                        <button
                          className="btn btn-outline"
                          style={{ padding: '6px 14px', fontSize: '12.5px' }}
                          onClick={() => { setBroadcastFor(alert); setBroadcastResult(null); }}
                        >
                          Broadcast Alert
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {broadcastFor && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(12,30,20,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setBroadcastFor(null)}
        >
          <div
            className="glass-panel"
            style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', width: 'min(420px, 90vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)' }}>Broadcast Alert</h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>{broadcastFor.message}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {BROADCAST_SCOPES.map((s) => (
                <button
                  key={s.value}
                  className="btn btn-outline"
                  disabled={broadcasting}
                  onClick={() => handleBroadcast(s.value)}
                  style={{ padding: '10px 14px', fontSize: '13px', textAlign: 'left' }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {broadcastResult && (
              <p style={{ fontSize: '12.5px', color: 'var(--leaf-primary)', marginTop: '14px', fontWeight: 600 }}>{broadcastResult}</p>
            )}
            <button className="btn btn-outline" style={{ marginTop: '16px', padding: '8px 14px', fontSize: '12.5px', width: '100%' }} onClick={() => setBroadcastFor(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsView;
