const { Events, EmbedBuilder } = require('discord.js');
const levelRepository = require('../database/repositories/level.repository');
const levelRoleRepository = require('../database/repositories/level-role.repository');
const { calculateLevel } = require('../utils/level-calculator');
const { CacheHelpers } = require('../utils/discord-cache');
const config = require('../config');
const logger = require('../utils/logger');

class LevelHandler {
    constructor(client) {
        this.client = client;
        this.cooldowns = new Map();
        const handlerConfig = config.handlers?.leveling || {};
        this.maxCooldowns = handlerConfig.maxCooldowns || 10000;
        this.cleanupInterval = handlerConfig.cleanupInterval || 3600000;
        this.cleanupProbability = handlerConfig.cleanupProbability || 0.01;
        this.cleanupTimer = null;
        this.startPeriodicCleanup();
    }

    startPeriodicCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.cleanupTimer = setInterval(() => {
            if (config.leveling?.enabled) {
                const cooldownTime = (config.leveling.cooldown || 60) * 1000;
                this.cleanupCooldowns(cooldownTime);
            }
        }, this.cleanupInterval);
    }

    setupEventListeners() {
        if (!config.leveling?.enabled) {
            logger.info('Leveling system is disabled');
            return;
        }

        this.client.on(Events.MessageCreate, async (message) => {

            if (message.author.bot) return;
            if (!message.guild) return;


            const guildConfig = config.leveling;
            if (!guildConfig?.enabled) return;


            const userId = message.author.id;
            const guildId = message.guild.id;
            const cooldownTime = (guildConfig.cooldown || 60) * 1000;
            const now = Date.now();

            if (this.cooldowns.has(userId)) {
                const lastMessageTime = this.cooldowns.get(userId);
                if (now - lastMessageTime < cooldownTime) {
                    return;
                }
            }


            this.cooldowns.set(userId, now);


            if (this.cooldowns.size > this.maxCooldowns) {
                this.cleanupCooldowns(cooldownTime);
            } else if (Math.random() < this.cleanupProbability) {
                this.cleanupCooldowns(cooldownTime);
            }

            try {

                const minXP = guildConfig.xpPerMessage?.min || 15;
                const maxXP = guildConfig.xpPerMessage?.max || 25;
                const xpGained = Math.floor(Math.random() * (maxXP - minXP + 1)) + minXP;


                let userLevel = await levelRepository.findByUser(guildId, userId);
                const oldLevel = userLevel?.level || 0;


                const newTotalXP = (userLevel?.total_xp || 0) + xpGained;


                const calculatedLevel = calculateLevel(newTotalXP);
                const newLevel = calculatedLevel.level;
                const currentXP = calculatedLevel.currentXP;
                const nextXP = calculatedLevel.nextXP;


                const userRank = await levelRepository.getUserRank(guildId, userId);


                await levelRepository.updateUserXP(
                    guildId,
                    userId,
                    newTotalXP,
                    newLevel,
                    currentXP,
                    nextXP,
                    userRank
                );



                await this.updateUserLevelRoles(guildId, userId, newLevel, message.member || message.author);


                if (newLevel > oldLevel) {
                    logger.info(`User ${message.author.tag} (${userId}) leveled up from ${oldLevel} to ${newLevel} in guild ${guildId}`);


                    if (guildConfig.levelUpMessage?.enabled) {
                        await this.sendLevelUpMessage(message, newLevel, guildConfig.levelUpMessage);
                    }
                } else if (newLevel < oldLevel) {
                    logger.info(`User ${message.author.tag} (${userId}) leveled down from ${oldLevel} to ${newLevel} in guild ${guildId}`);
                }

            } catch (error) {
                logger.error(`Error handling XP gain for user ${userId}:`, error);
            }
        });
    }

    async sendLevelUpMessage(message, newLevel, config) {
        try {
            const channelId = config.channelId || message.channel.id;
            const channel = await CacheHelpers.getChannel(this.client, channelId, 10 * 60 * 1000).catch(() => null);

            if (!channel) return;


            const embed = new EmbedBuilder()
                .setTitle('🎉 Niveau Supérieur !')
                .setDescription(`Félicitations <@${message.author.id}> ! Vous avez atteint le niveau **${newLevel}** !`)
                .setColor(0x57F287)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '📊 Nouveau Niveau', value: `**${newLevel}**`, inline: true }
                )
                .setTimestamp()
                .setFooter({
                    text: config.branding?.embeds?.footerText || 'Serenity Craft',
                    iconURL: message.guild?.iconURL({ dynamic: true }) || undefined
                });

            await channel.send({ embeds: [embed] });
            logger.info(`Sent level up embed for ${message.author.tag} - Level ${newLevel}`);
        } catch (error) {
            logger.error('Error sending level up message:', error);
        }
    }

    async sendLevelRoleMessage(member, currentLevel, roleLevel, role) {
        try {
            const guildConfig = config.leveling;
            if (!guildConfig?.levelUpMessage?.enabled) {
                return;
            }

            const channelId = guildConfig.levelUpMessage?.channelId;
            let channel = null;

            if (channelId) {

                channel = await CacheHelpers.getChannel(this.client, channelId, 10 * 60 * 1000).catch(() => null);
            }


            if (!channel && member.guild) {

                if (member.guild.systemChannel) {
                    channel = member.guild.systemChannel;
                } else {

                    const textChannels = member.guild.channels.cache.filter(
                        ch => ch.isTextBased() && ch.permissionsFor(this.client.user)?.has(['SendMessages', 'ViewChannel'])
                    );
                    if (textChannels.size > 0) {
                        channel = textChannels.first();
                    }
                }
            }

            if (!channel) {
                logger.warn(`Could not find a channel to send level role message for ${member.user.tag}`);
                return;
            }


            const embed = new EmbedBuilder()
                .setTitle('🎉 Nouveau Rôle de Niveau !')
                .setDescription(`Félicitations <@${member.user.id}> ! Vous avez atteint le niveau **${roleLevel}** et obtenu le rôle ${role} !`)
                .setColor(role.color || 0x57F287)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '📊 Niveau atteint', value: `**${roleLevel}**`, inline: true },
                    { name: '🎖️ Rôle obtenu', value: `${role}`, inline: true }
                )
                .setTimestamp()
                .setFooter({
                    text: config.branding?.embeds?.footerText || 'Serenity Craft',
                    iconURL: member.guild.iconURL({ dynamic: true }) || undefined
                });

            await channel.send({ embeds: [embed] });
            logger.info(`Sent level role embed for ${member.user.tag} - Level ${roleLevel}, Role: ${role.name}`);
        } catch (error) {
            logger.error('Error sending level role message:', error);
        }
    }

    /**
     * Update level roles for a user whenever their XP/level changes
     * This should be called after any XP update (manual or automatic)
     */
    async updateUserLevelRoles(guildId, userId, newLevel, memberOrUser = null) {
        try {

            if (!memberOrUser) {
                const guild = this.client.guilds.cache.get(guildId);
                if (!guild) {
                    logger.warn(`[LEVEL ROLES] Guild ${guildId} not found, cannot update roles for user ${userId}`);
                    return;
                }
                memberOrUser = await guild.members.fetch(userId).catch(() => null);
                if (!memberOrUser) {
                    logger.warn(`[LEVEL ROLES] User ${userId} not found in guild ${guildId}, cannot update roles`);
                    return;
                }
            }

            await this.assignLevelRoles(memberOrUser, guildId, newLevel);
        } catch (error) {
            logger.error(`[LEVEL ROLES] Error updating level roles for user ${userId}:`, error);
        }
    }

    async assignLevelRoles(memberOrUser, guildId, newLevel) {
        try {

            let member = memberOrUser;
            if (!member.guild) {
                const guild = this.client.guilds.cache.get(guildId);
                if (!guild) return;
                member = await guild.members.fetch(memberOrUser.id).catch(() => null);
                if (!member) return;
            }


            if (member.guild.roles.cache.size === 0) {
                await member.guild.roles.fetch();
            }


            const allLevelRoles = await levelRoleRepository.findAllByGuild(guildId);

            if (allLevelRoles.length === 0) {
                return;
            }


            const qualifyingRoles = allLevelRoles.filter(lr => lr.level <= newLevel);

            if (qualifyingRoles.length === 0) {

                for (const levelRole of allLevelRoles) {
                    let role = member.guild.roles.cache.get(levelRole.role_id);
                    if (!role) {
                        role = await member.guild.roles.fetch(levelRole.role_id).catch(() => null);
                    }
                    if (role && member.roles.cache.has(role.id)) {
                        try {
                            await member.roles.remove(role);
                            logger.info(`Removed level role ${role.name} (level ${levelRole.level}) from ${member.user.tag} (current level: ${newLevel})`);
                        } catch (error) {
                            logger.error(`Failed to remove level role ${role.name} from ${member.user.tag}:`, error);
                        }
                    }
                }
                return;
            }


            qualifyingRoles.sort((a, b) => b.level - a.level);
            const highestRole = qualifyingRoles[0];


            const userLevelRoleIds = new Set();
            for (const levelRole of allLevelRoles) {
                if (member.roles.cache.has(levelRole.role_id)) {
                    userLevelRoleIds.add(levelRole.role_id);
                }
            }


            const hasCorrectRole = userLevelRoleIds.has(highestRole.role_id);
            const hasOnlyCorrectRole = hasCorrectRole && userLevelRoleIds.size === 1;


            if (hasOnlyCorrectRole) {
                return;
            }


            const justReachedLevel = newLevel === highestRole.level;
            const hadHighestRole = hasCorrectRole;


            for (const levelRole of allLevelRoles) {

                if (levelRole.role_id === highestRole.role_id) {
                    continue;
                }


                if (userLevelRoleIds.has(levelRole.role_id)) {
                    let role = member.guild.roles.cache.get(levelRole.role_id);
                    if (!role) {
                        role = await member.guild.roles.fetch(levelRole.role_id).catch(() => null);
                    }
                    if (role) {
                        try {
                            await member.roles.remove(role);
                        } catch (error) {
                            logger.error(`Failed to remove level role ${role.name} from ${member.user.tag}:`, error);
                        }
                    }
                }
            }


            if (!hasCorrectRole) {
                let roleToAssign = member.guild.roles.cache.get(highestRole.role_id);
                if (!roleToAssign) {
                    roleToAssign = await member.guild.roles.fetch(highestRole.role_id).catch(() => null);
                }
                if (roleToAssign) {
                    try {
                        await member.roles.add(roleToAssign);


                        if (justReachedLevel) {
                            await this.sendLevelRoleMessage(member, newLevel, highestRole.level, roleToAssign);
                        }
                    } catch (error) {
                        logger.error(`Failed to assign level role ${roleToAssign.name} to ${member.user.tag}:`, error);
                    }
                }
            }
        } catch (error) {
            logger.error(`Error assigning level roles to user:`, error);
        }
    }

    cleanupCooldowns(cooldownTime) {
        const now = Date.now();
        for (const [userId, timestamp] of this.cooldowns.entries()) {
            if (now - timestamp > cooldownTime * 2) {
                this.cooldowns.delete(userId);
            }
        }
    }
}

module.exports = LevelHandler;