const redis = require('../config/redis');
const { normalizeFilters, buildCacheKey } = require('../utils/normalizeQuery');

const CACHE_TTL = 300; // 5 minutes in seconds

/**
 * Cache middleware for GET /api/profiles and /api/profiles/search
 * - Normalizes query params before building cache key
 * - Returns cached result if available
 * - Attaches cacheKey to req so the controller can populate it
 */
function cacheMiddleware(prefix) {
  return async (req, res, next) => {
    try {
      const normalized = normalizeFilters(req.query);
      const cacheKey   = buildCacheKey(prefix, normalized);

      // Attach to req so controller can use it
      req.cacheKey    = cacheKey;
      req.normalizedQ = normalized;

      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return res.json({ ...parsed, cached: true });
      }
    } catch {
      // Redis is down — skip cache, hit DB normally
    }

    next();
  };
}

/**
 * Stores a result in Redis after the controller builds it.
 * Called manually from controllers.
 */
async function setCache(key, data) {
  try {
    await redis.set(key, JSON.stringify(data), 'EX', CACHE_TTL);
  } catch {
    // Redis down — silently skip
  }
}

module.exports = { cacheMiddleware, setCache };