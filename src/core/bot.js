const { Client, GatewayIntentBits, Events, REST, Routes, ActivityType, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const CommandLoader = require('./command-loader');
const { initialize: initializeDatabase } = require('../database/schema');
const GiveawayHandler = require('../handlers/giveaway.handler');
const { handleModLogPagination } = require('../handlers/modlog.handler');
const EventLogHandler = require('../handlers/event-log.handler');
const TicketHandler = require('../handlers/ticket.handler');
const AntiSpamHandler = require('../handlers/anti-spam.handler');
const VoiceBlacklistHandler = require('../handlers/voice-blacklist.handler');
const VoiceSupportHandler = require('../handlers/voice-support.handler');

const LevelHandler = require('../handlers/level.handler');
const ClashRoyalHandler = require('../handlers/clash-royal.handler');
const giveawayService = require('../services/giveaway.service');
const { formatUserErrorMessage, getErrorCode, ERROR_CODES, BotError } = require('../utils/error-codes');
const { handleError } = require('../utils/error-handler');
const dbFallback = require('../utils/db-fallback');
const { loadTicketConfig } = require('../utils/yaml-loader');
const { testConnection } = require('../database/connection');
const { sendFeedback, getFeedbackMessage } = require('../utils/command-feedback');
const BotAPI = require('./bot-api');

class Bot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildBans
            ]
        });

        this.commands = CommandLoader.loadCommands();

        this.client.commands = this.commands;
        this.giveawayHandler = null;
        this.eventLogHandler = null;
        this.ticketHandler = null;
        this.antiSpamHandler = null;
        this.antiLinkHandler = null;
        this.levelHandler = null;
        this.pvpTournamentHandler = null;
        this.clashRoyalHandler = null;
        this.voiceBlacklistHandler = null;
        this.voiceSupportHandler = null;
        this.checkInterval = null;
        this.ticketPanelInterval = null;
        this.suggestionColorUpdateInterval = null;
        this.configWatchers = [];

        this.ticketService = null;
        this.ticketEmbedFactory = null;
        this.botAPI = null;
    }

    async initialize() {
        try {

            const loginPromise = this.client.login(config.bot.token);


            await Promise.all([
                initializeDatabase(),
                this.registerCommands()
            ]);


            this.giveawayHandler = new GiveawayHandler(this.client);
            this.eventLogHandler = new EventLogHandler(this.client);
            this.eventLogHandler.setupEventListeners();
            this.ticketHandler = new TicketHandler(this.client);
            const PvpTournamentHandler = require('../handlers/pvp-tournament.handler');
            this.pvpTournamentHandler = new PvpTournamentHandler(this.client);
            this.antiSpamHandler = new AntiSpamHandler(this.client);
            const AntiLinkHandler = require('../handlers/anti-link.handler');
            this.antiLinkHandler = new AntiLinkHandler(this.client);
            this.levelHandler = new LevelHandler(this.client);

            global.levelHandler = this.levelHandler;

            this.clashRoyalHandler = new ClashRoyalHandler(this.client);


            this.antiSpamHandler.setupEventListeners();
            this.antiSpamHandler.startCleanup();


            this.antiLinkHandler.setupEventListeners();


            this.levelHandler.setupEventListeners();

            this.voiceBlacklistHandler = new VoiceBlacklistHandler(this.client);
            this.voiceBlacklistHandler.setupEventListeners();

            this.voiceSupportHandler = new VoiceSupportHandler(this.client);
            this.voiceSupportHandler.setupEventListeners();


            this.ticketService = require('../services/ticket.service');
            this.ticketEmbedFactory = require('../utils/ticket-embeds');


            await loginPromise;


            this.botAPI = new BotAPI(this.client);
            await this.botAPI.start();

            this.setupEventHandlers();
            this.startGiveawayChecker();
            this.startTicketPanelUpdater();
            this.startSuggestionColorUpdater();
            this.setupConfigWatcher();

            logger.success('Bot initialisé avec succès');


            dbFallback.startHealthCheck(testConnection);
        } catch (error) {
            logger.error('Échec de l\'initialisation du bot', error);
            throw error;
        }
    }

    async registerCommands() {
        try {
            const rest = new REST({ version: '10' }).setToken(config.bot.token);
            const commands = [...this.commands.values()].map(cmd => cmd.data.toJSON());

            if (commands.length === 0) return;

            logger.info(`Enregistrement de ${commands.length} commande(s) de guilde...`);
            logger.debug(`Commandes à enregistrer: ${JSON.stringify(commands.map(c => ({ name: c.name, description: c.description })))}`);


            await rest.put(
                Routes.applicationGuildCommands(config.bot.clientId, config.bot.guildId),
                { body: commands }
            );

            logger.success(`Enregistrement réussi de ${commands.length} commande(s) dans la guilde ${config.bot.guildId}`);
            logger.info(`Commandes enregistrées: ${commands.map(c => c.name).join(', ')}`);
        } catch (error) {
            logger.error('Échec de l\'enregistrement des commandes', error);
            throw error;
        }
    }

    setupEventHandlers() {
        this.client.once(Events.ClientReady, async (client) => {
            logger.success(`Bot prêt: ${client.user.tag}`);


            try {
                const activityTypeMap = {
                    'PLAYING': ActivityType.Playing,
                    'STREAMING': ActivityType.Streaming,
                    'LISTENING': ActivityType.Listening,
                    'WATCHING': ActivityType.Watching,
                    'COMPETING': ActivityType.Competing
                };

                const status = config.bot.status?.toLowerCase() || 'online';
                const activityType = activityTypeMap[config.bot.activity?.type?.toUpperCase()] || ActivityType.Watching;
                const activityText = config.bot.activity?.text || 'Serenity Craft';

                client.user.setPresence({
                    activities: [{
                        name: activityText,
                        type: activityType
                    }],
                    status: status
                });

                logger.info(`Statut du bot défini: ${status}, activité: ${activityText} (${config.bot.activity?.type})`);
            } catch (error) {
                logger.error('Échec de la définition du statut/activité du bot', error);
            }


            await this.updateAllSuggestionColors();


            if (this.clashRoyalHandler) {
                await this.clashRoyalHandler.syncExistingParticipants();
            }
        });

        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (interaction.isChatInputCommand()) {
                await this.handleCommand(interaction);
            } else if (interaction.isAutocomplete()) {
                await this.handleAutocomplete(interaction);
            } else if (interaction.isButton()) {
                await this.handleButton(interaction);
            } else if (interaction.isStringSelectMenu()) {
                await this.handleSelectMenu(interaction);
            } else if (interaction.isModalSubmit()) {
                await this.handleModalSubmit(interaction);
            }
        });

        this.client.on(Events.Error, (error) => {
            logger.error('Erreur du client Discord', error);
        });


        this.client.on(Events.MessageReactionAdd, async (reaction, user) => {
            await this.handleSuggestionReaction(reaction, user);
        });

        this.client.on(Events.MessageReactionRemove, async (reaction, user) => {
            await this.handleSuggestionReaction(reaction, user);
        });
    }

    async handleAutocomplete(interaction) {
        const command = this.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) {
            return;
        }

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            logger.error(`Error handling autocomplete for ${interaction.commandName}`, error);
        }
    }

    async handleCommand(interaction) {
        const command = this.commands.get(interaction.commandName);
        if (!command) {
            try {
                await interaction.reply({
                    content: '❌ Commande introuvable!',
                    ephemeral: true
                });
            } catch (error) {
                logger.debug('Failed to reply to unknown command interaction', error);
            }
            return;
        }


        const CommandLoader = require('./command-loader');
        if (!CommandLoader.isCommandEnabled(interaction.commandName)) {
            try {
                await interaction.reply({
                    content: config.messages?.commandDisabled || '❌ Cette commande est actuellement désactivée.',
                    ephemeral: true
                });
            } catch (error) {
                logger.debug('Failed to reply to disabled command interaction', error);
            }
            return;
        }




        const timeout = setTimeout(async () => {
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content: '⏳ La commande prend plus de temps que prévu...',
                        ephemeral: true
                    });
                } catch (error) {
                    logger.debug('Échec de l\'envoi du message de timeout', error);
                }
            }
        }, 2500);

        try {
            const commandName = command.data?.name;


            if (interaction.replied || interaction.deferred) {
                await command.execute(interaction);
                clearTimeout(timeout);
                return;
            }

            const subcommand = interaction.options?.getSubcommand(false);
            const needsModal = (commandName === 'config' && subcommand === 'edit') ||
                (commandName === 'suggestion') ||
                (commandName === 'ping-embed');


            const handlesOwnReply = (commandName === 'suggestion-mod') || (commandName === 'event');


            if (!needsModal && !handlesOwnReply) {
                await sendFeedback(interaction);
            }

            await command.execute(interaction);
            clearTimeout(timeout);
        } catch (error) {
            clearTimeout(timeout);
            await handleError(interaction, error, `commande ${interaction.commandName}`);
        }
    }

    async handleButton(interaction) {
        try {

            if (interaction.customId === 'clash_royal_join' || interaction.customId === 'clash_royal_leave') {
                try {
                    await interaction.deferReply({ ephemeral: true });
                } catch (e) {
                    if (e.code === 10062) {
                        logger.debug('Interaction expired during Clash Royale button click');
                    } else {
                        logger.error('Failed to defer Clash Royale interaction', e);
                    }
                    return;
                }

                if (interaction.customId === 'clash_royal_join') {
                    return await this.clashRoyalHandler.handleJoin(interaction);
                } else {
                    return await this.clashRoyalHandler.handleLeave(interaction);
                }
            }

            let feedbackMessage = null;

            if (interaction.customId === 'ticket_create') {
                const categoryKey = 'connexion';
                const categoryConfig = config.tickets.categories.find(c => c.key === categoryKey);
                const inputs = categoryConfig?.inputs || [];


                if (inputs.length === 0) {
                    await this.ticketHandler.handleCreate(interaction, {}, categoryKey);
                    return;
                }

                const modal = new ModalBuilder()
                    .setCustomId('ticket_modal_create')
                    .setTitle('Création de ticket');

                for (const input of inputs) {
                    if (input.type === 'text') {
                        const style = input.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short;
                        const textInput = new TextInputBuilder()
                            .setCustomId(`ticket_field_${input.id}`)
                            .setLabel(input.label)
                            .setStyle(style)
                            .setRequired(input.required !== false)
                            .setPlaceholder(input.placeholder || '');

                        modal.addComponents(new ActionRowBuilder().addComponents(textInput));
                    } else if (input.type === 'select') {
                        const selectComponent = {
                            type: 18,
                            label: input.label,
                            component: {
                                type: 3,
                                custom_id: `ticket_field_${input.id}`,
                                placeholder: input.placeholder || "Sélectionnez une option",
                                options: input.options.map(opt => ({
                                    label: opt.label,
                                    value: opt.value,
                                    description: opt.description,
                                    emoji: opt.emoji ? (typeof opt.emoji === 'string' ? { name: opt.emoji } : opt.emoji) : undefined
                                }))
                            }
                        };
                        modal.addComponents(selectComponent);
                    }
                }

                await interaction.showModal(modal);
                return;
            } else if (interaction.customId === 'ticket_close_confirm') {
                feedbackMessage = getFeedbackMessage('ticket', 'close');
            } else if (interaction.customId === 'ticket_reopen') {
                feedbackMessage = getFeedbackMessage('ticket', 'reopen');
            } else if (interaction.customId === 'ticket_delete') {
                feedbackMessage = getFeedbackMessage('ticket', 'delete');
            } else if (interaction.customId === 'ticket_transcribe') {
                feedbackMessage = getFeedbackMessage('ticket', 'transcript');
            } else if (interaction.customId === 'ticket_edit_info') {
                await this.ticketHandler.handleEditInfo(interaction);
                return;
            } else if (interaction.customId === 'ticket_close_transcribe') {
                await this.ticketHandler.handleQuickClose(interaction);
                return;
            } else if (interaction.customId.startsWith('feedback_rating_')) {
                await this.ticketHandler.handleFeedback(interaction);
                return;
            }



            const isPaginationButton = interaction.customId.startsWith('modlog_prev_') ||
                interaction.customId.startsWith('modlog_next_');

            if (!isPaginationButton) {
                if (feedbackMessage && !interaction.deferred && !interaction.replied && interaction.customId !== 'ticket_close') {
                    await interaction.deferReply({ ephemeral: true });
                    await interaction.editReply({ content: feedbackMessage });
                } else if (!interaction.deferred && !interaction.replied && interaction.customId !== 'ticket_close') {

                    await interaction.deferReply({ ephemeral: true });
                }
            }


            if (interaction.customId.startsWith('giveaway_enter_')) {
                const messageId = interaction.customId.split('_')[2];
                await this.giveawayHandler.handleEnter(interaction, messageId);
            } else if (interaction.customId.startsWith('giveaway_leave_')) {
                const messageId = interaction.customId.split('_')[2];
                await this.giveawayHandler.handleLeave(interaction, messageId);
            } else if (interaction.customId.startsWith('pvp_register_')) {
                const tournamentId = parseInt(interaction.customId.split('_')[2], 10);
                await this.pvpTournamentHandler.handleRegister(interaction, tournamentId);
            } else if (interaction.customId.startsWith('pvp_leave_')) {
                const tournamentId = parseInt(interaction.customId.split('_')[2], 10);
                await this.pvpTournamentHandler.handleLeave(interaction, tournamentId);
            } else if (interaction.customId.startsWith('modlog_prev_')) {
                const parts = interaction.customId.split('_');
                const userId = parts[2];
                const currentPage = parseInt(parts[3], 10);
                await handleModLogPagination(interaction, userId, currentPage - 1, 'prev');
            } else if (interaction.customId.startsWith('modlog_next_')) {
                const parts = interaction.customId.split('_');
                const userId = parts[2];
                const currentPage = parseInt(parts[3], 10);
                await handleModLogPagination(interaction, userId, currentPage + 1, 'next');
            } else if (interaction.customId === 'ticket_create') {

            } else if (interaction.customId === 'ticket_close' || interaction.customId === 'ticket_close_confirm') {
                await this.ticketHandler.handleClose(interaction);
            } else if (interaction.customId === 'ticket_close_cancel') {

                try {
                    if (interaction.message) {
                        await interaction.message.delete();
                    }
                } catch (error) {
                    logger.debug('Failed to delete confirmation message on cancel', error);
                }

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        content: '❌ Fermeture du ticket annulée.',
                        components: []
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Fermeture du ticket annulée.',
                        ephemeral: true
                    });
                }
            } else if (interaction.customId === 'ticket_reopen') {
                await this.ticketHandler.handleReopen(interaction);
            } else if (interaction.customId === 'ticket_delete' || interaction.customId === 'ticket_delete_confirm') {
                await this.ticketHandler.handleDelete(interaction);
            } else if (interaction.customId === 'ticket_delete_cancel') {
                try {
                    if (interaction.message) {
                        await interaction.message.delete();
                    }
                } catch (error) {
                    logger.debug('Failed to delete delete confirmation message on cancel', error);
                }

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        content: '❌ Suppression du ticket annulée.',
                        components: []
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Suppression du ticket annulée.',
                        ephemeral: true
                    });
                }
            } else if (interaction.customId === 'ticket_transcribe') {
                await this.ticketHandler.handleTranscribe(interaction);
            } else {
                await interaction.editReply({
                    content: '❌ Interaction non reconnue.'
                }).catch((error) => {
                    logger.debug('Échec de l\'édition de la réponse pour une interaction de bouton non reconnue', error);
                });
            }
        } catch (error) {
            await handleError(interaction, error, 'interaction de bouton');
        }
    }

    async handleSelectMenu(interaction) {
        try {

            if (interaction.customId === 'ticket_category_select') {
                const selectedValue = interaction.values[0];
                const categoryKey = selectedValue.replace('category_', '');

                const categoryConfig = config.tickets.categories.find(c => c.key === categoryKey);
                const inputs = categoryConfig?.inputs || [];

                if (inputs.length === 0) {
                    await this.ticketHandler.handleCreate(interaction, {}, categoryKey);
                    return;
                }


                const modal = new ModalBuilder()
                    .setCustomId(`ticket_modal_${categoryKey}`)
                    .setTitle('Création de ticket');

                for (const input of inputs) {
                    if (input.type === 'text') {
                        const style = input.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short;
                        const textInput = new TextInputBuilder()
                            .setCustomId(`ticket_field_${input.id}`)
                            .setLabel(input.label)
                            .setStyle(style)
                            .setRequired(input.required !== false)
                            .setPlaceholder(input.placeholder || '');

                        modal.addComponents(new ActionRowBuilder().addComponents(textInput));
                    } else if (input.type === 'select') {
                        const selectComponent = {
                            type: 18,
                            label: input.label,
                            component: {
                                type: 3,
                                custom_id: `ticket_field_${input.id}`,
                                placeholder: input.placeholder || "Sélectionnez une option",
                                options: input.options.map(opt => ({
                                    label: opt.label,
                                    value: opt.value,
                                    description: opt.description,
                                    emoji: opt.emoji ? (typeof opt.emoji === 'string' ? { name: opt.emoji } : opt.emoji) : undefined
                                }))
                            }
                        };
                        modal.addComponents(selectComponent);
                    }
                }

                await interaction.showModal(modal);
                return;
            } else {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ ephemeral: true });
                }
            }

            if (interaction.customId === 'ticket_category_select') {

                await this.ticketHandler.handleCreate(interaction);
            } else {
                await interaction.editReply({
                    content: '❌ Interaction non reconnue.'
                }).catch((error) => {
                    logger.debug('Échec de l\'édition de la réponse pour une interaction de menu non reconnue', error);
                });
            }
        } catch (error) {
            await handleError(interaction, error, 'interaction de menu');
        }
    }

    async handleModalSubmit(interaction) {
        try {


            if (!interaction.deferred && !interaction.replied) {
                try {
                    await interaction.deferReply({ ephemeral: true });
                } catch (error) {

                    if (error.code === 10062) {
                        logger.debug('Modal interaction expired before processing');
                        return;
                    }
                    throw error;
                }
            }

            if (interaction.customId === 'suggestion_modal') {
                const title = interaction.fields.getTextInputValue('suggestion_title');
                const description = interaction.fields.getTextInputValue('suggestion_description');

                const suggestionChannelId = config.suggestion.channelId;
                if (!suggestionChannelId) {
                    return await this.safeReply(interaction, {
                        content: '❌ Le canal de suggestions n\'est pas configuré. Veuillez contacter un administrateur.',
                        ephemeral: true
                    });
                }

                const { CacheHelpers } = require('../utils/discord-cache');
                const channel = await CacheHelpers.getChannel(this.client, suggestionChannelId, 10 * 60 * 1000).catch(() => null);
                if (!channel) {
                    return await this.safeReply(interaction, {
                        content: '❌ Le canal de suggestions est introuvable. Veuillez contacter un administrateur.',
                        ephemeral: true
                    });
                }

                const SuggestionEmbedFactory = require('../utils/suggestion-embeds');
                const embed = SuggestionEmbedFactory.createSuggestionEmbed(
                    title,
                    description,
                    interaction.user,
                    interaction.guild
                );

                const message = await channel.send({ embeds: [embed] });


                try {
                    const suggestionRepository = require('../database/repositories/suggestion.repository');
                    await suggestionRepository.create({
                        messageId: message.id,
                        channelId: channel.id,
                        guildId: interaction.guild.id,
                        userId: interaction.user.id,
                        title: title,
                        description: description,
                        upvoteCount: 0,
                        downvoteCount: 0,
                        embedColor: 0x5865F2
                    });
                } catch (error) {
                    logger.debug('Failed to store suggestion in database', error);

                }

                const emojiConfig = config.suggestion.emojis || {};


                const getEmoji = (emojiString, fallback) => {
                    if (!emojiString) return fallback;



                    const match = emojiString.match(/<a?:([^:>]+):(\d+)>/);
                    if (match) {
                        const emojiId = match[2];

                        const emoji = this.client.emojis.cache.get(emojiId);
                        if (emoji) {
                            return emoji;
                        }


                        return emojiString;
                    }


                    if (/^\d+$/.test(emojiString)) {
                        const emoji = this.client.emojis.cache.get(emojiString);
                        if (emoji) return emoji;

                        return emojiString;
                    }


                    return fallback;
                };

                const upvoteEmoji = getEmoji(emojiConfig.upvote, '✅');
                const neutralEmoji = getEmoji(emojiConfig.neutral, '➖');
                const downvoteEmoji = getEmoji(emojiConfig.downvote, '❌');

                await message.react(upvoteEmoji);
                await message.react(neutralEmoji);
                await message.react(downvoteEmoji);

                const successEmbed = SuggestionEmbedFactory.createSuccessEmbed(interaction.guild);
                await this.safeReply(interaction, {
                    embeds: [successEmbed],
                    ephemeral: true
                });
            } else if (interaction.customId.startsWith('config_edit_')) {

                const configCommand = this.commands.get('config');
                if (configCommand && configCommand.handleModalSubmit) {
                    await configCommand.handleModalSubmit(interaction);
                } else {
                    await this.safeReply(interaction, {
                        content: '❌ Handler de modal non trouvé.',
                        ephemeral: true
                    });
                }
            } else if (interaction.customId.startsWith('ping_embed_')) {

                const pingEmbedCommand = this.commands.get('ping-embed');
                if (pingEmbedCommand && pingEmbedCommand.handleModalSubmit) {
                    await pingEmbedCommand.handleModalSubmit(interaction);
                } else {
                    await this.safeReply(interaction, {
                        content: '❌ Handler de modal non trouvé.',
                        ephemeral: true
                    });
                }
            } else if (interaction.customId.startsWith('ticket_modal_edit_')) {
                await this.ticketHandler.handleEditInfoSubmit(interaction);
            } else if (interaction.customId.startsWith('ticket_modal_')) {

                const suffix = interaction.customId.replace('ticket_modal_', '');
                let categoryKey = null;



                if (suffix === 'create') {
                    categoryKey = 'connexion';
                } else {
                    categoryKey = suffix;
                }

                const categoryConfig = config.tickets.categories.find(c => c.key === categoryKey);
                const inputs = categoryConfig?.inputs || [];

                if (inputs.length === 0) {
                    inputs.push({ id: 'pseudo', type: 'text', label: 'Pseudo', required: true });
                }

                const checkPlatformSelect = (fieldId) => {


                    if (interaction.fields.fields && interaction.fields.fields.has(fieldId)) {
                        const field = interaction.fields.fields.get(fieldId);
                        if (field.values && field.values.length > 0) return field.values[0];
                    }
                    try {
                        const fieldProxy = interaction.fields.getField(fieldId);
                        if (fieldProxy && fieldProxy.values && fieldProxy.values.length > 0) return fieldProxy.values[0];
                    } catch (e) { /* ignore */ }
                    return null;
                };

                const formData = {};

                for (const input of inputs) {
                    const fieldId = `ticket_field_${input.id}`;
                    let value = null;

                    if (input.type === 'text') {
                        try {
                            value = interaction.fields.getTextInputValue(fieldId);
                        } catch (e) {


                            if (input.id === 'pseudo') {
                                try { value = interaction.fields.getTextInputValue('ticket_pseudo'); } catch (err) { }
                            }
                        }
                    } else if (input.type === 'select') {
                        value = checkPlatformSelect(fieldId);

                        if (!value && input.id === 'platform') {
                            value = checkPlatformSelect('ticket_platform');
                        }
                    }

                    if (value) {
                        formData[input.label] = value;
                    } else {
                        formData[input.label] = "Non spécifié";
                    }
                }

                await this.ticketHandler.handleCreate(interaction, formData, categoryKey);

            } else {
                await this.safeReply(interaction, {
                    content: '❌ Modal non reconnu.',
                    ephemeral: true
                });
            }
        } catch (error) {

            if (error.code === 10062) {
                logger.debug('Interaction expired before modal submission could be processed');
                return;
            }
            await handleError(interaction, error, 'soumission de modal');
        }
    }


    async safeReply(interaction, options) {
        try {
            if (interaction.deferred || interaction.replied) {
                return await interaction.editReply(options);
            } else {

                const now = Date.now();
                const interactionAge = now - interaction.createdTimestamp;
                if (interactionAge > 3000) {

                    logger.debug('Interaction expired, cannot reply');
                    throw new Error('Interaction expired');
                }
                return await interaction.reply(options);
            }
        } catch (error) {

            if (error.code === 10062) {
                logger.debug('Interaction expired (Unknown interaction error)');
                throw error;
            }
            throw error;
        }
    }

    startGiveawayChecker() {
        const checkGiveaways = async () => {
            try {
                if (!this.giveawayHandler) {
                    logger.warn('Handler de concours non initialisé, vérification ignorée');
                    return;
                }
                const activeGiveaways = await giveawayService.getActiveGiveaways();
                if (!activeGiveaways || !activeGiveaways.length) return;

                const now = Date.now();
                const expiredGiveaways = activeGiveaways.filter(g => {
                    if (!g || !g.end_time) return false;
                    const endTime = new Date(g.end_time + 'Z').getTime();
                    return endTime <= now;
                });

                await Promise.all(expiredGiveaways.map(g => this.giveawayHandler.endGiveaway(g)));
            } catch (error) {
                logger.error('Erreur lors de la vérification des concours', error);

            }
        };


        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }


        const { convertDurationToMs } = require('../utils/helpers');
        let interval = config.giveaway.checkInterval;


        if (typeof interval === 'string') {
            interval = convertDurationToMs(interval);
        }


        if (!interval || isNaN(interval) || interval <= 0) {
            interval = 300000;
            logger.warn(`Invalid checkInterval, using default: ${interval}ms`);
        }

        this.checkInterval = setInterval(checkGiveaways, interval);
        checkGiveaways();
    }

    async updateAllTicketPanels() {

        try {
            if (!config.tickets.enabled || !this.ticketService || !this.ticketEmbedFactory || !this.client) return;


            if (!this.client.guilds || !this.client.guilds.cache) return;
            const guilds = Array.from(this.client.guilds.cache.values());


            const batchSize = 5;
            for (let i = 0; i < guilds.length; i += batchSize) {
                const batch = guilds.slice(i, i + batchSize);
                await Promise.allSettled(batch.map(async (guild) => {
                    try {
                        const panels = await this.ticketService.getAllPanels(guild.id);

                        if (!panels || panels.length === 0) return;


                        await Promise.allSettled(panels.map(async (panel) => {
                            try {
                                const { CacheHelpers } = require('../utils/discord-cache');
                                const channel = await CacheHelpers.getChannel(this.client, panel.channel_id, 5 * 60 * 1000).catch(() => null);
                                if (!channel) return;

                                const message = await channel.messages.fetch(panel.message_id).catch(() => null);
                                if (!message) return;


                                const embed = this.ticketEmbedFactory.createPanelEmbed(guild);


                                const categories = loadTicketConfig();
                                const selectMenu = new StringSelectMenuBuilder()
                                    .setCustomId('ticket_category_select')
                                    .setPlaceholder('Sélectionnez une catégorie de ticket');


                                const usedValues = new Set();
                                categories.slice(0, 25).forEach(cat => {
                                    const value = `category_${cat.key}`;
                                    if (!usedValues.has(value)) {
                                        usedValues.add(value);
                                        selectMenu.addOptions({
                                            label: cat.name,
                                            value: value,
                                            description: cat.description || `Créer un ticket ${cat.name}`
                                        });
                                    }
                                });



                                if (selectMenu.options.length === 0) {
                                    logger.warn(`No ticket categories available for panel ${panel.message_id}, skipping select menu update`);
                                    await message.edit({ embeds: [embed], components: [] });
                                } else {
                                    const row = new ActionRowBuilder().addComponents(selectMenu);
                                    await message.edit({ embeds: [embed], components: [row] });
                                }
                            } catch (error) {
                                logger.error(`Échec de la mise à jour du panel ${panel.message_id}`, error);
                            }
                        }));
                    } catch (error) {
                        logger.error(`Échec de la mise à jour des panels pour la guilde ${guild.id}`, error);
                    }
                }));
            }
        } catch (error) {
            logger.error('Erreur lors de la mise à jour des panels de tickets', error);
        }
    }

    startTicketPanelUpdater() {
        const updatePanels = async () => {
            try {
                if (!config.tickets.enabled || !this.ticketService || !this.ticketEmbedFactory || !this.client) return;


                if (!this.client.guilds || !this.client.guilds.cache) return;
                const guilds = Array.from(this.client.guilds.cache.values());


                const batchSize = 5;
                for (let i = 0; i < guilds.length; i += batchSize) {
                    const batch = guilds.slice(i, i + batchSize);
                    await Promise.allSettled(batch.map(async (guild) => {
                        try {
                            const panels = await this.ticketService.getAllPanels(guild.id);

                            if (!panels || panels.length === 0) return;


                            await Promise.allSettled(panels.map(async (panel) => {
                                try {
                                    const { CacheHelpers } = require('../utils/discord-cache');
                                    const channel = await CacheHelpers.getChannel(this.client, panel.channel_id, 5 * 60 * 1000).catch(() => null);
                                    if (!channel) return;

                                    const message = await channel.messages.fetch(panel.message_id).catch(() => null);
                                    if (!message) return;


                                    const embed = this.ticketEmbedFactory.createPanelEmbed(guild);


                                    const categories = loadTicketConfig();
                                    const selectMenu = new StringSelectMenuBuilder()
                                        .setCustomId('ticket_category_select')
                                        .setPlaceholder('Sélectionnez une catégorie de ticket');


                                    const usedValues = new Set();
                                    categories.slice(0, 25).forEach(cat => {
                                        const value = `category_${cat.key}`;
                                        if (!usedValues.has(value)) {
                                            usedValues.add(value);
                                            selectMenu.addOptions({
                                                label: cat.name,
                                                value: value,
                                                description: cat.description || `Créer un ticket ${cat.name}`
                                            });
                                        }
                                    });



                                    if (selectMenu.options.length === 0) {
                                        logger.warn(`No ticket categories available for panel ${panel.message_id}, skipping select menu update`);
                                        await message.edit({ embeds: [embed], components: [] });
                                    } else {
                                        const row = new ActionRowBuilder().addComponents(selectMenu);
                                        await message.edit({ embeds: [embed], components: [row] });
                                    }
                                } catch (error) {
                                    logger.error(`Échec de la mise à jour du panel ${panel.message_id}`, error);
                                }
                            }));
                        } catch (error) {
                            logger.error(`Échec de la mise à jour des panels pour la guilde ${guild.id}`, error);
                        }
                    }));
                }
            } catch (error) {
                logger.error('Erreur lors de la mise à jour des panels de tickets', error);
            }
        };


        if (this.ticketPanelInterval) {
            clearInterval(this.ticketPanelInterval);
            this.ticketPanelInterval = null;
        }


        const { convertDurationToMs } = require('../utils/helpers');
        let interval = config.tickets.panelUpdateInterval || "5m";


        if (typeof interval === 'string') {
            interval = convertDurationToMs(interval);
        }


        if (!interval || isNaN(interval) || interval <= 0) {
            interval = 300000;
            logger.warn(`Invalid panelUpdateInterval, using default: ${interval}ms`);
        }

        this.ticketPanelInterval = setInterval(updatePanels, interval);
        setTimeout(updatePanels, 10000);
    }


    setupConfigWatcher() {
        const fs = require('fs');
        const path = require('path');
        const { reloadDiscordConfig, reloadTicketConfig } = require('../utils/yaml-loader');
        const CommandLoader = require('./command-loader');


        if (this.configWatchers && this.configWatchers.length > 0) {
            this.configWatchers.forEach(watcher => {
                try {
                    fs.unwatchFile(watcher.path, watcher.listener);
                } catch (error) {
                    logger.debug('Error removing watcher', error);
                }
            });
            this.configWatchers = [];
        }


        const discordConfigPath = path.join(__dirname, '../config/discordconfig.yml');

        const handleConfigChange = async (filePath) => {
            try {
                logger.info(`📝 ${path.basename(filePath)} modifié, rechargement...`);


                const newConfig = reloadDiscordConfig();
                reloadTicketConfig();


                logger.info('🔄 Rechargement des commandes...');
                const oldCommands = Array.from(this.commands.keys());
                this.commands = CommandLoader.loadCommands();
                const newCommands = Array.from(this.commands.keys());


                const commandsChanged = oldCommands.length !== newCommands.length ||
                    !oldCommands.every(cmd => newCommands.includes(cmd));



                if (commandsChanged) {
                    logger.info(`📋 Commandes changées: ${oldCommands.length} → ${newCommands.length}, réenregistrement...`);
                    logger.debug(`Anciennes: ${oldCommands.join(', ') || 'aucune'}`);
                    logger.debug(`Nouvelles: ${newCommands.join(', ') || 'aucune'}`);
                } else {
                    logger.info('📋 Réenregistrement des commandes pour synchronisation avec Discord...');
                }
                await this.registerCommands();


                if (this.ticketService && this.ticketEmbedFactory) {
                    logger.info('📝 Configuration modifiée, mise à jour immédiate des panels de tickets...');
                    this.updateAllTicketPanels().catch(error => {
                        logger.error('Erreur lors de la mise à jour immédiate des panels après changement de config', error);
                    });
                }


                if (this.client.user) {
                    const activityTypeMap = {
                        'PLAYING': ActivityType.Playing,
                        'STREAMING': ActivityType.Streaming,
                        'LISTENING': ActivityType.Listening,
                        'WATCHING': ActivityType.Watching,
                        'COMPETING': ActivityType.Competing
                    };

                    const status = newConfig.bot?.presence?.status?.toLowerCase() || 'online';
                    const activityType = activityTypeMap[newConfig.bot?.presence?.activity?.type?.toUpperCase()] || ActivityType.Watching;
                    const activityText = newConfig.bot?.presence?.activity?.text || 'Serenity Craft';

                    this.client.user.setPresence({
                        activities: [{
                            name: activityText,
                            type: activityType
                        }],
                        status: status
                    });

                    logger.info(`Bot status mis à jour: ${status}, activité: ${activityText}`);
                }


                if (this.checkInterval && newConfig.giveaways?.settings?.checkInterval) {
                    clearInterval(this.checkInterval);
                    this.startGiveawayChecker();
                    logger.info(`Intervalle de vérification des concours mis à jour`);
                }


                if (this.ticketPanelInterval) {
                    clearInterval(this.ticketPanelInterval);
                    this.startTicketPanelUpdater();
                    logger.info(`Intervalle de mise à jour des panels de tickets mis à jour`);
                }

                logger.success('✅ Configuration rechargée avec succès');
            } catch (error) {
                logger.error('❌ Erreur lors du rechargement de la configuration', error);
            }
        };



        const discordWatcher = async (curr, prev) => {
            if (curr.mtime !== prev.mtime) {
                await handleConfigChange(discordConfigPath);
            }
        };

        fs.watchFile(discordConfigPath, { interval: 1000 }, discordWatcher);
        this.configWatchers.push({ path: discordConfigPath, listener: discordWatcher });

        logger.info('👀 Surveillance de discordconfig.yml activée');
    }

    async updateAllSuggestionColors() {
        try {
            const suggestionChannelId = config.suggestion.channelId;
            if (!suggestionChannelId) return;

            const suggestionRepository = require('../database/repositories/suggestion.repository');
            const { CacheHelpers } = require('../utils/discord-cache');
            const channel = await CacheHelpers.getChannel(this.client, suggestionChannelId, 10 * 60 * 1000).catch(() => null);
            if (!channel) return;


            const suggestions = await suggestionRepository.findAllByChannel(suggestionChannelId);
            if (!suggestions || suggestions.length === 0) return;


            const emojiConfig = config.suggestion.emojis || {};
            const upvoteEmoji = emojiConfig.upvote || '✅';
            const downvoteEmoji = emojiConfig.downvote || '❌';


            const matchesEmoji = (reactionEmoji, configEmoji) => {
                if (!reactionEmoji || !configEmoji) return false;


                if (typeof configEmoji === 'string' && configEmoji.startsWith('<') && configEmoji.endsWith('>')) {


                    const match = configEmoji.match(/<a?:([^:>]+):(\d+)>/);
                    if (match) {
                        const emojiId = match[2];
                        const emojiName = match[1];

                        if (reactionEmoji.id) {
                            const matches = String(reactionEmoji.id) === String(emojiId);
                            if (matches) return true;
                        }

                        if (reactionEmoji.name) {
                            return reactionEmoji.name.toLowerCase() === emojiName.toLowerCase();
                        }
                    }
                }

                if (typeof configEmoji === 'string' && /^\d+$/.test(configEmoji)) {
                    return reactionEmoji.id && String(reactionEmoji.id) === String(configEmoji);
                }

                if (typeof configEmoji === 'string') {

                    if (reactionEmoji.toString() === configEmoji) return true;

                    if (reactionEmoji.name && reactionEmoji.name === configEmoji) return true;

                    if (reactionEmoji.id && String(reactionEmoji.id) === String(configEmoji)) return true;
                }
                return false;
            };


            for (const suggestion of suggestions) {
                try {

                    const message = await channel.messages.fetch(suggestion.message_id).catch(() => null);
                    if (!message) {

                        continue;
                    }

                    const embed = message.embeds[0];
                    if (!embed) continue;


                    const allReactions = message.reactions.cache;


                    for (const [emojiKey, r] of allReactions) {
                        try {
                            await r.users.fetch();
                        } catch (error) {

                        }
                    }


                    let upvoteCount = 0;
                    let downvoteCount = 0;

                    for (const [emojiKey, r] of allReactions) {
                        const rEmojiId = r.emoji.id ? String(r.emoji.id) : null;

                        if (rEmojiId && upvoteEmojiId && rEmojiId === upvoteEmojiId) {
                            upvoteCount = r.count;
                        } else if (rEmojiId && downvoteEmojiId && rEmojiId === downvoteEmojiId) {
                            downvoteCount = r.count;
                        }
                    }


                    let newColor;
                    if (upvoteCount > downvoteCount) {
                        newColor = 0x00FF00;
                    } else if (downvoteCount > upvoteCount) {
                        newColor = 0xFF0000;
                    } else {
                        newColor = 0x5865F2;
                    }


                    await suggestionRepository.updateReactionCounts(
                        suggestion.message_id,
                        upvoteCount,
                        downvoteCount,
                        newColor
                    );


                    if (embed.color !== newColor) {
                        const updatedEmbed = EmbedBuilder.from(embed).setColor(newColor);
                        await message.edit({ embeds: [updatedEmbed] }).catch(() => {

                        });
                    }
                } catch (error) {

                    logger.debug('Error updating suggestion color', error);
                }
            }
        } catch (error) {
            logger.debug('Error in updateAllSuggestionColors', error);
        }
    }

    startSuggestionColorUpdater() {

        if (this.suggestionColorUpdateInterval) {
            clearInterval(this.suggestionColorUpdateInterval);
            this.suggestionColorUpdateInterval = null;
        }


        const interval = 30000;

        this.suggestionColorUpdateInterval = setInterval(() => {
            this.updateAllSuggestionColors();
        }, interval);

        logger.info('🔄 Mise à jour automatique des couleurs de suggestions activée (toutes les 30s)');
    }

    async handleSuggestionReaction(reaction, user) {
        try {

            if (user.bot) {
                logger.debug(`[SUGGESTION] Ignoring bot reaction`);
                return;
            }

            logger.info(`[SUGGESTION] Handling reaction from user ${user.id}`);


            const message = reaction.message.partial
                ? await reaction.message.fetch()
                : reaction.message;


            if (!message.embeds || message.embeds.length === 0) {
                logger.debug(`[SUGGESTION] Message has no embeds, ignoring`);
                return;
            }

            const suggestionChannelId = config.suggestion.channelId;
            if (!suggestionChannelId || message.channelId !== suggestionChannelId) {
                logger.debug(`[SUGGESTION] Not in suggestion channel (channelId: ${message.channelId}, expected: ${suggestionChannelId})`);
                return;
            }

            const embed = message.embeds[0];


            if (!embed.title || !embed.title.startsWith('💡')) return;


            const emojiConfig = config.suggestion.emojis || {};
            const upvoteEmojiConfig = emojiConfig.upvote || '✅';
            const downvoteEmojiConfig = emojiConfig.downvote || '❌';


            let upvoteEmojiId = null;
            let downvoteEmojiId = null;

            logger.info(`[SUGGESTION] Config - upvote: ${upvoteEmojiConfig}, downvote: ${downvoteEmojiConfig}`);

            if (typeof upvoteEmojiConfig === 'string' && upvoteEmojiConfig.startsWith('<') && upvoteEmojiConfig.endsWith('>')) {
                const upvoteMatch = upvoteEmojiConfig.match(/<a?:[^:>]+:(\d+)>/);
                if (upvoteMatch) {
                    upvoteEmojiId = upvoteMatch[1];
                    logger.info(`[SUGGESTION] Extracted upvote ID: ${upvoteEmojiId}`);
                } else {
                    logger.warn(`[SUGGESTION] Failed to extract upvote ID from: ${upvoteEmojiConfig}`);
                }
            } else if (typeof upvoteEmojiConfig === 'string' && /^\d+$/.test(upvoteEmojiConfig)) {
                upvoteEmojiId = upvoteEmojiConfig;
                logger.info(`[SUGGESTION] Using upvote ID directly: ${upvoteEmojiId}`);
            }

            if (typeof downvoteEmojiConfig === 'string' && downvoteEmojiConfig.startsWith('<') && downvoteEmojiConfig.endsWith('>')) {
                const downvoteMatch = downvoteEmojiConfig.match(/<a?:[^:>]+:(\d+)>/);
                if (downvoteMatch) {
                    logger.info(`[SUGGESTION] Downvote match: ${downvoteMatch}`);
                    downvoteEmojiId = downvoteMatch[1];
                    logger.info(`[SUGGESTION] Extracted downvote ID: ${downvoteEmojiId}`);
                } else {
                    logger.warn(`[SUGGESTION] Failed to extract downvote ID from: ${downvoteEmojiConfig}`);
                }
            } else if (typeof downvoteEmojiConfig === 'string' && /^\d+$/.test(downvoteEmojiConfig)) {
                downvoteEmojiId = downvoteEmojiConfig;
                logger.info(`[SUGGESTION] Using downvote ID directly: ${downvoteEmojiId}`);
            }


            let reactionEmoji = reaction.emoji;
            if (reactionEmoji.partial) {
                try {
                    reactionEmoji = await reactionEmoji.fetch();
                } catch (error) {
                    logger.debug(`[SUGGESTION] Could not fetch partial emoji: ${error.message}`);
                }
            }


            const reactionEmojiId = reactionEmoji.id ? String(reactionEmoji.id) : null;
            const reactionEmojiName = reactionEmoji.name || 'unknown';
            const reactionEmojiIdentifier = reactionEmoji.identifier || 'unknown';

            const isUpvote = reactionEmojiId && upvoteEmojiId && reactionEmojiId === upvoteEmojiId;
            const isDownvote = reactionEmojiId && downvoteEmojiId && reactionEmojiId === downvoteEmojiId;


            logger.info(`[SUGGESTION] Reaction received - emojiId: ${reactionEmojiId}, name: ${reactionEmojiName}, identifier: ${reactionEmojiIdentifier}`);
            logger.info(`[SUGGESTION] Comparison - upvoteId: ${upvoteEmojiId}, downvoteId: ${downvoteEmojiId}`);
            logger.info(`[SUGGESTION] Match result - isUpvote: ${isUpvote}, isDownvote: ${isDownvote}`);


            if (!isUpvote && !isDownvote) {
                logger.info(`[SUGGESTION] Not an upvote or downvote, ignoring reaction`);
                return;
            }

            logger.info(`[SUGGESTION] Processing upvote/downvote reaction, fetching all reactions...`);



            let allReactions;
            try {

                const fetchedMessage = await message.channel.messages.fetch(message.id);
                allReactions = fetchedMessage.reactions.cache;


                for (const [emojiKey, r] of allReactions) {
                    try {
                        await r.users.fetch();
                    } catch (error) {

                    }
                }

                logger.info(`[SUGGESTION] Successfully loaded ${allReactions.size} reactions`);
            } catch (error) {
                logger.error(`[SUGGESTION] Failed to fetch reactions: ${error.message}`);
                logger.error(`[SUGGESTION] Stack: ${error.stack}`);
                return;
            }


            let upvoteCount = 0;
            let downvoteCount = 0;

            logger.info(`[SUGGESTION] Processing ${allReactions.size} reactions on message ${message.id}`);

            for (const [emojiKey, r] of allReactions) {
                const rEmojiId = r.emoji.id ? String(r.emoji.id) : null;
                const rEmojiName = r.emoji.name || 'unknown';
                const rEmojiIdentifier = r.emoji.identifier || 'unknown';

                logger.info(`[SUGGESTION] Checking reaction - emojiId: ${rEmojiId}, name: ${rEmojiName}, identifier: ${rEmojiIdentifier}, count: ${r.count}`);

                if (rEmojiId && upvoteEmojiId && rEmojiId === upvoteEmojiId) {
                    upvoteCount = r.count;
                    logger.info(`[SUGGESTION] ✓ Found upvote: count=${r.count}, emojiId=${rEmojiId}`);
                } else if (rEmojiId && downvoteEmojiId && rEmojiId === downvoteEmojiId) {
                    downvoteCount = r.count;
                    logger.info(`[SUGGESTION] ✓ Found downvote: count=${r.count}, emojiId=${rEmojiId}`);
                } else {
                    logger.info(`[SUGGESTION] ✗ Not matching - rEmojiId: ${rEmojiId}, upvoteId: ${upvoteEmojiId}, downvoteId: ${downvoteEmojiId}`);
                }
            }

            logger.info(`[SUGGESTION] Final counts - upvotes: ${upvoteCount}, downvotes: ${downvoteCount}`);


            let newColor;
            if (upvoteCount > downvoteCount) {
                newColor = 0x00FF00;
            } else if (downvoteCount > upvoteCount) {
                newColor = 0xFF0000;
            } else {
                newColor = 0x5865F2;
            }


            try {
                logger.info(`[SUGGESTION] Starting database update for message ${message.id}`);
                const suggestionRepository = require('../database/repositories/suggestion.repository');


                let suggestion = await suggestionRepository.findByMessageId(message.id);
                logger.info(`[SUGGESTION] Suggestion in DB: ${suggestion ? 'exists' : 'not found'}`);

                if (!suggestion) {
                    logger.info(`[SUGGESTION] Creating new suggestion in database`);

                    let userId = null;
                    const proposedByField = embed.fields?.find(field => field.name === '👤 Proposé par' || field.name.includes('Proposé par'));
                    if (proposedByField) {
                        const mentionMatch = proposedByField.value.match(/<@(\d+)>/);
                        if (mentionMatch) {
                            userId = mentionMatch[1];
                        }
                    }
                    if (!userId && message.author) {
                        userId = message.author.id;
                    }

                    logger.info(`[SUGGESTION] Extracted userId: ${userId}`);

                    if (userId) {
                        const title = embed.title ? embed.title.replace(/^💡\s*/, '') : 'Suggestion';
                        const description = embed.description || '';
                        const guildId = message.guild?.id || message.channel?.guild?.id || '';

                        logger.info(`[SUGGESTION] Creating suggestion - messageId: ${message.id}, channelId: ${message.channelId}, guildId: ${guildId}, userId: ${userId}, upvotes: ${upvoteCount}, downvotes: ${downvoteCount}`);

                        await suggestionRepository.create({
                            messageId: message.id,
                            channelId: message.channelId,
                            guildId: guildId,
                            userId: userId,
                            title: title,
                            description: description,
                            upvoteCount: upvoteCount,
                            downvoteCount: downvoteCount,
                            embedColor: newColor
                        });

                        logger.info(`[SUGGESTION] ✓ Successfully created suggestion in database`);
                    } else {
                        logger.warn(`[SUGGESTION] ✗ Cannot create suggestion - userId is null`);
                    }
                } else {

                    logger.info(`[SUGGESTION] Updating existing suggestion - upvotes: ${upvoteCount}, downvotes: ${downvoteCount}, color: ${newColor.toString(16)}`);
                    await suggestionRepository.updateReactionCounts(
                        message.id,
                        upvoteCount,
                        downvoteCount,
                        newColor
                    );
                    logger.info(`[SUGGESTION] ✓ Successfully updated suggestion in database`);
                }
            } catch (error) {
                logger.error(`[SUGGESTION] ✗ Failed to update suggestion in database: ${error.message}`);
                logger.error(`[SUGGESTION] Stack trace: ${error.stack}`);
            }


            if (embed.color !== newColor) {
                const updatedEmbed = EmbedBuilder.from(embed).setColor(newColor);
                await message.edit({ embeds: [updatedEmbed] });
            }
        } catch (error) {

            logger.error(`[SUGGESTION] Error handling suggestion reaction: ${error.message}`);
            logger.error(`[SUGGESTION] Stack trace: ${error.stack}`);
        }
    }

    destroy() {
        try {

            if (this.configWatchers && this.configWatchers.length > 0) {
                this.configWatchers.forEach(watcher => {
                    try {
                        fs.unwatchFile(watcher.path, watcher.listener);
                    } catch (error) {
                        logger.debug('Error removing watcher during destroy', error);
                    }
                });
                this.configWatchers = [];
            }

            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
            if (this.ticketPanelInterval) {
                clearInterval(this.ticketPanelInterval);
                this.ticketPanelInterval = null;
            }
            if (this.suggestionColorUpdateInterval) {
                clearInterval(this.suggestionColorUpdateInterval);
                this.suggestionColorUpdateInterval = null;
            }

            if (this.botAPI) {
                this.botAPI.stop();
                this.botAPI = null;
            }

            if (this.client) {
                this.client.removeAllListeners();
                this.client.destroy();
            }
        } catch (error) {
            logger.error('Error during bot destroy', error);
        }
    }
}

module.exports = Bot;