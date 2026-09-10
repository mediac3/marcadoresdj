/**
 * Global Timer Service
 *
 * Keeps match timers running even when the ScoringView component
 * unmounts (e.g. navigating to another page). The timer ticks every
 * second via a single shared interval.
 */

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface TimerEntry {
  /** Elapsed seconds when the timer was last synced/resumed. */
  elapsedSeconds: number;
  /** Whether the timer is actively counting. */
  isRunning: boolean;
  /** Date.now() timestamp when the timer was last started/resumed. */
  startedAt: number;
}

type Listener = (eventId: string, elapsed: number) => void;

/* ── Internal state ─────────────────────────────────────────────────────────── */

const timers = new Map<string, TimerEntry>();
let tickInterval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

/* ── Tick ───────────────────────────────────────────────────────────────────── */

function tick() {
  const now = Date.now();
  for (const [eventId, entry] of timers) {
    if (entry.isRunning) {
      const elapsed =
        entry.elapsedSeconds + Math.floor((now - entry.startedAt) / 1000);
      listeners.forEach((fn) => fn(eventId, elapsed));
    }
  }
}

function ensureInterval() {
  if (!tickInterval) {
    tickInterval = setInterval(tick, 1000);
  }
}

function maybeStopInterval() {
  if (tickInterval && timers.size === 0) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

/* ── Public API ─────────────────────────────────────────────────────────────── */

/* ── Persistence ───────────────────────────────────────────────────────────── */
/**
 * Snapshot running timers to localStorage so the clocks survive a page
 * reload (including offline reloads, where the server snapshot may be
 * minutes old). Only written on state changes, never on every tick —
 * `startedAt` lets the live elapsed time be reconstructed exactly.
 */

const TIMER_STORAGE_KEY = 'marcadoresdj-timers';

function persistTimers(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const snapshot = Array.from(timers.entries()).map(([eventId, entry]) => ({
      eventId,
      elapsedSeconds: entry.elapsedSeconds,
      isRunning: entry.isRunning,
      startedAt: entry.startedAt,
    }));
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage full or unavailable — the in-memory timers still work.
  }
}

function restoreTimers(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return;
    const snapshot = JSON.parse(raw) as Array<{
      eventId: string;
      elapsedSeconds: number;
      isRunning: boolean;
      startedAt: number;
    }>;
    if (!Array.isArray(snapshot)) return;
    for (const entry of snapshot) {
      if (
        typeof entry?.eventId === 'string' &&
        typeof entry.elapsedSeconds === 'number' &&
        typeof entry.startedAt === 'number' &&
        !timers.has(entry.eventId)
      ) {
        timers.set(entry.eventId, {
          elapsedSeconds: entry.elapsedSeconds,
          isRunning: Boolean(entry.isRunning),
          startedAt: entry.startedAt,
        });
      }
    }
    if (timers.size > 0) ensureInterval();
  } catch {
    // Corrupted snapshot — start clean.
  }
}

if (typeof window !== 'undefined') {
  restoreTimers();
}

/**
 * Register or update a timer for a given event.
 * Called when the scoring view mounts or when the timer state changes.
 */
export function registerTimer(
  eventId: string,
  elapsedSeconds: number,
  isRunning: boolean,
): void {
  timers.set(eventId, {
    elapsedSeconds,
    isRunning,
    startedAt: Date.now(),
  });
  persistTimers();
  if (isRunning) ensureInterval();
}

/**
 * Sync the current elapsed time back to the global service.
 * Called periodically (every 10 s) or when the user pauses/resumes.
 */
export function syncTimer(
  eventId: string,
  elapsedSeconds: number,
  isRunning: boolean,
): void {
  const entry = timers.get(eventId);
  if (entry) {
    entry.elapsedSeconds = elapsedSeconds;
    entry.isRunning = isRunning;
    entry.startedAt = Date.now();
  } else {
    registerTimer(eventId, elapsedSeconds, isRunning);
    return;
  }
  persistTimers();
}

/**
 * Get the current elapsed seconds for an event.
 * If running, adds the time that passed since the last register/sync.
 */
export function getTimerElapsed(eventId: string): number {
  const entry = timers.get(eventId);
  if (!entry) return 0;
  if (!entry.isRunning) return entry.elapsedSeconds;
  return (
    entry.elapsedSeconds +
    Math.floor((Date.now() - entry.startedAt) / 1000)
  );
}

/**
 * Remove a timer (e.g. when an event ends).
 */
export function removeTimer(eventId: string): void {
  timers.delete(eventId);
  persistTimers();
  maybeStopInterval();
}

/**
 * Check if a timer exists for the given event.
 */
export function hasTimer(eventId: string): boolean {
  return timers.has(eventId);
}

/**
 * Subscribe to per-second tick updates for ALL running timers.
 * Returns an unsubscribe function.
 */
export function subscribeToTimer(fn: Listener): () => void {
  listeners.add(fn);
  // If there are running timers, ensure the interval is active
  if (timers.size > 0) ensureInterval();
  return () => {
    listeners.delete(fn);
  };
}