import React, { useState, useEffect, useCallback } from 'react';
import { usersApi, farmApi, analyticsApi } from '../../utils/api';
import FarmBoundaryEditor from './FarmBoundaryEditor';
import type { UserListItem, Farm } from '../../types';

const STATUS_BADGE: Record<string, string> = {
  'Critical':   'badge badge-red',
  'At Risk':    'badge badge-orange',
  'Safe':       'badge badge-green',
  'Monitoring': 'badge badge-blue',
};

interface FarmerTableProps {
  onRegisterClick?: () => void;
}

const PAGE_SIZE = 10;

const formatReportDate = (raw: string): string => {
  if (!raw || raw === 'No scans yet') return 'No scans yet';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return raw;
  }
};

export const FarmerTable: React.FC<FarmerTableProps> = ({ onRegisterClick }) => {
  const [farmers, setFarmers]       = useState<UserListItem[]>([]);
  const [total, setTotal]           = useState<number>(0);
  const [search, setSearch]         = useState<string>('');
  const [currentPage, setPage]     = useState<number>(1);
  const [loading, setLoading]       = useState<boolean>(true);
  const [error, setError]           = useState<string | null>(null);
  const [farms, setFarms]           = useState<Farm[]>([]);
  const [editingFarmer, setEditingFarmer] = useState<UserListItem | null>(null);
  const [updatingHotspotId, setUpdatingHotspotId] = useState<number | null>(null);

  const handleMarkSafe = async (farmer: UserListItem) => {
    if (!farmer.active_hotspot_id) return;
    setUpdatingHotspotId(farmer.active_hotspot_id);
    try {
      await analyticsApi.updateStatus(farmer.active_hotspot_id, 'RESOLVED');
      setFarmers((prev) =>
        prev.map((f) => (f.id === farmer.id ? { ...f, status: 'Safe', active_hotspot_id: null } : f))
      );
    } catch (err) {
      console.error('Failed to mark farmer safe:', err);
    } finally {
      setUpdatingHotspotId(null);
    }
  };

  const fetchFarms = useCallback(async () => {
    try {
      const res = await farmApi.list();
      setFarms(res.data);
    } catch (err) {
      console.error('Failed to fetch farms:', err);
    }
  }, []);

  useEffect(() => {
    fetchFarms();
  }, [fetchFarms]);

  const fetchFarmers = useCallback(async (searchTerm: string, page: number) => {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const res = await usersApi.list({
        role: 'FARMER',
        search: searchTerm,
        limit: PAGE_SIZE,
        offset,
      });
      setFarmers(res.data.results || []);
      setTotal(res.data.total || 0);
    } catch (err: unknown) {
      console.error('Failed to fetch real farmers:', err);
      setError('Unable to load farmers list. Please check your connection or login session.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFarmers(search, currentPage);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, currentPage, fetchFarmers]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleExportCSV = () => {
    if (farmers.length === 0) return;
    const headers = ['Farmer Code', 'Username', 'Name', 'Email', 'Phone', 'Barangay', 'Municipality', 'Status', 'Detected Disease', 'Total Scans', 'Last Report'];
    const rows = farmers.map(f => [
      f.user_code,
      f.username,
      `"${f.name.replace(/"/g, '""')}"`,
      f.email || '',
      f.phone_number || '',
      f.barangay,
      f.municipality,
      f.status,
      f.disease,
      f.total_scans,
      `"${f.last_report}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `farmers_registry_${new Date().toISOString().slice(0, 10)}.csv`);
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
            🌾 Registered Farmers Registry
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Real-time registered rice farmers in the municipality, including crop diagnostic history.
          </p>
        </div>
        {onRegisterClick && (
          <button
            className="btn btn-leaf"
            onClick={onRegisterClick}
            style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>➕</span> Register New Farmer
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
            placeholder="Search farmers by name, username, phone, or barangay…"
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
            onClick={() => fetchFarmers(search, currentPage)}
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
            disabled={farmers.length === 0}
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
          <button className="btn btn-outline" onClick={() => fetchFarmers(search, currentPage)} style={{ padding: '4px 10px', fontSize: '12px' }}>
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
                {['FARMER ID', 'FARMER NAME', 'BARANGAY', 'PHONE NUMBER', 'CROP STATUS', 'LATEST DIAGNOSIS', 'SCANS', 'LAST REPORT', 'FARM'].map((h) => (
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
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid var(--border)', borderTopColor: 'var(--leaf-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: '12px', fontSize: '13px' }}>Loading real registered farmers…</p>
                  </td>
                </tr>
              ) : farmers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '56px 20px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🌾</div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {search ? 'No farmers matching search' : 'No Farmers Registered Yet'}
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '360px', margin: '0 auto 16px' }}>
                      {search
                        ? 'Try searching with a different name, barangay, or phone number.'
                        : 'Use the registration form to add real farmers to the system.'}
                    </p>
                    {onRegisterClick && !search && (
                      <button className="btn btn-leaf" onClick={onRegisterClick} style={{ padding: '8px 18px', fontSize: '13px' }}>
                        ➕ Register First Farmer
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                farmers.map((f, i) => (
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
                      {f.user_code}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #1b6336, #237e46)',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {f.name.charAt(0).toUpperCase() || 'F'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{f.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 500 }}>{f.barangay}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{f.municipality}</div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                      {f.phone_number ? (
                        <span>📞 {f.phone_number}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={STATUS_BADGE[f.status] || 'badge'}>{f.status}</span>
                        {f.active_hotspot_id != null && (
                          <button
                            onClick={() => handleMarkSafe(f)}
                            disabled={updatingHotspotId === f.active_hotspot_id}
                            title="Mark this farmer's outbreak as Safe / Resolved"
                            style={{
                              position: 'relative',
                              width: '36px',
                              height: '20px',
                              borderRadius: '999px',
                              border: 'none',
                              background: '#dc2626',
                              cursor: updatingHotspotId === f.active_hotspot_id ? 'wait' : 'pointer',
                              padding: 0,
                              opacity: updatingHotspotId === f.active_hotspot_id ? 0.6 : 1,
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                background: '#ffffff',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                              }}
                            />
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {f.disease === 'None' || !f.disease ? (
                        <span style={{ color: 'var(--text-muted)' }}>None</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>{f.disease}</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {f.total_scans}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {formatReportDate(f.last_report)}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <button
                        className="btn btn-outline"
                        onClick={() => setEditingFarmer(f)}
                        style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                      >
                        {farms.some((fm) => fm.farmer === f.id) ? '🗺️ View / Edit' : '⚠️ Not Set Up'}
                      </button>
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
            Showing {total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, total)} of {total} registered farmers
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {editingFarmer && (
        <FarmBoundaryEditor
          farm={farms.find((fm) => fm.farmer === editingFarmer.id) ?? null}
          farmerLabel={`@${editingFarmer.username}`}
          onClose={() => setEditingFarmer(null)}
          onSaved={(saved) => {
            setFarms((prev) => {
              const others = prev.filter((fm) => fm.id !== saved.id);
              return [...others, saved];
            });
            setEditingFarmer(null);
          }}
        />
      )}
    </div>
  );
};

export default FarmerTable;
