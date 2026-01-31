const { query } = require('../connection');

class VoiceBlacklistRepository {
    async create(guildId, channelId, userId, moderatorId) {
        const sql = `
            INSERT INTO voice_blacklist (guild_id, channel_id, user_id, moderator_id)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE moderator_id = VALUES(moderator_id)
        `;
        return await query(sql, [guildId, channelId, userId, moderatorId]);
    }

    async delete(guildId, channelId, userId) {
        const sql = `
            DELETE FROM voice_blacklist
            WHERE guild_id = ? AND channel_id = ? AND user_id = ?
        `;
        return await query(sql, [guildId, channelId, userId]);
    }

    async isUserBlacklisted(guildId, channelId, userId) {
        const sql = `
            SELECT id FROM voice_blacklist
            WHERE guild_id = ? AND channel_id = ? AND user_id = ?
            LIMIT 1
        `;
        const rows = await query(sql, [guildId, channelId, userId]);
        return rows.length > 0;
    }

    async getBlacklistForGuild(guildId) {
        const sql = `
            SELECT channel_id, user_id, moderator_id, created_at
            FROM voice_blacklist
            WHERE guild_id = ?
        `;
        return await query(sql, [guildId]);
    }
}

module.exports = new VoiceBlacklistRepository();