import React, { useState } from 'react';
import { ALERTS_DATA, TYPE_STYLES } from '../../data/alerts.data';
import type { Alert } from '../../types';

export const AlertsView: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>(ALERTS_DATA);
  const unread = alerts.filter((a) => !a.read).length;

  const markAllRead = () => setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
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
        <button onClick={markAllRead} className="btn btn-outline" style={{ padding: '8px 16px' }}>
          <span>✓</span> Mark all read
        </button>
      </header>

      {/* Content */}
      <div className="layout-content" style={{ maxWidth: '820px', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {alerts.map((alert) => {
            const ts = TYPE_STYLES[alert.type];
            return (
              <div
                key={alert.id}
                className="glass-panel"
                style={{
                  padding: '20px 24px',
                  border: `1px solid ${ts.border}`,
                  backgroundColor: alert.read ? '#fafdfb' : '#ffffff',
                  opacity: alert.read ? 0.8 : 1,
                  boxShadow: alert.read ? 'none' : 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-sm)',
                      background: ts.iconBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      color: ts.iconColor,
                      flexShrink: 0,
                    }}
                  >
                    {alert.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 700, color: ts.titleColor }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {alert.time}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: alert.actions.length > 0 ? '14px' : '0' }}>
                  {alert.message}
                </div>

                {alert.actions.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {alert.actions.map((action, i) => (
                      <button
                        key={i}
                        className={action.style === 'primary' ? 'btn btn-primary' : 'btn btn-outline'}
                        style={{ padding: '6px 14px', fontSize: '12.5px' }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AlertsView;
