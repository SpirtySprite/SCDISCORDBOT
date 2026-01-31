const express = require('express');
const router = express.Router();
const modLogRepository = require('../../../src/database/repositories/modlog.repository');
const { isAuthenticated, requireGuild, getCurrentGuild, checkServerAccess } = require('../middleware/auth');
const logger = require('../../../src/utils/logger');


router.get('/', isAuthenticated, checkServerAccess, requireGuild, async (req, res) => {
    try {
        const guildId = getCurrentGuild(req);
        const {
            userId,
            moderatorId,
            action,
            search,
            dateFrom,
            dateTo,
            page = 1,
            limit = 50
        } = req.query;

        const filters = {
            userId: userId || null,
            moderatorId: moderatorId || null,
            action: action || null,
            search: search || null,
            dateFrom: dateFrom || null,
            dateTo: dateTo || null
        };

        const pagination = {
            page: parseInt(page),
            limit: parseInt(limit)
        };

        const result = await modLogRepository.findWithFilters(guildId, filters, pagination);

        res.json({
            logs: result.logs,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages
            }
        });
    } catch (error) {
        logger.error('Failed to get mod logs:', error);
        res.status(500).json({ error: 'Failed to get moderation logs', details: error.message });
    }
});


router.get('/stats', isAuthenticated, checkServerAccess, requireGuild, async (req, res) => {
    try {
        const guildId = getCurrentGuild(req);
        const stats = await modLogRepository.getStats(guildId);
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get mod log stats:', error);
        res.status(500).json({ error: 'Failed to get statistics', details: error.message });
    }
});


router.get('/export', isAuthenticated, checkServerAccess, requireGuild, async (req, res) => {
    try {
        const guildId = getCurrentGuild(req);
        const format = req.query.format || 'json';

        const data = await modLogRepository.exportLogs(guildId, format);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="modlogs_${guildId}_${Date.now()}.csv"`);
            res.send(data);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="modlogs_${guildId}_${Date.now()}.json"`);
            res.send(data);
        }
    } catch (error) {
        logger.error('Failed to export mod logs:', error);
        res.status(500).json({ error: 'Failed to export logs', details: error.message });
    }
});


router.get('/:logId', isAuthenticated, checkServerAccess, requireGuild, async (req, res) => {
    try {
        const guildId = getCurrentGuild(req);
        const { logId } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const log = await modLogRepository.findById(guildId, userId, logId);

        if (!log) {
            return res.status(404).json({ error: 'Log not found' });
        }

        res.json(log);
    } catch (error) {
        logger.error('Failed to get mod log:', error);
        res.status(500).json({ error: 'Failed to get log', details: error.message });
    }
});


router.delete('/:logId', isAuthenticated, checkServerAccess, requireGuild, async (req, res) => {
    try {
        const guildId = getCurrentGuild(req);
        const { logId } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const deleted = await modLogRepository.softDelete(guildId, userId, logId);

        if (!deleted) {
            return res.status(404).json({ error: 'Log not found' });
        }

        res.json({ message: 'Log deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete mod log:', error);
        res.status(500).json({ error: 'Failed to delete log', details: error.message });
    }
});

module.exports = router;