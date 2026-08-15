import React from 'react';
import MainLayout from '../../components/layout/MainLayout';
import type { User } from '../../types';

interface LayoutViewProps {
  children: React.ReactNode;
  user: User;
  activePage: string;
  onNavigate: (page: string) => void;
  onLogOut: () => void;
}

export const LayoutView: React.FC<LayoutViewProps> = (props) => {
  return <MainLayout {...props} />;
};

export default LayoutView;
