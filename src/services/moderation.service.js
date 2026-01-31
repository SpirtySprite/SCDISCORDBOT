const modLogRepository = require('../database/repositories/modlog.repository');
const { MOD_ACTION } = require('../utils/constants');
const logger = require('../utils/logger');

class ModerationService {
    async createLog(data) {
        try {
            const logId = await modLogRepository.create(data);
            return logId;
        } catch (error) {
            logger.error('Failed to create mod log', error);
            throw error;
        }
    }

    async getModLogs(guildId, userId, page = 1) {
        try {
            const allLogs = await modLogRepository.findByUserId(guildId, userId);
            const logsArray = Array.isArray(allLogs) ? allLogs : [];
            const logsWithSequentialId = logsArray.map((log, index) => ({
                ...log,
                sequentialId: index + 1
            }));

            const totalPages = Math.max(1, Math.ceil(logsWithSequentialId.length / 5));
            const startIndex = (page - 1) * 5;
            const endIndex = startIndex + 5;
            const logs = logsWithSequentialId.slice(startIndex, endIndex);

            return {
                logs,
                currentPage: page,
                totalPages: totalPages,
                totalLogs: logsWithSequentialId.length
            };
        } catch (error) {
            logger.error(`Failed to get mod logs for user ${userId}`, error);
            throw error;
        }
    }

    async deleteLog(guildId, userId, sequentialId) {
        try {
            const allLogs = await modLogRepository.findByUserId(guildId, userId);
            const logToDelete = allLogs[sequentialId - 1];

            if (!logToDelete) {
                return false;
            }

            return await modLogRepository.softDelete(guildId, userId, logToDelete.id);
        } catch (error) {
            logger.error(`Failed to delete mod log ${sequentialId}`, error);
            throw error;
        }
    }

    async getNextLogId(guildId, userId) {
        try {
            return await modLogRepository.getNextId(guildId, userId);
        } catch (error) {
            logger.error(`Failed to get next log ID for user ${userId}`, error);
            throw error;
        }
    }

    async logAction(guildId, userId, moderatorId, action, reason, duration = null) {
        try {
            const logId = await this.createLog({
                guildId,
                userId,
                moderatorId,
                action,
                reason,
                duration
            });
            return logId;
        } catch (error) {
            logger.error('Failed to log moderation action', error);
            throw error;
        }
    }
}

module.exports = new ModerationService();