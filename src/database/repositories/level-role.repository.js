const { query, transaction } = require('../connection');

class LevelRoleRepository {
    async findAllByGuild(guildId) {
        return await query(
            "SELECT * FROM level_roles WHERE guild_id = ? ORDER BY level ASC",
            [guildId]
        );
    }

    async findByLevel(guildId, level) {
        const rows = await query(
            "SELECT * FROM level_roles WHERE guild_id = ? AND level = ? LIMIT 1",
            [guildId, level]
        );
        return rows[0] || null;
    }

    async create(data) {
        return await transaction(async (connection) => {
            const sql = `
                INSERT INTO level_roles (guild_id, level, role_id)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE role_id = ?, updated_at = CURRENT_TIMESTAMP
            `;
            const params = [
                data.guildId,
                data.level,
                data.roleId,
                data.roleId
            ];
            const [result] = await connection.query(sql, params);
            return result.insertId || result.affectedRows;
        });
    }

    async update(guildId, level, roleId) {
        await query(
            "UPDATE level_roles SET role_id = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND level = ?",
            [roleId, guildId, level]
        );
    }

    async delete(guildId, level) {
        await query(
            "DELETE FROM level_roles WHERE guild_id = ? AND level = ?",
            [guildId, level]
        );
    }

    async deleteByRoleId(guildId, roleId) {
        await query(
            "DELETE FROM level_roles WHERE guild_id = ? AND role_id = ?",
            [guildId, roleId]
        );
    }

    async getRolesForLevels(guildId, levels) {
        if (!levels || levels.length === 0) return [];
        const placeholders = levels.map(() => '?').join(',');
        return await query(
            `SELECT * FROM level_roles WHERE guild_id = ? AND level IN (${placeholders}) ORDER BY level ASC`,
            [guildId, ...levels]
        );
    }
}

module.exports = new LevelRoleRepository();