'use client';

import { useEffect } from 'react';
import { startConnectionMonitor } from '@/lib/offline/connection';
import { useOfflineStore } from '@/lib/offline/offline-store';
import { pendingCount } from '@/lib/offline/queue';

/**
 * Invisible component that boots the offline layer once per app:
 * - Starts the connectivity monitor (browser events + heartbeat).
 * - Loads the pending-operations count from IndexedDB (covers reloads
 *   while offline, when ops from a previous session are still queued).
 * - Registers the service worker in production builds so the app shell
 *   survives an offline reload.
 */
export function ConnectivityManager() {
  useEffect(() => {
    startConnectionMonitor();
    void pendingCount().then((count) => {
      useOfflineStore.getState().setPendingCount(count);
    });

    // Refresh the count when the tab regains focus (another tab may
    // have enqueued operations).
    const onFocus = () => {
      void pendingCount().then((count) => {
        useOfflineStore.getState().setPendingCount(count);
      });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration is best-effort; the app works without it
        // as long as the tab stays open.
      });
    }
  }, []);

  return null;
}
