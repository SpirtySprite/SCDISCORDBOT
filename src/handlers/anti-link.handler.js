const { Events, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const { CacheHelpers } = require('../utils/discord-cache');


const DEFAULT_URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.(com|net|org|io|co|xyz|me|tv|gg|discord|gg|discordapp|com|gg|discord\.gg)[^\s]*)/gi;

class AntiLinkHandler {
    constructor(client) {
        this.client = client;
        this.listenerSet = false;
        this.handlerConfig = null;
        this.urlRegex = null;
        this.loadConfig();
    }

    loadConfig() {
        this.handlerConfig = config.handlers?.antiLink || {
            enabled: true,
            allowedDomains: [],
            blockedDomains: [],
            action: "delete",
            timeoutDuration: 600000,
            exemptRoles: [],
            exemptChannels: []
        };


        if (this.handlerConfig.allowedDomains && this.handlerConfig.allowedDomains.length > 0) {

            const allowedPattern = this.handlerConfig.allowedDomains
                .map(domain => domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('|');
            this.urlRegex = new RegExp(`(https?://(?:[^\\s]+\\.)?(?:${allowedPattern})[^\\s]*|www\\.(?:${allowedPattern})[^\\s]*)`, 'gi');
        } else if (this.handlerConfig.blockedDomains && this.handlerConfig.blockedDomains.length > 0) {

            const blockedPattern = this.handlerConfig.blockedDomains
                .map(domain => domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('|');
            this.urlRegex = new RegExp(`(https?://[^\\s]+|www\\.[^\\s]+|[a-z0-9-]+\\.(?!${blockedPattern})(?:com|net|org|io|co|xyz|me|tv|gg|discord|discordapp|discord\\.gg)[^\\s]*)`, 'gi');
        } else {

            this.urlRegex = DEFAULT_URL_REGEX;
        }
    }

    setupEventListeners() {

        if (!this.handlerConfig.enabled) {
            logger.info('Anti-link protection is disabled');
            return;
        }


        if (this.listenerSet) {
            logger.warn('Anti-link event listener already set up, skipping');
            return;
        }

        logger.info('✅ Anti-link protection enabled');

        this.client.on(Events.MessageCreate, async (message) => {
            await this.handleMessage(message);
        });

        this.listenerSet = true;
        logger.info('✅ Anti-link event listener registered and active');
    }

    containsLink(text) {
        if (!text) return false;
        return this.urlRegex.test(text);
    }

    isExempt(member, channel) {
        if (!member) return false;


        if (this.handlerConfig.exemptRoles && this.handlerConfig.exemptRoles.length > 0) {
            const hasExemptRole = member.roles.cache.some(role =>
                this.handlerConfig.exemptRoles.includes(role.id)
            );
            if (hasExemptRole) return true;
        }


        if (this.handlerConfig.exemptChannels && this.handlerConfig.exemptChannels.length > 0) {
            if (this.handlerConfig.exemptChannels.includes(channel.id)) {
                return true;
            }
        }

        return false;
    }

    async handleMessage(message) {
        try {

            if (!this.handlerConfig.enabled) {
                return;
            }


            if (message.author.bot) {
                return;
            }


            if (!message.guild) {
                return;
            }


            if (!this.containsLink(message.content)) {
                return;
            }


            let member = message.member;
            if (!member) {
                try {
                    member = await CacheHelpers.getMember(message.guild, message.author.id, 2 * 60 * 1000);
                } catch (fetchErr) {
                    logger.debug(`Could not fetch member ${message.author.id}: ${fetchErr.message}`);
                }
            }


            if (member && this.isExempt(member, message.channel)) {
                logger.debug(`Link allowed for ${message.author.tag} - exempt role/channel`);
                return;
            }


            let hasPermission = false;
            try {
                if (member) {
                    const permissions = member.permissionsIn(message.channel);
                    hasPermission = permissions && permissions.has(PermissionFlagsBits.ManageMessages);
                }
            } catch (err) {
                logger.debug(`Could not check permissions for ${message.author.tag}: ${err.message}`);
            }


            if (hasPermission) {
                logger.debug(`Link allowed for ${message.author.tag} - has ManageMessages permission`);
                return;
            }


            try {
                const action = this.handlerConfig.action || 'delete';


                const botMember = await CacheHelpers.getMember(message.guild, this.client.user.id, 2 * 60 * 1000);
                const botPermissions = message.channel.permissionsFor(botMember);

                if (action === 'delete' || action === 'warn' || action === 'timeout') {
                    if (!botPermissions.has(PermissionFlagsBits.ManageMessages)) {
                        logger.warn(`Cannot take anti-link action - bot lacks ManageMessages permission in ${message.channel.name}`);
                        return;
                    }
                }

                if (action === 'timeout') {
                    if (!botPermissions.has(PermissionFlagsBits.ModerateMembers)) {
                        logger.warn(`Cannot timeout user - bot lacks ModerateMembers permission in ${message.channel.name}`);
                        return;
                    }
                }


                if (action === 'delete') {
                    await message.delete();
                    logger.info(`Deleted message with link from ${message.author.tag} (${message.author.id}) in ${message.channel.name}`);


                    const warningMessage = await message.channel.send({
                        content: `⚠️ <@${message.author.id}> Les liens ne sont pas autorisés ici. Votre message a été supprimé.`
                    }).catch(() => null);


                    if (warningMessage) {
                        setTimeout(async () => {
                            try {
                                await warningMessage.delete();
                            } catch (error) {

                            }
                        }, 5000);
                    }
                } else if (action === 'warn') {
                    await message.delete();
                    const warningEmbed = new EmbedBuilder()
                        .setTitle('⚠️ Avertissement')
                        .setDescription(`<@${message.author.id}>, les liens ne sont pas autorisés ici.`)
                        .setColor(0xFFA500)
                        .setTimestamp();

                    await message.channel.send({ embeds: [warningEmbed] }).catch(() => null);
                    logger.info(`Warned user ${message.author.tag} for posting link`);
                } else if (action === 'timeout' && member) {
                    await message.delete();
                    const timeoutDuration = this.handlerConfig.timeoutDuration || 600000;
                    await member.timeout(timeoutDuration, 'Anti-link: lien non autorisé');
                    logger.info(`Timed out user ${message.author.tag} for ${timeoutDuration}ms for posting link`);
                }

            } catch (error) {
                logger.error('Error handling anti-link action', error);
            }

        } catch (error) {
            logger.error('Error in anti-link handler', error);
        }
    }
}

module.exports = AntiLinkHandler;