const logger = require('./logger');
const config = require('../config');

/**
 * Cache manager with TTL (Time-To-Live) support for Discord entities
 * Automatically invalidates expired entries and supports manual invalidation
 */
class DiscordCache {
    constructor() {
        this.cache = new Map();
        this.timers = new Map();
        const cacheConfig = config.performance?.cache || {};
        this.defaultTTL = cacheConfig.defaultTTL || 300000;
        this.cleanupIntervalMs = cacheConfig.cleanupInterval || 300000;
        this.maxSize = cacheConfig.maxSize || 10000;
        this.enableStats = cacheConfig.enableStats !== false;

        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            invalidations: 0,
            expirations: 0,
            evictions: 0
        };


        this.cleanupInterval = setInterval(() => {
            this.clearExpired();

            if (this.cache.size > this.maxSize) {
                this.evictOldest();
            }
        }, this.cleanupIntervalMs);
    }

    /**
     * Evict oldest entries using LRU policy
     * @returns {number} Number of entries evicted
     */
    evictOldest() {
        if (this.cache.size <= this.maxSize) {
            return 0;
        }

        const entriesToEvict = this.cache.size - this.maxSize;
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].createdAt - b[1].createdAt);

        let evicted = 0;
        for (let i = 0; i < entriesToEvict && i < entries.length; i++) {
            const [key] = entries[i];
            this.invalidate(key);
            evicted++;
            if (this.enableStats) {
                this.stats.evictions++;
            }
        }

        return evicted;
    }

    /**
     * Get a value from cache
     * @param {string} key - Cache key
     * @param {boolean} forceRefresh - If true, bypass cache and return null
     * @returns {*} Cached value or null if not found/expired
     */
    get(key, forceRefresh = false) {
        if (forceRefresh) {
            this.invalidate(key);
            return null;
        }

        const entry = this.cache.get(key);

        if (!entry) {
            if (this.enableStats) {
                this.stats.misses++;
            }
            return null;
        }


        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            if (this.timers.has(key)) {
                clearTimeout(this.timers.get(key));
                this.timers.delete(key);
            }
            if (this.enableStats) {
                this.stats.expirations++;
                this.stats.misses++;
            }
            return null;
        }


        entry.lastAccessed = Date.now();

        if (this.enableStats) {
            this.stats.hits++;
        }
        return entry.value;
    }

    /**
     * Set a value in cache with optional TTL
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (default: from config)
     */
    set(key, value, ttl = null) {

        if (ttl === null) {
            ttl = this.defaultTTL;
        }


        if (this.cache.has(key)) {
            this.invalidate(key);
        }


        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictOldest();
        }

        const expiresAt = ttl > 0 ? Date.now() + ttl : null;
        const now = Date.now();

        this.cache.set(key, {
            value,
            expiresAt,
            createdAt: now,
            lastAccessed: now
        });

        if (this.enableStats) {
            this.stats.sets++;
        }


        if (expiresAt) {
            const timer = setTimeout(() => {
                this.cache.delete(key);
                this.timers.delete(key);
                if (this.enableStats) {
                    this.stats.expirations++;
                }
            }, ttl);

            this.timers.set(key, timer);
        }
    }

    /**
     * Invalidate a specific key
     * @param {string} key - Cache key to invalidate
     */
    invalidate(key) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
            if (this.enableStats) {
                this.stats.invalidations++;
            }
        }

        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
    }

    /**
     * Invalidate all keys matching a pattern
     * @param {string|RegExp} pattern - Pattern to match keys
     */
    invalidatePattern(pattern) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        let count = 0;

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.invalidate(key);
                count++;
            }
        }

        return count;
    }

    /**
     * Clear all expired entries
     * @returns {number} Number of entries cleared
     */
    clearExpired() {
        const now = Date.now();
        let cleared = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                this.invalidate(key);
                cleared++;
            }
        }

        return cleared;
    }

    /**
     * Clear all cache entries
     */
    clear() {

        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }

        const size = this.cache.size;
        this.cache.clear();
        this.timers.clear();
        if (this.enableStats) {
            this.stats.invalidations += size;
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: `${hitRate}%`
        };
    }

    /**
     * Destroy the cache and cleanup
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}


const discordCache = new DiscordCache();


const CacheHelpers = {
    /**
     * Get or fetch a user
     * @param {Client} client - Discord client
     * @param {string} userId - User ID
     * @param {number} ttl - Cache TTL in ms (default: 5 minutes)
     * @param {boolean} forceRefresh - Force refresh from API
     * @returns {Promise<User>} Discord user
     */
    async getUser(client, userId, ttl = 5 * 60 * 1000, forceRefresh = false) {
        const cacheKey = `user:${userId}`;

        if (!forceRefresh) {
            const cached = discordCache.get(cacheKey);
            if (cached) return cached;
        }

        try {
            const user = await client.users.fetch(userId);
            discordCache.set(cacheKey, user, ttl);
            return user;
        } catch (error) {
            logger.warn(`Failed to fetch user ${userId}:`, error.message);
            throw error;
        }
    },

    /**
     * Get or fetch a guild member
     * @param {Guild} guild - Discord guild
     * @param {string} userId - User ID
     * @param {number} ttl - Cache TTL in ms (default: 2 minutes)
     * @param {boolean} forceRefresh - Force refresh from API
     * @returns {Promise<GuildMember>} Guild member
     */
    async getMember(guild, userId, ttl = 2 * 60 * 1000, forceRefresh = false) {
        const cacheKey = `member:${guild.id}:${userId}`;

        if (!forceRefresh) {
            const cached = discordCache.get(cacheKey);
            if (cached) return cached;
        }

        try {
            const member = await guild.members.fetch(userId);
            discordCache.set(cacheKey, member, ttl);
            return member;
        } catch (error) {
            logger.warn(`Failed to fetch member ${userId} in guild ${guild.id}:`, error.message);
            throw error;
        }
    },

    /**
     * Get or fetch a channel
     * @param {Client} client - Discord client
     * @param {string} channelId - Channel ID
     * @param {number} ttl - Cache TTL in ms (default: 10 minutes)
     * @param {boolean} forceRefresh - Force refresh from API
     * @returns {Promise<Channel>} Discord channel
     */
    async getChannel(client, channelId, ttl = 10 * 60 * 1000, forceRefresh = false) {
        const cacheKey = `channel:${channelId}`;

        if (!forceRefresh) {
            const cached = discordCache.get(cacheKey);
            if (cached) return cached;
        }

        try {
            const channel = await client.channels.fetch(channelId);
            discordCache.set(cacheKey, channel, ttl);
            return channel;
        } catch (error) {
            logger.warn(`Failed to fetch channel ${channelId}:`, error.message);
            throw error;
        }
    },

    /**
     * Invalidate user cache
     * @param {string} userId - User ID
     */
    invalidateUser(userId) {
        discordCache.invalidate(`user:${userId}`);
    },

    /**
     * Invalidate member cache for a guild
     * @param {string} guildId - Guild ID
     * @param {string} userId - User ID (optional, invalidates all if not provided)
     */
    invalidateMember(guildId, userId = null) {
        if (userId) {
            discordCache.invalidate(`member:${guildId}:${userId}`);
        } else {
            discordCache.invalidatePattern(`^member:${guildId}:`);
        }
    },

    /**
     * Invalidate channel cache
     * @param {string} channelId - Channel ID
     */
    invalidateChannel(channelId) {
        discordCache.invalidate(`channel:${channelId}`);
    }
};

module.exports = {
    discordCache,
    CacheHelpers
};