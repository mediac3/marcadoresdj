/**
 * Offline operation queue (the "temporary database").
 *
 * Enqueues user mutations performed while offline into IndexedDB and
 * applies compaction rules so the queue stays minimal and the replay
 * stays correct:
 *
 * 1. TIMER — only the latest value per event matters (the server also
 *    treats it as last-write-wins). A new TIMER removes previous TIMER
 *    ops of the same event *within the same post-END segment*.
 * 2. ACTION_DELETE — if the matching ACTION_CREATE is still pending for
 *    the same action id, both cancel out (net effect: nothing happened)
 *    and nothing is enqueued.
 *
 * Every mutation appends `seq` via IndexedDB autoIncrement, which
 * preserves the exact order the user performed the operations in.
 */
import { v4 as uuidv4 } from 'uuid';
import type { OfflineOp, QueuedAction, QueuedComment } from './types';
import {
  STORE_EVENT_CACHE,
  STORE_OPS,
  STORE_READ_CACHE,
  idbCount,
  idbDelete,
  idbDeleteWhere,
  idbGet,
  idbGetAll,
  idbPut,
} from './idb';
import { useOfflineStore } from './offline-store';

/* ── Internal helpers ─────────────────────────────────────────────────────── */

/** Notify the store that the pending count changed. */
async function refreshCount(): Promise<void> {
  useOfflineStore.getState().setPendingCount(await idbCount(STORE_OPS));
}

async function getOpsForEvent(eventId: string): Promise<OfflineOp[]> {
  const all = await idbGetAll<OfflineOp>(STORE_OPS);
  return all.filter((op) => op.eventId === eventId);
}

/**
 * Index (in queue order) of the last END op for the event, or -1.
 * Compaction must never cross an END: ops before an END belong to a
 * "match segment" that was already closed.
 */
function lastEndIndex(ops: OfflineOp[]): number {
  for (let i = ops.length - 1; i >= 0; i--) {
    if (ops[i].type === 'END') return i;
  }
  return -1;
}

/**
 * Distributive Omit over a discriminated union (plain `Omit` on a union
 * collapses it and loses the discriminant fields).
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** An operation without its seq — IndexedDB assigns it on insert. */
type OpDraft = DistributiveOmit<OfflineOp, 'seq'>;

async function appendOp(op: OpDraft): Promise<void> {
  // `seq` is omitted → IndexedDB autoIncrement assigns it, preserving order.
  await idbPut(STORE_OPS, op);
  await refreshCount();
}

/* ── Public queue API ─────────────────────────────────────────────────────── */

/** All queued operations in insertion (replay) order. */
export async function getAllOps(): Promise<OfflineOp[]> {
  const ops = await idbGetAll<OfflineOp>(STORE_OPS);
  return ops.sort((a, b) => a.seq - b.seq);
}

/** Queued operations for one event, in replay order. */
export async function getOpsForEventOrdered(eventId: string): Promise<OfflineOp[]> {
  return (await getOpsForEvent(eventId)).sort((a, b) => a.seq - b.seq);
}

export async function removeOps(seqs: number[]): Promise<void> {
  if (seqs.length === 0) return;
  await Promise.all(seqs.map((seq) => idbDelete(STORE_OPS, seq)));
  await refreshCount();
}

export async function pendingCount(): Promise<number> {
  return idbCount(STORE_OPS);
}

export async function clearQueue(): Promise<void> {
  await idbDeleteWhere(STORE_OPS, () => true);
  await refreshCount();
}

/* ── Typed enqueue functions ──────────────────────────────────────────────── */

export function enqueueTimer(
  eventId: string,
  elapsedSeconds: number,
  half?: string | null,
): Promise<void> {
  return (async () => {
    // Compact: drop previous TIMER ops after the last END of this event.
    const ops = await getOpsForEvent(eventId);
    const cutoff = lastEndIndex(ops);
    const staleSeqs = ops
      .filter((op, i) => i > cutoff && op.type === 'TIMER')
      .map((op) => op.seq);
    if (staleSeqs.length > 0) {
      await Promise.all(staleSeqs.map((seq) => idbDelete(STORE_OPS, seq)));
    }
    await appendOp({ type: 'TIMER', eventId, elapsedSeconds, half: half ?? null, createdAt: Date.now() });
  })();
}

export function enqueueStart(eventId: string): Promise<void> {
  return appendOp({ type: 'START', eventId, createdAt: Date.now() });
}

export function enqueuePauseTo(
  eventId: string,
  target: 'LIVE' | 'PAUSED',
): Promise<void> {
  return appendOp({ type: 'PAUSE_TO', eventId, target, createdAt: Date.now() });
}

export function enqueueEnd(eventId: string): Promise<void> {
  return appendOp({ type: 'END', eventId, createdAt: Date.now() });
}

export function newActionId(): string {
  return uuidv4();
}

export function enqueueActionCreate(eventId: string, action: QueuedAction): Promise<void> {
  return appendOp({ type: 'ACTION_CREATE', eventId, action, createdAt: Date.now() });
}

/**
 * Queue the removal of an action. If the action was created offline and
 * its ACTION_CREATE is still pending, both ops cancel out and nothing
 * is enqueued. Returns true when the pending create was cancelled.
 */
export async function enqueueActionDelete(
  eventId: string,
  actionId: string,
): Promise<boolean> {
  const ops = await getOpsForEvent(eventId);
  const cutoff = lastEndIndex(ops);
  const createIndex = ops.findIndex(
    (op, i) =>
      i > cutoff &&
      op.type === 'ACTION_CREATE' &&
      op.action.id === actionId,
  );
  if (createIndex !== -1) {
    await idbDelete(STORE_OPS, ops[createIndex].seq);
    await refreshCount();
    return true;
  }
  await appendOp({ type: 'ACTION_DELETE', eventId, actionId, createdAt: Date.now() });
  return false;
}

export function newCommentId(): string {
  return uuidv4();
}

export function enqueueCommentCreate(eventId: string, comment: QueuedComment): Promise<void> {
  return appendOp({ type: 'COMMENT_CREATE', eventId, comment, createdAt: Date.now() });
}

/* ── Read caches (offline navigation fallbacks) ──────────────────────────── */

/** Cache a successful GET /api/events/[id] response for offline reuse. */
export async function cacheEvent(event: unknown): Promise<void> {
  if (!event || typeof event !== 'object') return;
  const record = event as { id?: string };
  if (!record.id) return;
  await idbPut(STORE_EVENT_CACHE, { eventId: record.id, event, cachedAt: Date.now() });
}

export async function getCachedEvent<T = unknown>(eventId: string): Promise<T | null> {
  const record = await idbGet<{ event: T }>(STORE_EVENT_CACHE, eventId);
  return record?.event ?? null;
}

/** Cache any GET response (event list, sport action catalog…) by path. */
export async function cacheRead(key: string, data: unknown): Promise<void> {
  await idbPut(STORE_READ_CACHE, { key, data, cachedAt: Date.now() });
}

export async function getCachedRead<T = unknown>(key: string): Promise<T | null> {
  const record = await idbGet<{ data: T }>(STORE_READ_CACHE, key);
  return record?.data ?? null;
}
