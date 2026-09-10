/**
 * Pure sync engine — replays queued offline operations against the live
 * API, in the exact order the user performed them.
 *
 * This module has NO browser dependencies (no IndexedDB, no stores):
 * it takes an array of ops plus a fetcher and returns which ops were
 * applied, which conflict, and which seqs can be removed from the
 * queue. That makes it directly testable in Node against a real server
 * (see scripts/test-offline-sync.ts).
 *
 * Correctness rules (matching the server's route guards):
 * - The event's REAL server status is fetched first; every op is applied
 *   against that status, skipping no-ops:
 *     · START        → only if SCHEDULED (skip if already LIVE/PAUSED;
 *                       conflict if FINISHED)
 *     · PAUSE_TO(t)  → the /pause route TOGGLES, so we only call it when
 *                       the current status differs from the target
 *     · ACTION/COMMENT CREATE → only while LIVE/PAUSED; the client id
 *                       makes retries idempotent server-side
 *     · ACTION_DELETE→ 404 counts as success (already deleted)
 *     · TIMER        → coalesced: only the last value is POSTed, right
 *                       before an END (if any) and once at the end
 *     · END          → apply the pending TIMER first, then /end
 * - A 400 response means the op can never apply in the current state:
 *   it is dropped as a conflict, not retried forever.
 * - 401 aborts the whole pass (session expired — ops stay queued).
 * - Network/5xx failures abort the pass; applied ops are still returned
 *   and the rest remain queued for the next attempt.
 */
import type { OfflineOp, SyncConflict } from './types';

export type SyncFetcher = (
  path: string,
  init?: { method?: string; body?: string },
) => Promise<Response>;

export interface SyncCoreResult {
  /** seqs that were applied (or safely skipped) — safe to remove from the queue. */
  doneSeqs: number[];
  /** seqs dropped because they can never be applied — remove with a conflict report. */
  conflictSeqs: number[];
  conflicts: SyncConflict[];
  /** Number of operations successfully applied (or safely skipped). */
  syncedCount: number;
  /** Fatal error that stopped the pass (ops not listed above stay queued). */
  error?: string;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function syncOps(
  ops: OfflineOp[],
  fetcher: SyncFetcher,
): Promise<SyncCoreResult> {
  const doneSeqs: number[] = [];
  const conflictSeqs: number[] = [];
  const conflicts: SyncConflict[] = [];
  let syncedCount = 0;
  let fatal: string | undefined;

  const conflict = (op: OfflineOp, reason: string) => {
    conflictSeqs.push(op.seq);
    conflicts.push({ eventId: op.eventId, opType: op.type, reason });
  };
  const done = (op: OfflineOp) => {
    doneSeqs.push(op.seq);
    syncedCount++;
  };

  // Group ops by event, preserving global insertion order between events.
  const byEvent = new Map<string, OfflineOp[]>();
  for (const op of ops) {
    const list = byEvent.get(op.eventId) ?? [];
    list.push(op);
    byEvent.set(op.eventId, list);
  }

  outer: for (const [eventId, eventOps] of byEvent) {
    let aborted = false;

    /** Stop the current event's replay and the whole pass (first error wins). */
    const abort = (message: string) => {
      aborted = true;
      fatal = fatal ?? message;
    };

    // 1. Real server state for this event.
    let status: string | null = null;
    let getRes: Response;
    try {
      getRes = await fetcher(`/api/events/${eventId}`);
    } catch {
      abort('Conexión perdida durante la sincronización');
      break;
    }
    if (getRes.status === 401) {
      abort('Sesión expirada — inicia sesión de nuevo para sincronizar');
      break;
    }
    if (getRes.status === 404) {
      // Event deleted on the server: its ops can never apply.
      for (const op of eventOps) conflict(op, 'El evento ya no existe en el servidor');
      continue;
    }
    if (!getRes.ok) {
      abort(`No se pudo leer el evento (HTTP ${getRes.status})`);
      break;
    }
    try {
      status =
        ((await getRes.json()) as { event?: { status?: string } }).event?.status ??
        null;
    } catch {
      abort('Respuesta inválida del servidor');
      break;
    }

    // 2. Replay in order.
    // Coalesced timer state: only the latest snapshot is POSTed; the
    // seqs of every consumed TIMER op are marked done when flushed.
    let timerValue: { elapsedSeconds: number; half?: string | null } | null =
      null;
    let timerSeqs: number[] = [];

    /** POST the latest accumulated TIMER snapshot. Returns false on failure. */
    const flushTimer = async (): Promise<boolean> => {
      if (!timerValue || status === null) return true;
      if (status !== 'LIVE' && status !== 'PAUSED') {
        // Timer snapshots only apply while the event runs; the ops are
        // consumed either way (the END op carries the final intent).
        doneSeqs.push(...timerSeqs);
        syncedCount += timerSeqs.length;
        timerValue = null;
        timerSeqs = [];
        return true;
      }
      let res: Response;
      try {
        res = await fetcher(`/api/events/${eventId}/timer`, {
          method: 'POST',
          body: JSON.stringify({
            elapsedSeconds: timerValue.elapsedSeconds,
            ...(timerValue.half != null ? { half: timerValue.half } : {}),
          }),
        });
      } catch {
        return false;
      }
      if (res.status === 401) {
        abort('Sesión expirada — inicia sesión de nuevo para sincronizar');
        return false;
      }
      // 400 = event not running right now (race with someone else's END): consume.
      if (res.ok || res.status === 400) {
        doneSeqs.push(...timerSeqs);
        syncedCount += timerSeqs.length;
        timerValue = null;
        timerSeqs = [];
        return true;
      }
      return false;
    };

    for (const op of eventOps) {
      if (aborted) break;

      switch (op.type) {
        case 'TIMER': {
          timerValue = { elapsedSeconds: op.elapsedSeconds, half: op.half };
          timerSeqs = [...timerSeqs, op.seq];
          break;
        }

        case 'START': {
          if (status === 'SCHEDULED') {
            let res: Response;
            try {
              res = await fetcher(`/api/events/${eventId}/start`, { method: 'POST' });
            } catch {
              abort('Conexión perdida durante la sincronización');
              break;
            }
            if (res.status === 401) {
              abort('Sesión expirada — inicia sesión de nuevo para sincronizar');
              break;
            }
            if (res.ok) {
              status = 'LIVE';
              done(op);
            } else if (res.status === 400) {
              // Someone else started it concurrently — nothing to do.
              done(op);
            } else {
              abort(`No se pudo iniciar el evento (${await readError(res)})`);
            }
          } else {
            // Already LIVE/PAUSED… or FINISHED — a finished event was
            // necessarily started, so the intent is satisfied either way.
            done(op);
          }
          break;
        }

        case 'PAUSE_TO': {
          if (status === 'FINISHED') {
            // The event is over — pausing/resuming is moot, and it may
            // have finished via our own replayed END (full-queue retry).
            done(op);
          } else if (status === 'LIVE' || status === 'PAUSED') {
            if (status !== op.target) {
              let res: Response;
              try {
                res = await fetcher(`/api/events/${eventId}/pause`, {
                  method: 'POST',
                });
              } catch {
                abort('Conexión perdida durante la sincronización');
                break;
              }
              if (res.status === 401) {
                abort('Sesión expirada — inicia sesión de nuevo para sincronizar');
                break;
              }
              if (res.ok) {
                status = op.target;
                done(op);
              } else if (res.status === 400) {
                done(op); // state moved concurrently; intent satisfied elsewhere
              } else {
                abort(`No se pudo pausar/reanudar (${await readError(res)})`);
              }
            } else {
              done(op); // already at the intended status
            }
          } else {
            conflict(op, 'El evento no está iniciado en el servidor');
          }
          break;
        }

        case 'ACTION_CREATE': {
          // Always POST: the client id makes retries idempotent (the
          // server returns the existing row on duplicate), and a 400
          // signals a genuinely inapplicable action (e.g. event finished
          // by someone else before this action existed).
          let res: Response;
          try {
            res = await fetcher(`/api/events/${eventId}/actions`, {
              method: 'POST',
              // op.action already includes the client id — sent as the
              // row PK so retries are idempotent.
              body: JSON.stringify(op.action),
            });
          } catch {
            abort('Conexión perdida durante la sincronización');
            break;
          }
          if (res.status === 401) {
            abort('Sesión expirada — inicia sesión de nuevo para sincronizar');
            break;
          }
          if (res.ok) {
            done(op);
          } else if (res.status === 400) {
            conflict(op, `Acción rechazada: ${await readError(res)}`);
          } else {
            abort(`No se pudo registrar la acción (${await readError(res)})`);
          }
          break;
        }

        case 'ACTION_DELETE': {
          let res: Response;
          try {
            res = await fetcher(`/api/events/${eventId}/actions/${op.actionId}`, {
              method: 'DELETE',
            });
          } catch {
            abort('Conexión perdida durante la sincronización');
            break;
          }
          if (res.status === 401) {
            abort('Sesión expirada — inicia sesión de nuevo para sincronizar');
            break;
          }
          if (res.ok || res.status === 404) {
            done(op); // 404 = already deleted
          } else if (res.status === 400) {
            conflict(op, `No se pudo eliminar la acción: ${await readError(res)}`);
          } else {
            abort(`No se pudo eliminar la acción (${await readError(res)})`);
          }
          break;
        }

        case 'COMMENT_CREATE': {
          let res: Response;
          try {
            res = await fetcher(`/api/events/${eventId}/comments`, {
              method: 'POST',
              // op.comment already includes the client id (idempotency).
              body: JSON.stringify(op.comment),
            });
          } catch {
            abort('Conexión perdida durante la sincronización');
            break;
          }
          if (res.status === 401) {
            abort('Sesión expirada — inicia sesión de nuevo para sincronizar');
            break;
          }
          if (res.ok) {
            done(op);
          } else if (res.status === 400) {
            conflict(op, `Comentario rechazado: ${await readError(res)}`);
          } else {
            abort(`No se pudo guardar el comentario (${await readError(res)})`);
          }
          break;
        }

        case 'END': {
          // Apply the accumulated timer first so the final elapsed time
          // is persisted on the server before the event closes.
          const timerOk = await flushTimer();
          if (aborted) break;
          if (!timerOk) {
            abort('Conexión perdida durante la sincronización');
            break;
          }

          if (status === 'FINISHED') {
            done(op); // someone finished it concurrently
          } else if (status === 'SCHEDULED') {
            conflict(op, 'El evento no fue iniciado en el servidor');
          } else {
            let res: Response;
            try {
              res = await fetcher(`/api/events/${eventId}/end`, { method: 'POST' });
            } catch {
              abort('Conexión perdida durante la sincronización');
              break;
            }
            if (res.status === 401) {
              abort('Sesión expirada — inicia sesión de nuevo para sincronizar');
              break;
            }
            if (res.ok) {
              status = 'FINISHED';
              done(op);
            } else if (res.status === 400) {
              conflict(op, `No se pudo finalizar: ${await readError(res)}`);
            } else {
              abort(`No se pudo finalizar el evento (${await readError(res)})`);
            }
          }
          break;
        }
      }
    }

    if (aborted) break outer;

    // 3. Flush any remaining timer snapshot (event still LIVE/PAUSED).
    const ok = await flushTimer();
    if (!ok) {
      fatal = fatal ?? 'Conexión perdida durante la sincronización';
      break;
    }
    if (aborted) break;
  }

  return { doneSeqs, conflictSeqs, conflicts, syncedCount, error: fatal };
}
