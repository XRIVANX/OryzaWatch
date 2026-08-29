import React from 'react';
import { FIELD_AREAS, FieldAreaKey, LEGEND } from '../../data/diseasemap.data';

interface ThreatAssessmentProps {
  area?: FieldAreaKey;
}

export const ThreatAssessment: React.FC<ThreatAssessmentProps> = ({ area = 'carmen' }) => {
  const overview = FIELD_AREAS[area];
  return (
    <div className="glass-card-interactive" style={{ padding: '24px', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
          {overview.title}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {overview.subtitle}
        </div>
      </div>

      <div style={{ background: '#f9fbf9', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
        <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', fontFamily: "'Outfit', sans-serif" }}>
          THREAT ASSESSMENT
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Primary Threat</span>
          <span style={{ color: '#dc2626', fontWeight: 700 }}>{overview.primaryThreat}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Severity</span>
          <span style={{ color: '#dc2626', fontWeight: 700 }}>{overview.severity}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Spread Velocity</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{overview.spreadVelocity}</span>
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
