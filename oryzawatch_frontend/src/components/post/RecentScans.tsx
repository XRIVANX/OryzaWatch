import React, { useEffect, useState } from 'react';
import API from '../../utils/api';

interface BackendScan {
  id: number;
  reporter_username: string;
  image: string;
  detected_disease: 'HEALTHY' | 'BLB' | 'BLAST' | string;
  confidence_score: number;
  affected_area_ratio?: number | null;
  latitude: string;
  longitude: string;
  created_at: string;
}

const DISEASE_NAME_MAP: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  HEALTHY: { label: 'Healthy Leaf', icon: '🌿', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
  BLB: { label: 'Bacterial Leaf Blight', icon: '🍂', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
  BLAST: { label: 'Rice Blast', icon: '🌾', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.1)' },
};

function formatTimeAgo(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  } catch {
    return 'Recently';
  }
}

interface RecentScansProps {
  refreshKey?: number;
}

export const RecentScans: React.FC<RecentScansProps> = ({ refreshKey }) => {
  const [scans, setScans] = useState<BackendScan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentScans = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await API.get<BackendScan[]>('diagnostics/history/');
      setScans(res.data || []);
    } catch (err: any) {
      console.warn('Failed to load recent scans:', err);
      setError('Could not load recent scans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentScans();
  }, [refreshKey]);

  return (
    <div style={{ width: '100%', maxWidth: '520px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 800,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: "'Outfit', sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>🌾</span> RECENT REAL SCANS ({scans.length})
        </div>
        <button
          onClick={fetchRecentScans}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '11px',
            color: 'var(--leaf-primary)',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          ↻ Refresh
        </button>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden', backgroundColor: '#ffffff' }}>
        {loading ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Loading real scan history...
          </div>
        ) : error ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            {error}
          </div>
        ) : scans.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🍃</div>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
              No real scans recorded yet
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Upload a rice leaf photo above to see real AI diagnostics here.
            </div>
          </div>
        ) : (
          scans.slice(0, 10).map((scan, i) => {
            const meta = DISEASE_NAME_MAP[scan.detected_disease] || {
              label: scan.detected_disease,
              icon: '🔬',
              color: 'var(--text-primary)',
              bg: 'var(--leaf-soft)',
            };
            const confidencePct = Math.round((scan.confidence_score || 0) * 100);

            return (
              <div
                key={scan.id || i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 18px',
                  borderBottom: i < Math.min(scans.length, 10) - 1 ? '1px solid var(--border-light)' : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {/* Thumbnail or Icon */}
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: meta.bg,
                    border: '1px solid var(--border)',
                    flexShrink: 0,
                  }}
                >
                  {scan.image ? (
                    <img
                      src={scan.image}
                      alt={meta.label}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        // Fallback to icon if image fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '20px' }}>{meta.icon}</span>
                  )}
                </div>

                {/* Information */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13.5px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>{meta.label}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {scan.reporter_username ? `@${scan.reporter_username} · ` : ''}
                    {formatTimeAgo(scan.created_at)}
                    {scan.latitude && scan.longitude ? ` · (${Number(scan.latitude).toFixed(3)}, ${Number(scan.longitude).toFixed(3)})` : ''}
                  </div>
                </div>

                {/* Confidence Badge */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: '13.5px',
                      fontWeight: 800,
                      color: meta.color,
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    {confidencePct}%
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    AI Match
                  </div>
                  {typeof scan.affected_area_ratio === 'number' && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                      {Math.round(scan.affected_area_ratio * 100)}% affected
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RecentScans;

