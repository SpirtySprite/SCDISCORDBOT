const tournamentRepository = require('../database/repositories/pvp-tournament.repository');
const logger = require('../utils/logger');

class PvpTournamentService {
    async createTournament(data) {
        try {
            const tournamentId = await tournamentRepository.create(data);
            return tournamentId;
        } catch (error) {
            logger.error('Failed to create tournament', error);
            throw error;
        }
    }

    async getTournament(tournamentId) {
        try {
            return await tournamentRepository.findById(tournamentId);
        } catch (error) {
            logger.error(`Failed to get tournament ${tournamentId}`, error);
            throw error;
        }
    }

    async getTournamentByMessageId(messageId) {
        try {
            return await tournamentRepository.findByMessageId(messageId);
        } catch (error) {
            logger.error(`Failed to get tournament by message ${messageId}`, error);
            throw error;
        }
    }

    async getAllTournaments(guildId = null) {
        try {
            return await tournamentRepository.findAll(guildId);
        } catch (error) {
            logger.error('Failed to get tournaments', error);
            throw error;
        }
    }

    async addParticipant(tournamentId, userId, username, userTag) {
        try {
            const tournament = await tournamentRepository.findById(tournamentId);
            if (!tournament) {
                throw new Error('Tournament not found');
            }

            if (tournament.status !== 'registration') {
                throw new Error('Tournament registration is closed');
            }

            const participantCount = await tournamentRepository.getParticipantCount(tournamentId);
            if (participantCount >= tournament.max_entries) {
                throw new Error('Tournament is full');
            }

            return await tournamentRepository.addParticipant(tournamentId, userId, username, userTag);
        } catch (error) {
            logger.error(`Failed to add participant ${userId} to tournament ${tournamentId}`, error);
            throw error;
        }
    }

    async removeParticipant(tournamentId, userId) {
        try {
            const tournament = await tournamentRepository.findById(tournamentId);
            if (!tournament) {
                throw new Error('Tournament not found');
            }

            if (tournament.status !== 'registration') {
                throw new Error('Cannot leave tournament after registration closes');
            }

            return await tournamentRepository.removeParticipant(tournamentId, userId);
        } catch (error) {
            logger.error(`Failed to remove participant ${userId} from tournament ${tournamentId}`, error);
            throw error;
        }
    }

    async getParticipants(tournamentId) {
        try {
            return await tournamentRepository.getParticipants(tournamentId);
        } catch (error) {
            logger.error(`Failed to get participants for tournament ${tournamentId}`, error);
            throw error;
        }
    }

    async getParticipantCount(tournamentId) {
        try {
            return await tournamentRepository.getParticipantCount(tournamentId);
        } catch (error) {
            logger.error(`Failed to get participant count for tournament ${tournamentId}`, error);
            throw error;
        }
    }

    async generateBrackets(tournamentId) {
        try {
            const tournament = await tournamentRepository.findById(tournamentId);
            if (!tournament) {
                throw new Error('Tournament not found');
            }

            const participants = await tournamentRepository.getParticipants(tournamentId);
            const participantCount = participants.length;

            if (participantCount < 2) {
                throw new Error('Not enough participants to generate brackets (minimum 2)');
            }

            const validSizes = [8, 16, 32, 64];
            if (!validSizes.includes(tournament.max_entries)) {
                throw new Error(`Invalid tournament size: ${tournament.max_entries}. Must be 8, 16, 32, or 64.`);
            }


            const totalRounds = Math.log2(tournament.max_entries);


            const matchMap = new Map();


            for (let round = 1; round <= totalRounds; round++) {
                const matchesInRound = tournament.max_entries / Math.pow(2, round);

                for (let matchNum = 1; matchNum <= matchesInRound; matchNum++) {
                    let player1Id = null;
                    let player2Id = null;


                    if (round === 1) {
                        const matchIndex = matchNum - 1;
                        const player1Index = matchIndex * 2;
                        const player2Index = player1Index + 1;

                        if (player1Index < participantCount) {
                            player1Id = participants[player1Index].user_id;
                        }
                        if (player2Index < participantCount) {
                            player2Id = participants[player2Index].user_id;
                        }
                    }


                    const matchId = await tournamentRepository.createMatch({
                        tournamentId,
                        round,
                        matchNumber: matchNum,
                        player1Id,
                        player2Id,
                        status: (!player1Id || !player2Id) ? 'bye' : 'pending',
                        nextMatchId: null,
                        nextMatchSlot: null
                    });

                    const matchKey = `${round}_${matchNum}`;
                    matchMap.set(matchKey, { id: matchId, round, matchNumber: matchNum });
                }
            }


            const { query } = require('../database/connection');
            for (let round = 1; round < totalRounds; round++) {
                const matchesInRound = tournament.max_entries / Math.pow(2, round);

                for (let matchNum = 1; matchNum <= matchesInRound; matchNum++) {
                    const matchKey = `${round}_${matchNum}`;
                    const match = matchMap.get(matchKey);

                    if (!match) continue;


                    const nextRound = round + 1;
                    const nextMatchNumber = Math.ceil(matchNum / 2);
                    const nextMatchKey = `${nextRound}_${nextMatchNumber}`;
                    const nextMatch = matchMap.get(nextMatchKey);

                    if (nextMatch) {

                        const nextMatchSlot = (matchNum % 2 === 1) ? 'player1' : 'player2';

                        await query(
                            "UPDATE tournament_matches SET next_match_id = ?, next_match_slot = ? WHERE id = ?",
                            [nextMatch.id, nextMatchSlot, match.id]
                        );
                    }
                }
            }

            await tournamentRepository.updateStatus(tournamentId, 'brackets_generated');
            logger.info(`Brackets generated for tournament ${tournamentId}: ${totalRounds} rounds, ${matchMap.size} matches`);

            return await tournamentRepository.getBracketStructure(tournamentId);
        } catch (error) {
            logger.error(`Failed to generate brackets for tournament ${tournamentId}`, error);
            throw error;
        }
    }

    async getBracketStructure(tournamentId) {
        try {
            return await tournamentRepository.getBracketStructure(tournamentId);
        } catch (error) {
            logger.error(`Failed to get bracket structure for tournament ${tournamentId}`, error);
            throw error;
        }
    }

    async getMatches(tournamentId, round = null) {
        try {
            return await tournamentRepository.getMatches(tournamentId, round);
        } catch (error) {
            logger.error(`Failed to get matches for tournament ${tournamentId}`, error);
            throw error;
        }
    }

    async getMatch(matchId) {
        try {
            return await tournamentRepository.getMatch(matchId);
        } catch (error) {
            logger.error(`Failed to get match ${matchId}`, error);
            throw error;
        }
    }

    async startMatch(matchId) {
        try {
            const match = await tournamentRepository.getMatch(matchId);
            if (!match) {
                throw new Error('Match not found');
            }

            if (match.status !== 'pending') {
                throw new Error(`Match is not in pending status (current: ${match.status})`);
            }

            if (!match.player1_id || !match.player2_id) {
                throw new Error('Match does not have both players assigned');
            }

            await tournamentRepository.updateMatchStatus(matchId, 'in_progress');
            return match;
        } catch (error) {
            logger.error(`Failed to start match ${matchId}`, error);
            throw error;
        }
    }

    async setMatchWinner(matchId, winnerId) {
        try {
            const match = await tournamentRepository.getMatch(matchId);
            if (!match) {
                throw new Error('Match not found');
            }


            if (match.winner_id && match.winner_id !== winnerId) {
                throw new Error('Match already has a different winner');
            }


            if (match.winner_id === winnerId) {
                logger.info(`Match ${matchId} already has winner ${winnerId}, returning existing match`);
                return match;
            }

            if (match.status !== 'in_progress' && match.status !== 'completed') {
                throw new Error(`Match must be in progress to set winner (current: ${match.status})`);
            }

            if (match.player1_id !== winnerId && match.player2_id !== winnerId) {
                throw new Error('Winner must be one of the match players');
            }


            await tournamentRepository.setMatchWinner(matchId, winnerId);


            const allMatches = await tournamentRepository.getMatches(match.tournament_id);
            const totalRounds = Math.log2((await tournamentRepository.findById(match.tournament_id)).max_entries);
            const finalMatch = allMatches.find(m => m.round === totalRounds && m.match_number === 1);

            if (finalMatch && finalMatch.winner_id) {
                await tournamentRepository.updateStatus(match.tournament_id, 'completed');
                logger.info(`Tournament ${match.tournament_id} completed! Winner: ${finalMatch.winner_id}`);
            } else {
                await tournamentRepository.updateStatus(match.tournament_id, 'in_progress');
            }

            const updatedMatch = await tournamentRepository.getMatch(matchId);
            return updatedMatch;
        } catch (error) {
            logger.error(`Failed to set winner for match ${matchId}`, error);
            throw error;
        }
    }

    async setMatchMessageId(matchId, messageId) {
        try {
            await tournamentRepository.setMatchMessageId(matchId, messageId);
        } catch (error) {
            logger.error(`Failed to set match message ID for match ${matchId}`, error);
            throw error;
        }
    }

    async updateParticipantListMessageId(tournamentId, messageId) {
        try {
            await tournamentRepository.updateParticipantListMessageId(tournamentId, messageId);
        } catch (error) {
            logger.error(`Failed to update participant list message ID for tournament ${tournamentId}`, error);
            throw error;
        }
    }

    async updateStatus(tournamentId, status) {
        try {
            await tournamentRepository.updateStatus(tournamentId, status);
        } catch (error) {
            logger.error(`Failed to update status for tournament ${tournamentId}`, error);
            throw error;
        }
    }
}

module.exports = new PvpTournamentService();