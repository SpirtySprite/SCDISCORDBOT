const { query } = require('../connection');

class LevelRepository {
    constructor() {

        this.rankCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000;
    }

    _getCacheKey(guildId, userId) {
        return `${guildId}:${userId}`;
    }

    _invalidateRankCache(guildId, userId = null) {
        if (userId) {
            this.rankCache.delete(this._getCacheKey(guildId, userId));
        } else {

            for (const key of this.rankCache.keys()) {
                if (key.startsWith(`${guildId}:`)) {
                    this.rankCache.delete(key);
                }
            }
        }
    }

    async findByUser(guildId, userId) {
        const rows = await query(
            'SELECT user_id, guild_id, total_xp, level, current_xp, next_xp, user_rank, updated_at, created_at FROM user_levels WHERE guild_id = ? AND user_id = ? LIMIT 1',
            [guildId, userId]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async getLeaderboard(guildId, limit = 10, offset = 0) {
        const rows = await query(
            'SELECT user_id, guild_id, total_xp, level, current_xp, next_xp, user_rank FROM user_levels WHERE guild_id = ? ORDER BY total_xp DESC, user_rank ASC LIMIT ? OFFSET ?',
            [guildId, limit, offset]
        );
        return rows;
    }

    async getUserRank(guildId, userId) {

        const cacheKey = this._getCacheKey(guildId, userId);
        const cached = this.rankCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.rank;
        }


        const rankResult = await query(
            `SELECT (
                SELECT COUNT(*) + 1
                FROM user_levels ul2
                WHERE ul2.guild_id = ? AND ul2.total_xp > (
                    SELECT total_xp FROM user_levels WHERE guild_id = ? AND user_id = ? LIMIT 1
                )
            ) as \`user_rank\``,
            [guildId, guildId, userId]
        );

        const rank = rankResult && rankResult[0] ? rankResult[0].user_rank : null;


        if (rank !== null) {
            this.rankCache.set(cacheKey, { rank, timestamp: Date.now() });
        }

        return rank;
    }

    async updateUserXP(guildId, userId, totalXP, level, currentXP = 0, nextXP = 0, userRank = null) {

        const oldUserData = await this.findByUser(guildId, userId);
        const oldLevel = oldUserData?.level || 0;


        if (userRank === null) {
            userRank = await this.getUserRank(guildId, userId);
        }

        await query(
            `INSERT INTO user_levels (user_id, guild_id, total_xp, level, current_xp, next_xp, user_rank)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                total_xp = VALUES(total_xp),
                level = VALUES(level),
                current_xp = VALUES(current_xp),
                next_xp = VALUES(next_xp),
                user_rank = VALUES(user_rank),
                updated_at = CURRENT_TIMESTAMP`,
            [userId, guildId, totalXP, level, currentXP, nextXP, userRank || 0]
        );


        this._invalidateRankCache(guildId, userId);


        this._invalidateRankCache(guildId);


        const newLevel = level;
        if (newLevel !== oldLevel) {


            try {


                const EventEmitter = require('events');
                if (global.levelHandler) {
                    global.levelHandler.updateUserLevelRoles(guildId, userId, newLevel).catch(err => {
                        const logger = require('../../utils/logger');
                        logger.error(`[LEVEL REPO] Failed to update level roles after XP change:`, err);
                    });
                }
            } catch (error) {

            }
        }
    }

    async getTotalUsers(guildId) {
        const result = await query(
            'SELECT COUNT(*) as total FROM user_levels WHERE guild_id = ?',
            [guildId]
        );
        return result && result[0] ? result[0].total : 0;
    }

    async getUsersAroundUser(guildId, userId, range = 2) {

        const userRank = await this.getUserRank(guildId, userId);
        if (!userRank) return null;


        const startRank = Math.max(1, userRank - range);
        const endRank = userRank + range;
        const limit = (endRank - startRank) + 1;
        const offset = startRank - 1;

        return await this.getLeaderboard(guildId, limit, offset);
    }
}

module.exports = new LevelRepository();