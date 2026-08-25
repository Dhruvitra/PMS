import Redis from 'ioredis';
import { config } from './index';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableReadyCheck: true,
  retryStrategy(times) {
    if (times > 5) return null; // Stop retrying after 5 attempts
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => console.error('Redis connection error:', err.message));
redis.on('connect', () => console.log('Redis connected'));

// Try to connect but don't crash if Redis is unavailable
redis.connect().catch((err) => {
  console.warn('Redis unavailable at startup:', err.message);
});
