'use client';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { AppShell } from '@/components/layout/app-shell';
import { ErrorBoundary } from '@/components/error-boundary';
import { ConnectivityManager } from '@/components/offline/connectivity-manager';

export function HomeClient() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        {/* Boots the offline layer: connectivity monitor, pending-op
            count and (in production) the service worker. */}
        <ConnectivityManager />
        <AppShell />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
