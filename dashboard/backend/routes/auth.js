const express = require('express');
const router = express.Router();
const axios = require('axios');
const oauthConfig = require('../config/oauth');
const oauthService = require('../services/oauth.service');
const { isAuthenticated, requireGuild, checkServerAccess } = require('../middleware/auth');
const logger = require('../../../src/utils/logger');


const oauthStateCache = new Map();
const STATE_CACHE_TTL = 10 * 60 * 1000;


setInterval(() => {
    const now = Date.now();
    for (const [state, data] of oauthStateCache.entries()) {
        if (now - data.timestamp > STATE_CACHE_TTL) {
            oauthStateCache.delete(state);
        }
    }
}, 5 * 60 * 1000);


router.get('/discord', async (req, res) => {
    const state = require('crypto').randomBytes(16).toString('hex');


    if (!req.sessionID) {
        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => {
                if (err) {
                    logger.error('Failed to regenerate session:', err);
                    return reject(err);
                }
                resolve();
            });
        });
    }


    req.session.oauthState = state;
    req.session.oauthStateTimestamp = Date.now();
    oauthStateCache.set(state, {
        sessionID: req.sessionID,
        timestamp: Date.now()
    });

    logger.debug(`OAuth init - Session ID: ${req.sessionID}, State: ${state}, Cookie: ${req.headers.cookie}`);


    let saved = false;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await new Promise((resolve, reject) => {
                req.session.save((err) => {
                    if (err) {
                        logger.error(`Failed to save OAuth state in session (attempt ${attempt + 1}):`, err);
                        return reject(err);
                    }
                    saved = true;
                    resolve();
                });
            });
            break;
        } catch (error) {
            if (attempt === 2) {
                logger.error('Failed to save session after 3 attempts');
                return res.status(500).json({ error: 'Failed to create session' });
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    logger.debug(`OAuth init - Session saved: ${saved}, ID: ${req.sessionID}, State cached: ${oauthStateCache.has(state)}`);

    const params = new URLSearchParams({
        client_id: oauthConfig.clientId,
        redirect_uri: oauthConfig.redirectUri,
        response_type: 'code',
        scope: oauthConfig.scopes.join(' '),
        state: state
    });

    const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    res.redirect(authUrl);
});


router.get('/discord/callback', async (req, res) => {
    try {
        const { code, state } = req.query;


        logger.debug(`OAuth callback - State from query: ${state}, State from session: ${req.session?.oauthState || 'undefined'}, Session ID: ${req.sessionID || 'none'}, Cookie header: ${req.headers.cookie || 'none'}`);

        if (!state) {
            logger.warn('OAuth callback missing state parameter');
            return res.status(400).json({ error: 'Missing state parameter' });
        }


        if (!req.session) {
            logger.warn('OAuth callback - No session object, creating new one');

        }


        if (!req.sessionID) {
            logger.debug('OAuth callback - No session ID, session will be created on first write');
        }



        if (!oauthStateCache.has(state)) {
            logger.warn(`OAuth callback - State not found in cache. State: ${state}, Session ID: ${req.sessionID}`);
            return res.status(400).json({
                error: 'Invalid or expired state parameter. Please try logging in again.',
                hint: 'The OAuth state has expired or is invalid. This usually means the login attempt took too long or was already used.'
            });
        }

        const cachedData = oauthStateCache.get(state);


        const stateAge = Date.now() - cachedData.timestamp;
        if (stateAge > STATE_CACHE_TTL) {
            logger.warn(`OAuth callback - State expired. Age: ${stateAge}ms, TTL: ${STATE_CACHE_TTL}ms`);
            oauthStateCache.delete(state);
            return res.status(400).json({
                error: 'OAuth state has expired. Please try logging in again.',
                hint: 'The login attempt took too long. Please try again.'
            });
        }


        logger.info(`OAuth callback - State validated successfully. State: ${state}, Age: ${stateAge}ms, Original session: ${cachedData.sessionID}, Current session: ${req.sessionID}`);


        oauthStateCache.delete(state);

        if (!code) {
            return res.status(400).json({ error: 'Authorization code not provided' });
        }


        const tokens = await oauthService.exchangeCodeForTokens(code);


        const userInfo = await oauthService.getUserInfo(tokens.accessToken);


        await oauthService.saveUser(userInfo, tokens);


        req.session.discordUserId = userInfo.id;
        req.session.user = {
            discordId: userInfo.id,
            username: userInfo.username,
            discriminator: userInfo.discriminator,
            avatar: userInfo.avatar
        };
        req.session.oauthState = null;


        const guildId = oauthConfig.guildId;

        if (guildId) {
            try {
                const accessToken = await oauthService.getValidAccessToken(userInfo.id);
                const guilds = await oauthService.getUserGuilds(accessToken);
                const guild = guilds.find(g => g.id === guildId);

                if (guild && oauthService.hasManageServerPermission(guild.permissions)) {
                    req.session.hasAccess = true;
                    req.session.selectedGuildId = guildId;
                } else {
                    req.session.hasAccess = false;
                    req.session.selectedGuildId = null;
                }
            } catch (error) {
                logger.error('Failed to check access after login:', error);
                req.session.hasAccess = false;
                req.session.selectedGuildId = null;
            }
        } else {
            req.session.hasAccess = false;
            req.session.selectedGuildId = null;
        }



        let sessionSaved = false;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await new Promise((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) {
                            logger.error(`Failed to save session after login (attempt ${attempt + 1}):`, err);
                            return reject(err);
                        }
                        sessionSaved = true;
                        resolve();
                    });
                });
                break;
            } catch (error) {
                if (attempt === 2) {
                    logger.error('Failed to save session after 3 attempts, redirecting anyway');
                } else {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }

        logger.debug(`OAuth callback - Session saved: ${sessionSaved}, Session ID: ${req.sessionID}, Has access: ${req.session.hasAccess}`);


        if (req.session.hasAccess) {
            res.redirect('/#/dashboard');
        } else {
            res.redirect('/#/access-denied');
        }
    } catch (error) {
        logger.error('OAuth callback error:', error);
        res.status(500).json({ error: 'Authentication failed', details: error.message });
    }
});





router.post('/bypass', async (req, res) => {



    const allowBypass = process.env.NODE_ENV !== 'production' || process.env.ALLOW_BYPASS_IN_PRODUCTION === 'true';

    if (!allowBypass) {
        return res.status(403).json({ error: 'Bypass not available in production. Set ALLOW_BYPASS_IN_PRODUCTION=true to enable.' });
    }

    try {
        const guildId = oauthConfig.guildId;


        req.session.discordUserId = 'bypass-user-' + Date.now();
        req.session.user = {
            discordId: req.session.discordUserId,
            username: 'Local Admin',
            discriminator: '0000',
            avatar: null
        };


        if (guildId) {
            req.session.hasAccess = true;
            req.session.selectedGuildId = guildId;
        } else {
            req.session.hasAccess = true;
            req.session.selectedGuildId = null;
        }

        req.session.oauthState = null;


        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) {
                    logger.error('Failed to save bypass session:', err);
                    return reject(err);
                }
                resolve();
            });
        });

        logger.info('Local bypass authentication successful');
        res.json({ success: true, message: 'Bypass authentication successful' });
    } catch (error) {
        logger.error('Bypass authentication error:', error);
        res.status(500).json({ error: 'Failed to create bypass session' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
    });
});


router.get('/me', isAuthenticated, async (req, res) => {
    try {

        if (req.session.hasAccess === undefined) {
            const guildId = oauthConfig.guildId;
            if (guildId && req.session.user) {
                try {
                    const accessToken = await oauthService.getValidAccessToken(req.session.user.discordId);
                    const guilds = await oauthService.getUserGuilds(accessToken);
                    const guild = guilds.find(g => g.id === guildId);

                    if (guild && oauthService.hasManageServerPermission(guild.permissions)) {
                        req.session.hasAccess = true;
                        req.session.selectedGuildId = guildId;
                    } else {
                        req.session.hasAccess = false;
                        req.session.selectedGuildId = null;
                    }
                } catch (error) {
                    req.session.hasAccess = false;
                }
            } else {
                req.session.hasAccess = false;
            }
        }

        res.json({
            user: req.session.user,
            selectedGuildId: req.session.selectedGuildId || null,
            hasAccess: req.session.hasAccess || false
        });
    } catch (error) {
        logger.error('Failed to get user info:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});


router.get('/role', isAuthenticated, checkServerAccess, requireGuild, async (req, res) => {
    try {
        const guildId = req.session.selectedGuildId;
        const userId = req.session.user.discordId;

        if (!guildId || !userId) {
            return res.json({ role: null });
        }


        const botToken = process.env.DISCORD_TOKEN;
        if (!botToken) {
            return res.json({ role: null });
        }


        const memberResponse = await axios.get(
            `https://discord.com/api/guilds/${guildId}/members/${userId}`,
            {
                headers: {
                    'Authorization': `Bot ${botToken}`
                }
            }
        ).catch(() => null);

        if (!memberResponse || !memberResponse.data) {
            return res.json({
                role: {
                    name: 'Member',
                    color: null,
                    position: 0
                }
            });
        }


        const guildResponse = await axios.get(
            `https://discord.com/api/guilds/${guildId}`,
            {
                headers: {
                    'Authorization': `Bot ${botToken}`
                }
            }
        ).catch(() => null);

        if (!guildResponse || !guildResponse.data) {
            return res.json({
                role: {
                    name: 'Member',
                    color: null,
                    position: 0
                }
            });
        }

        const roles = guildResponse.data.roles || [];
        const memberRoles = memberResponse.data.roles || [];


        let highestRole = null;
        let highestPosition = -1;

        for (const roleId of memberRoles) {
            const role = roles.find(r => r.id === roleId);
            if (role && role.id !== guildId) {

                const hasHoist = role.hoist === true;

                if (hasHoist && role.position > highestPosition) {
                    highestPosition = role.position;
                    highestRole = role;
                }
            }
        }


        if (!highestRole || highestPosition === -1) {
            return res.json({
                role: {
                    name: 'Member',
                    color: null,
                    position: 0
                }
            });
        }


        const colorHex = highestRole.color
            ? `#${highestRole.color.toString(16).padStart(6, '0')}`
            : null;

        res.json({
            role: {
                name: highestRole.name,
                color: colorHex,
                position: highestRole.position
            }
        });
    } catch (error) {
        logger.error('Failed to get user role:', error);
        res.json({
            role: {
                name: 'Member',
                color: null,
                position: 0
            }
        });
    }
});

module.exports = router;