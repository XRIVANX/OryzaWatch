import React, { useState } from 'react';
import FarmerTable from '../../components/profile/FarmerTable';
import KagawadTable from '../../components/profile/KagawadTable';
import RegisterUserForm from '../../components/profile/RegisterUserForm';
import ActivityLogTable from '../../components/profile/ActivityLogTable';
import type { User } from '../../types';

interface MAOConsoleViewProps {
  user: User;
}

type TabId = 'farmers' | 'kagawad' | 'register' | 'logs';

const TABS: { id: TabId; label: string; icon: string; roles: string[] }[] = [
  { id: 'farmers',  label: 'Farmers',           icon: '🌾', roles: ['MAO_ADMIN', 'KAGAWAD'] },
  { id: 'kagawad',  label: 'SK / Agri-Kagawad', icon: '🎖️', roles: ['MAO_ADMIN'] },
  { id: 'register', label: 'Register User',     icon: '➕', roles: ['MAO_ADMIN', 'KAGAWAD'] },
  { id: 'logs',     label: 'Activity Logs',      icon: '📋', roles: ['MAO_ADMIN'] },
];

export const MAOConsoleView: React.FC<MAOConsoleViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<TabId>('farmers');

  // Filter tabs by role
  const visibleTabs = TABS.filter(t => t.roles.includes(user.role));

  // Reset to first available tab if current one is hidden
  const safeTab = visibleTabs.find(t => t.id === activeTab)
    ? activeTab
    : visibleTabs[0]?.id ?? 'farmers';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <header className="layout-topbar">
        <div>
          <h1 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            {user.role === 'KAGAWAD' ? 'Agri-Kagawad Console' : 'MAO Admin Console'}
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🏛️</span>
            <span>Municipal Agriculture Office · Carmen</span>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: '#ffffff',
          flexShrink: 0,
        }}
      >
        {visibleTabs.map(tab => {
          const isActive = safeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 18px',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--leaf-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--leaf-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif",
                transition: 'color 0.15s, border-color 0.15s',
                marginBottom: '-1px',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="layout-content">
        {safeTab === 'farmers'  && <FarmerTable onRegisterClick={() => setActiveTab('register')} />}
        {safeTab === 'kagawad'  && <KagawadTable onRegisterClick={() => setActiveTab('register')} />}
        {safeTab === 'register' && <RegisterUserForm adminUser={user} />}
        {safeTab === 'logs'     && <ActivityLogTable />}
      </div>
    </div>
  );
};

export default MAOConsoleView;
