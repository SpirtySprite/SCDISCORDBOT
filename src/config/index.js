require('dotenv').config();
const { loadDiscordConfig } = require('../utils/yaml-loader');


function getConfig() {
    const c = loadDiscordConfig();

    return {
        bot: {
            token: process.env.DISCORD_TOKEN,
            clientId: process.env.CLIENT_ID,
            guildId: process.env.GUILD_ID,
            status: c.bot?.presence?.status || "online",
            activity: c.bot?.presence?.activity || { type: "WATCHING", text: "Serenity Craft" }
        },
        database: {
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '3306', 10),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: process.env.DB_SSL !== 'false',
            caPath: process.env.CA_PATH || null,
            connectionLimit: c.database?.connectionPool?.connectionLimit || 100,
            connectionPool: c.database?.connectionPool || {
                connectionLimit: 100,
                queueLimit: 0,
                connectTimeout: 10000,
                idleTimeout: 600000,
                maxIdle: 10,
                enableKeepAlive: true,
                keepAliveInitialDelay: 0
            },
            query: c.database?.query || {
                acquireTimeout: 30000,
                retry: {
                    maxRetries: 3,
                    initialDelay: 1000,
                    backoffMultiplier: 2
                }
            }
        },
        giveaway: {
            enabled: c.giveaways?.enabled !== false,
            checkInterval: c.giveaways?.settings?.checkInterval || c.giveaways?.checkInterval,
            embedUpdateDelay: c.giveaways?.settings?.updateDelay || c.giveaways?.updateDelay,
            minDuration: c.giveaways?.settings?.minDuration || c.giveaways?.minDuration,
            maxWinners: c.giveaways?.settings?.maxWinners || c.giveaways?.maxWinners || 20,
            maxListItems: 10,
            defaultChannelId: c.giveaways?.defaultChannelId || c.giveaways?.channels?.defaultId || c.giveaways?.channelId
        },
        moderation: {
            enabled: c.moderation?.enabled !== false,
            logChannelId: c.moderation?.channels?.logId || null,
            defaultTimeoutDuration: c.moderation?.rules?.defaultDurations?.timeout,
            defaultBanDuration: c.moderation?.rules?.defaultDurations?.ban,
            requireReason: c.moderation?.rules?.requireReason === true,
            sendDM: c.moderation?.rules?.sendDM !== false,
            enabledActions: c.moderation?.actions || {},
            antiSpam: {
                enabled: c.moderation?.antiSpam?.enabled !== false,
                messageLimit: c.moderation?.antiSpam?.messageLimit || 5,
                timeWindow: c.moderation?.antiSpam?.timeWindow || '10s'
            },
        },
        voiceSupport: {
            enabled: c.voiceSupport?.enabled !== false,
            triggerChannelId: c.voiceSupport?.triggerChannelId || null,
            targetChannelName: c.voiceSupport?.targetChannelName || "👮┃Support vocal",
            categoryId: c.voiceSupport?.categoryId || null,
            anchorChannelId: c.voiceSupport?.anchorChannelId || null,
            basePosition: c.voiceSupport?.basePosition !== undefined ? c.voiceSupport?.basePosition : 1,
            allowedRoles: c.voiceSupport?.allowedRoles || []
        },
        tickets: {
            enabled: c.tickets?.enabled !== false,
            staffRoleId: c.tickets?.roles?.staffId || null,
            transcriptChannelId: c.tickets?.channels?.transcriptId || null,
            autoCloseAfter: c.tickets?.settings?.autoCloseAfter,
            deleteAfterClose: c.tickets?.settings?.deleteAfterClose === true,
            deleteDelay: c.tickets?.settings?.deleteDelay || "2s",
            panelUpdateInterval: c.tickets?.settings?.panelUpdateInterval || "5m",
            autoRoles: c.tickets?.settings?.autoRoles || [],
            autoUsers: c.tickets?.settings?.autoUsers || [],
            maxOpenTickets: c.tickets?.settings?.maxOpenTickets || 1,
            categories: c.tickets?.categories || []
        },
        suggestion: {
            enabled: c.suggestion?.enabled !== false,
            channelId: c.suggestion?.channelId || null,
            requireApproval: c.suggestion?.requireApproval || false,
            allowAnonymous: c.suggestion?.allowAnonymous || false,
            emojis: c.suggestion?.emojis || {}
        },
        autoRoles: {
            enabled: false,
            roleIds: []
        },
        minecraft: {
            enabled: c.minecraft?.enabled !== false,
            apiKey: c.minecraft?.apiKey || null,
            port: c.minecraft?.port || 48324
        },
        market: {
            enabled: c.market?.enabled !== false,
            rotationEnabled: c.market?.rotation?.enabled !== false,
            publishEnabled: c.market?.rotation?.publishEnabled !== false,
            itemsPerRotation: c.market?.rotation?.itemsPerRotation || 8,
            buffMultiplier: c.market?.balancing?.buffMultiplier || 1.5,
            nerfMultiplier: c.market?.balancing?.nerfMultiplier || 0.6666667
        },
        eventLogs: {
            enabled: c.logs?.enabled !== false,
            logChannelId: c.logs?.channels?.eventLogId || null,
            spamLogChannelId: c.logs?.channels?.spamLogId || null,
            logMessageDelete: c.logs?.events?.messageDelete !== false,
            logMessageEdit: c.logs?.events?.messageEdit !== false,
            logMemberJoin: c.logs?.events?.memberJoin !== false,
            logMemberLeave: c.logs?.events?.memberLeave !== false,
            logRoleAdd: c.logs?.events?.roleAdd !== false,
            logRoleRemove: c.logs?.events?.roleRemove !== false,
            logNicknameChange: c.logs?.events?.nicknameChange !== false,
            logVoiceJoin: c.logs?.events?.voiceJoin !== false,
            logVoiceLeave: c.logs?.events?.voiceLeave !== false,
            logVoiceMove: c.logs?.events?.voiceMove !== false,
            logVoiceMute: c.logs?.events?.voiceMute !== false,
            logVoiceDeafen: c.logs?.events?.voiceDeafen !== false,
            logChannelCreate: c.logs?.events?.channelCreate !== false,
            logChannelUpdate: c.logs?.events?.channelUpdate !== false,
            logChannelDelete: c.logs?.events?.channelDelete !== false,
            logRoleCreate: c.logs?.events?.roleCreate !== false,
            logRoleDelete: c.logs?.events?.roleDelete !== false,
            logRoleUpdate: c.logs?.events?.roleUpdate !== false,
            logBanAdd: c.logs?.events?.banAdd !== false,
            logBanRemove: c.logs?.events?.banRemove !== false
        },
        colors: c.branding?.colors || {},
        messages: c.branding?.messages || {},
        rateLimits: {
            commandCooldown: c.limits?.cooldowns?.global,
            giveawayCreateCooldown: c.limits?.cooldowns?.giveawayCreate,
            ticketCreateCooldown: c.limits?.cooldowns?.ticketCreate
        },
        features: {
            ...(c.features || {}),
            welcomeMessages: c.features?.welcomeMessages === true,
            welcomeChannelId: c.features?.welcomeChannelId || null,
            welcomeSettings: c.features?.welcomeSettings || {
                sendImage: true,
                message: "Bienvenue {user} sur {server}! 🎉",
                imageWidth: 1200,
                imageHeight: 400,
                imageBackgroundColor: "#1a1a2e",
                imageTextColor: "#ffffff",
                imageAvatarSize: 150,
                imageTitle: "Bienvenue {username}!",
                imageSubtitle: "Tu es le {memberCount}ème membre"
            }
        },
        advanced: c.advanced || {},
        commands: c.commands || {},
        branding: c.branding || {},
        leveling: {
            enabled: c.leveling?.enabled !== false,
            cooldown: parseInt(c.leveling?.cooldown) || 60,
            xpPerMessage: {
                min: parseInt(c.leveling?.xpPerMessage?.min) || 15,
                max: parseInt(c.leveling?.xpPerMessage?.max) || 25
            },
            levelUpMessage: {
                enabled: c.leveling?.levelUpMessage?.enabled === true,
                channelId: c.leveling?.levelUpMessage?.channelId || null,
                message: c.leveling?.levelUpMessage?.message || '🎉 Félicitations <@USER> ! Vous avez atteint le niveau **LEVEL** !'
            }
        },
        handlers: c.handlers || {
            antiSpam: {
                maxHistorySize: 5000,
                cleanupInterval: 300000,
                cleanupProbability: 0.01
            },
            antiLink: {
                enabled: true,
                allowedDomains: [],
                blockedDomains: [],
                action: "delete",
                timeoutDuration: 600000,
                exemptRoles: [],
                exemptChannels: []
            },
            leveling: {
                maxCooldowns: 10000,
                cleanupInterval: 3600000,
                cleanupProbability: 0.01
            },
            eventLog: {
                batchSize: 10,
                batchDelay: 1000,
                maxQueueSize: 1000
            },
            giveaway: {
                maxQueueSize: 100,
                embedUpdateDebounce: 500
            },
            pvpTournament: {
                maxConcurrentTournaments: 10,
                bracketGenerationTimeout: 30000,
                matchNotificationTimeout: 10000
            }
        },
        performance: c.performance || {
            cache: {
                defaultTTL: 300000,
                cleanupInterval: 300000,
                maxSize: 10000,
                enableStats: true
            },
            memory: {
                enableCleanup: true,
                cleanupInterval: 3600000,
                maxMapSize: 10000
            },
            botApi: {
                port: 45049,
                maxRequestSize: 10485760,
                requestTimeout: 30000,
                enableCors: true
            }
        },
        soundboard: c.soundboard || {
            enabled: true,
            maxFileSize: 10485760,
            allowedFormats: ["mp3", "ogg", "wav"],
            playDelay: 200,
            maxConcurrentPlays: 3
        },
        pvpTournaments: c.pvpTournaments || {
            enabled: true,
            maxParticipants: 64,
            minParticipants: 2,
            registrationMinDuration: 60000,
            registrationMaxDuration: 604800000,
            bracketUpdateInterval: 5000
        },
        rolePermissions: c.rolePermissions || {}
    };
}

function getNestedConfig(config, path, defaultValue = null) {
    const keys = path.split('.');
    let value = config;
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return defaultValue;
        }
    }
    return value !== undefined ? value : defaultValue;
}

const config = {};
const configKeys = ['bot', 'database', 'giveaway', 'moderation', 'tickets', 'suggestion', 'autoRoles', 'minecraft', 'market', 'eventLogs', 'colors', 'messages', 'rateLimits', 'features', 'advanced', 'commands', 'branding', 'leveling', 'handlers', 'performance', 'soundboard', 'pvpTournaments', 'rolePermissions', 'voiceSupport'];

configKeys.forEach(key => {
    Object.defineProperty(config, key, {
        get() {
            return getConfig()[key];
        },
        enumerable: true,
        configurable: true
    });
});

const validateConfig = () => {
    const required = [
        'bot.token',
        'bot.clientId',
        'bot.guildId',
        'database.host',
        'database.user',
        'database.password',
        'database.database'
    ];
    const missing = required.filter(key => {
        const keys = key.split('.');
        let value = config;
        for (const k of keys) {
            value = value?.[k];
        }
        return !value;
    });

    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}. Please set the required environment variables.`);
    }
};

validateConfig();

config.getNestedConfig = (path, defaultValue) => getNestedConfig(getConfig(), path, defaultValue);

module.exports = config;