import React from 'react';
import type { User } from '../../types';

interface NavbarProps {
  user: User;
  title: string;
  subtitle?: string;
  chips?: React.ReactNode;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  title,
  subtitle,
  chips,
}) => {
  return (
    <header className="layout-topbar">
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
          {title}
        </h1>
        {subtitle && (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🌱</span>
            <span>{subtitle}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {chips}
      </div>
    </header>
  );
};

export default Navbar;
