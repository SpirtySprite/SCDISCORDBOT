const ticketRepository = require('../database/repositories/ticket.repository');
const logger = require('../utils/logger');

class TicketService {
    async createTicket(guildId, userId, channelId, categoryKey, username, welcomeMessageId = null) {



        const sanitizedUsername = username
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '')
            .substring(0, 20);


        const timestamp = Date.now().toString().slice(-6);
        const ticketId = `${categoryKey}-${sanitizedUsername}-${timestamp}`;


        await ticketRepository.create({
            ticketId,
            channelId,
            guildId,
            userId,
            status: 'open',
            welcomeMessageId,
            category: categoryKey
        });

        return { ticketId, ticketNumber: null };
    }

    async updateWelcomeMessageId(channelId, messageId) {
        try {
            await ticketRepository.updateWelcomeMessageId(channelId, messageId);
        } catch (error) {
            logger.error(`Failed to update welcome message ID for channel ${channelId}`, error);
            throw error;
        }
    }

    async transferTicket(channelId, newUserId) {
        try {
            await ticketRepository.updateOwner(channelId, newUserId);
            return await ticketRepository.findByChannelId(channelId);
        } catch (error) {
            logger.error(`Failed to transfer ticket ${channelId} to user ${newUserId}`, error);
            throw error;
        }
    }

    async getTicketByChannel(channelId) {
        try {
            return await ticketRepository.findByChannelId(channelId);
        } catch (error) {
            logger.error(`Failed to get ticket for channel ${channelId}`, error);
            throw error;
        }
    }

    async closeTicket(channelId, closedBy) {
        try {
            await ticketRepository.updateStatus(channelId, 'closed', closedBy);
            return await ticketRepository.findByChannelId(channelId);
        } catch (error) {
            logger.error(`Failed to close ticket ${channelId}`, error);
            throw error;
        }
    }

    async reopenTicket(channelId) {
        try {
            await ticketRepository.updateStatus(channelId, 'open', null);
            return await ticketRepository.findByChannelId(channelId);
        } catch (error) {
            logger.error(`Failed to reopen ticket ${channelId}`, error);
            throw error;
        }
    }

    async deleteTicket(channelId) {
        try {
            await ticketRepository.delete(channelId);
            return await ticketRepository.findByChannelId(channelId);
        } catch (error) {
            logger.error(`Failed to delete ticket ${channelId}`, error);
            throw error;
        }
    }

    async getUserTickets(guildId, userId) {
        try {
            return await ticketRepository.findByUserId(guildId, userId);
        } catch (error) {
            logger.error(`Failed to get tickets for user ${userId}`, error);
            throw error;
        }
    }

    async createPanel(guildId, channelId, messageId, categoryId = null) {
        try {
            return await ticketRepository.createPanel({
                guildId,
                channelId,
                messageId,
                categoryId
            });
        } catch (error) {
            logger.error('Failed to create ticket panel', error);
            throw error;
        }
    }

    async getPanelByMessageId(messageId) {
        try {
            return await ticketRepository.findPanelByMessageId(messageId);
        } catch (error) {
            logger.error(`Failed to get panel for message ${messageId}`, error);
            throw error;
        }
    }

    async getNextTicketNumber(guildId) {
        try {
            return await ticketRepository.getNextTicketNumber(guildId);
        } catch (error) {
            logger.error(`Failed to get next ticket number for guild ${guildId}`, error);
            throw error;
        }
    }

    async getTicketStats(guildId) {
        try {
            return await ticketRepository.getTicketStats(guildId);
        } catch (error) {
            logger.error(`Failed to get ticket stats for guild ${guildId}`, error);
            throw error;
        }
    }

    async getAllPanels(guildId) {
        try {
            return await ticketRepository.findPanelsByGuild(guildId);
        } catch (error) {
            logger.error(`Failed to get panels for guild ${guildId}`, error);
            throw error;
        }
    }

    async isUserBlacklisted(guildId, userId) {
        try {
            return await ticketRepository.isBlacklisted(guildId, userId);
        } catch (error) {
            logger.error(`Failed to check if user ${userId} is blacklisted in guild ${guildId}`, error);
            throw error;
        }
    }

    async blacklistUser(guildId, userId, moderatorId, reason) {
        try {
            return await ticketRepository.blacklistUser(guildId, userId, moderatorId, reason);
        } catch (error) {
            logger.error(`Failed to blacklist user ${userId} in guild ${guildId}`, error);
            throw error;
        }
    }

    async unblacklistUser(guildId, userId) {
        try {
            return await ticketRepository.unblacklistUser(guildId, userId);
        } catch (error) {
            logger.error(`Failed to unblacklist user ${userId} in guild ${guildId}`, error);
            throw error;
        }
    }
}

module.exports = new TicketService();