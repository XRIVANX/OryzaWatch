import { CSSProperties } from 'react';

const s: Record<string, CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  topbar: {
    display: 'flex', alignItems: 'center',
    padding: '18px 28px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)',
  },
  pageTitle:    { fontSize: '18px', fontWeight: 700 },
  pageSubtitle: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' },

  content: { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 },

  toolbar: { display: 'flex', alignItems: 'center', gap: '10px' },
  searchWrap: {
    position: 'relative', flex: 1, maxWidth: '340px',
  },
  searchIcon: {
    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text-muted)', pointerEvents: 'none',
  },
  searchInput: {
    width: '100%', padding: '9px 12px 9px 36px',
    border: '1px solid var(--border)', borderRadius: '8px',
    fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)',
    outline: 'none',
  },
  toolbarRight: { display: 'flex', gap: '8px', marginLeft: 'auto' },
  filterBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)',
    borderRadius: '7px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer',
  },
  exportBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px', background: 'var(--text-primary)', color: '#fff',
    border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },

  tableWrap: { overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { borderBottom: '1px solid var(--border)' },
  th: {
    padding: '11px 16px', textAlign: 'left',
    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid var(--border-light)', transition: 'background 0.1s' },
  td: { padding: '13px 16px', fontSize: '13px', color: 'var(--text-primary)', verticalAlign: 'middle' },

  farmerId: { fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' },
  farmerName: { display: 'flex', alignItems: 'center', gap: '8px' },
  avatarCircle: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: 'var(--green-light)', color: 'var(--green-dark)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', fontWeight: 700, flexShrink: 0,
  },
  lastReport: { color: 'var(--text-secondary)', fontSize: '12px' },
  moreBtn: {
    width: '28px', height: '28px', background: 'transparent', border: 'none',
    borderRadius: '4px', cursor: 'pointer', fontSize: '18px', color: 'var(--text-muted)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  pagination: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderTop: '1px solid var(--border)',
  },
  paginationInfo:     { fontSize: '12px', color: 'var(--text-secondary)' },
  paginationControls: { display: 'flex', gap: '4px', alignItems: 'center' },
  pageBtn: {
    padding: '5px 11px', background: 'transparent', border: '1px solid var(--border)',
    borderRadius: '5px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  pageBtnActive: {
    background: 'var(--text-primary)', color: '#fff', borderColor: 'var(--text-primary)',
  },
};

export default s;
