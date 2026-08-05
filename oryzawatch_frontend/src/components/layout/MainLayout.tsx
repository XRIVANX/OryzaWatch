import type { CSSProperties } from 'react';
import OryzaLogo from '../ui/OryzaLogo';
import type { User, UserRole } from '../../types';

// Human-readable labels — must match Django ROLE_CHOICES
const ROLE_LABELS: Record<UserRole, string> = {
  FARMER:    'Farmer',
  KAGAWAD:   'Agri-Kagawad',
  MAO_ADMIN: 'MAO · Admin',
};

interface NavItem {
  id: string;
  label: string;
  icon: string;
  group: 'MAIN' | 'ADMIN';
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',   label: 'Dashboard',  icon: '⊞',  group: 'MAIN' },
  { id: 'disease-map', label: 'Disease Map', icon: '⊙',  group: 'MAIN' },
  { id: 'ai-scan',     label: 'AI Scan',     icon: '◫',  group: 'MAIN' },
  { id: 'alerts',      label: 'Alerts',      icon: '🔔', group: 'MAIN', badge: 3 },
  { id: 'mao-console', label: 'MAO Console', icon: '👤', group: 'ADMIN' }, // shown only to MAO_ADMIN
];

interface MainLayoutProps {
  children: React.ReactNode;
  user: User;
  activePage: string;
  onNavigate: (page: string) => void;
  onLogOut: () => void;
}

interface NavGroupProps {
  label: string;
  items: NavItem[];
  activePage: string;
  onNavigate: (page: string) => void;
}

const NavGroup = ({ label, items, activePage, onNavigate }: NavGroupProps) => (
  <div style={s.navGroup}>
    <div style={s.navGroupLabel}>{label}</div>
    {items.map(item => {
      const isActive = activePage === item.id;
      return (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{ ...s.navItem, ...(isActive ? s.navItemActive : {}) }}
        >
          <span style={s.navIcon}>{item.icon}</span>
          <span style={s.navLabel}>{item.label}</span>
          {item.badge && <span style={s.navBadge}>{item.badge}</span>}
        </button>
      );
    })}
  </div>
);

const MainLayout = ({ children, user, activePage, onNavigate, onLogOut }: MainLayoutProps) => {
  const mainItems = NAV_ITEMS.filter(i => i.group === 'MAIN');

  // MAO Console only visible when the logged-in user is MAO_ADMIN
  const adminItems = user.role === 'MAO_ADMIN'
    ? NAV_ITEMS.filter(i => i.group === 'ADMIN')
    : [];

  // "Logged in as" label matches their actual role
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <div style={s.root}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        {/* Logo */}
        <div style={s.logoRow}>
          <div style={s.logoIcon}><OryzaLogo size={22} showText={false} /></div>
          <span style={s.logoText}>OryzaWatch</span>
        </div>

        {/* Nav */}
        <nav style={s.nav}>
          <NavGroup label="MAIN" items={mainItems} activePage={activePage} onNavigate={onNavigate} />
          {/* ADMIN group only rendered when adminItems is non-empty (MAO_ADMIN only) */}
          {adminItems.length > 0 && (
            <NavGroup label="ADMIN" items={adminItems} activePage={activePage} onNavigate={onNavigate} />
          )}
        </nav>

        {/* Footer */}
        <div style={s.sidebarFooter}>
          <div style={s.footerLabel}>Logged in as</div>
          {/* Shows e.g. "MAO · Admin" or "Agri-Kagawad" or "Farmer" */}
          <div style={s.footerUser}>{roleLabel} · {user.municipality}</div>
          <div style={s.footerStatusRow}>
            <div style={s.footerStatus}>
              <span style={s.statusDot} />
              Online
            </div>
            <button onClick={onLogOut} style={s.logoutLinkBtn}>Log Out</button>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={s.main}>{children}</div>
    </div>
  );
};

const s: Record<string, CSSProperties> = {
  root:           { display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg)' },
  sidebar:        { width: 'var(--sidebar-w)', minWidth: 'var(--sidebar-w)', background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100 },
  logoRow:        { display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 16px 18px', borderBottom: '1px solid var(--border-light)' },
  logoIcon:       { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText:       { fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', letterSpacing: '-0.02em' },
  nav:            { flex: 1, padding: '12px 0', overflowY: 'auto' },
  navGroup:       { marginBottom: '4px' },
  navGroupLabel:  { fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', padding: '10px 16px 4px', textTransform: 'uppercase' },
  navItem:        { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 12px 8px 16px', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, transition: 'all 0.15s ease', position: 'relative' },
  navItemActive:  { background: 'var(--green-light)', color: 'var(--green-dark)', fontWeight: 600 },
  navIcon:        { fontSize: '14px', width: '18px', textAlign: 'center', flexShrink: 0 },
  navLabel:       { flex: 1 },
  navBadge:       { background: '#dc2626', color: '#fff', borderRadius: '10px', fontSize: '10px', fontWeight: 700, padding: '1px 6px', minWidth: '18px', textAlign: 'center' },
  sidebarFooter:  { padding: '14px 16px', borderTop: '1px solid var(--border-light)' },
  footerLabel:    { fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' },
  footerUser:     { fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' },
  footerStatusRow:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' },
  footerStatus:   { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--green-status)', fontWeight: 500 },
  statusDot:      { width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' },
  logoutLinkBtn:  { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500, cursor: 'pointer', padding: 0, textDecoration: 'underline' },
  main:           { marginLeft: 'var(--sidebar-w)', flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' },
};

export default MainLayout;