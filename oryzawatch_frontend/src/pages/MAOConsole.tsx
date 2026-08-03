import React, { useState } from 'react';
import s from '../styles/maoconsole.styles.jsx';
import { FARMERS, STATUS_BADGE, TOTAL, PAGE_SIZE, TOTAL_PAGES } from '../data/maoconsole.data';

const MAOConsole: React.FC = () => {
  const [search, setSearch]    = useState<string>('');
  const [currentPage, setPage] = useState<number>(1);

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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
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
                    <span className={STATUS_BADGE[f.status] || 'badge'}>{f.status}</span>
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
              <button style={s.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  style={{ ...s.pageBtn, ...(currentPage === n ? s.pageBtnActive : {}) }}
                >
                  {n}
                </button>
              ))}
              <button style={s.pageBtn} onClick={() => setPage(p => Math.min(TOTAL_PAGES, p + 1))}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MAOConsole;
