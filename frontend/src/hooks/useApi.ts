import { useState, useEffect, useCallback, useRef } from 'react';
import type { AxiosResponse, AxiosError } from 'axios';
import api from '../services/api';
import { dedup, requestKey, cancelRequest, withAbort, batchRequests } from '../services/requestManager';

/* ──────────────────────────────────────────────────────────────
   useApi — React hook for safe concurrent API calls
   ─────────────────────────────────────────────────────────────
   ✓ Auto-cancels in-flight requests on unmount (prevents
     "setState on unmounted component" leaks)
   ✓ Deduplicates identical GET requests
   ✓ Provides loading / error / data state
   ✓ Supports manual refetch and on-demand calls
   ────────────────────────────────────────────────────────────── */

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiOptions {
  /** Skip the automatic fetch on mount */
  manual?: boolean;
  /** Deduplicate identical GET requests (default: true) */
  deduplicate?: boolean;
}

/**
 * Hook for a single API endpoint.
 *
 * @example
 * const { data, loading, error, refetch } = useApi<Stats>('/dashboard/stats');
 * const { execute } = useApi<Task>('/tasks', { manual: true });
 * await execute({ method: 'POST', data: newTask });
 */
export function useApi<T = any>(
  url: string,
  options: UseApiOptions = {}
) {
  const { manual = false, deduplicate = true } = options;
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: !manual,
    error: null,
  });

  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  // Cancel previous request when a new one starts or on unmount
  const abort = useCallback(() => {
    if (controllerRef.current) {
      cancelRequest(controllerRef.current);
      controllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abort();
    };
  }, [abort]);

  /** Execute a request (GET by default). Returns response data. */
  const execute = useCallback(
    async (overrides?: { method?: string; data?: any; params?: any; url?: string }): Promise<T | null> => {
      abort(); // cancel any pending request

      const config = {
        url: overrides?.url || url,
        method: overrides?.method || 'get',
        data: overrides?.data,
        params: overrides?.params,
      };

      const { config: signalConfig, controller } = withAbort(config);
      controllerRef.current = controller;

      if (mountedRef.current) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }

      try {
        let response: AxiosResponse<{ success: boolean; data: T }>;
        const key = requestKey(config);

        if (deduplicate && config.method.toLowerCase() === 'get') {
          response = await dedup(key, () => api.request(signalConfig));
        } else {
          response = await api.request(signalConfig);
        }

        if (mountedRef.current) {
          const payload = response.data?.data ?? (response.data as any);
          setState({ data: payload, loading: false, error: null });
          return payload;
        }
        return null;
      } catch (err: any) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
          // Request was aborted — don't update state
          return null;
        }
        const message =
          (err as AxiosError<{ message?: string }>)?.response?.data?.message ||
          err?.message ||
          'Request failed';
        if (mountedRef.current) {
          setState({ data: null, loading: false, error: message });
        }
        throw err;
      }
    },
    [url, abort, deduplicate]
  );

  /** Convenience: re-run the same GET */
  const refetch = useCallback(() => execute(), [execute]);

  // Auto-fetch on mount unless manual
  useEffect(() => {
    if (!manual) {
      execute().catch(() => {}); // errors surfaced via state.error
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, manual]);

  return { ...state, execute, refetch, abort };
}

/* ──────────────────────────────────────────────────────────────
   useApiBatch — fire multiple requests in parallel, safely
   ─────────────────────────────────────────────────────────────
   Cancels all on unmount. Returns combined loading / error.
   ────────────────────────────────────────────────────────────── */

interface BatchState<T extends any[]> {
  data: { [K in keyof T]: T[K] | null };
  loading: boolean;
  error: string | null;
}

/**
 * @example
 * const { data, loading, refetch } = useApiBatch(
 *   () => api.get('/dashboard/stats?orgId=1'),
 *   () => api.get('/dashboard/due-tasks?orgId=1'),
 * );
 * const [statsRes, dueRes] = data;
 */
export function useApiBatch<T extends any[]>(
  ...fns: { [K in keyof T]: () => Promise<AxiosResponse<T[K]>> }
) {
  type Responses = { [K in keyof T]: AxiosResponse<T[K]> | null };

  const [state, setState] = useState<BatchState<Responses>>({
    data: new Array(fns.length).fill(null) as any,
    loading: true,
    error: null,
  });

  const mountedRef = useRef(true);
  const controllersRef = useRef<AbortController[]>([]);

  const abortAll = useCallback(() => {
    controllersRef.current.forEach((c) => cancelRequest(c));
    controllersRef.current = [];
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortAll();
    };
  }, [abortAll]);

  const execute = useCallback(async () => {
    abortAll();
    if (mountedRef.current) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    try {
      const results = await batchRequests(fns as any);
      if (mountedRef.current) {
        setState({ data: results as any, loading: false, error: null });
      }
      return results;
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED') return null;
      const message = err?.response?.data?.message || err?.message || 'Batch request failed';
      if (mountedRef.current) {
        setState({ data: new Array(fns.length).fill(null) as any, loading: false, error: message });
      }
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abortAll]);

  useEffect(() => {
    execute();
  }, [execute]);

  return { ...state, refetch: execute, abort: abortAll };
}
