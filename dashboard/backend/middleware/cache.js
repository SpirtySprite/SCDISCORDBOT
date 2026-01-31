const logger = require('../../../src/utils/logger');

/**
 * Simple in-memory cache middleware for GET requests
 */
class CacheMiddleware {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 5 * 60 * 1000;
    }

    /**
     * Generate cache key from request
     */
    _getCacheKey(req) {
        return `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
    }

    /**
     * Middleware factory
     * @param {number} ttl - Time to live in milliseconds
     * @param {Function} keyGenerator - Optional custom key generator
     */
    middleware(ttl = null, keyGenerator = null) {
        const cacheTTL = ttl || this.defaultTTL;

        return (req, res, next) => {

            if (req.method !== 'GET') {
                return next();
            }

            const cacheKey = keyGenerator ? keyGenerator(req) : this._getCacheKey(req);
            const cached = this.cache.get(cacheKey);

            if (cached && Date.now() < cached.expiresAt) {

                res.setHeader('X-Cache', 'HIT');
                return res.json(cached.data);
            }


            const originalJson = res.json.bind(res);
            res.json = (data) => {

                this.cache.set(cacheKey, {
                    data,
                    expiresAt: Date.now() + cacheTTL
                });

                res.setHeader('X-Cache', 'MISS');
                return originalJson(data);
            };

            next();
        };
    }

    /**
     * Invalidate cache by pattern
     * @param {string|RegExp} pattern - Pattern to match keys
     */
    invalidate(pattern) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        let count = 0;

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                count++;
            }
        }

        return count;
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now >= entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        return cleaned;
    }

    /**
     * Get cache stats
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}


const cacheMiddleware = new CacheMiddleware();


setInterval(() => {
    const cleaned = cacheMiddleware.cleanup();
    if (cleaned > 0) {
        logger.debug(`[CACHE] Cleaned up ${cleaned} expired cache entries`);
    }
}, 5 * 60 * 1000);

module.exports = cacheMiddleware;