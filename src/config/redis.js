const Redis = require('ioredis');

const redis = new Redis({
  host:     process.env.REDIS_HOST || '127.0.0.1',
  port:     parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  // If Redis is down, don't crash the app — just skip cache
  lazyConnect:        true,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    if (times > 3) return null; // stop retrying
    return Math.min(times * 200, 1000);
  },
});

redis.on('connect',  () => console.log('Redis connected'));
redis.on('error',    (err) => console.warn('Redis error (cache disabled):', err.message));

module.exports = redis;