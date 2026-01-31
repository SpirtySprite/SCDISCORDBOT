const { query } = require('../connection');
const logger = require('../../utils/logger');

class MinecraftRepository {

    /**
     * Save a command execution log
     * @param {Object} commandData
     */
    async logCommand(commandData) {
        const sql = `
            INSERT INTO minecraft_commands
            (user_uuid, username, command, args, success, world, x, y, z, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            commandData.playerUUID,
            commandData.playerName,
            commandData.command,
            commandData.args,
            commandData.success,
            commandData.world,
            parseFloat(commandData.x).toFixed(1),
            parseFloat(commandData.y).toFixed(1),
            parseFloat(commandData.z).toFixed(1),
            commandData.timestamp || Date.now()
        ];

        try {
            await query(sql, params);
            return true;
        } catch (error) {
            logger.error('[DB] Failed to log minecraft command:', error);
            return false;
        }
    }

    /**
     * Get recent commands with pagination
     * @param {number} limit
     * @param {number} offset
     */
    async getRecentCommands(limit = 50, offset = 0) {
        const sql = `
            SELECT * FROM minecraft_commands
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        `;

        try {
            return await query(sql, [limit, offset]);
        } catch (error) {
            logger.error('[DB] Failed to fetch recent minecraft commands:', error);
            return [];
        }
    }

    /**
     * Get commands by username
     * @param {string} username
     * @param {number} limit
     */
    async getCommandsByUser(username, limit = 100) {
        const sql = `
            SELECT * FROM minecraft_commands
            WHERE username = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;

        try {
            return await query(sql, [username, limit]);
        } catch (error) {
            logger.error('[DB] Failed to fetch minecraft commands by user:', error);
            return [];
        }
    }

    /**
     * Search commands
     * @param {string} searchTerm
     * @param {number} limit
     */
    async searchCommands(searchTerm, limit = 50) {
        const sql = `
            SELECT * FROM minecraft_commands
            WHERE username LIKE ? OR command LIKE ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;

        const term = `%${searchTerm}%`;

        try {
            return await query(sql, [term, term, limit]);
        } catch (error) {
            logger.error('[DB] Failed to search minecraft commands:', error);
            return [];
        }
    }

    /**
     * Get distinct players with stats
     */
    async getPlayers(limit = 50, offset = 0, search = '') {
        let sql = `
            SELECT
                username,
                user_uuid,
                COUNT(*) as command_count,
                MAX(timestamp) as last_seen,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as fail_count
            FROM minecraft_commands
        `;

        const params = [];
        if (search) {
            sql += ` WHERE username LIKE ?`;
            params.push(`%${search}%`);
        }

        sql += ` GROUP BY username, user_uuid ORDER BY last_seen DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        try {
            return await query(sql, params);
        } catch (error) {
            logger.error('[DB] Failed to fetch minecraft players:', error);
            return [];
        }
    }

    /**
     * Get total command count
     */
    async getCommandCount() {
        const sql = 'SELECT COUNT(*) as count FROM minecraft_commands';
        try {
            const results = await query(sql);
            return results[0]?.count || 0;
        } catch (error) {
            logger.error('[DB] Failed to count minecraft commands:', error);
            return 0;
        }
    }
}

module.exports = new MinecraftRepository();