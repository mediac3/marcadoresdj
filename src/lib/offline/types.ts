/**
 * Offline queue operation types.
 *
 * Each operation represents ONE user mutation performed while offline.
 * Operations are persisted in IndexedDB (see `idb.ts`) with a monotonic
 * `seq` (autoIncrement keyPath) that preserves the order in which the
 * user performed them — critical for correct replay, because the server
 * enforces status transitions (SCHEDULED → LIVE ⇄ PAUSED → FINISHED).
 *
 * Idempotency:
 * - ACTION_CREATE / COMMENT_CREATE carry a client-generated `id` (uuid)
 *   that the server accepts as the row's primary key. Replaying them
 *   twice never duplicates data.
 * - PAUSE_TO stores the INTENDED status, not the HTTP call, because
 *   `POST /api/events/[id]/pause` is a toggle.
 */

/** Payload for ACTION_CREATE — mirrors the POST /api/events/[id]/actions body. */
export interface QueuedAction {
  /** Client-generated uuid — becomes the EventAction PK on the server (idempotency key). */
  id: string;
  playerId: string | null;
  actionType: string;
  actionLabel: string;
  actionIcon: string;
  actionColor: string;
  value: number;
  minute: number | null;
  half: string | null;
}

/** Payload for COMMENT_CREATE. */
export interface QueuedComment {
  /** Client-generated uuid — becomes the Comment PK on the server (idempotency key). */
  id: string;
  content: string;
}

interface OfflineOpBase {
  /** Monotonic sequence number assigned by IndexedDB autoIncrement. */
  seq: number;
  eventId: string;
  createdAt: number;
}

export type OfflineOp =
  | (OfflineOpBase & { type: 'TIMER'; elapsedSeconds: number; half?: string | null })
  | (OfflineOpBase & { type: 'START' })
  | (OfflineOpBase & { type: 'PAUSE_TO'; target: 'LIVE' | 'PAUSED' })
  | (OfflineOpBase & { type: 'END' })
  | (OfflineOpBase & { type: 'ACTION_CREATE'; action: QueuedAction })
  | (OfflineOpBase & { type: 'ACTION_DELETE'; actionId: string })
  | (OfflineOpBase & { type: 'COMMENT_CREATE'; comment: QueuedComment });

export type OfflineOpType = OfflineOp['type'];

/** A conflict reported by the sync engine for an operation that could not be applied. */
export interface SyncConflict {
  eventId: string;
  opType: OfflineOpType;
  reason: string;
}

/** Result of a full sync pass. */
export interface SyncResult {
  /** Number of operations successfully applied (or safely skipped as no-ops). */
  synced: number;
  /** Operations that can never be applied (removed from the queue with a reason). */
  conflicts: SyncConflict[];
  /** Operations still left in the queue (sync was interrupted). */
  remaining: number;
  /** Fatal error that stopped the sync (e.g. session expired, connection lost). */
  error?: string;
}
