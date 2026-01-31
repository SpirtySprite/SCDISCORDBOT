const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('./logger');
const { convertDurationToMs } = require('./helpers');

let ticketCategories = null;
let discordConfig = null;


function deepMerge(target, source) {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else if (Array.isArray(source[key])) {
                output[key] = source[key];
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}


function validateAndConvertConfig(config) {

    if (config.database?.connectionPool) {
        const pool = config.database.connectionPool;
        pool.connectionLimit = validateRange(pool.connectionLimit, 1, 200, 100, 'database.connectionPool.connectionLimit');
        pool.queueLimit = validateRange(pool.queueLimit, 0, 1000, 0, 'database.connectionPool.queueLimit');
        pool.connectTimeout = validateRange(pool.connectTimeout, 1000, 60000, 10000, 'database.connectionPool.connectTimeout');
        pool.idleTimeout = validateRange(pool.idleTimeout, 60000, 3600000, 600000, 'database.connectionPool.idleTimeout');
        pool.maxIdle = validateRange(pool.maxIdle, 1, 50, 10, 'database.connectionPool.maxIdle');
    }


    if (config.database?.query) {
        const query = config.database.query;
        query.acquireTimeout = validateRange(query.acquireTimeout, 5000, 120000, 30000, 'database.query.acquireTimeout');
        if (query.retry) {
            query.retry.maxRetries = validateRange(query.retry.maxRetries, 0, 10, 3, 'database.query.retry.maxRetries');
            query.retry.initialDelay = validateRange(query.retry.initialDelay, 100, 10000, 1000, 'database.query.retry.initialDelay');
            query.retry.backoffMultiplier = validateRange(query.retry.backoffMultiplier, 1, 5, 2, 'database.query.retry.backoffMultiplier');
        }
    }


    if (config.handlers?.antiSpam) {
        const antiSpam = config.handlers.antiSpam;
        antiSpam.maxHistorySize = validateRange(antiSpam.maxHistorySize, 100, 50000, 5000, 'handlers.antiSpam.maxHistorySize');
        antiSpam.cleanupInterval = validateRange(antiSpam.cleanupInterval, 60000, 3600000, 300000, 'handlers.antiSpam.cleanupInterval');
        antiSpam.cleanupProbability = validateRange(antiSpam.cleanupProbability, 0, 1, 0.01, 'handlers.antiSpam.cleanupProbability');
    }

    if (config.handlers?.leveling) {
        const leveling = config.handlers.leveling;
        leveling.maxCooldowns = validateRange(leveling.maxCooldowns, 100, 100000, 10000, 'handlers.leveling.maxCooldowns');
        leveling.cleanupInterval = validateRange(leveling.cleanupInterval, 60000, 7200000, 3600000, 'handlers.leveling.cleanupInterval');
        leveling.cleanupProbability = validateRange(leveling.cleanupProbability, 0, 1, 0.01, 'handlers.leveling.cleanupProbability');
    }

    if (config.handlers?.eventLog) {
        const eventLog = config.handlers.eventLog;
        eventLog.batchSize = validateRange(eventLog.batchSize, 1, 100, 10, 'handlers.eventLog.batchSize');
        eventLog.batchDelay = validateRange(eventLog.batchDelay, 100, 10000, 1000, 'handlers.eventLog.batchDelay');
        eventLog.maxQueueSize = validateRange(eventLog.maxQueueSize, 10, 10000, 1000, 'handlers.eventLog.maxQueueSize');
    }

    if (config.handlers?.giveaway) {
        const giveaway = config.handlers.giveaway;
        giveaway.maxQueueSize = validateRange(giveaway.maxQueueSize, 10, 1000, 100, 'handlers.giveaway.maxQueueSize');
        giveaway.embedUpdateDebounce = validateRange(giveaway.embedUpdateDebounce, 100, 5000, 500, 'handlers.giveaway.embedUpdateDebounce');
    }

    if (config.handlers?.pvpTournament) {
        const pvp = config.handlers.pvpTournament;
        pvp.maxConcurrentTournaments = validateRange(pvp.maxConcurrentTournaments, 1, 50, 10, 'handlers.pvpTournament.maxConcurrentTournaments');
        pvp.bracketGenerationTimeout = validateRange(pvp.bracketGenerationTimeout, 5000, 120000, 30000, 'handlers.pvpTournament.bracketGenerationTimeout');
        pvp.matchNotificationTimeout = validateRange(pvp.matchNotificationTimeout, 1000, 60000, 10000, 'handlers.pvpTournament.matchNotificationTimeout');
    }


    if (config.performance?.cache) {
        const cache = config.performance.cache;
        cache.defaultTTL = validateRange(cache.defaultTTL, 60000, 3600000, 300000, 'performance.cache.defaultTTL');
        cache.cleanupInterval = validateRange(cache.cleanupInterval, 60000, 3600000, 300000, 'performance.cache.cleanupInterval');
        cache.maxSize = validateRange(cache.maxSize, 100, 100000, 10000, 'performance.cache.maxSize');
    }

    if (config.performance?.memory) {
        const memory = config.performance.memory;
        memory.cleanupInterval = validateRange(memory.cleanupInterval, 300000, 7200000, 3600000, 'performance.memory.cleanupInterval');
        memory.maxMapSize = validateRange(memory.maxMapSize, 100, 100000, 10000, 'performance.memory.maxMapSize');
    }

    if (config.performance?.botApi) {
        const botApi = config.performance.botApi;
        botApi.port = validateRange(botApi.port, 1024, 65535, 45049, 'performance.botApi.port');
        botApi.maxRequestSize = validateRange(botApi.maxRequestSize, 1048576, 104857600, 10485760, 'performance.botApi.maxRequestSize');
        botApi.requestTimeout = validateRange(botApi.requestTimeout, 1000, 300000, 30000, 'performance.botApi.requestTimeout');
    }


    if (config.soundboard) {
        const soundboard = config.soundboard;
        soundboard.maxFileSize = validateRange(soundboard.maxFileSize, 1048576, 104857600, 10485760, 'soundboard.maxFileSize');
        soundboard.playDelay = validateRange(soundboard.playDelay, 0, 2000, 200, 'soundboard.playDelay');
        soundboard.maxConcurrentPlays = validateRange(soundboard.maxConcurrentPlays, 1, 10, 3, 'soundboard.maxConcurrentPlays');
    }


    if (config.pvpTournaments) {
        const pvp = config.pvpTournaments;
        pvp.maxParticipants = validateRange(pvp.maxParticipants, 2, 128, 64, 'pvpTournaments.maxParticipants');
        pvp.minParticipants = validateRange(pvp.minParticipants, 2, 64, 2, 'pvpTournaments.minParticipants');
        pvp.bracketUpdateInterval = validateRange(pvp.bracketUpdateInterval, 1000, 60000, 5000, 'pvpTournaments.bracketUpdateInterval');
    }
}

function validateRange(value, min, max, defaultValue, path) {
    if (value === undefined || value === null) {
        return defaultValue;
    }
    const numValue = typeof value === 'number' ? value : parseInt(value, 10);
    if (isNaN(numValue)) {
        logger.warn(`Invalid numeric value for ${path}, using default ${defaultValue}`);
        return defaultValue;
    }
    if (numValue < min || numValue > max) {
        logger.warn(`Value ${numValue} for ${path} is out of range [${min}, ${max}], clamping to ${Math.max(min, Math.min(max, numValue))}`);
        return Math.max(min, Math.min(max, numValue));
    }
    return numValue;
}


function loadTicketConfig() {
    if (ticketCategories !== null) {
        return ticketCategories;
    }

    try {

        const discordConfig = loadDiscordConfig();

        if (!discordConfig.tickets || !discordConfig.tickets.categories || !Array.isArray(discordConfig.tickets.categories)) {
            logger.warn('Aucune catégorie de ticket trouvée dans discordconfig.yml, utilisation d\'un tableau vide');
            ticketCategories = [];
            return ticketCategories;
        }


        ticketCategories = discordConfig.tickets.categories
            .map(category => {

                const categoryIdValue = category.categoryId || category.category;

                if (!category.key || !category.name || !categoryIdValue) {
                    if (categoryIdValue === null) {

                        return null;
                    }
                    logger.warn(`Configuration de catégorie invalide: ${JSON.stringify(category)}`);
                    return null;
                }


                let categoryId = String(categoryIdValue);

                categoryId = categoryId.trim();

                logger.info(`Catégorie chargée: ${category.name} -> ${categoryId}`);
                return {
                    key: category.key,
                    name: category.name,
                    description: category.description || `Créer un ticket ${category.name}`,
                    categoryId: categoryId,
                    onCreateMessage: category.onCreateMessage || null,
                    inputs: category.inputs || []
                };
            })
            .filter(cat => cat !== null);

        logger.success(`${ticketCategories.length} catégorie(s) de ticket chargée(s) depuis discordconfig.yml`);
        return ticketCategories;
    } catch (error) {
        logger.error('Échec du chargement des catégories de ticket depuis discordconfig.yml', error);
        ticketCategories = [];
        return ticketCategories;
    }
}


function reloadTicketConfig() {
    ticketCategories = null;
    return loadTicketConfig();
}


function loadDiscordConfig() {
    if (discordConfig !== null) {
        return discordConfig;
    }


    const defaultConfig = {
        bot: {
            presence: {
                status: "online",
                activity: { type: "WATCHING", text: "Serenity Craft" }
            }
        },
        moderation: {
            enabled: true,
            channels: { logId: null },
            rules: { requireReason: false, sendDM: true, defaultDurations: { timeout: "10m", ban: null } },
            actions: { ban: true, kick: true, mute: true, timeout: true, warn: true, unban: true, unmute: true, untimeout: true }
        },
        tickets: {
            enabled: true,
            roles: { staffId: null },
            channels: { transcriptId: null },
            settings: { autoCloseAfter: null, deleteAfterClose: false, deleteDelay: "2s", autoRoles: [], autoUsers: [] },
            categories: []
        },
        giveaways: {
            enabled: true,
            channels: { defaultId: null },
            settings: { checkInterval: "5m", updateDelay: "500ms", minDuration: "1m", maxWinners: 20 }
        },
        minecraft: {
            enabled: true,
            apiKey: "SCraftSCkey",
            port: 48324
        },
        market: {
            enabled: true,
            rotation: { enabled: true, itemsPerRotation: 8, publishEnabled: true },
            balancing: { buffMultiplier: 1.5, nerfMultiplier: 0.6666667 }
        },
        logs: {
            enabled: true,
            channels: { eventLogId: null, modLogId: null, suggestionId: null },
            events: {
                messageDelete: true, messageEdit: true, memberJoin: true, memberLeave: true,
                roleAdd: true, roleRemove: true, nicknameChange: true, voiceJoin: true,
                voiceLeave: true, voiceMove: true, voiceMute: true, voiceDeafen: true
            }
        },
        branding: {
            colors: { primary: "#5865F2", success: "#57F287", error: "#ED4245", warning: "#FEE75C", info: "#5865F2" },
            messages: {
                defaultReason: "Aucune raison spécifiée",
                noPermission: "Vous n'avez pas la permission d'utiliser cette commande.",
                errorOccurred: "Une erreur est survenue lors de l'exécution de la commande.",
                commandDisabled: "Cette commande est actuellement désactivée."
            },
            embeds: { footerText: "Serenity Craft", showTimestamp: true }
        },
        limits: { cooldowns: { global: "3s", giveawayCreate: "1m", ticketCreate: "30s" } },
        features: { autoModeration: false, welcomeMessages: false, goodbyeMessages: false, leveling: false, economy: false },
        commands: {},
        database: {
            connectionPool: {
                connectionLimit: 100,
                queueLimit: 0,
                connectTimeout: 10000,
                idleTimeout: 600000,
                maxIdle: 10,
                enableKeepAlive: true,
                keepAliveInitialDelay: 0
            },
            query: {
                acquireTimeout: 30000,
                retry: {
                    maxRetries: 3,
                    initialDelay: 1000,
                    backoffMultiplier: 2
                }
            }
        },
        handlers: {
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
                timeoutDuration: "10m",
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
        performance: {
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
        soundboard: {
            enabled: true,
            maxFileSize: 10485760,
            allowedFormats: ["mp3", "ogg", "wav"],
            playDelay: 200,
            maxConcurrentPlays: 3
        },
        pvpTournaments: {
            enabled: true,
            maxParticipants: 64,
            minParticipants: 2,
            registrationMinDuration: "1m",
            registrationMaxDuration: "7d",
            bracketUpdateInterval: 5000
        }
    };

    try {

        const discordConfigPath = path.join(__dirname, '../config/discordconfig.yml');

        if (!fs.existsSync(discordConfigPath)) {
            logger.warn('discordconfig.yml not found, using default values');
            discordConfig = defaultConfig;
            return discordConfig;
        }

        const fileContents = fs.readFileSync(discordConfigPath, 'utf8');
        let yamlConfig = yaml.load(fileContents);


        if (yamlConfig && yamlConfig.Discord) {
            yamlConfig = yamlConfig.Discord;
        }

        if (!yamlConfig) {
            logger.warn('Invalid config file format, using default values');
            discordConfig = defaultConfig;
            return discordConfig;
        }



        discordConfig = {};


        for (const key of Object.keys(defaultConfig)) {
            if (yamlConfig[key] === undefined || yamlConfig[key] === null) {

                discordConfig[key] = defaultConfig[key];
            } else if (typeof yamlConfig[key] === 'object' && !Array.isArray(yamlConfig[key]) &&
                typeof defaultConfig[key] === 'object' && !Array.isArray(defaultConfig[key])) {

                discordConfig[key] = { ...defaultConfig[key], ...yamlConfig[key] };
            } else {

                discordConfig[key] = yamlConfig[key];
            }
        }


        for (const key of Object.keys(yamlConfig)) {
            if (!(key in discordConfig)) {
                discordConfig[key] = yamlConfig[key];
            }
        }


        validateAndConvertConfig(discordConfig);


        const d = discordConfig;
        if (d.moderation?.rules?.defaultDurations) {
            d.moderation.rules.defaultDurations.timeout = convertDurationToMs(d.moderation.rules.defaultDurations.timeout) ?? d.moderation.rules.defaultDurations.timeout;
            d.moderation.rules.defaultDurations.ban = convertDurationToMs(d.moderation.rules.defaultDurations.ban) ?? d.moderation.rules.defaultDurations.ban;
        }
        if (d.giveaways?.settings) {
            d.giveaways.settings.checkInterval = convertDurationToMs(d.giveaways.settings.checkInterval) ?? d.giveaways.settings.checkInterval;
            d.giveaways.settings.updateDelay = convertDurationToMs(d.giveaways.settings.updateDelay) ?? d.giveaways.settings.updateDelay;
            d.giveaways.settings.minDuration = convertDurationToMs(d.giveaways.settings.minDuration) ?? d.giveaways.settings.minDuration;
        }
        if (d.limits?.cooldowns) {
            d.limits.cooldowns.global = convertDurationToMs(d.limits.cooldowns.global) ?? d.limits.cooldowns.global;
            d.limits.cooldowns.giveawayCreate = convertDurationToMs(d.limits.cooldowns.giveawayCreate) ?? d.limits.cooldowns.giveawayCreate;
            d.limits.cooldowns.ticketCreate = convertDurationToMs(d.limits.cooldowns.ticketCreate) ?? d.limits.cooldowns.ticketCreate;
        }
        if (d.handlers?.antiLink?.timeoutDuration) {
            d.handlers.antiLink.timeoutDuration = convertDurationToMs(d.handlers.antiLink.timeoutDuration) ?? d.handlers.antiLink.timeoutDuration;
        }
        if (d.pvpTournaments?.registrationMinDuration) {
            d.pvpTournaments.registrationMinDuration = convertDurationToMs(d.pvpTournaments.registrationMinDuration) ?? d.pvpTournaments.registrationMinDuration;
        }
        if (d.pvpTournaments?.registrationMaxDuration) {
            d.pvpTournaments.registrationMaxDuration = convertDurationToMs(d.pvpTournaments.registrationMaxDuration) ?? d.pvpTournaments.registrationMaxDuration;
        }

        logger.success('discordconfig.yml chargé');
        return discordConfig;
    } catch (error) {
        logger.error('Échec du chargement de la configuration', error);
        discordConfig = defaultConfig;
        return discordConfig;
    }
}


function reloadDiscordConfig() {
    discordConfig = null;
    ticketCategories = null;
    return loadDiscordConfig();
}

module.exports = {
    loadTicketConfig,
    reloadTicketConfig,
    loadDiscordConfig,
    reloadDiscordConfig
};