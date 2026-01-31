const { Events } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const EventLogEmbedFactory = require('../utils/event-log-embeds');
const WelcomeHandler = require('./welcome.handler');
const { CacheHelpers } = require('../utils/discord-cache');

class EventLogHandler {
    constructor(client) {
        this.client = client;
        this.messageCache = new Map();
        this.welcomeHandler = new WelcomeHandler(client);
    }

    async sendToLogChannel(embed) {
        try {

            const logChannelId = config.eventLogs.logChannelId || config.moderation.logChannelId;
            if (!logChannelId) {

                return false;
            }

            const channel = await CacheHelpers.getChannel(this.client, logChannelId, 10 * 60 * 1000).catch(() => null);
            if (!channel) {
                logger.warn(`Event log channel ${logChannelId} not found`);
                return false;
            }

            await channel.send({ embeds: [embed] });
            return true;
        } catch (error) {
            logger.error('Failed to send event log to channel', error);
            return false;
        }
    }


    async fetchExecutor(guild, type, targetId = null, timeWindow = 5000) {
        if (!guild.members.me?.permissions?.has('ViewAuditLog')) return null;
        try {
            const auditLogs = await guild.fetchAuditLogs({ type, limit: 1 });
            if (auditLogs.entries.size > 0) {
                const entry = auditLogs.entries.first();
                const isTargetMatch = targetId ? entry.target?.id === targetId : true;
                if (isTargetMatch && entry.createdTimestamp > Date.now() - timeWindow) {
                    return entry.executor;
                }
            }
        } catch (e) {

        }
        return null;
    }

    setupEventListeners() {
        this.client.on(Events.MessageDelete, async (message) => {
            if (!config.eventLogs.enabled || !config.eventLogs.logMessageDelete) return;
            if (message.author?.bot) return;
            if (!message.guild || message.guild.id !== config.bot.guildId) return;

            try {
                const executor = await this.fetchExecutor(message.guild, 72);
                const embed = EventLogEmbedFactory.createMessageDeleteEmbed(message, executor);
                await this.sendToLogChannel(embed);
            } catch (error) {
                logger.error('Error handling message delete event', error);
            }
        });

        this.client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
            if (!config.eventLogs.enabled || !config.eventLogs.logMessageEdit) return;
            if (newMessage.author?.bot) return;
            if (!newMessage.guild || newMessage.guild.id !== config.bot.guildId) return;
            if (oldMessage.content === newMessage.content) return;

            try {
                const embed = EventLogEmbedFactory.createMessageEditEmbed(oldMessage, newMessage);
                await this.sendToLogChannel(embed);
            } catch (error) {
                logger.error('Error handling message update event', error);
            }
        });

        this.client.on(Events.GuildMemberAdd, async (member) => {
            if (member.guild.id !== config.bot.guildId) return;
            try {

                if (config.autoRoles.enabled && config.autoRoles.roleIds.length > 0) {
                    try {
                        const rolesToAdd = [];
                        for (const roleId of config.autoRoles.roleIds) {
                            const role = await member.guild.roles.fetch(roleId).catch(() => null);
                            if (role && !member.roles.cache.has(roleId)) {
                                rolesToAdd.push(role);
                            }
                        }

                        if (rolesToAdd.length > 0) {
                            await member.roles.add(rolesToAdd);
                            logger.info(`Auto-assigned ${rolesToAdd.length} role(s) to ${member.user.tag}`);
                        }
                    } catch (error) {
                        logger.error(`Failed to assign auto-roles to ${member.user.tag}`, error);
                    }
                }


                await this.welcomeHandler.handleMemberJoin(member);

                if (config.eventLogs.enabled && config.eventLogs.logMemberJoin) {
                    const embed = EventLogEmbedFactory.createMemberJoinEmbed(member);
                    await this.sendToLogChannel(embed);
                }
            } catch (error) {
                logger.error('Error handling member add event', error);
            }
        });

        this.client.on(Events.GuildMemberRemove, async (member) => {
            if (member.guild.id !== config.bot.guildId) return;
            if (!config.eventLogs.enabled || !config.eventLogs.logMemberLeave) return;
            try {


                const embed = EventLogEmbedFactory.createMemberLeaveEmbed(member);
                await this.sendToLogChannel(embed);
            } catch (error) {
                logger.error('Error handling member remove event', error);
            }
        });

        this.client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
            if (newMember.guild.id !== config.bot.guildId) return;
            if (!config.eventLogs.enabled) return;
            try {
                const oldRoles = oldMember.roles.cache;
                const newRoles = newMember.roles.cache;

                const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
                const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

                if (config.eventLogs.logRoleAdd && addedRoles.size > 0) {
                    const executor = await this.fetchExecutor(newMember.guild, 25, newMember.id);
                    for (const role of addedRoles.values()) {
                        if (role.id === newMember.guild.id) continue;
                        const embed = EventLogEmbedFactory.createRoleAddEmbed(newMember, role, executor);
                        await this.sendToLogChannel(embed);
                    }
                }

                if (config.eventLogs.logRoleRemove && removedRoles.size > 0) {
                    const executor = await this.fetchExecutor(newMember.guild, 25, newMember.id);
                    for (const role of removedRoles.values()) {
                        if (role.id === newMember.guild.id) continue;
                        const embed = EventLogEmbedFactory.createRoleRemoveEmbed(newMember, role, executor);
                        await this.sendToLogChannel(embed);
                    }
                }

                if (config.eventLogs.logNicknameChange && oldMember.nickname !== newMember.nickname) {
                    const executor = await this.fetchExecutor(newMember.guild, 24, newMember.id);
                    const embed = EventLogEmbedFactory.createNicknameChangeEmbed(oldMember, newMember, executor);
                    await this.sendToLogChannel(embed);
                }
            } catch (error) {
                logger.error('Error handling member update event', error);
            }
        });

        this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
            if (newState.guild.id !== config.bot.guildId) return;
            if (!config.eventLogs.enabled) return;
            try {
                const member = newState.member || oldState.member;
                if (!member || member.user.bot) return;

                const oldChannel = oldState.channel;
                const newChannel = newState.channel;

                if (config.eventLogs.logVoiceMove && oldChannel && newChannel && oldChannel.id !== newChannel.id) {
                    const embed = EventLogEmbedFactory.createVoiceMoveEmbed(member, oldChannel, newChannel);
                    await this.sendToLogChannel(embed);
                }

                if (config.eventLogs.logVoiceJoin && !oldChannel && newChannel) {
                    const embed = EventLogEmbedFactory.createVoiceJoinEmbed(member, newChannel);
                    await this.sendToLogChannel(embed);
                }

                if (config.eventLogs.logVoiceLeave && oldChannel && !newChannel) {
                    const embed = EventLogEmbedFactory.createVoiceLeaveEmbed(member, oldChannel);
                    await this.sendToLogChannel(embed);
                }

                if (config.eventLogs.logVoiceMute && oldState.mute !== newState.mute) {
                    const embed = EventLogEmbedFactory.createVoiceMuteEmbed(member, newChannel || oldChannel, newState.mute);
                    await this.sendToLogChannel(embed);
                }

                if (config.eventLogs.logVoiceDeafen && oldState.deaf !== newState.deaf) {
                    const embed = EventLogEmbedFactory.createVoiceDeafenEmbed(member, newChannel || oldChannel, newState.deaf);
                    await this.sendToLogChannel(embed);
                }
            } catch (error) {
                logger.error('Error handling voice state update event', error);
            }
        });

        this.client.on(Events.ChannelCreate, async (channel) => {
            if (!config.eventLogs.enabled || !config.eventLogs.logChannelCreate) return;
            if (!channel.guild || channel.guild.id !== config.bot.guildId) return;

            try {
                const executor = await this.fetchExecutor(channel.guild, 10, channel.id);
                const embed = EventLogEmbedFactory.createChannelCreateEmbed(channel, executor);
                await this.sendToLogChannel(embed);
            } catch (error) {
                logger.error('Error handling channel create event', error);
            }
        });

        this.client.on(Events.ChannelDelete, async (channel) => {
            if (!config.eventLogs.enabled || !config.eventLogs.logChannelDelete) return;
            if (!channel.guild || channel.guild.id !== config.bot.guildId) return;

            try {
                const executor = await this.fetchExecutor(channel.guild, 12, channel.id);
                const embed = EventLogEmbedFactory.createChannelDeleteEmbed(channel, executor);
                await this.sendToLogChannel(embed);
            } catch (error) {
                logger.error('Error handling channel delete event', error);
            }
        });

        this.client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
            if (!config.eventLogs.enabled || !config.eventLogs.logChannelUpdate) return;
            if (!newChannel.guild || newChannel.guild.id !== config.bot.guildId) return;

            try {
                const changes = [];

                if (oldChannel.name !== newChannel.name) changes.push({ type: 'name', old: oldChannel.name, new: newChannel.name });
                if (oldChannel.type !== newChannel.type) changes.push({ type: 'type', old: oldChannel.type, new: newChannel.type });
                if (oldChannel.parentId !== newChannel.parentId) changes.push({ type: 'category', old: oldChannel.parentId, new: newChannel.parentId });
                if (oldChannel.topic !== newChannel.topic) changes.push({ type: 'topic', old: oldChannel.topic || '*Aucun*', new: newChannel.topic || '*Aucun*' });
                if (oldChannel.nsfw !== newChannel.nsfw) changes.push({ type: 'nsfw', old: oldChannel.nsfw ? 'Oui' : 'Non', new: newChannel.nsfw ? 'Oui' : 'Non' });
                if (oldChannel.position !== newChannel.position) changes.push({ type: 'position', old: oldChannel.position, new: newChannel.position });

                if (changes.length === 0) return;

                const executor = await this.fetchExecutor(newChannel.guild, 11, newChannel.id);
                const embed = EventLogEmbedFactory.createChannelUpdateEmbed(oldChannel, newChannel, changes, executor);
                await this.sendToLogChannel(embed);
            } catch (error) {
                logger.error('Error handling channel update event', error);
            }
        });

        this.client.on(Events.GuildBanAdd, async (ban) => {
            if (ban.guild.id !== config.bot.guildId) return;


            if (!config.eventLogs.enabled || !config.eventLogs.logBanAdd) return;
            try {
                const executor = await this.fetchExecutor(ban.guild, 22, ban.user.id);
                const reason = ban.reason;




                let finalReason = 'Aucune raison';
                if (executor) {

                    const auditLogs = await ban.guild.fetchAuditLogs({ type: 22, limit: 1 });
                    const entry = auditLogs.entries.first();
                    if (entry && entry.target.id === ban.user.id) finalReason = entry.reason || 'Aucune raison';
                }

                const embed = EventLogEmbedFactory.createBanAddEmbed(ban.user, executor, finalReason);
                await this.sendToLogChannel(embed);
            } catch (error) {
                logger.error('Error handling ban add event', error);
            }
        });

        this.client.on(Events.GuildBanRemove, async (ban) => {
            if (ban.guild.id !== config.bot.guildId) return;
            if (!config.eventLogs.enabled || !config.eventLogs.logBanRemove) return;
            try {
                const executor = await this.fetchExecutor(ban.guild, 23, ban.user.id);
                const embed = EventLogEmbedFactory.createBanRemoveEmbed(ban.user, executor);
                await this.sendToLogChannel(embed);
            } catch (error) {
                logger.error('Error handling ban remove event', error);
            }
        });

        this.client.on(Events.GuildRoleCreate, async (role) => {
            if (role.guild.id !== config.bot.guildId) return;
            if (!config.eventLogs.enabled || !config.eventLogs.logRoleCreate) return;
            try {
                const executor = await this.fetchExecutor(role.guild, 30, role.id);
                const embed = EventLogEmbedFactory.createRoleCreateEmbed(role, executor);
                await this.sendToLogChannel(embed);
            } catch (error) {
                logger.error('Error handling role create event', error);
            }
        });

        this.client.on(Events.GuildRoleDelete, async (role) => {
            if (role.guild.id !== config.bot.guildId) return;
            if (!config.eventLogs.enabled || !config.eventLogs.logRoleDelete) return;
            try {
                const executor = await this.fetchExecutor(role.guild, 32, role.id);
                const embed = EventLogEmbedFactory.createRoleDeleteEmbed(role, executor);
                await this.sendToLogChannel(embed);
            } catch (error) {
                logger.error('Error handling role delete event', error);
            }
        });

        this.client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
            if (newRole.guild.id !== config.bot.guildId) return;
            if (!config.eventLogs.enabled || !config.eventLogs.logRoleUpdate) return;
            try {
                const changes = [];
                if (oldRole.name !== newRole.name) changes.push({ type: 'name', old: oldRole.name, new: newRole.name });
                if (oldRole.color !== newRole.color) changes.push({ type: 'color', old: oldRole.hexColor, new: newRole.hexColor });
                if (oldRole.hoist !== newRole.hoist) changes.push({ type: 'hoist', old: oldRole.hoist, new: newRole.hoist });

                if (changes.length === 0) return;

                const executor = await this.fetchExecutor(newRole.guild, 31, newRole.id);
                const embed = EventLogEmbedFactory.createRoleUpdateEmbed(oldRole, newRole, changes, executor);
                await this.sendToLogChannel(embed);
            } catch (error) {
                logger.error('Error handling role update event', error);
            }
        });
    }
}

module.exports = EventLogHandler;