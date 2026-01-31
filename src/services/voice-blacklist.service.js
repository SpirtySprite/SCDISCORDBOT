const voiceBlacklistRepository = require('../database/repositories/voice-blacklist.repository');
const logger = require('../utils/logger');

class VoiceBlacklistService {
    async blacklistUser(guildId, channelId, userId, moderatorId) {
        try {
            return await voiceBlacklistRepository.create(guildId, channelId, userId, moderatorId);
        } catch (error) {
            logger.error(`Failed to blacklist user ${userId} from channel ${channelId} in guild ${guildId}`, error);
            throw error;
        }
    }

    async unblacklistUser(guildId, channelId, userId) {
        try {
            return await voiceBlacklistRepository.delete(guildId, channelId, userId);
        } catch (error) {
            logger.error(`Failed to unblacklist user ${userId} from channel ${channelId} in guild ${guildId}`, error);
            throw error;
        }
    }

    async isUserBlacklisted(guildId, channelId, userId) {
        try {
            return await voiceBlacklistRepository.isUserBlacklisted(guildId, channelId, userId);
        } catch (error) {
            logger.error(`Failed to check blacklist for user ${userId} in channel ${channelId}`, error);
            throw error;
        }
    }

    async getBlacklist(guildId) {
        try {
            return await voiceBlacklistRepository.getBlacklistForGuild(guildId);
        } catch (error) {
            logger.error(`Failed to get blacklist for guild ${guildId}`, error);
            throw error;
        }
    }
}

module.exports = new VoiceBlacklistService();