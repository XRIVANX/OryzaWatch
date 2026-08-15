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
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  user,
  activePage,
  onNavigate,
  onLogOut,
}) => {
  return (
    <div className="layout-root leafy-bg">
      <LeafParticles count={14} />
      <Sidebar
        user={user}
        activePage={activePage}
        onNavigate={onNavigate}
        onLogOut={onLogOut}
      />
      <main className="layout-main">{children}</main>
    </div>
  );
};

export default MainLayout;