import Redis from 'ioredis';
import { config } from '../config';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  (config.redis.url
    ? new Redis(config.redis.url, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
        tls: config.redis.url.includes('upstash.io') || config.redis.url.startsWith('rediss://') ? {} : undefined,
      })
    : new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
        tls: config.redis.host.includes('upstash.io') ? {} : undefined,
      }));

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export async function connectRedis(): Promise<void> {
  if (redis.status === 'wait') {
    await redis.connect();
  }
}

export default redis;

export function getRedisClient(): Redis {
  return redis;
}