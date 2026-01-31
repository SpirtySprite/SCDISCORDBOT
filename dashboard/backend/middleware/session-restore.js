const oauthService = require('../services/oauth.service');
const logger = require('../../../src/utils/logger');


const restoreSession = async (req, res, next) => {

    if (req.session && !req.session.user && req.session.discordUserId) {
        try {
            const user = await oauthService.getUserByDiscordId(req.session.discordUserId);
            if (user) {
                req.session.user = {
                    discordId: user.discordId,
                    username: user.username,
                    discriminator: user.discriminator,
                    avatar: user.avatar
                };
                logger.debug(`[SESSION RESTORE] Restored session for user ${user.discordId}`);



                req.session.hasAccess = undefined;
            }
        } catch (error) {
            logger.debug('[SESSION RESTORE] Could not restore session:', error.message);
        }
    }
    next();
};

module.exports = { restoreSession };