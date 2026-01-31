const express = require('express');
const router = express.Router();
const levelRoleRepository = require('../../../src/database/repositories/level-role.repository');
const oauthConfig = require('../config/oauth');
const { isAuthenticated, checkServerAccess, isAdmin } = require('../middleware/auth');
const logger = require('../../../src/utils/logger');


router.get('/', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const guildId = oauthConfig.guildId;
        if (!guildId) {
            return res.status(500).json({ error: 'Server not configured' });
        }

        logger.debug(`[LEVEL ROLES] Fetching level roles for guild ${guildId}`);
        const levelRoles = await levelRoleRepository.findAllByGuild(guildId);
        logger.debug(`[LEVEL ROLES] Found ${levelRoles.length} level roles in database`);


        const formatted = levelRoles.map(lr => ({
            level: parseInt(lr.level),
            roleId: lr.role_id
        }));

        logger.debug(`[LEVEL ROLES] Returning ${formatted.length} formatted level roles`);
        res.json(formatted);
    } catch (error) {
        logger.error('[LEVEL ROLES] Failed to get level roles:', error);
        res.status(500).json({ error: 'Failed to get level roles', details: error.message });
    }
});


router.put('/', isAuthenticated, checkServerAccess, isAdmin, async (req, res) => {
    try {
        const guildId = oauthConfig.guildId;
        if (!guildId) {
            return res.status(500).json({ error: 'Server not configured' });
        }

        const { levelRoles } = req.body;

        logger.info(`[LEVEL ROLES] Received update request for guild ${guildId}:`, JSON.stringify(levelRoles));

        if (!Array.isArray(levelRoles)) {
            logger.error(`[LEVEL ROLES] Invalid request: levelRoles is not an array`, typeof levelRoles);
            return res.status(400).json({ error: 'levelRoles must be an array' });
        }


        const currentLevelRoles = await levelRoleRepository.findAllByGuild(guildId);
        logger.info(`[LEVEL ROLES] Current level roles in DB: ${currentLevelRoles.length}`);
        const currentMap = new Map(currentLevelRoles.map(lr => [lr.level, lr.role_id]));


        const newMap = new Map();
        for (const lr of levelRoles) {

            if (!lr || (typeof lr.level !== 'number' && typeof lr.level !== 'string')) {
                logger.warn(`[LEVEL ROLES] Skipping invalid entry (no level):`, lr);
                continue;
            }

            const level = parseInt(lr.level);
            const roleId = lr.roleId || lr.role_id;

            if (isNaN(level) || level < 1 || !roleId || typeof roleId !== 'string') {
                logger.warn(`[LEVEL ROLES] Skipping invalid entry: level=${lr.level}, roleId=${roleId}`);
                continue;
            }

            newMap.set(level, roleId);
        }

        logger.info(`[LEVEL ROLES] Valid level roles to save: ${newMap.size}`);


        for (const [level] of currentMap) {
            if (!newMap.has(level)) {
                await levelRoleRepository.delete(guildId, level);
            }
        }


        for (const [level, roleId] of newMap) {
            const currentRoleId = currentMap.get(level);
            if (currentRoleId !== roleId) {
                try {
                    await levelRoleRepository.create({
                        guildId,
                        level,
                        roleId
                    });
                    logger.info(`Level role created/updated: level ${level} -> role ${roleId} for guild ${guildId}`);
                } catch (error) {
                    logger.error(`Failed to create/update level role for level ${level}:`, error);
                    throw error;
                }
            }
        }


        const verifyLevelRoles = await levelRoleRepository.findAllByGuild(guildId);
        logger.info(`Level roles saved successfully. Total level roles for guild ${guildId}: ${verifyLevelRoles.length}`);

        res.json({
            message: 'Level roles updated successfully',
            count: verifyLevelRoles.length
        });
    } catch (error) {
        logger.error('Failed to update level roles:', error);
        res.status(500).json({ error: 'Failed to update level roles', details: error.message });
    }
});

module.exports = router;