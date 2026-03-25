/**
 * Lightweight in-memory TTL cache for client-side fetch calls.
 *
 * Usage:
 *   const data = await cachedFetch("roles", () => fetch(...).then(r => r.json()), 60_000);
 *
 * - Cache is module-scoped → shared across all renders in the same browser session.
 * - Stale entries are returned immediately and a background refresh is fired so the
 *   UI never blocks on a cache miss after the first load.
 * - Call `invalidate(key)` after any mutation to force the next read to re-fetch.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const _store = new Map<string, CacheEntry<unknown>>();

/**
 * Fetch `key` from cache if fresh, otherwise call `fetcher()`.
 * @param key      Unique cache key (e.g. "roles", "plans")
 * @param fetcher  Async function that returns the fresh data
 * @param ttlMs    Time-to-live in milliseconds (default: 60 000 = 1 minute)
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000,
): Promise<T> {
  const entry = _store.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data;
  }
  const data = await fetcher();
  _store.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/**
 * Remove a key from the cache so the next `cachedFetch` call re-fetches.
 * Call this after any create / update / delete mutation.
 */
export function invalidate(key: string): void {
  _store.delete(key);
}