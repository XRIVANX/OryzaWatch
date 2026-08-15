import React, { useState } from 'react';
import { FARMERS, STATUS_BADGE, TOTAL, PAGE_SIZE, TOTAL_PAGES } from '../../data/maoconsole.data';

export const FarmerTable: React.FC = () => {
  const [search, setSearch]    = useState<string>('');
  const [currentPage, setPage] = useState<number>(1);

  const filtered = FARMERS.filter((f) =>
    !search ||
    f.id.toLowerCase().includes(search.toLowerCase()) ||
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.barangay.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <svg
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            viewBox="0 0 20 20"
            fill="currentColor"
            width="16"
            height="16"
          >
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
          </svg>
          <input
            type="text"
            placeholder="Search farmers, ID, or barangay…"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              backgroundColor: '#ffffff',
              color: 'var(--text-primary)',
              fontSize: '13.5px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" style={{ padding: '9px 14px' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4-2A1 1 0 018 15v-4.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd"/>
            </svg>
            Filter
          </button>
          <button className="btn btn-leaf" style={{ padding: '9px 16px' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
            Export Data
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="glass-panel" style={{ overflow: 'hidden', backgroundColor: '#ffffff' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fbf9', borderBottom: '1px solid var(--border)' }}>
                {['FARMER ID', 'NAME', 'BARANGAY', 'STATUS', 'DETECTED DISEASE', 'LAST REPORT', 'ACTIONS'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '14px 18px',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.08em',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr
                  key={f.id}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    background: i % 2 === 0 ? '#ffffff' : '#fafdfb',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#ffffff' : '#fafdfb'; }}
                >
                  <td style={{ padding: '14px 18px', fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: 'var(--leaf-deep)' }}>
                    {f.id}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #1b6336, #237e46)',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {f.name.charAt(0)}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>{f.barangay}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className={STATUS_BADGE[f.status] || 'badge'}>{f.status}</span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    {f.disease === 'None' ? (
                      <span style={{ color: 'var(--text-muted)' }}>None</span>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>{f.disease}</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '12px' }}>{f.lastReport}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <button
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '4px',
                      }}
                      title="More actions"
                    >
                      ⋮
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            borderTop: '1px solid var(--border-light)',
            background: '#ffffff',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing 1 to {Math.min(PAGE_SIZE, filtered.length)} of {TOTAL} entries
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-outline"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: currentPage === n ? '1px solid var(--leaf-primary)' : '1px solid var(--border)',
                  background: currentPage === n ? 'var(--leaf-primary)' : '#ffffff',
                  color: currentPage === n ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                {n}
              </button>
            ))}
            <button
              className="btn btn-outline"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={() => setPage((p) => Math.min(TOTAL_PAGES, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FarmerTable;
