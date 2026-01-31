const express = require('express');
const router = express.Router();
const axios = require('axios');
const oauthService = require('../services/oauth.service');
const oauthConfig = require('../config/oauth');
const { isAuthenticated, checkServerAccess } = require('../middleware/auth');
const logger = require('../../../src/utils/logger');
const { getBotApiUrl } = require('../utils/bot-api-url');


router.get('/', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const guildId = oauthConfig.guildId;
        if (!guildId) {
            return res.status(500).json({ error: 'Server not configured' });
        }


        const botApiUrl = getBotApiUrl();
        let serverInfo = null;

        try {
            const response = await axios.get(`${botApiUrl}/guilds/${guildId}/info`, {
                timeout: 2000
            });
            serverInfo = response.data;
        } catch (error) {
            logger.debug(`Could not get server info from bot API:`, error.message);
        }


        const accessToken = await oauthService.getValidAccessToken(req.session.user.discordId);
        const guilds = await oauthService.getUserGuilds(accessToken);
        const userGuild = guilds.find(g => g.id === guildId);

        res.json({
            id: guildId,
            name: serverInfo?.name || userGuild?.name || 'Unknown Server',
            icon: userGuild?.icon
                ? `https://cdn.discordapp.com/icons/${guildId}/${userGuild.icon}.png`
                : null,
            botPresent: serverInfo !== null,
            memberCount: serverInfo?.memberCount || null,
            hasAccess: req.session.hasAccess || false
        });
    } catch (error) {
        logger.error('Failed to get server info:', error);
        res.status(500).json({ error: 'Failed to get server info', details: error.message });
    }
});

router.get('/roles', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const guildId = oauthConfig.guildId;
        if (!guildId) {
            logger.warn('[ROLES API] No guild ID configured');
            return res.status(500).json({ error: 'Server not configured. Please set DISCORD_GUILD_ID.' });
        }


        let botApiUrl;
        try {
            botApiUrl = getBotApiUrl();
        } catch (urlError) {
            logger.error(`[ROLES API] ${urlError.message}`);
            return res.status(500).json({
                error: urlError.message,
                hint: 'Remove any comments or extra text from the BOT_API_URL environment variable'
            });
        }

        const url = `${botApiUrl}/guilds/${guildId}/roles`;

        logger.info(`[ROLES API] Fetching roles from: ${url} (guildId: ${guildId}, botApiUrl: ${botApiUrl})`);

        try {
            const response = await axios.get(url, {
                timeout: 10000,
                validateStatus: (status) => status < 500
            });

            if (response.status === 503) {
                logger.warn('[ROLES API] Bot API returned 503 - Bot client not ready');
                return res.status(503).json({ error: 'Bot API server not ready. Ensure bot is running and connected to Discord.' });
            }

            if (response.status === 404) {
                logger.warn(`[ROLES API] Guild ${guildId} not found in bot API`);
                return res.status(404).json({ error: 'Guild not found. Ensure bot is in the server.' });
            }

            if (response.status !== 200) {
                logger.error(`[ROLES API] Unexpected status ${response.status}:`, response.data);
                return res.status(response.status).json({ error: response.data?.error || 'Failed to get roles' });
            }

            const roles = response.data || [];
            logger.debug(`[ROLES API] Successfully fetched ${roles.length} roles`);

            res.json(roles);

        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                logger.error(`[ROLES API] Connection refused to ${botApiUrl}/guilds/${guildId}/roles. Is the bot running?`);
                return res.status(503).json({
                    error: `Bot API server not available at ${botApiUrl}. Ensure bot is running and BOT_API_URL is set correctly.`,
                    url: `${botApiUrl}/guilds/${guildId}/roles`
                });
            }

            if (error.code === 'ETIMEDOUT') {
                logger.error(`[ROLES API] Timeout connecting to ${botApiUrl}`);
                return res.status(503).json({
                    error: `Timeout connecting to bot API at ${botApiUrl}. The bot may be overloaded or not responding.`,
                    url: `${botApiUrl}/guilds/${guildId}/roles`
                });
            }

            if (error.response) {
                logger.error(`[ROLES API] Bot API error (${error.response.status}):`, error.response.data);
                return res.status(error.response.status).json({
                    error: error.response.data?.error || 'Failed to get roles from bot API',
                    url: url
                });
            }

            logger.error('[ROLES API] Network error:', error.message, error);
            return res.status(503).json({
                error: `Failed to connect to bot API: ${error.message}`,
                url: url,
                code: error.code,
                botApiUrl: botApiUrl,
                guildId: guildId
            });
        }
    } catch (error) {
        logger.error('[ROLES API] Unexpected error:', error);
        res.status(500).json({ error: 'Failed to get roles', details: error.message });
    }
});


router.get('/roles/test', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const guildId = oauthConfig.guildId;
        let botApiUrl;
        try {
            botApiUrl = getBotApiUrl();
        } catch (urlError) {
            return res.status(500).json({
                error: urlError.message,
                hint: 'Remove any comments or extra text from the BOT_API_URL environment variable'
            });
        }


        try {
            const healthUrl = botApiUrl.replace(/\/+$/, '') + '/health';
            const healthResponse = await axios.get(healthUrl, { timeout: 5000 });

            return res.json({
                success: true,
                botApiUrl: botApiUrl,
                healthCheck: healthResponse.data,
                message: `Bot API is reachable at ${botApiUrl}. Bot ready: ${healthResponse.data.ready || false}`
            });
        } catch (healthError) {
            return res.status(503).json({
                success: false,
                botApiUrl: botApiUrl,
                error: healthError.message,
                code: healthError.code,
                message: `Cannot reach bot API at ${botApiUrl}. Please check:`,
                checks: [
                    '1. Is the bot running?',
                    '2. Is BOT_API_URL set correctly in dashboard backend environment?',
                    '3. If bot and dashboard are on the same server, use: http://localhost:45049',
                    '4. If bot is on a different server, use: http://<bot-ip>:45049',
                    `5. Check bot logs for "Bot API server running on port X" to confirm the port`
                ]
            });
        }
    } catch (error) {
        logger.error('[ROLES API TEST] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;