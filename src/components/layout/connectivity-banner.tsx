'use client';

import { useCallback } from 'react';
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { useOfflineStore } from '@/lib/offline/offline-store';
import { runSync } from '@/lib/offline/sync-engine';
import { Button } from '@/components/ui/button';

/**
 * Top ribbon shown only while disconnected or with pending offline
 * operations. Rendered inside the sticky header wrapper in AppShell so
 * banner + header stick together as one unit.
 *
 * - Offline → amber ribbon: mode notice + pending count.
 * - Back online with pending ops → green ribbon + "Sincronizar" button.
 * - While syncing → the button shows a spinner and is disabled.
 */
export function ConnectivityBanner() {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const pendingCount = useOfflineStore((s) => s.pendingCount);
  const syncing = useOfflineStore((s) => s.syncing);

  const handleSync = useCallback(() => {
    void runSync();
  }, []);

  if (isOnline && pendingCount === 0) return null;

  // ── Syncing state (takes precedence over the button) ───────────────────
  if (syncing) {
    return (
      <div
        className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
        style={{
          background: 'rgba(59,130,246,0.15)',
          color: '#93c5fd',
          borderBottom: '1px solid rgba(59,130,246,0.3)',
        }}
        role="status"
        aria-live="polite"
      >
        <RefreshCw className="size-3.5 animate-spin" />
        Sincronizando datos con el servidor…
      </div>
    );
  }

  // ── Offline ─────────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div
        className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
        style={{
          background: 'rgba(245,158,11,0.15)',
          color: '#fcd34d',
          borderBottom: '1px solid rgba(245,158,11,0.3)',
        }}
        role="status"
        aria-live="polite"
      >
        <WifiOff className="size-3.5 shrink-0" />
        <span className="truncate">
          Sin conexión a internet — modo sin conexión activo
          {pendingCount > 0
            ? ` · ${pendingCount} operación(es) pendiente(s) se guardarán localmente`
            : ' · puedes seguir gestionando tus eventos'}
        </span>
      </div>
    );
  }

  // ── Back online with pending operations ────────────────────────────────
  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
      style={{
        background: 'rgba(34,197,94,0.15)',
        color: '#86efac',
        borderBottom: '1px solid rgba(34,197,94,0.3)',
      }}
      role="status"
      aria-live="polite"
    >
      <CloudOff className="size-3.5 shrink-0" />
      <span className="truncate">
        Conexión restablecida — {pendingCount} operación(es) pendiente(s) de
        sincronizar
      </span>
      <Button
        size="sm"
        variant="outline"
        className="ml-2 h-6 gap-1.5 rounded-md px-2.5 text-[11px] font-semibold"
        style={{
          background: 'rgba(34,197,94,0.25)',
          color: '#bbf7d0',
          borderColor: 'rgba(34,197,94,0.5)',
        }}
        onClick={handleSync}
        aria-label="Sincronizar operaciones pendientes"
      >
        <RefreshCw className="size-3" />
        Sincronizar ({pendingCount})
      </Button>
    </div>
  );
}
