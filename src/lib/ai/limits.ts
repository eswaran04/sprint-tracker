/**
 * Per-instance, in-memory guards for AI routes. App Hosting runs at most a couple of instances,
 * so this is a cost/abuse brake, not a global quota.
 */

/** Fixed-window limiter: `limit` hits per `windowMs` per key. */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { start: number; count: number }>();
  return {
    take(key: string): boolean {
      const t = now();
      const w = hits.get(key);
      if (!w || t - w.start >= windowMs) {
        hits.set(key, { start: t, count: 1 });
        if (hits.size > 10_000) for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
        return true;
      }
      if (w.count >= limit) return false;
      w.count++;
      return true;
    },
    reset: () => hits.clear(),
  };
}

/** Tiny LRU built on Map insertion order. */
export function createLru<V>(max: number) {
  const m = new Map<string, V>();
  return {
    get(key: string): V | undefined {
      const v = m.get(key);
      if (v !== undefined) {
        m.delete(key);
        m.set(key, v);
      }
      return v;
    },
    set(key: string, v: V) {
      m.delete(key);
      m.set(key, v);
      if (m.size > max) m.delete(m.keys().next().value!);
    },
    get size() {
      return m.size;
    },
    clear: () => m.clear(),
  };
}
