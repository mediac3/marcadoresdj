/**
 * MarcadoresDJ service worker — offline app shell.
 *
 * Goal: the SPA survives a page reload while offline. Strategies:
 * - /_next/static/*  → cache-first (immutable, content-hashed assets).
 * - navigations (/)  → network-first with cache fallback (fresh when
 *                      online, last-known shell when offline).
 * - other same-origin static assets (favicon, logo, uploads) →
 *                      stale-while-revalidate.
 * - /api/*           → NEVER intercepted (API responses are never cached;
 *                      the offline layer handles data via IndexedDB).
 *
 * Registered only in production builds (see ConnectivityManager).
 */

const CACHE_NAME = 'marcadoresdj-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Best-effort precache of the app shell document.
      await Promise.allSettled([
        cache.add(new Request('/', { cache: 'reload' })),
      ]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstDocument(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'reload' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = (await cache.match(request)) || (await caches.match('/'));
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || networkPromise || new Response('Offline', { status: 503 });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept the API — data offline-ness is handled by the queue.
  if (url.pathname.startsWith('/api/')) return;

  // Immutable build assets → cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // App shell navigations → network-first with cache fallback.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  // Other same-origin static assets → stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(request));
});
