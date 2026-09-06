import React, { useState, useEffect, useRef } from 'react';
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
import AlertToast from './components/common/AlertToast';
import API, { alertsApi } from './utils/api';
import type { User, Alert } from './types';

const ALERTS_POLL_MS = 10000;

const App: React.FC = () => {
  const [user, setUser]             = useState<User | null>(null);
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [verifying, setVerifying]   = useState<boolean>(true);
  const [focusHotspotId, setFocusHotspotId] = useState<number | null>(null);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [toastAlert, setToastAlert] = useState<Alert | null>(null);
  const seenAlertIds = useRef<Set<number> | null>(null);

  // Real unread count for the sidebar's Alerts badge, plus a real-time-ish
  // popup the moment a genuinely new alert shows up - there's no
  // WebSocket/push infra here, so a short poll is as "live" as it gets.
  useEffect(() => {
    if (!user) {
      setUnreadAlertsCount(0);
      seenAlertIds.current = null;
      return;
    }
    let cancelled = false;
    const fetchUnread = () => {
      alertsApi.list()
        .then((res) => {
          if (cancelled) return;
          const data = res.data;
          if (seenAlertIds.current) {
            const fresh = data.find((a) => !seenAlertIds.current!.has(a.id) && !a.is_read);
            if (fresh) setToastAlert(fresh);
          } else {
            seenAlertIds.current = new Set();
          }
          data.forEach((a) => seenAlertIds.current!.add(a.id));
          setUnreadAlertsCount(data.filter((a) => !a.is_read).length);
        })
        .catch(() => undefined);
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, ALERTS_POLL_MS);
    // Poll pauses in a backgrounded tab; refresh the instant it's focused
    // again so a returning user sees new alerts without a manual reload.
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchUnread();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, activePage]);

  const handleViewHotspotOnMap = (hotspotId: number) => {
    setFocusHotspotId(hotspotId);
    setActivePage('disease-map');
  };

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
        return <DiseaseMapView focusHotspotId={focusHotspotId} />;
      case 'ai-scan':
        return <AIScanView />;
      case 'alerts':
        return <AlertsView user={user} onViewOnMap={handleViewHotspotOnMap} />;
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
          unreadAlertsCount={unreadAlertsCount}
        >
          {getPageComponent(activePage)}
        </LayoutView>
      )}
      <AlertToast
        alert={toastAlert}
        onDismiss={() => setToastAlert(null)}
        onView={() => {
          if (toastAlert?.hotspot) handleViewHotspotOnMap(toastAlert.hotspot);
          else setActivePage('alerts');
          setToastAlert(null);
        }}
      />
    </>
  );
};

// Add CSS animations directly - insertRule takes exactly one rule per call.
const styleSheet = document.styleSheets[0];
const keyframeRules = [
  `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`,
  `@keyframes ow-toast-in { 0% { transform: translateY(-12px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }`,
];
if (styleSheet) {
  keyframeRules.forEach((rule) => {
    try {
      styleSheet.insertRule(rule, styleSheet.cssRules.length);
    } catch { /* ignore */ }
  });
}

export default App;
