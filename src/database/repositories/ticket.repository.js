const { query } = require('../connection');

class TicketRepository {
    async create(data) {
        const sql = `
            INSERT INTO tickets
            (ticket_id, channel_id, guild_id, user_id, status, welcome_message_id, category)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.ticketId,
            data.channelId,
            data.guildId,
            data.userId,
            data.status || 'open',
            data.welcomeMessageId || null,
            data.category || 'unknown'
        ];
        const result = await query(sql, params);
        return result.insertId;
    }

    async findByChannelId(channelId) {
        const rows = await query(
            "SELECT id, ticket_id, channel_id, guild_id, user_id, status, closed_by, closed_at, welcome_message_id, created_at FROM tickets WHERE channel_id = ? LIMIT 1",
            [channelId]
        );
        return rows[0] || null;
    }

    async findByTicketId(ticketId) {
        const rows = await query(
            "SELECT id, ticket_id, channel_id, guild_id, user_id, status, closed_by, closed_at, welcome_message_id, created_at FROM tickets WHERE ticket_id = ? LIMIT 1",
            [ticketId]
        );
        return rows[0] || null;
    }

    async findByUserId(guildId, userId) {
        return await query(
            "SELECT id, ticket_id, channel_id, guild_id, user_id, status, closed_by, closed_at, welcome_message_id, created_at FROM tickets WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC",
            [guildId, userId]
        );
    }

    async findByGuild(guildId, status = null, limit = null, offset = 0) {
        const fields = "id, ticket_id, channel_id, guild_id, user_id, status, closed_by, closed_at, welcome_message_id, rating, category, created_at";
        let sql = status
            ? `SELECT ${fields} FROM tickets WHERE guild_id = ? AND status = ? ORDER BY created_at DESC`
            : `SELECT ${fields} FROM tickets WHERE guild_id = ? ORDER BY created_at DESC`;

        if (limit) {
            sql += ` LIMIT ? OFFSET ?`;
            const params = status ? [guildId, status, limit, offset] : [guildId, limit, offset];
            return await query(sql, params);
        }

        const params = status ? [guildId, status] : [guildId];
        return await query(sql, params);
    }

    async updateStatus(channelId, status, closedBy = null) {
        const sql = `
            UPDATE tickets
            SET status = ?, closed_by = ?, closed_at = ?
            WHERE channel_id = ?
        `;
        const closedAt = status === 'closed' ? new Date() : null;
        await query(sql, [status, closedBy, closedAt, channelId]);
    }

    async updateWelcomeMessageId(channelId, messageId) {
        await query(
            "UPDATE tickets SET welcome_message_id = ? WHERE channel_id = ?",
            [messageId, channelId]
        );
    }

    async updateOwner(channelId, newUserId) {
        await query(
            "UPDATE tickets SET user_id = ? WHERE channel_id = ?",
            [newUserId, channelId]
        );
    }

    async delete(channelId) {
        await query(
            "UPDATE tickets SET status = 'deleted' WHERE channel_id = ?",
            [channelId]
        );
    }

    async getNextTicketNumber(guildId) {




        try {
            const rows = await query(
                `SELECT
                    COALESCE(MAX(
                        CASE
                            WHEN ticket_id REGEXP '^ticket-[0-9]+$'
                            THEN CAST(SUBSTRING_INDEX(ticket_id, '-', -1) AS UNSIGNED)
                            ELSE 0
                        END
                    ), 0) as maxNumber
                FROM tickets
                WHERE guild_id = ? AND ticket_id LIKE 'ticket-%'`,
                [guildId]
            );

            let maxNumber = 0;
            if (rows && rows.length > 0 && rows[0] && rows[0].maxNumber !== null && rows[0].maxNumber !== undefined) {
                maxNumber = parseInt(rows[0].maxNumber, 10) || 0;
            }


            return Math.max(maxNumber + 1, 1);
        } catch (error) {

            const fallbackRows = await query(
                "SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?",
                [guildId]
            );
            const count = fallbackRows[0]?.count || 0;
            return count + 1;
        }
    }

    async createPanel(data) {
        const sql = `
            INSERT INTO ticket_panels
            (guild_id, channel_id, message_id, category_id)
            VALUES (?, ?, ?, ?)
        `;
        const params = [
            data.guildId,
            data.channelId,
            data.messageId,
            data.categoryId || null
        ];
        const result = await query(sql, params);
        return result.insertId;
    }

    async findPanelByMessageId(messageId) {
        const rows = await query(
            "SELECT id, guild_id, channel_id, message_id, category_id, created_at FROM ticket_panels WHERE message_id = ? LIMIT 1",
            [messageId]
        );
        return rows[0] || null;
    }

    async findPanelsByGuild(guildId) {
        return await query(
            "SELECT id, guild_id, channel_id, message_id, category_id, created_at FROM ticket_panels WHERE guild_id = ?",
            [guildId]
        );
    }

    async deletePanel(messageId) {
        await query(
            "DELETE FROM ticket_panels WHERE message_id = ?",
            [messageId]
        );
    }

    async getTicketStats(guildId) {
        const rows = await query(
            `SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
            FROM tickets
            WHERE guild_id = ?`,
            [guildId]
        );
        return {
            total: rows[0]?.total || 0,
            open: rows[0]?.open || 0,
            closed: rows[0]?.closed || 0
        };
    }

    async isBlacklisted(guildId, userId) {
        const rows = await query(
            "SELECT id FROM ticket_blacklist WHERE guild_id = ? AND user_id = ? LIMIT 1",
            [guildId, userId]
        );
        return rows.length > 0;
    }

    async blacklistUser(guildId, userId, moderatorId, reason) {
        return await query(
            "INSERT INTO ticket_blacklist (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE moderator_id = ?, reason = ?",
            [guildId, userId, moderatorId, reason, moderatorId, reason]
        );
    }

    async unblacklistUser(guildId, userId) {
        return await query(
            "DELETE FROM ticket_blacklist WHERE guild_id = ? AND user_id = ?",
            [guildId, userId]
        );
    }
}

module.exports = new TicketRepository();