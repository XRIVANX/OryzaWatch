import React from 'react';
import { getDiseaseAdvice } from '../../utils/helpers';

const CLASS_LABELS: Record<string, string> = {
  HEALTHY: 'Healthy',
  BLB: 'Bacterial Leaf Blight',
  BLAST: 'Rice Blast',
};
const CLASS_ORDER = ['HEALTHY', 'BLB', 'BLAST'];

interface ScanResultCardProps {
  disease: string;
  confidence: string | number;
  probabilities?: Record<string, number> | null;
  onReset: () => void;
}

export const ScanResultCard: React.FC<ScanResultCardProps> = ({
  disease,
  confidence,
  probabilities,
  onReset,
}) => {
  const advice = getDiseaseAdvice(disease);

  return (
    <div
      className="glass-panel"
      style={{
        padding: '24px',
        border: `1px solid ${advice.color}44`,
        backgroundColor: '#ffffff',
        boxShadow: 'var(--shadow-md)',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: advice.color, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: advice.color, display: 'inline-block' }} />
            DIAGNOSTIC CLASSIFICATION
          </div>
          <div style={{ fontSize: '21px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: "'Outfit', sans-serif" }}>
            {disease}
          </div>
        </div>

        <div
          style={{
            padding: '5px 14px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--green-status-light)',
            border: '1px solid var(--green-status-border)',
            color: 'var(--green-status-text)',
            fontWeight: 800,
            fontSize: '14.5px',
            fontFamily: "'Outfit', sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>🎯</span> {confidence}%
        </div>
      </div>

      {/* Per-class Confidence Breakdown */}
      {probabilities && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: '#f9fbf9',
            padding: '14px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-light)',
            marginBottom: '14px',
          }}
        >
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Confidence Breakdown
          </div>
          {CLASS_ORDER.filter((cls) => cls in probabilities).map((cls) => {
            const pct = Math.round((probabilities[cls] ?? 0) * 100);
            const barColor = getDiseaseAdvice(cls).color;
            return (
              <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '150px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {CLASS_LABELS[cls] ?? cls}
                </div>
                <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'var(--border-light)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: '4px', background: barColor, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ width: '38px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {pct}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Advisory Information Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', background: '#f9fbf9', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', marginBottom: '18px' }}>
        <div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Threat Severity</div>
          <div style={{ fontSize: '13px', color: advice.color, fontWeight: 700, marginTop: '2px' }}>{advice.severity}</div>
        </div>
        <div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Recommended Agricultural Intervention</div>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px', lineHeight: 1.5 }}>{advice.action}</div>
        </div>
        <div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Spatiotemporal Spread Factor</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{advice.riskSpread}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onReset}
          className="btn btn-outline"
          style={{ flex: 1, padding: '10px' }}
        >
          🔄 Scan Another Specimen
        </button>
      </div>
    </div>
  );
};

export default ScanResultCard;
