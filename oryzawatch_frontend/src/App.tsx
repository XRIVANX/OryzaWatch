import React, { useState, useEffect } from 'react';
import AuthView from './views/auth/AuthView';
import LayoutView from './views/layout/LayoutView';
import DashboardView from './views/feed/DashboardView';
import DiseaseMapView from './views/post/DiseaseMapView';
import AIScanView from './views/post/AIScanView';
import AlertsView from './views/profile/AlertsView';
import ProfileView from './views/profile/ProfileView';
import MAOConsoleView from './views/profile/MAOConsoleView';
import OryzaLogo from './components/common/OryzaLogo';
import LeafParticles from './components/common/LeafParticles';
import API from './utils/api';
import type { User } from './types';

const App: React.FC = () => {
  const [user, setUser]             = useState<User | null>(null);
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [verifying, setVerifying]   = useState<boolean>(true);

  // Run on mount to check if token exists and verify profile
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      API.get('auth/profile/')
        .then((response) => {
          setUser(response.data);
        })
        .catch((err) => {
          console.error('Session verification failed, logging out:', err);
          localStorage.clear();
        })
        .finally(() => {
          setVerifying(false);
        });
    } else {
      setVerifying(false);
    }
  }, []);

  const handleLogOut = () => {
    localStorage.clear();
    setUser(null);
    setActivePage('dashboard');
  };

  const getPageComponent = (page: string) => {
    switch (page) {
      case 'dashboard':
        return <DashboardView user={user} />;
      case 'disease-map':
        return <DiseaseMapView />;
      case 'ai-scan':
        return <AIScanView />;
      case 'alerts':
        return <AlertsView />;
      case 'profile':
        return user ? <ProfileView user={user} onLogOut={handleLogOut} /> : <DashboardView />;
      case 'mao-console':
        return user ? <MAOConsoleView user={user} /> : <DashboardView />;
      default:
        return <DashboardView />;
    }
  };

  if (verifying) {
    return (
      <div className="leafy-bg" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100vw', height: '100vh', gap: '18px' }}>
        <LeafParticles count={10} />
        <div style={{ transform: 'scale(1.05)' }}>
          <OryzaLogo size={75} showText={false} glow={false} />
        </div>
        <div
          style={{
            width: '34px',
            height: '34px',
            border: '3px solid #e1eae3',
            borderTop: '3px solid var(--leaf-primary)',
            borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }}
        />
        <span style={{ fontSize: '13px', color: 'var(--leaf-forest)', fontWeight: 600, letterSpacing: '0.04em' }}>
          Verifying session...
        </span>
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <AuthView onLoginSuccess={(userData: User) => setUser(userData)} />
      ) : (
        <LayoutView
          user={user}
          activePage={activePage}
          onNavigate={setActivePage}
          onLogOut={handleLogOut}
        >
          {getPageComponent(activePage)}
        </LayoutView>
      )}
    </>
  );
};

// Add CSS animation for spin directly
const styleSheet = document.styleSheets[0];
const keyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
if (styleSheet) {
  try {
    styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
  } catch { /* ignore */ }
}

export default App;
