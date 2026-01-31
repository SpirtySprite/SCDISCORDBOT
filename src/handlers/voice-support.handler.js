const { Events, ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

class VoiceSupportHandler {
    constructor(client) {
        this.client = client;
    }

    setupEventListeners() {
        this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {

            if (newState.channelId === config.voiceSupport.triggerChannelId) {
                await this.handleSupportRequest(newState);
            }


            if (oldState.channelId && oldState.channel && oldState.channel.name === config.voiceSupport.targetChannelName) {
                await this.handleSupportCleanup(oldState.channel);
            }
        });
    }

    async handleSupportRequest(state) {
        try {
            const guild = state.guild;
            const member = state.member;

            if (!config.voiceSupport.enabled) return;


            let categoryId = config.voiceSupport.categoryId;
            if (!categoryId || categoryId === "REPLACE_WITH_CATEGORY_ID") {
                categoryId = state.channel.parentId;
            }


            const permissionOverwrites = [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.Connect],
                },
                {
                    id: member.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
                }
            ];


            if (config.voiceSupport.allowedRoles && Array.isArray(config.voiceSupport.allowedRoles)) {
                for (const roleId of config.voiceSupport.allowedRoles) {
                    permissionOverwrites.push({
                        id: roleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                    });
                }
            }





            let position = 0;
            const offset = config.voiceSupport.basePosition || 1;


            await guild.channels.fetch();

            let referenceChannel = null;
            let referenceName = "None";


            if (config.voiceSupport.anchorChannelId) {
                referenceChannel = guild.channels.cache.get(config.voiceSupport.anchorChannelId);
                if (referenceChannel) referenceName = `Anchor (${referenceChannel.name})`;
            }


            if (!referenceChannel && state.channel) {
                referenceChannel = state.channel;
                if (referenceChannel) referenceName = `Trigger (${referenceChannel.name})`;
            }


            if (!referenceChannel && config.voiceSupport.triggerChannelId) {
                referenceChannel = guild.channels.cache.get(config.voiceSupport.triggerChannelId);
                if (referenceChannel) referenceName = `Config Trigger (${referenceChannel.name})`;
            }


            let basePosition = offset;
            if (referenceChannel) {
                basePosition = referenceChannel.position + offset;
            } else {
                logger.warn('Could not find any reference channel (Anchor or Trigger). Using absolute position.');
            }


            let supportChannels = new Map();
            if (categoryId) {
                const categoryChannels = guild.channels.cache.filter(c => c.parentId === categoryId);
                supportChannels = categoryChannels.filter(c => c.name === config.voiceSupport.targetChannelName);
            }

            if (supportChannels.size > 0) {

                const sortedChannels = [...supportChannels.values()].sort((a, b) => a.position - b.position);
                const lastChannel = sortedChannels[sortedChannels.length - 1];
                position = lastChannel.position + 1;
                logger.debug(`Found ${supportChannels.size} existing support channels. Last: ${lastChannel.name} (Pos: ${lastChannel.position}). Stacking at: ${position}`);
            } else {

                position = basePosition;
                logger.debug(`No existing support channels. Placing relative to ${referenceName} (Pos: ${referenceChannel?.position}) + Offset ${offset} -> New Pos: ${position}`);
            }


            const channel = await guild.channels.create({
                name: config.voiceSupport.targetChannelName,
                type: ChannelType.GuildVoice,
                parent: categoryId,
                permissionOverwrites: permissionOverwrites
            });


            try {
                await channel.setPosition(position);
                logger.debug(`Force set position to ${position} for ${channel.name}`);
            } catch (posError) {
                logger.error(`Failed to set channel position to ${position}`, posError);
            }


            await member.voice.setChannel(channel);
            logger.info(`Support channel created for ${member.user.tag}`);

        } catch (error) {
            logger.error('Error handling support voice request', error);
        }
    }

    async handleSupportCleanup(channel) {
        try {

            if (channel.members.size === 0) {
                await channel.delete();
                logger.info(`Deleted empty support channel ${channel.name}`);
            }
        } catch (error) {

            if (error.code !== 10003) {
                logger.error('Error handling support voice cleanup', error);
            }
        }
    }
}

module.exports = VoiceSupportHandler;