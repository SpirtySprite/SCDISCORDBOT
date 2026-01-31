const express = require('express');
const router = express.Router();
const logger = require('../../../src/utils/logger');
const minecraftRepo = require('../../../src/database/repositories/minecraftapi');


router.get('/commands', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const search = req.query.search;

        let commands;
        if (search) {
            commands = await minecraftRepo.searchCommands(search, limit);
        } else {
            commands = await minecraftRepo.getRecentCommands(limit, offset);
        }

        res.json(commands);
    } catch (error) {
        logger.error('[DASHBOARD API] Failed to fetch minecraft commands:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get('/commands/user/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const limit = parseInt(req.query.limit) || 100;

        const commands = await minecraftRepo.getCommandsByUser(username, limit);
        res.json(commands);
    } catch (error) {
        logger.error('[DASHBOARD API] Failed to fetch user commands:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get('/players', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const search = req.query.search;

        const players = await minecraftRepo.getPlayers(limit, offset, search);
        res.json(players);
    } catch (error) {
        logger.error('[DASHBOARD API] Failed to fetch minecraft players:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;