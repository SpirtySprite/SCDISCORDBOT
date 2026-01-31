const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const { parseDuration } = require('../utils/helpers');
const { CacheHelpers } = require('../utils/discord-cache');

class AntiSpamHandler {
    constructor(client) {
        this.client = client;

        this.messageHistory = new Map();
        const handlerConfig = config.handlers?.antiSpam || {};
        this.maxHistorySize = handlerConfig.maxHistorySize || 5000;
        this.cleanupInterval = handlerConfig.cleanupInterval || 300000;
        this.cleanupProbability = handlerConfig.cleanupProbability || 0.01;
        this.timeWindowMs = null;
        this.listenerSet = false;
        this.setupTimeWindow();
    }

    setupTimeWindow() {
        if (!config.moderation?.antiSpam?.timeWindow) {
            this.timeWindowMs = 10000;
            logger.warn('Anti-spam timeWindow not configured, using default 10s');
            return;
        }

        const parsed = parseDuration(config.moderation.antiSpam.timeWindow);
        this.timeWindowMs = parsed ? parsed : 10000;
        if (!parsed) {
            logger.warn(`Failed to parse anti-spam timeWindow "${config.moderation.antiSpam.timeWindow}", using default 10s`);
        } else {
            logger.info(`Anti-spam time window set to ${this.timeWindowMs}ms (${config.moderation.antiSpam.timeWindow})`);
        }
    }

    setupEventListeners() {
        if (!config.moderation?.antiSpam?.enabled) {
            logger.debug('Anti-spam is disabled');
            return;
        }


        if (this.listenerSet) {
            logger.warn('Anti-spam event listener already set up, skipping');
            return;
        }

        const messageLimit = config.moderation?.antiSpam?.messageLimit || 5;
        const timeWindow = config.moderation?.antiSpam?.timeWindow || '10s';
        logger.info(`✅ Anti-spam enabled: ${messageLimit} messages in ${timeWindow}`);

        this.client.on(Events.MessageCreate, async (message) => {
            logger.debug(`[ANTI-SPAM] Message received from ${message.author?.tag || 'unknown'} in ${message.guild?.name || 'DM'}`);
            await this.handleMessage(message);
        });

        this.listenerSet = true;
        logger.info('✅ Anti-spam event listener registered and active');
    }

    async handleMessage(message) {
        try {

            if (!config.moderation?.antiSpam?.enabled) {
                logger.debug('Anti-spam is disabled');
                return;
            }


            if (message.author.bot) {
                logger.debug(`Skipping bot message from ${message.author.tag}`);
                return;
            }


            if (!message.guild) {
                logger.debug('Skipping DM message');
                return;
            }


            try {
                if (message.member) {
                    const permissions = message.member.permissionsIn(message.channel);
                    if (permissions && permissions.has(PermissionFlagsBits.ManageMessages)) {
                        logger.debug(`Skipping anti-spam check for ${message.author.tag} - has ManageMessages permission`);
                        return;
                    }
                } else {

                    try {
                        const member = await CacheHelpers.getMember(message.guild, message.author.id, 2 * 60 * 1000);
                        const permissions = member.permissionsIn(message.channel);
                        if (permissions && permissions.has(PermissionFlagsBits.ManageMessages)) {
                            logger.debug(`Skipping anti-spam check for ${message.author.tag} - has ManageMessages permission (fetched)`);
                            return;
                        }
                    } catch (fetchErr) {
                        logger.debug(`Could not fetch member ${message.author.id}: ${fetchErr.message}`);
                    }
                }
            } catch (err) {
                logger.debug(`Could not check permissions for ${message.author.tag}: ${err.message}`);
            }


            const botMember = message.guild.members.cache.get(this.client.user.id);
            if (botMember) {
                const botPermissions = botMember.permissionsIn(message.channel);
                if (!botPermissions || !botPermissions.has(PermissionFlagsBits.ManageMessages)) {
                    logger.warn(`Bot doesn't have ManageMessages permission in ${message.channel.name} (${message.channel.id})`);
                    return;
                }
            } else {
                logger.warn(`Bot member not found in cache for guild ${message.guild.id}`);
            }

            const userId = message.author.id;
            const now = Date.now();
            const messageLimit = config.moderation?.antiSpam?.messageLimit || 5;
            const timeWindow = this.timeWindowMs || 10000;


            if (!this.messageHistory.has(userId)) {
                this.messageHistory.set(userId, []);
            }

            const userHistory = this.messageHistory.get(userId);


            const cutoffTime = now - timeWindow;
            const recentMessages = userHistory.filter(msg => msg.timestamp > cutoffTime);


            recentMessages.push({
                message: message,
                timestamp: now
            });

            logger.info(`[ANTI-SPAM] User ${message.author.tag} (${userId}) has ${recentMessages.length} messages in the last ${timeWindow}ms (limit: ${messageLimit})`);


            this.messageHistory.set(userId, recentMessages);


            if (this.messageHistory.size > this.maxHistorySize) {
                this.cleanupOldHistory();
            } else if (Math.random() < this.cleanupProbability) {

                this.cleanupOldHistory();
            }


            logger.info(`[ANTI-SPAM CHECK] recentMessages.length=${recentMessages.length}, messageLimit=${messageLimit}, condition=${recentMessages.length > messageLimit}`);
            if (recentMessages.length > messageLimit) {
                logger.warn(`🚨 ANTI-SPAM TRIGGERED for user ${message.author.tag} (${userId}): ${recentMessages.length} messages in ${timeWindow}ms (limit: ${messageLimit})`);


                const messagesToDelete = recentMessages
                    .map(msg => msg.message)
                    .filter(msg => msg && !msg.deleted);

                if (messagesToDelete.length > 0) {
                    try {

                        const deletableMessages = messagesToDelete.filter(msg => {
                            const messageAge = Date.now() - msg.createdTimestamp;
                            return messageAge < 14 * 24 * 60 * 60 * 1000;
                        });

                        logger.debug(`Attempting to delete ${deletableMessages.length} spam messages from ${message.author.tag}`);

                        if (deletableMessages.length > 0) {

                            const batchSize = 100;
                            for (let i = 0; i < deletableMessages.length; i += batchSize) {
                                const batch = deletableMessages.slice(i, i + batchSize);

                                if (batch.length === 1) {

                                    await batch[0].delete().catch(err => {
                                        logger.error(`Failed to delete single spam message: ${err.message}`);
                                    });
                                } else {

                                    await message.channel.bulkDelete(batch, true).catch(async (err) => {
                                        logger.error(`Failed to bulk delete spam messages: ${err.message}`);

                                        for (const msg of batch) {
                                            await msg.delete().catch(err => {
                                                logger.debug(`Failed to delete message ${msg.id}: ${err.message}`);
                                            });
                                        }
                                    });
                                }
                            }

                            logger.info(`Successfully deleted ${deletableMessages.length} spam messages from ${message.author.tag}`);
                        }


                        const warningEmbed = this.createSpamWarningEmbed(message.author, deletableMessages.length);
                        try {
                            await message.author.send({ embeds: [warningEmbed] }).catch(err => {
                                logger.debug(`Failed to send anti-spam warning DM to ${message.author.tag}: ${err.message}`);
                            });
                        } catch (err) {
                            logger.debug(`Could not send DM to ${message.author.tag}: ${err.message}`);
                        }


                        await this.logSpamToChannel(message, deletableMessages.length);


                        this.messageHistory.delete(userId);

                    } catch (error) {
                        logger.error('Error handling anti-spam action', error);
                    }
                } else {

                    this.messageHistory.delete(userId);
                }
            }
        } catch (error) {
            logger.error('Error in handleMessage (anti-spam)', error);
        }
    }

    createSpamWarningEmbed(user, messageCount) {
        const embed = new EmbedBuilder()
            .setTitle('🚫 Anti-spam')
            .setDescription(`${messageCount} message${messageCount > 1 ? 's' : ''} supprimé${messageCount > 1 ? 's' : ''} pour spam`)
            .addFields({
                name: '👤 Utilisateur',
                value: `<@${user.id}>\n**Tag:** ${user.tag}`,
                inline: true
            })
            .setColor(0xFF4444)
            .setTimestamp();

        return embed;
    }

    createSpamLogEmbed(message, messageCount) {
        const embed = new EmbedBuilder()
            .setTitle('🚫 Spam détecté')
            .setDescription(`${messageCount} message${messageCount > 1 ? 's' : ''} supprimé${messageCount > 1 ? 's' : ''} pour spam`)
            .addFields(
                {
                    name: '👤 Utilisateur',
                    value: `<@${message.author.id}>\n**Tag:** ${message.author.tag}\n**ID:** ${message.author.id}`,
                    inline: true
                },
                {
                    name: '📺 Canal',
                    value: `<#${message.channel.id}>\n**Nom:** ${message.channel.name}`,
                    inline: true
                },
                {
                    name: '📊 Statistiques',
                    value: `**Messages supprimés:** ${messageCount}\n**Limite configurée:** ${config.moderation?.antiSpam?.messageLimit || 5} messages\n**Fenêtre temporelle:** ${config.moderation?.antiSpam?.timeWindow || '10s'}`,
                    inline: false
                }
            )
            .setColor(0xFF4444)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        if (message.guild) {
            embed.setFooter({
                text: `Serveur: ${message.guild.name}`,
                iconURL: message.guild.iconURL({ dynamic: true, size: 32 }) || undefined
            });
        }

        return embed;
    }

    async logSpamToChannel(message, messageCount) {
        try {
            const spamLogChannelId = config.eventLogs?.spamLogChannelId;
            if (!spamLogChannelId) {
                logger.debug('No spam log channel configured');
                return;
            }

            const channel = await CacheHelpers.getChannel(this.client, spamLogChannelId, 10 * 60 * 1000).catch(() => null);
            if (!channel) {
                logger.warn(`Spam log channel ${spamLogChannelId} not found`);
                return;
            }

            const logEmbed = this.createSpamLogEmbed(message, messageCount);
            await channel.send({ embeds: [logEmbed] });
            logger.debug(`Spam logged to channel ${spamLogChannelId}`);
        } catch (error) {
            logger.error('Failed to log spam to channel', error);
        }
    }

    cleanupOldHistory() {
        const now = Date.now();
        const cutoffTime = now - this.timeWindowMs;
        let cleaned = 0;

        for (const [userId, history] of this.messageHistory.entries()) {
            const recentMessages = history.filter(msg => msg.timestamp > cutoffTime);

            if (recentMessages.length === 0) {
                this.messageHistory.delete(userId);
                cleaned++;
            } else {
                this.messageHistory.set(userId, recentMessages);
            }
        }

        return cleaned;
    }


    startCleanup() {
        setInterval(() => {
            this.cleanupOldHistory();
        }, this.cleanupInterval);
    }
}

module.exports = AntiSpamHandler;