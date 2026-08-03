export const s = {
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
  // ... rest of your existing styles
};
