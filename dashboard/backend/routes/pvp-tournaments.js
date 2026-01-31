const express = require('express');
const router = express.Router();
const tournamentService = require('../../../src/services/pvp-tournament.service');
const { isAuthenticated, checkServerAccess, getCurrentGuild, requireGuild, isAdmin } = require('../middleware/auth');
const logger = require('../../../src/utils/logger');
const { getBotApiUrl } = require('../utils/bot-api-url');
const axios = require('axios');


router.get('/', isAuthenticated, checkServerAccess, requireGuild, async (req, res) => {
    try {
        const guildId = getCurrentGuild(req);
        if (!guildId) {
            return res.status(400).json({ error: 'Guild ID is required' });
        }
        const tournaments = await tournamentService.getAllTournaments(guildId);
        res.json(tournaments);
    } catch (error) {
        logger.error('Failed to fetch tournaments', error);
        res.status(500).json({ error: 'Failed to fetch tournaments', details: error.message });
    }
});


router.get('/:id', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const tournamentId = parseInt(req.params.id, 10);
        const tournament = await tournamentService.getTournament(tournamentId);

        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        const participants = await tournamentService.getParticipants(tournamentId);
        const matches = await tournamentService.getMatches(tournamentId);
        const bracketStructure = await tournamentService.getBracketStructure(tournamentId);

        res.json({
            ...tournament,
            participants,
            matches,
            bracket: bracketStructure
        });
    } catch (error) {
        logger.error('Failed to fetch tournament', error);
        res.status(500).json({ error: 'Failed to fetch tournament', details: error.message });
    }
});


router.get('/:id/bracket', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const tournamentId = parseInt(req.params.id, 10);
        const bracketStructure = await tournamentService.getBracketStructure(tournamentId);
        res.json(bracketStructure);
    } catch (error) {
        logger.error('Failed to fetch bracket structure', error);
        res.status(500).json({ error: 'Failed to fetch bracket structure', details: error.message });
    }
});


router.post('/:id/matches/:matchId/start', isAuthenticated, checkServerAccess, isAdmin, async (req, res) => {
    try {
        const tournamentId = parseInt(req.params.id, 10);
        const matchId = parseInt(req.params.matchId, 10);

        const tournament = await tournamentService.getTournament(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        const match = await tournamentService.getMatch(matchId);
        if (!match || match.tournament_id !== tournamentId) {
            return res.status(404).json({ error: 'Match not found' });
        }

        const botApiUrl = getBotApiUrl();
        const response = await axios.post(
            `${botApiUrl}/tournaments/${tournamentId}/matches/${matchId}/notify`,
            {},
            { timeout: 10000 }
        );

        res.json({ success: true, messageId: response.data.messageId });
    } catch (error) {
        logger.error('Failed to start match', error);
        if (error.response) {
            res.status(error.response.status).json({
                error: 'Failed to start match',
                details: error.response.data?.error || error.message
            });
        } else {
            res.status(500).json({ error: 'Failed to start match', details: error.message });
        }
    }
});


router.post('/:id/matches/:matchId/winner', isAuthenticated, checkServerAccess, isAdmin, async (req, res) => {
    try {
        const tournamentId = parseInt(req.params.id, 10);
        const matchId = parseInt(req.params.matchId, 10);
        const { winnerId } = req.body;

        if (!winnerId) {
            return res.status(400).json({ error: 'winnerId is required' });
        }

        const tournament = await tournamentService.getTournament(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        const match = await tournamentService.getMatch(matchId);
        if (!match || match.tournament_id !== tournamentId) {
            return res.status(404).json({ error: 'Match not found' });
        }

        if (match.player1_id !== winnerId && match.player2_id !== winnerId) {
            return res.status(400).json({ error: 'Winner must be one of the match players' });
        }

        await tournamentService.setMatchWinner(matchId, winnerId);

        const botApiUrl = getBotApiUrl();
        try {
            await axios.post(
                `${botApiUrl}/tournaments/${tournamentId}/matches/${matchId}/complete`,
                { winnerId },
                { timeout: 10000 }
            );
        } catch (error) {
            logger.warn('Failed to notify bot API of match completion, but match was updated', error);
        }

        const updatedMatch = await tournamentService.getMatch(matchId);
        const bracketStructure = await tournamentService.getBracketStructure(tournamentId);

        res.json({
            success: true,
            match: updatedMatch,
            bracket: bracketStructure
        });
    } catch (error) {
        logger.error('Failed to set match winner', error);
        res.status(500).json({ error: 'Failed to set match winner', details: error.message });
    }
});

module.exports = router;