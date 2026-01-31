const { query, transaction } = require('../connection');

class SuggestionRepository {
    async create(data) {
        return await transaction(async (connection) => {
            const sql = `
                INSERT INTO suggestions
                (message_id, channel_id, guild_id, user_id, title, description, upvote_count, downvote_count, embed_color)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                data.messageId,
                data.channelId,
                data.guildId,
                data.userId,
                data.title,
                data.description,
                data.upvoteCount || 0,
                data.downvoteCount || 0,
                data.embedColor || 0x5865F2
            ];
            const [result] = await connection.query(sql, params);
            return result.insertId;
        });
    }

    async findByMessageId(messageId) {
        const rows = await query(
            "SELECT * FROM suggestions WHERE message_id = ? LIMIT 1",
            [messageId]
        );
        return rows[0] || null;
    }

    async findAllByChannel(channelId) {
        return await query(
            "SELECT * FROM suggestions WHERE channel_id = ? ORDER BY created_at DESC",
            [channelId]
        );
    }

    async findAllByGuild(guildId) {
        return await query(
            "SELECT * FROM suggestions WHERE guild_id = ? ORDER BY created_at DESC",
            [guildId]
        );
    }

    async updateReactionCounts(messageId, upvoteCount, downvoteCount, embedColor) {
        await query(
            "UPDATE suggestions SET upvote_count = ?, downvote_count = ?, embed_color = ?, updated_at = CURRENT_TIMESTAMP WHERE message_id = ?",
            [upvoteCount, downvoteCount, embedColor, messageId]
        );
    }

    async updateColor(messageId, embedColor) {
        await query(
            "UPDATE suggestions SET embed_color = ?, updated_at = CURRENT_TIMESTAMP WHERE message_id = ?",
            [embedColor, messageId]
        );
    }

    async delete(messageId) {
        await query(
            "DELETE FROM suggestions WHERE message_id = ?",
            [messageId]
        );
    }
}

module.exports = new SuggestionRepository();