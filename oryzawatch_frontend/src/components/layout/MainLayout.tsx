import React from 'react';
import Sidebar from './Sidebar';
import LeafParticles from '../common/LeafParticles';
import type { User } from '../../types';

interface MainLayoutProps {
  children: React.ReactNode;
  user: User;
  activePage: string;
  onNavigate: (page: string) => void;
  onLogOut: () => void;
  unreadAlertsCount?: number;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  user,
  activePage,
  onNavigate,
  onLogOut,
  unreadAlertsCount = 0,
}) => {
  return (
    <div className="layout-root leafy-bg">
      <LeafParticles count={14} />
      <Sidebar
        user={user}
        activePage={activePage}
        onNavigate={onNavigate}
        onLogOut={onLogOut}
        unreadAlertsCount={unreadAlertsCount}
      />
      <main className="layout-main">{children}</main>
    </div>
  );
};

export default MainLayout;