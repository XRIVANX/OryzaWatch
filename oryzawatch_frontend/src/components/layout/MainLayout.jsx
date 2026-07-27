
import OryzaLogo from '../ui/OryzaLogo';

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '⊞',  group: 'MAIN' },
  { id: 'disease-map', label: 'Disease Map',  icon: '⊙',  group: 'MAIN' },
  { id: 'ai-scan',     label: 'AI Scan',      icon: '◫',  group: 'MAIN' },
  { id: 'alerts',      label: 'Alerts',       icon: '🔔', group: 'MAIN', badge: 3 },
  { id: 'mao-console', label: 'MAO Console',  icon: '👤', group: 'ADMIN' },
];

const MainLayout = ({ children, user, activePage, onNavigate, onLogOut }) => {
  const mainItems  = NAV_ITEMS.filter(i => i.group === 'MAIN');
  const adminItems = NAV_ITEMS.filter(i => i.group === 'ADMIN');

  return (
    <div style={s.root}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        {/* Logo */}
        <div style={s.logoRow}>
          <div style={s.logoIcon}>
            <OryzaLogo size={22} showText={false} />
          </div>
          <span style={s.logoText}>OryzaWatch</span>
        </div>

        {/* Nav */}
        <nav style={s.nav}>
          <NavGroup label="MAIN" items={mainItems} activePage={activePage} onNavigate={onNavigate} />
          <NavGroup label="ADMIN" items={adminItems} activePage={activePage} onNavigate={onNavigate} />
        </nav>

        {/* Footer */}
        <div style={s.sidebarFooter}>
          <div style={s.footerLabel}>Logged in as</div>
          <div style={s.footerUser}>{user?.role?.toUpperCase() || 'MAO'} · {user?.username || 'Carmen'}</div>
          <div style={s.footerStatusRow}>
            <div style={s.footerStatus}>
              <span style={s.statusDot} />
              Online
            </div>
            <button onClick={onLogOut} style={s.logoutLinkBtn}>
              Log Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={s.main}>
        {children}
      </div>
    </div>
  );
};

const NavGroup = ({ label, items, activePage, onNavigate }) => (
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
          {item.badge && (
            <span style={s.navBadge}>{item.badge}</span>
          )}
        </button>
      );
    })}
  </div>
);

const s = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    background: 'var(--bg)',
  },
  sidebar: {
    width: 'var(--sidebar-w)',
    minWidth: 'var(--sidebar-w)',
    background: 'var(--bg-sidebar)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 100,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '20px 16px 18px',
    borderBottom: '1px solid var(--border-light)',
  },
  logoIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontWeight: 700,
    fontSize: '15px',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  nav: {
    flex: 1,
    padding: '12px 0',
    overflowY: 'auto',
  },
  navGroup: {
    marginBottom: '4px',
  },
  navGroupLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    padding: '10px 16px 4px',
    textTransform: 'uppercase',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '8px 12px 8px 16px',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    position: 'relative',
  },
  navItemActive: {
    background: 'var(--green-light)',
    color: 'var(--green-dark)',
    fontWeight: 600,
  },
  navIcon: {
    fontSize: '14px',
    width: '18px',
    textAlign: 'center',
    flexShrink: 0,
  },
  navLabel: {
    flex: 1,
  },
  navBadge: {
    background: '#dc2626',
    color: '#fff',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 700,
    padding: '1px 6px',
    minWidth: '18px',
    textAlign: 'center',
  },
  sidebarFooter: {
    padding: '14px 16px',
    borderTop: '1px solid var(--border-light)',
  },
  footerLabel: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    marginBottom: '2px',
  },
  footerUser: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  footerStatusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '6px',
  },
  footerStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    color: 'var(--green-status)',
    fontWeight: 500,
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#22c55e',
    display: 'inline-block',
  },
  logoutLinkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    transition: 'color 0.15s',
  },
  main: {
    marginLeft: 'var(--sidebar-w)',
    flex: 1,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
};

export default MainLayout;