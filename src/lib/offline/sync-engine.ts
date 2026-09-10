/**
 * Browser-side sync orchestration.
 *
 * Wires the pure engine (sync-core) to the IndexedDB queue and the
 * authenticated fetcher, updates the offline store, reports results via
 * toasts and bumps `syncVersion` so open views refetch fresh data.
 */
import { toast } from 'sonner';
import type { SyncResult } from './types';
import { getAllOps, pendingCount, removeOps } from './queue';
import { syncOps, type SyncFetcher } from './sync-core';
import { useOfflineStore } from './offline-store';

const TOKEN_KEY = 'marcadoresdj-token';

/** Authenticated fetcher for the sync engine (raw Response, needs status codes). */
export function createBrowserFetcher(): SyncFetcher {
  return async (path, init) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token =
      typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(path, { ...init, headers, cache: 'no-store' });
  };
}

/**
 * Run one full sync pass (triggered by the "Sincronizar" button).
 * Concurrency-guarded: a second call while syncing is a no-op.
 */
export async function runSync(): Promise<SyncResult> {
  const store = useOfflineStore.getState();
  if (store.syncing) {
    return { synced: 0, conflicts: [], remaining: await pendingCount() };
  }

  const ops = await getAllOps();
  if (ops.length === 0) {
    return { synced: 0, conflicts: [], remaining: 0 };
  }

  store.setSyncing(true);
  try {
    const core = await syncOps(ops, createBrowserFetcher());

    // Applied ops and permanent conflicts both leave the queue; ops of
    // an aborted pass simply stay for the next attempt.
    await removeOps([...core.doneSeqs, ...core.conflictSeqs]);

    const remaining = await pendingCount();
    const result: SyncResult = {
      synced: core.syncedCount,
      conflicts: core.conflicts,
      remaining,
      error: core.error,
    };

    if (core.error) {
      toast.error(`Sincronización incompleta: ${core.error}`, {
        description: `${result.synced} operación(es) aplicadas. Las demás siguen pendientes.`,
      });
    } else if (result.synced > 0 || core.conflictSeqs.length === 0) {
      toast.success(
        result.synced > 0
          ? `Sincronización completada: ${result.synced} operación(es)`
          : 'Todo estaba sincronizado',
      );
    }

    if (core.conflicts.length > 0) {
      const details = core.conflicts.map((c) => `• ${c.reason}`).join('\n');
      toast.warning(`${core.conflicts.length} operación(es) no aplicadas`, {
        description: details,
        duration: 10_000,
      });
    }

    // Views observe syncVersion to refetch server data.
    if (core.doneSeqs.length > 0 || core.conflictSeqs.length > 0) {
      useOfflineStore.getState().bumpSyncVersion();
    }

    return result;
  } finally {
    useOfflineStore.getState().setSyncing(false);
  }
}
