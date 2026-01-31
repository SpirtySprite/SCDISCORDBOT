const axios = require('axios');
const oauthService = require('../services/oauth.service');
const oauthConfig = require('../config/oauth');
const logger = require('../../../src/utils/logger');

const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.discordId) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
};

const getCurrentGuild = (req) => {
    return req.session?.selectedGuildId || oauthConfig.guildId || null;
};

const requireGuild = (req, res, next) => {
    const guildId = getCurrentGuild(req);
    if (!guildId) {
        return res.status(400).json({ error: 'No server configured. Please set DISCORD_GUILD_ID in environment.' });
    }
    next();
};


const checkServerAccess = async (req, res, next) => {

    if (req.session.hasAccess !== undefined) {
        if (req.session.hasAccess) {
            return next();
        } else {
            return res.status(403).json({ error: 'Access denied: You do not have "Manage Server" permission' });
        }
    }

    const guildId = oauthConfig.guildId;
    if (!guildId) {
        req.session.hasAccess = false;
        return res.status(500).json({ error: 'Server not configured. Please set DISCORD_GUILD_ID.' });
    }


    if (!req.session || !req.session.user || !req.session.user.discordId) {
        return next();
    }

    try {
        const userId = req.session.user.discordId;


        const accessToken = await oauthService.getValidAccessToken(userId);


        const guilds = await oauthService.getUserGuilds(accessToken);


        const guild = guilds.find(g => g.id === guildId);

        if (!guild) {
            req.session.hasAccess = false;
            req.session.selectedGuildId = null;
            logger.warn(`[AUTH] User ${userId} is not in configured guild ${guildId}`);
            return res.status(403).json({ error: 'Access denied: You are not a member of this server' });
        }


        const hasPermission = oauthService.hasManageServerPermission(guild.permissions);

        if (hasPermission) {
            req.session.hasAccess = true;
            req.session.selectedGuildId = guildId;
            logger.debug(`[AUTH] User ${userId} granted access to guild ${guildId}`);
            next();
        } else {
            req.session.hasAccess = false;
            req.session.selectedGuildId = null;
            logger.warn(`[AUTH] User ${userId} denied access to guild ${guildId} - no Manage Server permission`);
            return res.status(403).json({ error: 'Access denied: You do not have "Manage Server" permission' });
        }
    } catch (error) {
        logger.error('[AUTH] Failed to check server access:', error);
        req.session.hasAccess = false;
        return res.status(500).json({ error: 'Failed to verify server access', details: error.message });
    }
};

const isAdmin = (req, res, next) => {

    if (req.session && req.session.hasAccess) {
        return next();
    }
    res.status(403).json({ error: 'Forbidden: Admin access required' });
};

module.exports = {
    isAuthenticated,
    isAdmin,
    getCurrentGuild,
    requireGuild,
    checkServerAccess
};