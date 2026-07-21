import React, { useState } from 'react';

const FARMERS = [
  { id: 'F-102', name: 'Juan Dela Cruz',  barangay: 'Ising',    status: 'Critical',   disease: 'BLB',        lastReport: 'Today, 09:14 AM' },
  { id: 'F-045', name: 'Maria Santos',    barangay: 'Birungan', status: 'At Risk',    disease: 'None',       lastReport: 'Yesterday' },
  { id: 'F-218', name: 'Pedro Garcia',    barangay: 'San Pedro',status: 'Safe',       disease: 'None',       lastReport: '3 days ago' },
  { id: 'F-156', name: 'Luis Reyes',      barangay: 'Ising',    status: 'Critical',   disease: 'BLB',        lastReport: 'Today, 06:30 AM' },
  { id: 'F-092', name: 'Elena Cruz',      barangay: 'Mangalcal',status: 'Monitoring', disease: 'Brown Spot', lastReport: '2 days ago' },
];

const STATUS_BADGE = {
  'Critical':   'badge badge-red',
  'At Risk':    'badge badge-orange',
  'Safe':       'badge badge-green',
  'Monitoring': 'badge badge-blue',
};

const TOTAL = 248;
const PAGE_SIZE = 5;
const TOTAL_PAGES = Math.ceil(TOTAL / PAGE_SIZE);

const MAOConsole = () => {
  const [search, setSearch]       = useState('');
  const [currentPage, setPage]    = useState(1);

  const filtered = FARMERS.filter(f =>
    !search ||
    f.id.toLowerCase().includes(search.toLowerCase()) ||
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.barangay.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={s.wrapper}>
      {/* Top bar */}
      <div style={s.topbar}>
        <div>
          <div style={s.pageTitle}>MAO Admin Console</div>
          <div style={s.pageSubtitle}>Municipal Agriculture Office · Carmen</div>
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {/* Toolbar */}
        <div style={s.toolbar}>
          <div style={s.searchWrap}>
            <svg style={s.searchIcon} viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input
              type="text"
              placeholder="Search farmers, ID, or barangay…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={s.searchInput}
            />
          </div>
          <div style={s.toolbarRight}>
            <button style={s.filterBtn}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4-2A1 1 0 018 15v-4.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd"/>
              </svg>
              Filter
            </button>
            <button style={s.exportBtn}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
              Export Data
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                {['FARMER ID', 'NAME', 'BARANGAY', 'STATUS', 'DETECTED DISEASE', 'LAST REPORT', 'ACTIONS'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr key={f.id} style={{ ...s.tr, background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={s.td}><span style={s.farmerId}>{f.id}</span></td>
                  <td style={s.td}>
                    <div style={s.farmerName}>
                      <div style={s.avatarCircle}>{f.name.charAt(0)}</div>
                      {f.name}
                    </div>
                  </td>
                  <td style={s.td}>{f.barangay}</td>
                  <td style={s.td}>
                    <span className={STATUS_BADGE[f.status]}>{f.status}</span>
                  </td>
                  <td style={s.td}>{f.disease === 'None' ? <span style={{ color: 'var(--text-muted)' }}>None</span> : f.disease}</td>
                  <td style={s.td}><span style={s.lastReport}>{f.lastReport}</span></td>
                  <td style={s.td}>
                    <button style={s.moreBtn} title="More actions">⋮</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={s.pagination}>
            <span style={s.paginationInfo}>Showing 1 to {Math.min(PAGE_SIZE, filtered.length)} of {TOTAL} entries</span>
            <div style={s.paginationControls}>
              <button style={s.pageBtn} onClick={() => setPage(p => Math.max(1, p-1))}>Prev</button>
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  style={{ ...s.pageBtn, ...(currentPage === n ? s.pageBtnActive : {}) }}
                >
                  {n}
                </button>
              ))}
              <button style={s.pageBtn} onClick={() => setPage(p => Math.min(TOTAL_PAGES, p+1))}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const s = {
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

export default MAOConsole;
