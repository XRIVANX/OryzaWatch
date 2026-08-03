const s = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 28px 14px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-card)',
  },
  pageTitle:    { fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' },
  pageSubtitle: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' },
  topbarRight:  { display: 'flex', gap: '8px' },

  content: { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 },

  statRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
  statCard: { padding: '20px 22px' },
  statValue: { fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 },
  statLabel: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500 },
  statSub:   { fontSize: '11px', marginTop: '4px' },

  panelRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  activityCard: { padding: '20px 22px' },
  weatherCard:  { padding: '20px 22px' },

  sectionLabel: {
    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px',
  },
  activityList:  { display: 'flex', flexDirection: 'column', gap: '14px' },
  activityItem:  { display: 'flex', alignItems: 'center', gap: '10px' },
  activityDot:   { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  activityText:  { flex: 1, fontSize: '13px', color: 'var(--text-primary)' },
  activityTime:  { fontSize: '11px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' },

  weatherList:  { display: 'flex', flexDirection: 'column', gap: '14px' },
  weatherRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' },
  weatherLabel: { fontSize: '13px', color: 'var(--text-secondary)' },
  weatherValue: { fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 },
};

export default s;
