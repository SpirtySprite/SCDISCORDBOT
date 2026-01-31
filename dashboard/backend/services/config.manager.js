const logger = require('../../../src/utils/logger');
const YAMLConfigManager = require('./yaml-config-manager');

/**
 * Config Manager - Handles domain-specific config operations
 * Uses YAMLConfigManager for actual file I/O operations
 */
class ConfigManager {
    /**
     * Get full config (delegates to YAMLConfigManager)
     */
    static getFullConfig() {
        return YAMLConfigManager.loadConfig();
    }

    /**
     * Get domain-specific config with special handling for complex domains
     */
    static getDomainConfig(domain) {
        const config = this.getFullConfig();


        const mapping = {
            'bot': 'Discord.bot',
            'channels': 'Discord.channels',
            'roles': 'Discord.roles',
            'moderation': 'Discord.moderation',
            'giveaway': 'Discord.giveaways',
            'giveaways': 'Discord.giveaways',
            'tickets': 'Discord.tickets',
            'suggestion': 'Discord.suggestion',
            'market': 'Discord.market',
            'eventLogs': 'Discord.logs',
            'logs': 'Discord.logs',
            'colors': 'Discord.branding.colors',
            'messages': 'Discord.branding.messages',
            'branding': 'Discord.branding',
            'rateLimits': 'Discord.limits',
            'limits': 'Discord.limits',
            'features': 'Discord.features',
            'advanced': 'Discord.advanced',
            'commands': 'Discord.commands',
            'leveling': 'Discord.leveling',
            'rolePermissions': 'Discord.rolePermissions'
        };


        if (domain === 'branding') {
            const branding = config.Discord?.branding || {};
            return {
                colors: branding.colors || {},
                messages: branding.messages || {},
                embeds: branding.embeds || {}
            };
        }


        if (domain === 'logs' || domain === 'eventLogs') {
            const logs = config.Discord?.logs || {};
            const channels = logs.channels || {};
            const events = logs.events || {};

            return {
                enabled: logs.enabled !== false,
                channels: {
                    eventLogId: channels.eventLogId || null,
                    modLogId: channels.modLogId || null,
                    suggestionId: channels.suggestionId || null,
                    spamLogId: channels.spamLogId || null
                },
                events: events || {}
            };
        }


        if (domain === 'limits' || domain === 'rateLimits') {
            const limits = config.Discord?.limits || {};
            return { cooldowns: limits.cooldowns || {} };
        }


        if (domain === 'bot') {
            const bot = config.Discord?.bot || {};
            if (bot.presence) {
                return {
                    presence: {
                        status: bot.presence.status || 'online',
                        activity: bot.presence.activity || {}
                    }
                };
            }
            return bot;
        }


        if (domain === 'rolePermissions') {
            const rolePerms = config.Discord?.rolePermissions;
            return rolePerms || {};
        }


        const domainPath = mapping[domain] || `Discord.${domain}`;
        const result = YAMLConfigManager.getDomain(domainPath);
        return result || null;
    }

    /**
     * Validate domain data structure
     */
    static validateDomainData(domain, data) {
        const schemas = {
            bot: (d) => d.presence && d.presence.status && d.presence.activity,
            channels: (d) => typeof d === 'object',
            roles: (d) => typeof d === 'object',
            moderation: (d) => typeof d === 'object',
            tickets: (d) => typeof d === 'object',
            giveaways: (d) => typeof d === 'object',
            giveaway: (d) => typeof d === 'object',
            market: (d) => typeof d === 'object',
            eventLogs: (d) => typeof d === 'object',
            logs: (d) => typeof d === 'object',
            branding: (d) => typeof d === 'object',
            colors: (d) => typeof d === 'object',
            messages: (d) => typeof d === 'object',
            limits: (d) => typeof d === 'object',
            rateLimits: (d) => typeof d === 'object',
            features: (d) => typeof d !== 'undefined',
            advanced: (d) => typeof d === 'object',
            commands: (d) => typeof d === 'object',
            leveling: (d) => typeof d === 'object',
            rolePermissions: (d) => typeof d === 'object'
        };

        if (schemas[domain] && !schemas[domain](data)) {
            throw new Error(`Invalid data structure for domain: ${domain}`);
        }
        return true;
    }

    /**
     * Update domain config with proper merge logic
     */
    static updateDomainConfig(domain, data) {
        try {
            this.validateDomainData(domain, data);


            const mapping = {
                'bot': 'Discord.bot',
                'channels': 'Discord.channels',
                'roles': 'Discord.roles',
                'moderation': 'Discord.moderation',
                'giveaway': 'Discord.giveaways',
                'giveaways': 'Discord.giveaways',
                'tickets': 'Discord.tickets',
                'suggestion': 'Discord.suggestion',
                'market': 'Discord.market',
                'eventLogs': 'Discord.logs',
                'logs': 'Discord.logs',
                'colors': 'Discord.branding.colors',
                'messages': 'Discord.branding.messages',
                'branding': 'Discord.branding',
                'rateLimits': 'Discord.limits',
                'limits': 'Discord.limits',
                'features': 'Discord.features',
                'advanced': 'Discord.advanced',
                'commands': 'Discord.commands',
                'leveling': 'Discord.leveling',
                'rolePermissions': 'Discord.rolePermissions'
            };


            if (domain === 'branding') {
                const currentBranding = YAMLConfigManager.getDomain('Discord.branding') || {};
                const brandingUpdate = {
                    ...currentBranding,
                    colors: data.colors !== undefined ? data.colors : currentBranding.colors,
                    messages: data.messages !== undefined ? data.messages : currentBranding.messages,
                    embeds: data.embeds !== undefined ? data.embeds : currentBranding.embeds
                };
                YAMLConfigManager.updateDomain('Discord.branding', brandingUpdate, false);
                logger.success(`[CONFIG MANAGER] Updated domain: ${domain}`);
                return true;
            }


            if (domain === 'colors') {
                const currentBranding = YAMLConfigManager.getDomain('Discord.branding') || {};
                const brandingUpdate = {
                    ...currentBranding,
                    colors: data
                };
                YAMLConfigManager.updateDomain('Discord.branding', brandingUpdate, false);
                logger.success(`[CONFIG MANAGER] Updated domain: ${domain}`);
                return true;
            }


            if (domain === 'messages') {
                const currentBranding = YAMLConfigManager.getDomain('Discord.branding') || {};
                const brandingUpdate = {
                    ...currentBranding,
                    messages: data
                };
                YAMLConfigManager.updateDomain('Discord.branding', brandingUpdate, false);
                logger.success(`[CONFIG MANAGER] Updated domain: ${domain}`);
                return true;
            }


            if (domain === 'logs' || domain === 'eventLogs') {

                const currentLogs = YAMLConfigManager.getDomain('Discord.logs') || {};


                const logsUpdate = {
                    enabled: data.enabled !== undefined ? data.enabled : (currentLogs.enabled !== false),
                    channels: {
                        ...(currentLogs.channels || {}),
                        ...(data.channels || {})
                    },
                    events: {
                        ...(currentLogs.events || {}),
                        ...(data.events || {})
                    }
                };


                YAMLConfigManager.updateDomain('Discord.logs', logsUpdate, false);


                if (data.channels && data.channels.suggestionId !== undefined) {
                    try {
                        const currentSuggestion = YAMLConfigManager.getDomain('Discord.suggestion') || {};
                        const suggestionUpdate = {
                            ...currentSuggestion,
                            channelId: data.channels.suggestionId || null
                        };
                        YAMLConfigManager.updateDomain('Discord.suggestion', suggestionUpdate, false);
                        logger.info(`[CONFIG MANAGER] Synced suggestion channel ID to Discord.suggestion.channelId: ${suggestionUpdate.channelId}`);
                    } catch (syncError) {
                        logger.warn('[CONFIG MANAGER] Failed to sync suggestion channel ID:', syncError);
                    }
                }

                logger.success(`[CONFIG MANAGER] Updated domain: ${domain}`);
                return true;
            }


            if (domain === 'limits' || domain === 'rateLimits') {
                if (data.cooldowns) {
                    const currentLimits = YAMLConfigManager.getDomain('Discord.limits') || {};
                    const limitsUpdate = {
                        ...currentLimits,
                        cooldowns: data.cooldowns
                    };
                    YAMLConfigManager.updateDomain('Discord.limits', limitsUpdate, false);
                    logger.success(`[CONFIG MANAGER] Updated domain: ${domain}`);
                    return true;
                }
            }


            if (domain === 'bot' && data.presence) {
                const botUpdate = {
                    presence: {
                        status: data.presence.status,
                        activity: data.presence.activity || {}
                    }
                };
                YAMLConfigManager.updateDomain('Discord.bot', botUpdate, true);
                logger.success(`[CONFIG MANAGER] Updated domain: ${domain}`);
                return true;
            }


            const domainPath = mapping[domain] || `Discord.${domain}`;
            YAMLConfigManager.updateDomain(domainPath, data, true);
            logger.success(`[CONFIG MANAGER] Updated domain: ${domain}`);
            return true;
        } catch (error) {
            logger.error(`[CONFIG MANAGER] Failed to update domain ${domain}:`, error.message);
            throw error;
        }
    }

    /**
     * Toggle command enabled/disabled state
     */
    static toggleCommand(name, enabled) {
        try {
            const commands = YAMLConfigManager.getDomain('Discord.commands') || {};
            const updatedCommands = {
                ...commands,
                [name]: enabled
            };
            YAMLConfigManager.updateDomain('Discord.commands', updatedCommands, false);
            logger.success(`[CONFIG MANAGER] Toggled command ${name}: ${enabled}`);
            return true;
        } catch (error) {
            logger.error(`[CONFIG MANAGER] Failed to toggle command ${name}:`, error);
            throw error;
        }
    }
}

module.exports = ConfigManager;