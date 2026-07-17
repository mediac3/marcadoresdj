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
  }
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