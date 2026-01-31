const giveawayService = require('../../../src/services/giveaway.service');
const ticketService = require('../../../src/services/ticket.service');
const fs = require('fs');
const path = require('path');
const logger = require('../../../src/utils/logger');

class MonitoringService {
    async getActiveGiveaways() {
        try {
            const giveaways = await giveawayService.getActiveGiveaways();
            return giveaways.map(g => ({
                id: g.id,
                messageId: g.message_id,
                channelId: g.channel_id,
                guildId: g.guild_id,
                prize: g.prize,
                winners: g.winners,
                endTime: g.end_time,
                createdBy: g.created_by,
                requirements: g.requirements,
                participantCount: g.participant_ids ? JSON.parse(g.participant_ids || '[]').length : 0,
                createdAt: g.created_at
            }));
        } catch (error) {
            logger.error('[MONITORING] Failed to get active giveaways:', error);
            throw error;
        }
    }

    async getOpenTickets() {
        try {
            const ticketRepository = require('../../../src/database/repositories/ticket.repository');
            const config = require('../../../src/config');
            const tickets = await ticketRepository.findByGuild(config.bot.guildId, 'open');

            return tickets.map(t => ({
                id: t.id,
                ticketId: t.ticket_id,
                channelId: t.channel_id,
                guildId: t.guild_id,
                userId: t.user_id,
                status: t.status,
                rating: t.rating,
                createdAt: t.created_at,
                welcomeMessageId: t.welcome_message_id
            }));
        } catch (error) {
            logger.error('[MONITORING] Failed to get open tickets:', error);
            throw error;
        }
    }

    async getMarketState() {
        try {
            const statePath = path.join(__dirname, '../../../src/data/market-state.json');
            if (!fs.existsSync(statePath)) {
                return {
                    lastUpdated: null,
                    buffed: [],
                    nerfed: [],
                    reset: []
                };
            }

            delete require.cache[require.resolve(statePath)];
            const fileContents = fs.readFileSync(statePath, 'utf8');
            return JSON.parse(fileContents);
        } catch (error) {
            logger.error('[MONITORING] Failed to get market state:', error);
            throw error;
        }
    }

    async getPreviousMarketState() {
        try {
            const previousStatePath = path.join(__dirname, '../../../src/data/market-state-previous.json');
            if (!fs.existsSync(previousStatePath)) {
                return null;
            }

            delete require.cache[require.resolve(previousStatePath)];
            const fileContents = fs.readFileSync(previousStatePath, 'utf8');
            const state = JSON.parse(fileContents);
            if (!state.buffed || !state.nerfed || !state.reset) {
                return null;
            }
            return state;
        } catch (error) {
            logger.error('[MONITORING] Failed to get previous market state:', error);
            return null;
        }
    }
}

module.exports = new MonitoringService();