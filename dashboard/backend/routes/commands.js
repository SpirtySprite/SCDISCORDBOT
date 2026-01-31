const express = require('express');
const router = express.Router();
const CommandService = require('../services/command.service');
const ConfigManager = require('../services/config.manager');
const { isAuthenticated, isAdmin, checkServerAccess } = require('../middleware/auth');


router.get('/', isAuthenticated, checkServerAccess, (req, res) => {
    try {
        const commands = CommandService.getCommands();
        res.json(commands);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch commands' });
    }
});


router.put('/:name/toggle', isAuthenticated, checkServerAccess, isAdmin, (req, res) => {
    try {
        const { enabled } = req.body;
        ConfigManager.toggleCommand(req.params.name, enabled);
        res.json({ message: `Command ${req.params.name} ${enabled ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle command' });
    }
});

module.exports = router;