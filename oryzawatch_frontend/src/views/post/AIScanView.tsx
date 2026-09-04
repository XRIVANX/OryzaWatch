import React, { useState } from 'react';
import LeafScanner from '../../components/post/LeafScanner';
import RecentScans from '../../components/post/RecentScans';

export const AIScanView: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState<number>(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <header className="layout-topbar">
        <div>
          <h1 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            AI Leaf Scan
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🌿</span>
            <span>Disease detection via machine learning</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div
        className="layout-content"
        style={{
          alignItems: 'center',
          gap: '32px',
        }}
      >
        <LeafScanner onScanSuccess={() => setRefreshKey((k) => k + 1)} />
        <RecentScans refreshKey={refreshKey} />
      </div>
    </div>
  );
};

export default AIScanView;
