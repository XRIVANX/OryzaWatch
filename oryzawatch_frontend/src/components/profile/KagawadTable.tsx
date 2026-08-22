import React, { useState, useEffect, useCallback } from 'react';
import { usersApi } from '../../utils/api';
import type { UserListItem } from '../../types';

interface KagawadTableProps {
  onRegisterClick?: () => void;
}

const PAGE_SIZE = 10;

const formatDate = (raw: string): string => {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return raw;
  }
};

export const KagawadTable: React.FC<KagawadTableProps> = ({ onRegisterClick }) => {
  const [kagawads, setKagawads]     = useState<UserListItem[]>([]);
  const [total, setTotal]           = useState<number>(0);
  const [search, setSearch]         = useState<string>('');
  const [currentPage, setPage]     = useState<number>(1);
  const [loading, setLoading]       = useState<boolean>(true);
  const [error, setError]           = useState<string | null>(null);

  const fetchKagawads = useCallback(async (searchTerm: string, page: number) => {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const res = await usersApi.list({
        role: 'KAGAWAD',
        search: searchTerm,
        limit: PAGE_SIZE,
        offset,
      });
      setKagawads(res.data.results || []);
      setTotal(res.data.total || 0);
    } catch (err: unknown) {
      console.error('Failed to fetch real kagawads:', err);
      setError('Unable to load SK / Agri-Kagawad list. Please check your connection or session.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchKagawads(search, currentPage);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, currentPage, fetchKagawads]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleExportCSV = () => {
    if (kagawads.length === 0) return;
    const headers = ['Kagawad Code', 'Username', 'Name', 'Email', 'Phone', 'Barangay', 'Municipality', 'Registered Date', 'Scans Submitted'];
    const rows = kagawads.map(k => [
      k.user_code,
      k.username,
      `"${k.name.replace(/"/g, '""')}"`,
      k.email || '',
      k.phone_number || '',
      k.barangay,
      k.municipality,
      `"${formatDate(k.date_joined)}"`,
      k.total_scans,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `agri_kagawad_registry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            🎖️ SK / Agri-Kagawad Officials Registry
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Designated barangay agricultural and youth leaders responsible for farmer verification and field coordination.
          </p>
        </div>
        {onRegisterClick && (
          <button
            className="btn btn-leaf"
            onClick={onRegisterClick}
            style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>➕</span> Register New Kagawad
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
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
            placeholder="Search Kagawad by name, username, barangay, or phone…"
            value={search}
            onChange={handleSearchChange}
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

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn btn-outline"
            onClick={() => fetchKagawads(search, currentPage)}
            disabled={loading}
            style={{ padding: '9px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh list"
          >
            <span style={{ display: 'inline-block', transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }}>🔄</span>
            Refresh
          </button>
          <button
            className="btn btn-outline"
            onClick={handleExportCSV}
            disabled={kagawads.length === 0}
            style={{ padding: '9px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-sm)', color: 'var(--red-text)', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button className="btn btn-outline" onClick={() => fetchKagawads(search, currentPage)} style={{ padding: '4px 10px', fontSize: '12px' }}>
            Retry
          </button>
        </div>
      )}

      {/* Table Card */}
      <div className="glass-panel" style={{ overflow: 'hidden', backgroundColor: '#ffffff' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fbf9', borderBottom: '1px solid var(--border)' }}>
                {['OFFICER ID', 'KAGAWAD NAME', 'ASSIGNED BARANGAY', 'CONTACT INFO', 'ROLE / DESIGNATION', 'SCANS REPORTED', 'REGISTERED DATE'].map((h) => (
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
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid var(--border)', borderTopColor: 'var(--leaf-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: '12px', fontSize: '13px' }}>Loading SK / Agri-Kagawad officers…</p>
                  </td>
                </tr>
              ) : kagawads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '56px 20px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎖️</div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {search ? 'No Agri-Kagawads matching search' : 'No SK / Agri-Kagawad Officers Registered Yet'}
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto 16px' }}>
                      {search
                        ? 'Try searching with a different name, barangay, or phone number.'
                        : 'Register SK / Agri-Kagawad accounts to represent barangays and verify local rice fields.'}
                    </p>
                    {onRegisterClick && !search && (
                      <button className="btn btn-leaf" onClick={onRegisterClick} style={{ padding: '8px 18px', fontSize: '13px' }}>
                        ➕ Register First Kagawad
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                kagawads.map((k, i) => (
                  <tr
                    key={k.id}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      background: i % 2 === 0 ? '#ffffff' : '#fafdfb',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#ffffff' : '#fafdfb'; }}
                  >
                    <td style={{ padding: '14px 18px', fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: '#6366f1' }}>
                      {k.user_code}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {k.name.charAt(0).toUpperCase() || 'K'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{k.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{k.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{k.barangay}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{k.municipality}</div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                      <div>{k.phone_number ? `📞 ${k.phone_number}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}</div>
                      {k.email && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>✉️ {k.email}</div>}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          backgroundColor: '#ede9fe',
                          color: '#5b21b6',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          fontFamily: "'Outfit', sans-serif",
                        }}
                      >
                        <span>🎖️</span> SK / Agri-Kagawad
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {k.total_scans}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {formatDate(k.date_joined)}
                    </td>
                  </tr>
                ))
              )}
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
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing {total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, total)} of {total} Kagawad officers
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-outline"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: currentPage === n ? '1px solid #6366f1' : '1px solid var(--border)',
                    background: currentPage === n ? '#6366f1' : '#ffffff',
                    color: currentPage === n ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  {n}
                </button>
              ))}
            <button
              className="btn btn-outline"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KagawadTable;
