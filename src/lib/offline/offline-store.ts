/**
 * Zustand store for the offline layer.
 *
 * Deliberately kept "dumb": it only holds state + plain setters. The
 * connection monitor (connection.ts) and the queue (queue.ts) write to
 * it, components read from it. This avoids circular imports between
 * the queue and the store.
 */
import { create } from 'zustand';

interface OfflineState {
  /** Whether the site is reachable (heartbeat-verified, not just navigator.onLine). */
  isOnline: boolean;
  /** Number of operations waiting in the offline queue. */
  pendingCount: number;
  /** True while a sync pass is running (disables the sync button). */
  syncing: boolean;
  /** Incremented after every finished sync so open views can refetch. */
  syncVersion: number;

  setOnline: (online: boolean) => void;
  setPendingCount: (count: number) => void;
  setSyncing: (syncing: boolean) => void;
  bumpSyncVersion: () => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  pendingCount: 0,
  syncing: false,
  syncVersion: 0,

  setOnline: (online) => set({ isOnline: online }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setSyncing: (syncing) => set({ syncing }),
  bumpSyncVersion: () =>
    set((state) => ({ syncVersion: state.syncVersion + 1 })),
}));
