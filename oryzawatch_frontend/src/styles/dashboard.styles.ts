import { CSSProperties } from 'react';

const s = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' } as CSSProperties,
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 28px 14px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-card)',
  } as CSSProperties,
  pageTitle:    { fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' } as CSSProperties,
  pageSubtitle: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' } as CSSProperties,
  topbarRight:  { display: 'flex', gap: '8px' } as CSSProperties,

  content: { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 } as CSSProperties,

  statRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' } as CSSProperties,
  statCard: { padding: '20px 22px' } as CSSProperties,
  statValue: { fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 } as CSSProperties,
  statLabel: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500 } as CSSProperties,
  statSub:   { fontSize: '11px', marginTop: '4px' } as CSSProperties,

  panelRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } as CSSProperties,
  activityCard: { padding: '20px 22px' } as CSSProperties,
  weatherCard:  { padding: '20px 22px' } as CSSProperties,

  sectionLabel: {
    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px',
  } as CSSProperties,
  activityList:  { display: 'flex', flexDirection: 'column', gap: '14px' } as CSSProperties,
  activityItem:  { display: 'flex', alignItems: 'center', gap: '10px' } as CSSProperties,
  activityDot:   { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 } as CSSProperties,
  activityText:  { flex: 1, fontSize: '13px', color: 'var(--text-primary)' } as CSSProperties,
  activityTime:  { fontSize: '11px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' } as CSSProperties,

  weatherList:  { display: 'flex', flexDirection: 'column', gap: '14px' } as CSSProperties,
  weatherRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' } as CSSProperties,
  weatherLabel: { fontSize: '13px', color: 'var(--text-secondary)' } as CSSProperties,
  weatherValue: { fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 } as CSSProperties,
};

export default s;
