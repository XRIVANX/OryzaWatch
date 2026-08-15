import React from 'react';
import FarmerTable from '../../components/profile/FarmerTable';

export const MAOConsoleView: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <header className="layout-topbar">
        <div>
          <h1 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            MAO Admin Console
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🏛️</span>
            <span>Municipal Agriculture Office · Carmen</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="layout-content">
        <FarmerTable />
      </div>
    </div>
  );
};

export default MAOConsoleView;
