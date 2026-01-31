const giveawayRepository = require('../database/repositories/giveaway.repository');
const { pickRandomWinners } = require('../utils/helpers');
const logger = require('../utils/logger');

class GiveawayService {
    async getActiveGiveaways(guildId = null) {
        try {
            return await giveawayRepository.findAllActive(guildId);
        } catch (error) {
            logger.error('Failed to get active giveaways', error);
            throw error;
        }
    }

    async getGiveawayByMessageId(messageId) {
        try {
            return await giveawayRepository.findByMessageId(messageId);
        } catch (error) {
            logger.error(`Failed to get giveaway ${messageId}`, error);
            throw error;
        }
    }

    async createGiveaway(data) {
        try {
            return await giveawayRepository.create(data);
        } catch (error) {
            logger.error('Failed to create giveaway', error);
            throw error;
        }
    }

    async addParticipant(messageId, userId) {
        try {
            return await giveawayRepository.addParticipant(messageId, userId);
        } catch (error) {
            logger.error(`Failed to add participant ${userId} to giveaway ${messageId}`, error);
            throw error;
        }
    }

    async removeParticipant(messageId, userId) {
        try {
            return await giveawayRepository.removeParticipant(messageId, userId);
        } catch (error) {
            logger.error(`Failed to remove participant ${userId} from giveaway ${messageId}`, error);
            throw error;
        }
    }

    async getParticipants(messageId) {
        try {
            return await giveawayRepository.getParticipants(messageId);
        } catch (error) {
            logger.error(`Failed to get participants for giveaway ${messageId}`, error);
            throw error;
        }
    }

    async endGiveaway(messageId, winnerIds) {
        try {
            await giveawayRepository.end(messageId, winnerIds);
        } catch (error) {
            logger.error(`Failed to end giveaway ${messageId}`, error);
            throw error;
        }
    }

    pickWinners(participants, count) {
        return pickRandomWinners(participants, count);
    }
}

module.exports = new GiveawayService();