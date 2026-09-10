import { reportFetchFailure } from '@/lib/offline/connection';

const TOKEN_KEY = 'marcadoresdj-token';

/**
 * Thrown when a request fails at the network level (no response at all),
 * e.g. because the internet connection was lost. Distinct from HTTP
 * errors (4xx/5xx), which DO produce a server response.
 */
export class OfflineError extends Error {
  constructor(message = 'Sin conexión a internet') {
    super(message);
    this.name = 'OfflineError';
  }
}

/**
 * Core fetch wrapper that automatically attaches the JWT token
 * from localStorage and normalises error handling.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    // Network-level failure (offline, DNS, server unreachable): notify
    // the connectivity monitor for a fast verified check.
    reportFetchFailure();
    throw new OfflineError();
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Error en la petición');
  }

  return data as T;
}

/** Convenience GET wrapper. */
export function apiGet<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' });
}

/** Convenience POST wrapper. */
export function apiPost<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

/** Convenience PUT wrapper. */
export function apiPut<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

/** Convenience DELETE wrapper. */
export function apiDelete<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' });
}
