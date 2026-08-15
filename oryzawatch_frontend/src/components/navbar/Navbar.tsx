import React from 'react';
import AlertChip from '../common/AlertChip';
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
        {chips ? (
          chips
        ) : (
          <>
            <AlertChip color="#b45309" bg="#fef3c7" border="#fde68a" icon="💧" label="Humidity 89%" />
            <AlertChip color="#b91c1c" bg="#fee2e2" border="#fca5a5" icon="🔥" label="2 Hotspots" pulse />
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
