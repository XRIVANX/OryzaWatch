import React, { useState, useEffect, useCallback } from 'react';
import API from '../../utils/api';

interface LogEntry {
  id:           number;
  timestamp:    string;
  user:         string;
  action_type:  string;
  action_label: string;
  details:      string;
}

interface ApiResponse {
  total:   number;
  limit:   number;
  offset:  number;
  results: LogEntry[];
}

const ACTION_TYPE_OPTIONS = [
  { value: '',               label: 'All Actions' },
  { value: 'LOGIN_SUCCESS',  label: 'Login Success' },
  { value: 'LOGIN_FAILED',   label: 'Login Failed' },
  { value: 'LOGIN_LOCKED',   label: 'Account Locked' },
  { value: 'LOGOUT',         label: 'Logout' },
  { value: 'REGISTER_FARMER','label': 'Registered Farmer' },
  { value: 'REGISTER_KAGAWAD','label': 'Registered Kagawad' },
  { value: 'SCAN_UPLOAD',    label: 'AI Scan Uploaded' },
  { value: 'ALERT_READ',     label: 'Alert Marked Read' },
];

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  LOGIN_SUCCESS:   { bg: '#dcfce7', color: '#166534' },
  LOGIN_FAILED:    { bg: '#fee2e2', color: '#991b1b' },
  LOGIN_LOCKED:    { bg: '#fef3c7', color: '#92400e' },
  LOGOUT:          { bg: '#f3f4f6', color: '#374151' },
  REGISTER_FARMER: { bg: '#dbeafe', color: '#1e40af' },
  REGISTER_KAGAWAD:{ bg: '#ede9fe', color: '#5b21b6' },
  SCAN_UPLOAD:     { bg: '#d1fae5', color: '#065f46' },
  ALERT_READ:      { bg: '#e0f2fe', color: '#0369a1' },
};

const PAGE_SIZE = 20;

const formatTimestamp = (iso: string): { date: string; time: string } => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
  };
};

export const ActivityLogTable: React.FC = () => {
  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const [total, setTotal]           = useState(0);
  const [offset, setOffset]         = useState(0);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [actionFilter, setFilter]   = useState('');
  const [lastRefresh, setRefresh]   = useState(new Date());

  const fetchLogs = useCallback(async (off: number, filter: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: off };
      if (filter) params.action_type = filter;
      const { data } = await API.get<ApiResponse>('auth/logs/', { params });
      setLogs(data.results);
      setTotal(data.total);
      setRefresh(new Date());
    } catch {
      setError('Failed to load activity logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLogs(offset, actionFilter);
  }, [fetchLogs, offset, actionFilter]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLogs(offset, actionFilter);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs, offset, actionFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter(e.target.value);
    setOffset(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
            Activity Logs
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: '#f3f4f6', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
            {total} events
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Filter by action */}
          <select
            value={actionFilter}
            onChange={handleFilterChange}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              backgroundColor: '#ffffff',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {ACTION_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            onClick={() => fetchLogs(offset, actionFilter)}
            className="btn btn-outline"
            style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title={`Last refreshed: ${lastRefresh.toLocaleTimeString()}`}
          >
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Auto-refresh notice */}
      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>
        Auto-refreshes every 30 seconds · Last updated: {lastRefresh.toLocaleTimeString()}
      </p>

      {error && (
        <div style={{ padding: '11px 15px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-sm)', color: 'var(--red-text)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠</span> {error}
        </div>
      )}

      {/* Table */}
      <div className="glass-panel" style={{ overflow: 'hidden', backgroundColor: '#ffffff' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fbf9', borderBottom: '1px solid var(--border)' }}>
                {['DATE & TIME', 'USER', 'ACTION TYPE', 'DETAILS'].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '13px 18px',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.08em',
                      fontFamily: "'Outfit', sans-serif",
                      whiteSpace: 'nowrap',
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
                  <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '24px', height: '24px', border: '2px solid #e1eae3', borderTop: '2px solid var(--leaf-primary)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                      Loading logs…
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No activity logs found{actionFilter ? ` for "${ACTION_TYPE_OPTIONS.find(o => o.value === actionFilter)?.label}"` : ''}.
                  </td>
                </tr>
              ) : (
                logs.map((log, i) => {
                  const { date, time } = formatTimestamp(log.timestamp);
                  const chip = ACTION_COLORS[log.action_type] ?? { bg: '#f3f4f6', color: '#374151' };
                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border-light)',
                        background: i % 2 === 0 ? '#ffffff' : '#fafdfb',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#ffffff' : '#fafdfb'; }}
                    >
                      {/* Date & Time */}
                      <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>{date}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{time}</div>
                      </td>

                      {/* User */}
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #1b6336, #237e46)', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {log.user === 'system' ? '⚙' : log.user.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                            {log.user}
                          </span>
                        </div>
                      </td>

                      {/* Action Type chip */}
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700, backgroundColor: chip.bg, color: chip.color, whiteSpace: 'nowrap' }}>
                          {log.action_label}
                        </span>
                      </td>

                      {/* Details */}
                      <td style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontSize: '12.5px', maxWidth: '320px' }}>
                        {log.details || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 20px', borderTop: '1px solid var(--border-light)', background: '#ffffff' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total} events
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-outline"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              disabled={offset === 0}
              onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
              const page = idx + 1;
              return (
                <button
                  key={page}
                  onClick={() => setOffset((page - 1) * PAGE_SIZE)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: currentPage === page ? '1px solid var(--leaf-primary)' : '1px solid var(--border)',
                    background: currentPage === page ? 'var(--leaf-primary)' : '#ffffff',
                    color: currentPage === page ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  {page}
                </button>
              );
            })}
            <button
              className="btn btn-outline"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(o => o + PAGE_SIZE)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogTable;
