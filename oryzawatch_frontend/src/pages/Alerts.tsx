import { useState } from 'react';
import s from '../styles/alerts.styles.jsx';
import type { Alert } from '../types';


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


export default Alerts;
