/**
 * Connectivity monitor.
 *
 * `navigator.onLine` only knows about the local network interface — it
 * stays `true` when the router loses internet. This monitor verifies
 * real reachability of the site with a lightweight heartbeat
 * (`GET /api/ping`, 204, no auth) and combines three signals:
 *
 * 1. `offline` browser event      → offline immediately.
 * 2. `online` browser event       → verify with a ping before trusting it.
 * 3. Periodic heartbeat (30 s)    → 2 consecutive failed pings → offline;
 *    one success → online. A failed API fetch triggers an immediate
 *    check (via `reportFetchFailure`) for fast detection.
 */
import { useOfflineStore } from './offline-store';

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 1_200;

let started = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastCheckAt = 0;
let inflightCheck: Promise<boolean> | null = null;

/** Single reachability probe. */
async function ping(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
    const res = await fetch('/api/ping', {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Verified connectivity check. A first failed ping is retried once
 * after a short delay to filter transient blips; offline requires both
 * to fail.
 */
export async function checkNow(): Promise<boolean> {
  if (inflightCheck) return inflightCheck;

  inflightCheck = (async () => {
    lastCheckAt = Date.now();
    const store = useOfflineStore.getState();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      store.setOnline(false);
      return false;
    }

    if (await ping()) {
      store.setOnline(true);
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    const ok = await ping();
    store.setOnline(ok);
    return ok;
  })();

  const result = await inflightCheck;
  inflightCheck = null;
  return result;
}

/**
 * Called by `apiFetch` when a request fails at the network level.
 * Triggers an immediate verified check (rate-limited to one per 5 s so
 * a burst of failed requests doesn't spam the endpoint).
 */
export function reportFetchFailure(): void {
  if (!started) return;
  if (Date.now() - lastCheckAt < 5_000) return;
  void checkNow();
}

/** Boot the monitor (idempotent). Client-side only. */
export function startConnectionMonitor(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  window.addEventListener('offline', () => {
    useOfflineStore.getState().setOnline(false);
  });

  window.addEventListener('online', () => {
    void checkNow();
  });

  heartbeatTimer = setInterval(() => void checkNow(), HEARTBEAT_INTERVAL_MS);

  // Assume online at boot, verify in the background.
  void checkNow();
}

/** Stop the monitor (tests / hot reload hygiene). */
export function stopConnectionMonitor(): void {
  started = false;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
