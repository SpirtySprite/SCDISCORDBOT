const express = require('express');
const router = express.Router();
const ConfigManager = require('../services/config.manager');
const { isAuthenticated, isAdmin, requireGuild, getCurrentGuild, checkServerAccess } = require('../middleware/auth');
const cacheMiddleware = require('../middleware/cache');
const logger = require('../../../src/utils/logger');

router.get('/:domain', isAuthenticated, checkServerAccess, (req, res) => {
    try {
        const config = ConfigManager.getDomainConfig(req.params.domain);
        if (!config) {
            return res.status(404).json({ error: 'Config domain not found' });
        }
        res.json(config);
    } catch (error) {
        logger.error(`[CONFIG ROUTE] Failed to fetch config domain ${req.params.domain}:`, error);
        res.status(500).json({ error: 'Failed to fetch configuration', details: error.message });
    }
});

router.put('/:domain', isAuthenticated, checkServerAccess, isAdmin, (req, res) => {
    try {
        logger.info(`[CONFIG API] Updating domain: ${req.params.domain}`);

        ConfigManager.updateDomainConfig(req.params.domain, req.body);


        const invalidated = cacheMiddleware.invalidate(new RegExp(`^GET:/api/config/.*`));
        logger.debug(`[CONFIG API] Invalidated ${invalidated} cache entries for config update`);

        res.json({ message: `Config domain ${req.params.domain} updated successfully` });
    } catch (error) {
        logger.error(`[CONFIG API] Failed to update domain ${req.params.domain}:`, error);
        res.status(500).json({ error: 'Failed to update configuration', details: error.message });
    }
});

module.exports = router;