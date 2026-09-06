import React from 'react';
import { LEGEND } from '../../data/diseasemap.data';
import type { Farm, DiseaseHotspot } from '../../types';

interface ThreatAssessmentProps {
  municipality: string;
  farms: Farm[];
  hotspots: DiseaseHotspot[];
}

const STATUS_RANK: Record<string, number> = { CRITICAL: 3, AT_RISK: 2, MONITORING: 1, RESOLVED: 0 };
const STATUS_LABEL: Record<string, string> = {
  CRITICAL: 'Critical Outbreak',
  AT_RISK: 'At Risk',
  MONITORING: 'Monitoring',
  RESOLVED: 'Resolved',
};

export const ThreatAssessment: React.FC<ThreatAssessmentProps> = ({ municipality, farms, hotspots }) => {
  const active = hotspots.filter((h) => h.is_active);

  const worst = active.reduce<DiseaseHotspot | null>((acc, h) => {
    if (!acc || (STATUS_RANK[h.status] ?? 0) > (STATUS_RANK[acc.status] ?? 0)) return h;
    return acc;
  }, null);

  const primaryThreat = worst ? worst.scan.detected_disease : 'None reported';
  const severityLabel = worst ? STATUS_LABEL[worst.status] ?? worst.status : 'Safe';
  const severityColor = worst ? '#dc2626' : '#16a34a';
  const maxSpread = active.length ? Math.max(...active.map((h) => h.spread_velocity)) : 0;

  return (
    <div className="glass-card-interactive" style={{ padding: '24px', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
          {municipality} Overview
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {farms.length} registered farm{farms.length === 1 ? '' : 's'} · {active.length} active hotspot{active.length === 1 ? '' : 's'}
        </div>
      </div>

      <div style={{ background: '#f9fbf9', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
        <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', fontFamily: "'Outfit', sans-serif" }}>
          THREAT ASSESSMENT
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Primary Threat</span>
          <span style={{ color: worst ? '#dc2626' : 'var(--text-primary)', fontWeight: 700 }}>{primaryThreat}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Severity</span>
          <span style={{ color: severityColor, fontWeight: 700 }}>{severityLabel}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Spread Velocity</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{maxSpread.toFixed(1)} km / day</span>
        </div>
      </div>

      <div>
        <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', fontFamily: "'Outfit', sans-serif" }}>
          MAP LEGEND
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {LEGEND.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
              <span>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ThreatAssessment;
