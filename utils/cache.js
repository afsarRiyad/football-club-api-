/**
 * Caching layer with Redis (or in-memory fallback).
 * Uses ioredis if REDIS_URL is set, otherwise falls back to a simple Map.
 */

let redis = null;
let memoryCache = new Map();

// Try to connect to Redis
const connectRedis = async () => {
  if (process.env.REDIS_URL) {
    try {
      const Redis = require("ioredis");
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) {
            console.warn("⚠️ Redis connection failed, using in-memory cache");
            redis = null;
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      redis.on("connect", () => console.log("✅ Redis connected"));
      redis.on("error", (err) => {
        console.warn("⚠️ Redis error:", err.message);
        redis = null;
      });

      return true;
    } catch (error) {
      console.warn("⚠️ Redis not available, using in-memory cache");
      return false;
    }
  }
  return false;
};

/**
 * Get cached value.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
const cacheGet = async (key) => {
  try {
    if (redis) {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    }

    // In-memory fallback
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value;
  } catch (error) {
    console.error("Cache get error:", error.message);
    return null;
  }
};

/**
 * Set cached value with TTL.
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds - Time to live in seconds (default: 5 minutes)
 */
const cacheSet = async (key, value, ttlSeconds = 300) => {
  try {
    const serialized = JSON.stringify(value);

    if (redis) {
      await redis.setex(key, ttlSeconds, serialized);
      return;
    }

    // In-memory fallback
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    // Cleanup old entries periodically
    if (memoryCache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of memoryCache) {
        if (v.expiresAt && now > v.expiresAt) {
          memoryCache.delete(k);
        }
      }
    }
  } catch (error) {
    console.error("Cache set error:", error.message);
  }
};

/**
 * Delete cached value(s).
 * @param {string} pattern - Key or pattern (e.g., "players:*")
 */
const cacheDel = async (pattern) => {
  try {
    if (redis) {
      if (pattern.includes("*")) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } else {
        await redis.del(pattern);
      }
      return;
    }

    // In-memory fallback
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
          memoryCache.delete(key);
        }
      }
    } else {
      memoryCache.delete(pattern);
    }
  } catch (error) {
    console.error("Cache delete error:", error.message);
  }
};

/**
 * Clear all cache.
 */
const cacheFlush = async () => {
  try {
    if (redis) {
      await redis.flushdb();
      return;
    }
    memoryCache.clear();
  } catch (error) {
    console.error("Cache flush error:", error.message);
  }
};

/**
 * Cache middleware for Express routes.
 * @param {number} ttlSeconds - Cache duration
 * @param {function} [keyGenerator] - Custom key generator (req) => string
 */
const cacheMiddleware = (ttlSeconds = 300, keyGenerator = null) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") return next();

    const key = keyGenerator
      ? keyGenerator(req)
      : `cache:${req.originalUrl}`;

    const cached = await cacheGet(key);
    if (cached) {
      return res.status(200).json(cached);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode === 200) {
        cacheSet(key, body, ttlSeconds);
      }
      return originalJson(body);
    };

    next();
  };
};

module.exports = {
  connectRedis,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheFlush,
  cacheMiddleware,
};
