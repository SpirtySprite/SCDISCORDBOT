const { query, transaction } = require('../connection');
const { GIVEAWAY_STATUS } = require('../../utils/constants');
const { safeJsonParse } = require('../../utils/helpers');

class GiveawayRepository {
    async findAllActive(guildId = null) {
        const sql = guildId
            ? "SELECT * FROM giveaways WHERE status = ? AND guild_id = ? ORDER BY end_time ASC"
            : "SELECT * FROM giveaways WHERE status = ? ORDER BY end_time ASC";
        const params = guildId ? [GIVEAWAY_STATUS.ACTIVE, guildId] : [GIVEAWAY_STATUS.ACTIVE];
        return await query(sql, params);
    }

    async findByMessageId(messageId) {
        const rows = await query(
            "SELECT * FROM giveaways WHERE message_id = ? LIMIT 1",
            [messageId]
        );
        return rows[0] || null;
    }

    async create(data) {
        return await transaction(async (connection) => {
            const sql = `
                INSERT INTO giveaways
                (message_id, channel_id, guild_id, prize, winners, end_time, created_by, requirements, status, participant_ids)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                data.messageId,
                data.channelId,
                data.guildId,
                data.prize,
                data.winners,
                data.endTime,
                data.createdBy,
                data.requirements || null,
                GIVEAWAY_STATUS.ACTIVE,
                '[]'
            ];
            const [result] = await connection.query(sql, params);
            return result.insertId;
        });
    }

    async addParticipant(messageId, userId) {
        return await transaction(async (connection) => {
            const [rows] = await connection.query(
                "SELECT participant_ids FROM giveaways WHERE message_id = ? FOR UPDATE",
                [messageId]
            );

            if (!rows[0]) {
                return false;
            }

            const participants = safeJsonParse(rows[0].participant_ids);
            if (!participants.includes(userId)) {
                participants.push(userId);
                await connection.query(
                    "UPDATE giveaways SET participant_ids = ? WHERE message_id = ?",
                    [JSON.stringify(participants), messageId]
                );
            }

            return true;
        });
    }

    async removeParticipant(messageId, userId) {
        return await transaction(async (connection) => {
            const [rows] = await connection.query(
                "SELECT participant_ids FROM giveaways WHERE message_id = ? FOR UPDATE",
                [messageId]
            );

            if (!rows[0]) {
                return false;
            }

            const participants = safeJsonParse(rows[0].participant_ids);
            const filtered = participants.filter(id => id !== userId);

            await connection.query(
                "UPDATE giveaways SET participant_ids = ? WHERE message_id = ?",
                [JSON.stringify(filtered), messageId]
            );

            return true;
        });
    }

    async getParticipants(messageId) {
        const rows = await query(
            "SELECT participant_ids FROM giveaways WHERE message_id = ? LIMIT 1",
            [messageId]
        );

        if (!rows[0]?.participant_ids) {
            return [];
        }

        return safeJsonParse(rows[0].participant_ids);
    }

    async end(messageId, winnerIds) {
        await query(
            "UPDATE giveaways SET status = ?, winner_ids = ? WHERE message_id = ?",
            [GIVEAWAY_STATUS.ENDED, JSON.stringify(winnerIds), messageId]
        );
    }
}

module.exports = new GiveawayRepository();