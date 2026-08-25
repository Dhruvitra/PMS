/**
 * Day 37: Redis Cache Utility
 * Centralized caching helpers with graceful degradation when Redis is unavailable
 */
import { redis } from '../config/redis';

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get a cached value, returning null if not found or Redis is unavailable
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Set a cache value with optional TTL (seconds). Silent failure if Redis down.
 */
export async function cacheSet(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // Ignore: Redis unavailable
  }
}

/**
 * Delete one or more cache keys. Silent failure.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length) await redis.del(...keys);
  } catch {
    // Ignore
  }
}

/**
 * Delete all keys matching a pattern (e.g. 'user:*')
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  } catch {
    // Ignore
  }
}

/**
 * Cache-aside pattern: read from cache, fall back to loader, store result.
 */
export async function cacheAside<T>(
  key: string,
  loader: () => Promise<T>,
  ttl = DEFAULT_TTL
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await loader();
  await cacheSet(key, fresh, ttl);
  return fresh;
}

// ─── Cache key factories ──────────────────────────────────────────────────────
export const CacheKeys = {
  user: (id: string) => `user:${id}`,
  orgMembers: (orgId: string) => `org:${orgId}:members`,
  orgDetails: (orgId: string) => `org:${orgId}:details`,
  taskById: (id: string) => `task:${id}`,
  projectTasks: (projectId: string) => `project:${projectId}:tasks`,
  userNotifications: (userId: string) => `user:${userId}:notifications`,
  dashboardStats: (key: string) => `dashboard:${key}:stats`,
  userSpaces: (userId: string, orgId?: string) => `spaces:${userId}:${orgId || 'all'}`,
};
