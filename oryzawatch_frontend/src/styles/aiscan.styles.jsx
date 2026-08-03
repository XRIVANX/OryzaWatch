const s = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  topbar: {
    display: 'flex', alignItems: 'center', padding: '18px 28px 14px',
    borderBottom: '1px solid var(--border)', background: 'var(--bg-card)',
  },
  pageTitle:    { fontSize: '18px', fontWeight: 700 },
  pageSubtitle: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' },

  content: { padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', flex: 1 },

  uploadOuter: { width: '100%', maxWidth: '420px' },
  uploadCard: {
    border: '2px dashed #93c5fd', borderRadius: '16px',
    padding: '28px 24px 20px', background: '#f0f7ff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
  },

  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '12px 0' },
  cameraCircle: {
    width: '60px', height: '60px', borderRadius: '50%',
    background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle:    { fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' },
  emptySubtitle: { fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 },

  previewBox: { width: '100%', display: 'flex', justifyContent: 'center' },
  previewImg: { maxWidth: '100%', maxHeight: '200px', borderRadius: '10px', objectFit: 'contain' },

  resultBanner: {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    border: '1px solid', fontSize: '13px', fontWeight: 500, textAlign: 'center',
  },

  captureBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '11px', background: 'var(--green-dark)', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
  galleryBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '11px', background: '#fff', color: 'var(--text-primary)',
    border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
  },

  recentSection: { width: '100%', maxWidth: '520px' },
  sectionLabel: {
    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px',
  },
  scanList: { overflow: 'hidden' },
  scanItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px' },
  scanIcon: { fontSize: '22px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--green-light)', borderRadius: '8px' },
  scanInfo: { flex: 1 },
  scanDisease:  { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' },
  scanLocation: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' },
  scanConfidence: { fontSize: '14px', fontWeight: 700, color: 'var(--green-dark)' },
};

export default s;