/**
 * Client-side reconstruction of an event's effective state.
 *
 * When the page is reloaded while offline, the scoring view falls back
 * to the last cached GET /api/events/[id] response. That snapshot may
 * be older than the operations the user performed offline — this module
 * replays the queued ops over the snapshot so the UI shows exactly what
 * the user will get after syncing (status, timer, actions, comments).
 */
import type { OfflineOp } from './types';
import type { SportEvent, EventAction, Comment, Player, User } from '@/lib/store';

export interface ReplayContext {
  user: Pick<User, 'id' | 'username' | 'name'>;
}

/**
 * Find a player in the event's rosters, injecting the team id — roster
 * player objects from the event GET don't include `teamId`, but score
 * computation needs it to know which side gets the points.
 */
export function findPlayerWithTeam(
  event: SportEvent,
  playerId: string | null,
): Player | undefined {
  if (!playerId) return undefined;
  const inA = event.teamA?.players?.find((p) => p.id === playerId);
  if (inA && event.teamAId) return { ...inA, teamId: event.teamAId };
  const inB = event.teamB?.players?.find((p) => p.id === playerId);
  if (inB && event.teamBId) return { ...inB, teamId: event.teamBId };
  return undefined;
}

/** Build the optimistic local EventAction for a queued ACTION_CREATE op. */
function opToLocalAction(
  event: SportEvent,
  op: OfflineOp & { type: 'ACTION_CREATE' },
  ctx: ReplayContext,
): EventAction {
  return {
    id: op.action.id,
    eventId: event.id,
    playerId: op.action.playerId,
    player: findPlayerWithTeam(event, op.action.playerId),
    actionType: op.action.actionType,
    actionLabel: op.action.actionLabel,
    actionIcon: op.action.actionIcon,
    actionColor: op.action.actionColor,
    minute: op.action.minute,
    value: op.action.value,
    half: op.action.half,
    userId: ctx.user.id,
    cardPayment: null,
    createdAt: new Date(op.createdAt).toISOString(),
    // Marks actions that exist only in the offline queue (not yet on the server).
    pendingSync: true,
  };
}

/** Build the optimistic local Comment for a queued COMMENT_CREATE op. */
function opToLocalComment(
  event: SportEvent,
  op: OfflineOp & { type: 'COMMENT_CREATE' },
  ctx: ReplayContext,
): Comment {
  return {
    id: op.comment.id,
    eventId: event.id,
    content: op.comment.content,
    isAI: false,
    actionId: null,
    userId: ctx.user.id,
    user: {
      id: ctx.user.id,
      username: ctx.user.username,
      name: ctx.user.name,
    },
    createdAt: new Date(op.createdAt).toISOString(),
    pendingSync: true,
  };
}

/**
 * Apply queued offline ops (in replay order) over a cached event
 * snapshot. Pure: returns a new object, never mutates the input.
 */
export function replayOpsOnEvent(
  event: SportEvent,
  ops: OfflineOp[],
  ctx: ReplayContext,
): SportEvent {
  let next: SportEvent = {
    ...event,
    actions: [...(event.actions ?? [])],
    comments: [...(event.comments ?? [])],
  };

  for (const op of ops) {
    switch (op.type) {
      case 'START': {
        if (next.status === 'SCHEDULED') {
          next = {
            ...next,
            status: 'LIVE',
            startedAt: new Date(op.createdAt).toISOString(),
            currentHalf: next.currentHalf ?? '1',
          };
        }
        break;
      }
      case 'PAUSE_TO': {
        if (next.status === 'LIVE' || next.status === 'PAUSED') {
          next = { ...next, status: op.target };
        }
        break;
      }
      case 'TIMER': {
        next = {
          ...next,
          elapsedSeconds: op.elapsedSeconds,
          ...(op.half != null ? { currentHalf: op.half } : {}),
        };
        break;
      }
      case 'END': {
        if (next.status === 'LIVE' || next.status === 'PAUSED') {
          next = {
            ...next,
            status: 'FINISHED',
            endedAt: new Date(op.createdAt).toISOString(),
          };
        }
        break;
      }
      case 'ACTION_CREATE': {
        if (next.status !== 'LIVE' && next.status !== 'PAUSED') break;
        if (next.actions?.some((a) => a.id === op.action.id)) break;
        next = {
          ...next,
          // Server orders actions desc by createdAt → newest first.
          actions: [opToLocalAction(next, op, ctx), ...(next.actions ?? [])],
        };
        break;
      }
      case 'ACTION_DELETE': {
        next = {
          ...next,
          actions: (next.actions ?? []).filter((a) => a.id !== op.actionId),
        };
        break;
      }
      case 'COMMENT_CREATE': {
        if (next.comments?.some((c) => c.id === op.comment.id)) break;
        next = {
          ...next,
          comments: [opToLocalComment(next, op, ctx), ...(next.comments ?? [])],
        };
        break;
      }
    }
  }

  return next;
}
