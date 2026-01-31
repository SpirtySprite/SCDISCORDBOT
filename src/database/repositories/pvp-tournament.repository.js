const { query, transaction } = require('../connection');

class PvpTournamentRepository {
    async create(data) {
        return await transaction(async (connection) => {
            const sql = `
                INSERT INTO tournaments
                (guild_id, channel_id, message_id, max_entries, entry_duration_ms, entry_end_time, created_by, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'registration')
            `;
            const params = [
                data.guildId,
                data.channelId,
                data.messageId,
                data.maxEntries,
                data.entryDurationMs,
                data.entryEndTime,
                data.createdBy
            ];
            const [result] = await connection.query(sql, params);
            return result.insertId;
        });
    }

    async findById(tournamentId) {
        const rows = await query(
            "SELECT * FROM tournaments WHERE id = ? LIMIT 1",
            [tournamentId]
        );
        return rows[0] || null;
    }

    async findByMessageId(messageId) {
        const rows = await query(
            "SELECT * FROM tournaments WHERE message_id = ? LIMIT 1",
            [messageId]
        );
        return rows[0] || null;
    }

    async findAll(guildId = null) {
        const sql = guildId
            ? "SELECT * FROM tournaments WHERE guild_id = ? ORDER BY created_at DESC"
            : "SELECT * FROM tournaments ORDER BY created_at DESC";
        const params = guildId ? [guildId] : [];
        return await query(sql, params);
    }

    async updateStatus(tournamentId, status) {
        await query(
            "UPDATE tournaments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [status, tournamentId]
        );
    }

    async updateParticipantListMessageId(tournamentId, messageId) {
        await query(
            "UPDATE tournaments SET participant_list_message_id = ? WHERE id = ?",
            [messageId, tournamentId]
        );
    }

    async addParticipant(tournamentId, userId, username, userTag) {
        return await transaction(async (connection) => {
            try {
                const sql = `
                    INSERT INTO tournament_participants
                    (tournament_id, user_id, username, user_tag)
                    VALUES (?, ?, ?, ?)
                `;
                await connection.query(sql, [tournamentId, userId, username, userTag]);
                return true;
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    return false;
                }
                throw error;
            }
        });
    }

    async removeParticipant(tournamentId, userId) {
        const [result] = await query(
            "DELETE FROM tournament_participants WHERE tournament_id = ? AND user_id = ?",
            [tournamentId, userId]
        );
        return result.affectedRows > 0;
    }

    async getParticipants(tournamentId) {
        return await query(
            "SELECT * FROM tournament_participants WHERE tournament_id = ? ORDER BY registered_at ASC",
            [tournamentId]
        );
    }

    async getParticipantCount(tournamentId) {
        const rows = await query(
            "SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = ?",
            [tournamentId]
        );
        return rows[0]?.count || 0;
    }

    async createMatch(data) {
        return await transaction(async (connection) => {
            const sql = `
                INSERT INTO tournament_matches
                (tournament_id, round, match_number, player1_id, player2_id, status, next_match_id, next_match_slot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                data.tournamentId,
                data.round,
                data.matchNumber,
                data.player1Id || null,
                data.player2Id || null,
                data.status || 'pending',
                data.nextMatchId || null,
                data.nextMatchSlot || null
            ];
            const [result] = await connection.query(sql, params);
            return result.insertId;
        });
    }

    async getMatches(tournamentId, round = null) {
        const sql = round !== null
            ? "SELECT * FROM tournament_matches WHERE tournament_id = ? AND round = ? ORDER BY match_number ASC"
            : "SELECT * FROM tournament_matches WHERE tournament_id = ? ORDER BY round ASC, match_number ASC";
        const params = round !== null ? [tournamentId, round] : [tournamentId];
        return await query(sql, params);
    }

    async getMatch(matchId) {
        const rows = await query(
            "SELECT * FROM tournament_matches WHERE id = ? LIMIT 1",
            [matchId]
        );
        return rows[0] || null;
    }

    async updateMatchStatus(matchId, status) {
        await query(
            "UPDATE tournament_matches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [status, matchId]
        );
    }

    async setMatchWinner(matchId, winnerId) {
        const logger = require('../utils/logger');
        return await transaction(async (connection) => {

            const [matchRowsBefore] = await connection.query(
                "SELECT * FROM tournament_matches WHERE id = ? LIMIT 1",
                [matchId]
            );
            const matchBefore = matchRowsBefore[0];

            if (!matchBefore) {
                throw new Error('Match not found');
            }

            logger.info(`Setting winner for match ${matchId}: winner=${winnerId}, next_match_id=${matchBefore.next_match_id}, next_match_slot=${matchBefore.next_match_slot}`);


            await connection.query(
                "UPDATE tournament_matches SET winner_id = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [winnerId, matchId]
            );


            if (matchBefore.next_match_id) {
                const [nextMatchRows] = await connection.query(
                    "SELECT * FROM tournament_matches WHERE id = ? LIMIT 1",
                    [matchBefore.next_match_id]
                );
                const nextMatch = nextMatchRows[0];

                if (nextMatch) {
                    const updateField = matchBefore.next_match_slot === 'player1' ? 'player1_id' : 'player2_id';
                    logger.info(`Advancing winner ${winnerId} to match ${matchBefore.next_match_id} in slot ${updateField}`);

                    await connection.query(
                        `UPDATE tournament_matches SET ${updateField} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [winnerId, matchBefore.next_match_id]
                    );


                    const [updatedNextMatchRows] = await connection.query(
                        "SELECT * FROM tournament_matches WHERE id = ? LIMIT 1",
                        [matchBefore.next_match_id]
                    );
                    const updatedNextMatch = updatedNextMatchRows[0];

                    if (updatedNextMatch.player1_id && updatedNextMatch.player2_id) {
                        logger.info(`Next match ${matchBefore.next_match_id} now has both players, setting status to pending`);
                        await connection.query(
                            "UPDATE tournament_matches SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                            [matchBefore.next_match_id]
                        );
                    } else {
                        logger.info(`Next match ${matchBefore.next_match_id} still waiting for opponent (player1: ${updatedNextMatch.player1_id}, player2: ${updatedNextMatch.player2_id})`);
                    }
                } else {
                    logger.warn(`Next match ${matchBefore.next_match_id} not found`);
                }
            } else {
                logger.info(`Match ${matchId} has no next_match_id (likely the final match)`);
            }
        });
    }

    async setMatchMessageId(matchId, messageId) {
        await query(
            "UPDATE tournament_matches SET match_message_id = ? WHERE id = ?",
            [messageId, matchId]
        );
    }

    async getBracketStructure(tournamentId) {
        const matches = await this.getMatches(tournamentId);
        const rounds = {};

        for (const match of matches) {
            if (!rounds[match.round]) {
                rounds[match.round] = [];
            }
            rounds[match.round].push(match);
        }

        return rounds;
    }
}

module.exports = new PvpTournamentRepository();