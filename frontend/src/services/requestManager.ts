import type { AxiosRequestConfig } from 'axios';

/* ──────────────────────────────────────────────────────────────
   Request Manager
   ─────────────────────────────────────────────────────────────
   Provides:
   • AbortController management (cancel in-flight requests)
   • Request deduplication (same GET URL → reuse running promise)
   • Concurrency limiting (configurable max parallel requests)
   ────────────────────────────────────────────────────────────── */

const MAX_CONCURRENT = 6;

/** In-flight dedup map:  key → { promise, controller } */
const inflight = new Map<
  string,
  { promise: Promise<any>; controller: AbortController; refCount: number }
>();

/** Pending queue when concurrency limit is reached */
const pending: Array<{
  key: string;
  run: () => Promise<any>;
  resolve: (v: any) => void;
  reject: (e: any) => void;
}> = [];

let active = 0;

/** Build a dedup key from method + URL + sorted params / query */
export function requestKey(config: AxiosRequestConfig): string {
  const method = (config.method || 'get').toUpperCase();
  const url = config.url || '';
  const params = config.params ? JSON.stringify(config.params, Object.keys(config.params).sort()) : '';
  return `${method}:${url}:${params}`;
}

/** Create a new AbortController and attach its signal to the config */
export function withAbort(config: AxiosRequestConfig): {
  config: AxiosRequestConfig;
  controller: AbortController;
} {
  const controller = new AbortController();
  return {
    config: { ...config, signal: controller.signal },
    controller,
  };
}

/** Cancel a specific request by its AbortController */
export function cancelRequest(controller: AbortController): void {
  if (!controller.signal.aborted) {
    controller.abort();
  }
}

/** Cancel all in-flight requests (e.g. on logout) */
export function cancelAllRequests(): void {
  inflight.forEach(({ controller }) => cancelRequest(controller));
  inflight.clear();
  pending.length = 0;
  active = 0;
}

/* ── Deduplication helpers ───────────────────────────────────── */

/**
 * Deduplicate GET requests: if an identical GET is already running,
 * return the same promise instead of issuing a new request.
 *
 * Usage:
 *   const data = await dedup(key, () => api.get('/foo'));
 */
export function dedup<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) {
    existing.refCount++;
    return existing.promise as Promise<T>;
  }

  const controller = new AbortController();
  const promise = run().finally(() => {
    const entry = inflight.get(key);
    if (entry) {
      entry.refCount--;
      if (entry.refCount <= 0) inflight.delete(key);
    }
  });

  inflight.set(key, { promise, controller, refCount: 1 });
  return promise;
}

/* ── Concurrency limiter ─────────────────────────────────────── */

function drain() {
  while (active < MAX_CONCURRENT && pending.length > 0) {
    const next = pending.shift()!;
    active++;
    next
      .run()
      .then(next.resolve, next.reject)
      .finally(() => {
        active--;
        drain();
      });
  }
}

/**
 * Enqueue a request through the concurrency limiter.
 * Resolves/rejects when the underlying request completes.
 */
export function enqueue<T>(key: string, run: () => Promise<T>): Promise<T> {
  if (active < MAX_CONCURRENT) {
    active++;
    return run().finally(() => {
      active--;
      drain();
    });
  }

  return new Promise<T>((resolve, reject) => {
    pending.push({ key, run, resolve, reject });
  });
}

/* ── Batch helper ────────────────────────────────────────────── */

/**
 * Fire multiple requests in parallel with concurrency & dedup.
 *
 * Usage:
 *   const [stats, tasks] = await batchRequests([
 *     () => api.get('/dashboard/stats'),
 *     () => api.get('/tasks'),
 *   ]);
 */
export function batchRequests<T extends readonly (() => Promise<any>)[]>(
  fns: T
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  return Promise.all(fns.map((fn) => enqueue('batch', fn))) as any;
}
