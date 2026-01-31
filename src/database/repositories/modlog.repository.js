const { query } = require('../connection');

class ModLogRepository {
    async create(data) {
        const sql = `
            INSERT INTO mod_logs
            (guild_id, user_id, moderator_id, action, reason, duration)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.guildId,
            data.userId,
            data.moderatorId,
            data.action,
            data.reason || null,
            data.duration || null
        ];
        const result = await query(sql, params);
        return result.insertId;
    }

    async findByUserId(guildId, userId, includeDeleted = false) {
        const fields = "id, guild_id, user_id, moderator_id, action, reason, duration, deleted, created_at";
        const sql = includeDeleted
            ? `SELECT ${fields} FROM mod_logs WHERE guild_id = ? AND user_id = ? ORDER BY id ASC`
            : `SELECT ${fields} FROM mod_logs WHERE guild_id = ? AND user_id = ? AND deleted = FALSE ORDER BY id ASC`;
        return await query(sql, [guildId, userId]);
    }

    async getNextId(guildId, userId) {
        const rows = await query(
            "SELECT COUNT(*) as count FROM mod_logs WHERE guild_id = ? AND user_id = ? AND deleted = FALSE",
            [guildId, userId]
        );
        return (rows[0]?.count || 0) + 1;
    }

    async countByUserId(guildId, userId) {
        const rows = await query(
            "SELECT COUNT(*) as count FROM mod_logs WHERE guild_id = ? AND user_id = ? AND deleted = FALSE",
            [guildId, userId]
        );
        return rows[0]?.count || 0;
    }

    async softDelete(guildId, userId, logId) {
        const rows = await query(
            "SELECT id FROM mod_logs WHERE guild_id = ? AND user_id = ? AND id = ? AND deleted = FALSE",
            [guildId, userId, logId]
        );

        if (!rows[0]) {
            return false;
        }

        await query(
            "UPDATE mod_logs SET deleted = TRUE WHERE guild_id = ? AND user_id = ? AND id = ?",
            [guildId, userId, logId]
        );

        return true;
    }

    async findById(guildId, userId, logId) {
        const rows = await query(
            "SELECT id, guild_id, user_id, moderator_id, action, reason, duration, deleted, created_at FROM mod_logs WHERE guild_id = ? AND user_id = ? AND id = ? AND deleted = FALSE LIMIT 1",
            [guildId, userId, logId]
        );
        return rows[0] || null;
    }

    async findWithFilters(guildId, filters = {}, pagination = {}) {
        const fields = "id, guild_id, user_id, moderator_id, action, reason, duration, deleted, created_at";
        let sql = `SELECT ${fields} FROM mod_logs WHERE guild_id = ? AND deleted = FALSE`;
        const params = [guildId];
        const conditions = [];

        if (filters.userId) {
            conditions.push("user_id = ?");
            params.push(filters.userId);
        }

        if (filters.moderatorId) {
            conditions.push("moderator_id = ?");
            params.push(filters.moderatorId);
        }

        if (filters.action) {
            conditions.push("action = ?");
            params.push(filters.action);
        }

        if (filters.search) {
            conditions.push("(reason LIKE ? OR user_id LIKE ? OR moderator_id LIKE ?)");
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (filters.dateFrom) {
            conditions.push("created_at >= ?");
            params.push(filters.dateFrom);
        }

        if (filters.dateTo) {
            conditions.push("created_at <= ?");
            params.push(filters.dateTo);
        }

        if (conditions.length > 0) {
            sql += " AND " + conditions.join(" AND ");
        }

        sql += " ORDER BY created_at DESC";

        const page = pagination.page || 1;
        const limit = pagination.limit || 50;
        const offset = (page - 1) * limit;

        sql += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const logs = await query(sql, params);


        let countSql = "SELECT COUNT(*) as total FROM mod_logs WHERE guild_id = ? AND deleted = FALSE";
        const countParams = [guildId];
        if (conditions.length > 0) {
            countSql += " AND " + conditions.join(" AND ");
            countParams.push(...params.slice(1, params.length - 2));
        }
        const countResult = await query(countSql, countParams);
        const total = countResult[0]?.total || 0;

        return {
            logs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }

    async getStats(guildId) {
        const stats = {
            total: 0,
            byAction: {},
            recent: []
        };


        const totalResult = await query(
            "SELECT COUNT(*) as total FROM mod_logs WHERE guild_id = ? AND deleted = FALSE",
            [guildId]
        );
        stats.total = totalResult[0]?.total || 0;


        const actionStats = await query(
            "SELECT action, COUNT(*) as count FROM mod_logs WHERE guild_id = ? AND deleted = FALSE GROUP BY action",
            [guildId]
        );
        actionStats.forEach(row => {
            stats.byAction[row.action] = row.count;
        });


        const recent = await query(
            "SELECT id, guild_id, user_id, moderator_id, action, reason, duration, deleted, created_at FROM mod_logs WHERE guild_id = ? AND deleted = FALSE ORDER BY created_at DESC LIMIT 10",
            [guildId]
        );
        stats.recent = recent;

        return stats;
    }

    async exportLogs(guildId, format = 'json') {
        const logs = await query(
            "SELECT id, guild_id, user_id, moderator_id, action, reason, duration, deleted, created_at FROM mod_logs WHERE guild_id = ? AND deleted = FALSE ORDER BY created_at DESC",
            [guildId]
        );

        if (format === 'csv') {
            const headers = ['ID', 'User ID', 'Moderator ID', 'Action', 'Reason', 'Duration', 'Created At'];
            const rows = logs.map(log => [
                log.id,
                log.user_id,
                log.moderator_id,
                log.action,
                log.reason || '',
                log.duration || '',
                log.created_at
            ]);
            return headers.join(',') + '\n' + rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        }

        return JSON.stringify(logs, null, 2);
    }
}

module.exports = new ModLogRepository();