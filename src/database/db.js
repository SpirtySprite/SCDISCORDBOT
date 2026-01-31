const giveawayService = require('../src/services/giveaway.service');
const { initialize } = require('../src/database/schema');

module.exports = {
    init: initialize,
    getActiveGiveaways: (guildId) => giveawayService.getActiveGiveaways(guildId),
    getGiveawayByMessageId: (messageId) => giveawayService.getGiveawayByMessageId(messageId),
    createGiveaway: (data) => giveawayService.createGiveaway(data),
    addParticipant: (messageId, userId) => giveawayService.addParticipant(messageId, userId),
    removeParticipant: (messageId, userId) => giveawayService.removeParticipant(messageId, userId),
    getParticipants: (messageId) => giveawayService.getParticipants(messageId),
    endGiveaway: (messageId, winnerIds) => giveawayService.endGiveaway(messageId, winnerIds)
};