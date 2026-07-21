import React, { useState } from 'react';

const ALERTS_DATA = [
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

const TYPE_STYLES = {
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

const Alerts = () => {
  const [alerts, setAlerts] = useState(ALERTS_DATA);
  const unread = alerts.filter(a => !a.read).length;

  const markAllRead = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })));

  return (
    <div style={s.wrapper}>
      {/* Top bar */}
      <div style={s.topbar}>
        <div>
          <div style={s.pageTitle}>System Alerts</div>
          <div style={s.pageSubtitle}>{unread} unread notification{unread !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={markAllRead} style={s.markAllBtn}>
          <span>✓</span> Mark all read
        </button>
      </div>

      {/* Content */}
      <div style={s.content}>
        {alerts.map(alert => {
          const ts = TYPE_STYLES[alert.type];
          return (
            <div
              key={alert.id}
              style={{
                ...s.alertCard,
                background: ts.bg,
                borderColor: ts.border,
                opacity: alert.read ? 0.7 : 1,
              }}
            >
              <div style={s.alertHeader}>
                <div style={{ ...s.alertIconWrap, background: ts.iconBg }}>
                  <span style={{ ...s.alertIcon, color: ts.iconColor }}>{alert.icon}</span>
                </div>
                <div style={s.alertMeta}>
                  <span style={{ ...s.alertTitle, color: ts.titleColor }}>{alert.title}</span>
                  <span style={s.alertTime}>{alert.time}</span>
                </div>
              </div>
              <div style={s.alertMessage}>{alert.message}</div>
              {alert.actions.length > 0 && (
                <div style={s.alertActions}>
                  {alert.actions.map((action, i) => (
                    <button
                      key={i}
                      style={action.style === 'primary' ? s.actionBtnPrimary : s.actionBtnOutline}
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
  );
};

const s = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  topbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 28px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)',
  },
  pageTitle:    { fontSize: '18px', fontWeight: 700 },
  pageSubtitle: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' },
  markAllBtn: {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '7px 14px', background: 'transparent',
    border: '1px solid var(--border)', borderRadius: '6px',
    fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer',
  },

  content: { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, maxWidth: '700px' },

  alertCard: {
    border: '1px solid', borderRadius: '12px',
    padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  alertHeader: { display: 'flex', alignItems: 'center', gap: '12px' },
  alertIconWrap: {
    width: '34px', height: '34px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  alertIcon:  { fontSize: '15px', fontWeight: 700 },
  alertMeta:  { display: 'flex', alignItems: 'baseline', gap: '10px', flex: 1, flexWrap: 'wrap' },
  alertTitle: { fontSize: '14px', fontWeight: 700 },
  alertTime:  { fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' },
  alertMessage: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, paddingLeft: '46px' },
  alertActions: { display: 'flex', gap: '8px', paddingLeft: '46px' },

  actionBtnPrimary: {
    padding: '7px 14px', background: 'var(--green-dark)', color: '#fff',
    border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
  },
  actionBtnOutline: {
    padding: '7px 14px', background: '#fff', color: 'var(--text-primary)',
    border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
  },
};

export default Alerts;
