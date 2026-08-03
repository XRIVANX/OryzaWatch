import { CSSProperties } from 'react';

const s: Record<string, CSSProperties> = {
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

export default s;
