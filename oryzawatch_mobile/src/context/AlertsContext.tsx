// ─────────────────────────────────────────────────────────────────────────────
// AlertsContext — polls /api/alerts/ in the background so the whole app (bell
// badges, AlertsScreen, HomeScreen) stays current without a manual refresh,
// and pops up an in-app toast the moment a genuinely new alert arrives.
//
// There's no push/WebSocket infrastructure here, so "real-time" means a short
// poll (10s) - plus an immediate refresh whenever the app returns to the
// foreground - rather than a true server push. Close enough to feel live
// without standing up new backend infra.
// ─────────────────────────────────────────────────────────────────────────────
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { alertsApi } from '../api/alerts';
import { useAuth } from '../hooks/useAuth';
import type { Alert } from '../types';

const POLL_INTERVAL_MS = 10000;

interface AlertsContextType {
  alerts: Alert[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  toast: Alert | null;
  dismissToast: () => void;
}

export const AlertsContext = createContext<AlertsContextType>({
  alerts: [],
  unreadCount: 0,
  refresh: async () => {},
  markRead: async () => {},
  toast: null,
  dismissToast: () => {},
});

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [toast, setToast] = useState<Alert | null>(null);
  const seenIds = useRef<Set<number> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await alertsApi.getAlerts();
      if (seenIds.current) {
        // Skip on the very first load - everything already in the list is
        // "old news", not a new arrival worth popping up.
        const fresh = data.find((a) => !seenIds.current!.has(a.id) && !a.is_read);
        if (fresh) setToast(fresh);
      } else {
        seenIds.current = new Set();
      }
      data.forEach((a) => seenIds.current!.add(a.id));
      setAlerts(data);
    } catch {
      // best-effort - a failed poll just tries again next tick
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setAlerts([]);
      seenIds.current = null;
      return;
    }
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    // The interval is throttled while the app is backgrounded; refresh the
    // moment it comes back so a returning user isn't looking at a stale list.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [user, refresh]);

  const unreadCount = alerts.filter((a) => !a.is_read).length;
  const dismissToast = useCallback(() => setToast(null), []);

  const markRead = useCallback(async (id: number) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    try {
      await alertsApi.markRead(id);
    } catch {
      // best-effort; the next poll reconciles either way
    }
  }, []);

  return (
    <AlertsContext.Provider value={{ alerts, unreadCount, refresh, markRead, toast, dismissToast }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlertsContext() {
  return useContext(AlertsContext);
}
