import { CSSProperties } from 'react';

const s: Record<string, CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  topbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 28px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)',
  },
  pageTitle:    { fontSize: '18px', fontWeight: 700 },
  pageSubtitle: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' },

  content: { padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 },

  tabs: { display: 'flex', gap: '8px' },
  tab: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '7px 16px', borderRadius: '20px', border: '1px solid var(--border)',
    background: 'transparent', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.15s',
  },
  tabActive: {
    background: 'var(--green-dark)', color: '#fff', border: '1px solid var(--green-dark)',
  },
  tabDot: {
    width: '7px', height: '7px', borderRadius: '50%', background: '#fff',
  },

  mapRow: { display: 'flex', gap: '20px', flex: 1 },
  mapCard: { flex: 1, padding: '12px', overflow: 'hidden' },

  rightPanel: {
    width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px',
  },
  rpTitle:    { fontSize: '16px', fontWeight: 700 },
  rpSubtitle: { fontSize: '11px', color: 'var(--text-secondary)', marginTop: '-12px' },

  rpSection: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '14px',
  },
  rpSectionTitle: {
    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px',
  },
  rpRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' },
  rpLabel: { fontSize: '12px', color: 'var(--text-secondary)' },
  rpValue: { fontSize: '12px', color: 'var(--text-primary)', textAlign: 'right', maxWidth: '110px' },

  legendList: { display: 'flex', flexDirection: 'column', gap: '7px' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  legendDot:  { width: '12px', height: '12px', borderRadius: '3px', flexShrink: 0 },
  legendLabel:{ fontSize: '11px', color: 'var(--text-secondary)' },
};

export default s;
