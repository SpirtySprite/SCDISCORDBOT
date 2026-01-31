const { Events } = require('discord.js');
const voiceBlacklistService = require('../services/voice-blacklist.service');
const config = require('../config');
const logger = require('../utils/logger');

class VoiceBlacklistHandler {
    constructor(client) {
        this.client = client;
    }

    setupEventListeners() {
        this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {

            if (!newState.channelId) return;
            if (newState.guild.id !== config.bot.guildId) return;

            const member = newState.member;
            if (!member || member.user.bot) return;

            try {
                const isBlacklisted = await voiceBlacklistService.isUserBlacklisted(
                    newState.guild.id,
                    newState.channelId,
                    member.id
                );

                if (isBlacklisted) {
                    await member.voice.disconnect('Banni du salon vocal');
                    logger.info(`User ${member.user.tag} disconnected from blacklisted channel ${newState.channelId}`);


                    try {
                        await member.send(`❌ Vous êtes banni du salon vocal **${newState.channel.name}**.`);
                    } catch (dmError) {
                        logger.debug(`Could not send DM to ${member.user.tag}`, dmError);
                    }
                }
            } catch (error) {
                logger.error('Error in VoiceBlacklistHandler', error);
            }
        });
    }
}

module.exports = VoiceBlacklistHandler;