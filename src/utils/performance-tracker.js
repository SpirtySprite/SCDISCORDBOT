const logger = require('./logger');

/**
 * Performance tracking utility for monitoring bot performance
 */
class PerformanceTracker {
    constructor() {
        this.metrics = {
            interactions: {
                total: 0,
                byCommand: new Map(),
                responseTimes: [],
                errors: 0
            },
            apiCalls: {
                total: 0,
                byType: new Map(),
                cacheHits: 0,
                cacheMisses: 0
            },
            database: {
                queries: 0,
                slowQueries: [],
                errors: 0
            }
        };


        setInterval(() => {
            this.cleanup();
        }, 60 * 60 * 1000);
    }

    /**
     * Track interaction performance
     */
    trackInteraction(commandName, responseTime, success = true) {
        this.metrics.interactions.total++;

        if (!success) {
            this.metrics.interactions.errors++;
        }

        const commandStats = this.metrics.interactions.byCommand.get(commandName) || {
            count: 0,
            totalTime: 0,
            errors: 0,
            avgTime: 0
        };

        commandStats.count++;
        commandStats.totalTime += responseTime;
        commandStats.avgTime = commandStats.totalTime / commandStats.count;
        if (!success) commandStats.errors++;

        this.metrics.interactions.byCommand.set(commandName, commandStats);


        this.metrics.interactions.responseTimes.push({
            command: commandName,
            time: responseTime,
            timestamp: Date.now()
        });

        if (this.metrics.interactions.responseTimes.length > 1000) {
            this.metrics.interactions.responseTimes.shift();
        }


        if (responseTime > 3000) {
            logger.warn(`[PERF] Slow interaction: ${commandName} took ${responseTime}ms`);
        }
    }

    /**
     * Track API call
     */
    trackAPICall(type, cached = false) {
        this.metrics.apiCalls.total++;

        if (cached) {
            this.metrics.apiCalls.cacheHits++;
        } else {
            this.metrics.apiCalls.cacheMisses++;
        }

        const typeStats = this.metrics.apiCalls.byType.get(type) || {
            total: 0,
            cached: 0,
            uncached: 0
        };

        typeStats.total++;
        if (cached) {
            typeStats.cached++;
        } else {
            typeStats.uncached++;
        }

        this.metrics.apiCalls.byType.set(type, typeStats);
    }

    /**
     * Track database query
     */
    trackQuery(queryTime, query = '') {
        this.metrics.database.queries++;


        if (queryTime > 1000) {
            this.metrics.database.slowQueries.push({
                query: query.substring(0, 200),
                time: queryTime,
                timestamp: Date.now()
            });


            if (this.metrics.database.slowQueries.length > 100) {
                this.metrics.database.slowQueries.shift();
            }

            logger.warn(`[PERF] Slow query (${queryTime}ms): ${query.substring(0, 100)}`);
        }
    }

    /**
     * Track database error
     */
    trackDBError() {
        this.metrics.database.errors++;
    }

    /**
     * Get cache hit rate
     */
    getCacheHitRate() {
        const total = this.metrics.apiCalls.cacheHits + this.metrics.apiCalls.cacheMisses;
        if (total === 0) return 0;
        return (this.metrics.apiCalls.cacheHits / total * 100).toFixed(2);
    }

    /**
     * Get average response time for a command
     */
    getAvgResponseTime(commandName = null) {
        if (commandName) {
            const stats = this.metrics.interactions.byCommand.get(commandName);
            return stats ? stats.avgTime : 0;
        }


        const times = this.metrics.interactions.responseTimes;
        if (times.length === 0) return 0;
        const sum = times.reduce((acc, t) => acc + t.time, 0);
        return sum / times.length;
    }

    /**
     * Get performance summary
     */
    getSummary() {
        return {
            interactions: {
                total: this.metrics.interactions.total,
                errors: this.metrics.interactions.errors,
                errorRate: this.metrics.interactions.total > 0
                    ? (this.metrics.interactions.errors / this.metrics.interactions.total * 100).toFixed(2) + '%'
                    : '0%',
                avgResponseTime: this.getAvgResponseTime(),
                topCommands: Array.from(this.metrics.interactions.byCommand.entries())
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 10)
                    .map(([name, stats]) => ({
                        name,
                        count: stats.count,
                        avgTime: stats.avgTime.toFixed(2) + 'ms',
                        errors: stats.errors
                    }))
            },
            apiCalls: {
                total: this.metrics.apiCalls.total,
                cacheHits: this.metrics.apiCalls.cacheHits,
                cacheMisses: this.metrics.apiCalls.cacheMisses,
                hitRate: this.getCacheHitRate() + '%',
                byType: Object.fromEntries(
                    Array.from(this.metrics.apiCalls.byType.entries()).map(([type, stats]) => [
                        type,
                        {
                            total: stats.total,
                            cached: stats.cached,
                            uncached: stats.uncached,
                            hitRate: stats.total > 0
                                ? (stats.cached / stats.total * 100).toFixed(2) + '%'
                                : '0%'
                        }
                    ])
                )
            },
            database: {
                queries: this.metrics.database.queries,
                errors: this.metrics.database.errors,
                slowQueries: this.metrics.database.slowQueries.length
            }
        };
    }

    /**
     * Cleanup old metrics
     */
    cleanup() {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;


        this.metrics.interactions.responseTimes = this.metrics.interactions.responseTimes
            .filter(t => t.timestamp > oneHourAgo);


        this.metrics.database.slowQueries = this.metrics.database.slowQueries
            .filter(q => q.timestamp > oneHourAgo);
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            interactions: {
                total: 0,
                byCommand: new Map(),
                responseTimes: [],
                errors: 0
            },
            apiCalls: {
                total: 0,
                byType: new Map(),
                cacheHits: 0,
                cacheMisses: 0
            },
            database: {
                queries: 0,
                slowQueries: [],
                errors: 0
            }
        };
    }
}


const performanceTracker = new PerformanceTracker();

module.exports = performanceTracker;