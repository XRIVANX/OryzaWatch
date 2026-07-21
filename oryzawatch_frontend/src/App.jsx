import React, { useState, useEffect } from 'react';
import LoginForm  from './components/layout/LoginForm';
import MainLayout from './components/layout/MainLayout';
import Dashboard  from './pages/Dashboard';
import DiseaseMap from './pages/DiseaseMap';
import AIScan     from './pages/AIScan';
import Alerts     from './pages/Alerts';
import MAOConsole from './pages/MAOConsole';
import API        from './services/api';

const PAGE_COMPONENTS = {
  'dashboard':   <Dashboard />,
  'disease-map': <DiseaseMap />,
  'ai-scan':     <AIScan />,
  'alerts':      <Alerts />,
  'mao-console': <MAOConsole />,
};

function App() {
  const [user, setUser]           = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [verifying, setVerifying]   = useState(true);

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

  if (verifying) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingSpinner}></div>
        <span style={styles.loadingText}>Verifying session...</span>
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <LoginForm onLoginSuccess={(userData) => setUser(userData)} />
      ) : (
        <MainLayout
          user={user}
          activePage={activePage}
          onNavigate={setActivePage}
          onLogOut={handleLogOut}
        >
          {PAGE_COMPONENTS[activePage] || <Dashboard />}
        </MainLayout>
      )}
    </>
  );
}

const styles = {
  loadingScreen: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100vw',
    height: '100vh',
    background: 'var(--bg)',
    gap: '16px',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '4px solid var(--border)',
    borderTop: '4px solid var(--green-dark)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
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
  } catch (e) {}
}

export default App;