/**
 * Minimal promise-based IndexedDB wrapper for the offline layer.
 *
 * Zero dependencies. Everything degrades gracefully: if IndexedDB is
 * unavailable (private browsing, quota errors…), all functions resolve
 * to empty/null instead of throwing — the app keeps working online-only.
 *
 * Database layout (`marcadoresdj-offline`, version 1):
 * - `ops`         → offline operation queue, keyPath `seq` (autoIncrement
 *                   keeps insertion order — the replay order).
 * - `event_cache` → last successful GET /api/events/[id] per event
 *                   (offline fallback for the scoring & report views).
 * - `read_cache`  → generic read cache keyed by request path
 *                   (event list, sport action catalog…).
 */

const DB_NAME = 'marcadoresdj-offline';
const DB_VERSION = 1;

export const STORE_OPS = 'ops';
export const STORE_EVENT_CACHE = 'event_cache';
export const STORE_READ_CACHE = 'read_cache';

let dbPromise: Promise<IDBDatabase> | null = null;

function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  if (!idbAvailable()) {
    return Promise.reject(new Error('IndexedDB no disponible'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_OPS)) {
          db.createObjectStore(STORE_OPS, { keyPath: 'seq', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_EVENT_CACHE)) {
          db.createObjectStore(STORE_EVENT_CACHE, { keyPath: 'eventId' });
        }
        if (!db.objectStoreNames.contains(STORE_READ_CACHE)) {
          db.createObjectStore(STORE_READ_CACHE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error('Error abriendo IndexedDB'));
      };
    });
  }
  return dbPromise;
}

/** Run a read/write transaction on one store; resolves with the request result. */
function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (objectStore: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        transaction.oncomplete = () => resolve(request.result as T);
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      }),
  );
}

/* ── Generic helpers (all fail-safe: log & fall back) ────────────────────── */

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | null> {
  try {
    return (await tx<T>(store, 'readonly', (s) => s.get(key))) ?? null;
  } catch {
    return null;
  }
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  try {
    return (await tx<T[]>(store, 'readonly', (s) => s.getAll())) ?? [];
  } catch {
    return [];
  }
}

export async function idbPut(store: string, value: unknown): Promise<void> {
  try {
    await tx(store, 'readwrite', (s) => s.put(value as never));
  } catch {
    /* offline persistence is best-effort */
  }
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  try {
    await tx(store, 'readwrite', (s) => s.delete(key));
  } catch {
    /* ignore */
  }
}

export async function idbCount(store: string): Promise<number> {
  try {
    return (await tx<number>(store, 'readonly', (s) => s.count())) ?? 0;
  } catch {
    return 0;
  }
}

/** Delete every record in `store` matching `predicate` (single transaction). */
export async function idbDeleteWhere<T>(
  store: string,
  predicate: (record: T) => boolean,
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      const cursorReq = objectStore.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        if (predicate(cursor.value as T)) cursor.delete();
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    /* ignore */
  }
}
