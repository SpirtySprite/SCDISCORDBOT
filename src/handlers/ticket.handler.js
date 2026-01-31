const {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');
const ticketService = require('../services/ticket.service');
const TicketEmbedFactory = require('../utils/ticket-embeds');
const config = require('../config');
const logger = require('../utils/logger');
const { loadTicketConfig } = require('../utils/yaml-loader');
const ticketQueue = require('../utils/ticket-queue');
const { CacheHelpers } = require('../utils/discord-cache');
const crypto = require('crypto');
const { query } = require('../database/connection');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://91.197.6.177:44962';

class TicketHandler {
    constructor(client) {
        this.client = client;
    }

    async handleCreate(interaction, formData = {}, categoryKeyOverride = null) {
        try {
            const pseudo = formData['Pseudo'] || formData['pseudo'] || (typeof formData === 'string' ? formData : null);
            const platform = formData['Plateforme'] || formData['platform'] || null;

            const panel = await ticketService.getPanelByMessageId(interaction.message.id);
            if (!panel) {
                if (interaction.deferred) {
                    return interaction.editReply({
                        content: '❌ Panneau de tickets introuvable.'
                    });
                }
                return interaction.reply({
                    content: '❌ Panneau de tickets introuvable.',
                    ephemeral: true
                });
            }


            const isBlacklisted = await ticketService.isUserBlacklisted(interaction.guild.id, interaction.user.id);
            if (isBlacklisted) {
                const message = '❌ Vous êtes banni du système de tickets.';
                if (interaction.deferred) {
                    return interaction.editReply({ content: message });
                }
                return interaction.reply({ content: message, ephemeral: true });
            }

            const existingTickets = await ticketService.getUserTickets(interaction.guild.id, interaction.user.id);
            const openTickets = existingTickets.filter(t => t.status === 'open');

            const guild = interaction.guild;

            let validOpenTickets = 0;
            const openTicketChannels = [];


            for (const ticket of openTickets) {
                try {
                    const channel = await CacheHelpers.getChannel(this.client, ticket.channel_id, 5 * 60 * 1000).catch(() => null);
                    if (channel) {
                        validOpenTickets++;
                        openTicketChannels.push(ticket.channel_id);
                    } else {

                        await ticketService.deleteTicket(ticket.channel_id);
                    }
                } catch (error) {
                    logger.error('Error checking existing ticket channel', error);
                    await ticketService.deleteTicket(ticket.channel_id);
                }
            }

            const maxOpenTickets = config.tickets.maxOpenTickets || 1;

            if (validOpenTickets >= maxOpenTickets) {
                const channelsList = openTicketChannels.map(id => `<#${id}>`).join(', ');
                const message = `❌ Vous avez atteint la limite de ${maxOpenTickets} tickets ouverts: ${channelsList}`;

                if (interaction.deferred) {
                    return interaction.editReply({
                        content: message
                    });
                }
                return interaction.reply({
                    content: message,
                    ephemeral: true
                });
            }



            let categoryId = null;
            let categoryKey = null;


            if (categoryKeyOverride) {
                categoryKey = categoryKeyOverride;
                logger.info(`Using category key override: ${categoryKey}`);

                const categories = loadTicketConfig();
                const selectedCategory = categories.find(cat => cat.key === categoryKey);

                if (selectedCategory) {
                    categoryId = selectedCategory.categoryId;
                    logger.info(`Mapped category key '${categoryKey}' to category ID: ${categoryId}`);
                } else {
                    logger.warn(`Category key '${categoryKey}' not found in config`);
                }
            }

            else if (interaction.isStringSelectMenu() && interaction.values.length > 0) {
                const selectedValue = interaction.values[0];
                logger.info(`Selected value from menu: ${selectedValue}`);
                if (selectedValue.startsWith('category_')) {

                    categoryKey = selectedValue.replace('category_', '');
                    logger.info(`Extracted category key: ${categoryKey}`);


                    const categories = loadTicketConfig();
                    const selectedCategory = categories.find(cat => cat.key === categoryKey);

                    if (selectedCategory) {
                        categoryId = selectedCategory.categoryId;
                        logger.info(`Mapped category key '${categoryKey}' to category ID: ${categoryId}`);
                    } else {
                        logger.warn(`Category key '${categoryKey}' not found in config`);
                    }
                } else {
                    logger.warn(`Selected value does not start with 'category_': ${selectedValue}`);
                }
            } else {

                const categories = loadTicketConfig();
                if (categories.length > 0) {
                    categoryKey = categories[0].key;
                    categoryId = categories[0].categoryId;
                    logger.info(`No category selected, using first category from config: ${categoryKey} (${categoryId})`);
                } else {
                    logger.warn('No category ID available and no categories in config, ticket will be created without a parent category');
                }
            }


            if (!categoryKey) {
                if (interaction.deferred) {
                    return interaction.editReply({
                        content: '❌ Catégorie de ticket introuvable.'
                    });
                }
                return interaction.reply({
                    content: '❌ Catégorie de ticket introuvable.',
                    ephemeral: true
                });
            }


            if (categoryId) {
                try {
                    const category = await CacheHelpers.getChannel(this.client, categoryId, 10 * 60 * 1000);
                    if (category && category.type === ChannelType.GuildCategory) {
                        logger.info(`Category verified: ${category.name} (${categoryId})`);
                    } else {
                        logger.error(`Channel ${categoryId} exists but is not a category (type: ${category?.type}). Cannot create ticket.`);
                        if (interaction.deferred) {
                            return interaction.editReply({
                                content: `❌ La catégorie spécifiée n'est pas valide. Veuillez vérifier la configuration.`
                            });
                        }
                        return interaction.reply({
                            content: `❌ La catégorie spécifiée n'est pas valide. Veuillez vérifier la configuration.`,
                            ephemeral: true
                        });
                    }
                } catch (error) {
                    logger.error(`Could not fetch category ${categoryId}: ${error.message}`);
                    if (interaction.deferred) {
                        return interaction.editReply({
                            content: `❌ La catégorie ${categoryId} n'existe pas ou n'est pas accessible. Veuillez vérifier les permissions du bot et la configuration.`
                        });
                    }
                    return interaction.reply({
                        content: `❌ La catégorie ${categoryId} n'existe pas ou n'est pas accessible. Veuillez vérifier les permissions du bot et la configuration.`,
                        ephemeral: true
                    });
                }
            } else {
                logger.warn('No category ID available, ticket will be created without a parent category');
            }


            const categories = loadTicketConfig();
            const selectedCategory = categories.find(cat => cat.key === categoryKey);


            let categoryEmoji = '';
            if (selectedCategory && selectedCategory.name) {

                const emojiMatch = selectedCategory.name.match(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}]+/u);
                if (emojiMatch) {
                    categoryEmoji = emojiMatch[0];
                }
            }


            const sanitizedUsername = interaction.user.username
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, '')
                .substring(0, 15);
            const channelName = categoryEmoji ? `${categoryEmoji}-${categoryKey}-${sanitizedUsername}` : `${categoryKey}-${sanitizedUsername}`;


            const addedIds = new Set();

            const permissionOverwrites = [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                },
                {
                    id: this.client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageChannels
                    ]
                }
            ];


            addedIds.add(interaction.user.id);
            addedIds.add(this.client.user.id);


            if (config.tickets.staffRoleId) {
                const staffRoleId = String(config.tickets.staffRoleId);
                if (!addedIds.has(staffRoleId)) {
                    addedIds.add(staffRoleId);
                    permissionOverwrites.push({
                        id: staffRoleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageMessages
                        ]
                    });
                }
            }


            if (config.tickets.autoRoles && Array.isArray(config.tickets.autoRoles) && config.tickets.autoRoles.length > 0) {
                logger.debug(`Adding ${config.tickets.autoRoles.length} auto-roles to ticket`);
                for (const roleId of config.tickets.autoRoles) {
                    if (roleId) {
                        const roleIdStr = String(roleId);
                        if (!addedIds.has(roleIdStr)) {
                            addedIds.add(roleIdStr);
                            permissionOverwrites.push({
                                id: roleIdStr,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.ManageMessages,
                                    PermissionFlagsBits.ManageChannels,
                                    PermissionFlagsBits.ManageRoles
                                ]
                            });
                            logger.debug(`Added auto-role ${roleIdStr} to ticket permissions`);
                        }
                    }
                }
            }


            if (config.tickets.autoUsers && Array.isArray(config.tickets.autoUsers) && config.tickets.autoUsers.length > 0) {
                logger.debug(`Adding ${config.tickets.autoUsers.length} auto-users to ticket`);
                for (const userId of config.tickets.autoUsers) {
                    if (userId) {
                        const userIdStr = String(userId);

                        if (userIdStr !== interaction.user.id && !addedIds.has(userIdStr)) {
                            addedIds.add(userIdStr);
                            permissionOverwrites.push({
                                id: userIdStr,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            });
                            logger.debug(`Added auto-user ${userIdStr} to ticket permissions`);
                        }
                    }
                }
            }

            logger.info(`Queueing ticket channel creation with category ID: ${categoryId || 'none'}`);


            const channelData = {
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites
            };

            if (categoryId) {
                channelData.parent = categoryId;
            }





            const defaultMessage = `Bonjour <@${interaction.user.id}>, comment peut-on vous assister ?`;
            const onCreateMessage = selectedCategory?.onCreateMessage || defaultMessage;


            const formattedMessage = onCreateMessage.replace(/<@USER>/g, `<@${interaction.user.id}>`);


            const queueStatus = ticketQueue.getQueueStatus(guild.id);
            if (queueStatus.queueLength > 0) {
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: `⏳ Création du ticket en cours... (${queueStatus.queueLength} ticket(s) en attente)`
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: `⏳ Création du ticket en cours... (${queueStatus.queueLength} ticket(s) en attente)`,
                        ephemeral: true
                    });
                }
            }


            let channel;
            try {
                channel = await ticketQueue.enqueue(async () => {
                    logger.info(`Creating ticket channel with category ID: ${categoryId || 'none'}`);
                    try {
                        const createdChannel = await guild.channels.create(channelData);
                        logger.info(`Ticket channel created: ${createdChannel.name} in category: ${createdChannel.parent ? createdChannel.parent.name : 'none'}`);
                        return createdChannel;
                    } catch (error) {

                        logger.error(`Failed to create ticket channel for user ${interaction.user.id}`, error);
                        throw error;
                    }
                }, guild.id);
            } catch (error) {
                logger.error('Failed to create ticket channel (queue error)', error);
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: '❌ Échec de la création du ticket. Veuillez réessayer dans quelques instants.'
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: '❌ Échec de la création du ticket. Veuillez réessayer dans quelques instants.',
                        ephemeral: true
                    });
                }
                return;
            }


            const embedMain = TicketEmbedFactory.createTicketCreatedEmbed(interaction.user, interaction.guild, null);

            const closeRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('Fermer le ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

            const welcomeMessage = await channel.send({ embeds: [embedMain], components: [closeRow] });

            const embedInfo = TicketEmbedFactory.createTicketDetailsEmbed(formData, interaction.guild);

            const infoRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_edit_info')
                        .setLabel('Modifier les infos')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✏️')
                );

            await channel.send({ embeds: [embedInfo], components: [infoRow] });


            await channel.send(formattedMessage);

            const { ticketId } = await ticketService.createTicket(
                guild.id,
                interaction.user.id,
                channel.id,
                categoryKey,
                interaction.user.username,
                welcomeMessage.id
            );
            await ticketService.updateWelcomeMessageId(channel.id, welcomeMessage.id);


            try {
                const categories = loadTicketConfig();
                if (categories.length > 0) {
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
                        logger.warn('No ticket categories available, skipping select menu reset');
                        await interaction.message.edit({ components: [] });
                    } else {
                        const row = new ActionRowBuilder().addComponents(selectMenu);
                        const panelMessage = interaction.message;
                        await panelMessage.edit({ components: [row] });
                    }
                }
            } catch (error) {
                logger.error('Failed to reset select menu', error);
            }

            if (interaction.deferred) {
                await interaction.editReply({
                    content: `✅ Ticket créé: <#${channel.id}>`
                });
            } else {
                await interaction.reply({
                    content: `✅ Ticket créé: <#${channel.id}>`,
                    ephemeral: true
                });
            }
        } catch (error) {
            logger.error('Failed to create ticket', error);
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ Échec de la création du ticket.'
                }).catch((error) => {
                    logger.debug('Failed to edit reply after ticket creation error', error);
                });
            } else {
                await interaction.reply({
                    content: '❌ Échec de la création du ticket.',
                    ephemeral: true
                }).catch((error) => {
                    logger.debug('Failed to reply after ticket creation error', error);
                });
            }
        }
    }

    async handleClose(interaction) {
        try {
            const ticket = await ticketService.getTicketByChannel(interaction.channel.id);

            if (!ticket) {
                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply({
                        content: '❌ Ce canal n\'est pas un ticket.'
                    });
                }
                return interaction.reply({
                    content: '❌ Ce canal n\'est pas un ticket.',
                    ephemeral: true
                });
            }


            const member = await CacheHelpers.getMember(interaction.guild, interaction.user.id, 2 * 60 * 1000).catch(() => null);
            if (!member) {
                return interaction.reply({
                    content: '❌ Impossible de vérifier vos permissions.',
                    ephemeral: true
                });
            }


            const isCreator = ticket.user_id === interaction.user.id;


            const channel = interaction.channel;
            const hasAccess = channel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel);


            let isStaff = false;
            if (config.tickets.staffRoleId) {
                isStaff = member.roles.cache.has(String(config.tickets.staffRoleId));
            }

            if (!isCreator && !hasAccess && !isStaff) {
                return interaction.reply({
                    content: '❌ Vous n\'avez pas accès à ce ticket.',
                    ephemeral: true
                });
            }

            if (ticket.status === 'closed' && interaction.customId !== 'ticket_close_confirm') {
                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply({
                        content: '❌ Ce ticket est déjà fermé.'
                    });
                }
                return interaction.reply({
                    content: '❌ Ce ticket est déjà fermé.',
                    ephemeral: true
                });
            }

            if (interaction.customId === 'ticket_close_confirm') {
                await ticketService.closeTicket(interaction.channel.id, interaction.user.id);



                if (config.tickets.deleteAfterClose) {
                    try {
                        await interaction.channel.permissionOverwrites.edit(ticket.user_id, {
                            ViewChannel: false
                        });
                        logger.info(`Removed creator access for ticket ${ticket.ticket_id} (deleteAfterClose enabled)`);
                    } catch (error) {
                        logger.error(`Failed to remove creator access for ticket ${ticket.ticket_id}`, error);
                    }
                }


                if (ticket.user_id) {
                    try {

                        const user = await this.client.users.fetch(ticket.user_id).catch(() => null);
                        if (user) {
                            await this.sendFeedbackRequest(user, ticket);
                        } else {
                            logger.warn(`Could not fetch user ${ticket.user_id} for feedback request`);
                        }
                    } catch (e) {
                        logger.warn(`Failed to send feedback request to ${ticket.user_id}`, e);
                    }
                }


                const embed = TicketEmbedFactory.createTicketClosedEmbed(interaction.user, interaction.guild);

                const actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_close_transcribe')
                            .setLabel('Fermer & Transcrire')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📑'),
                        new ButtonBuilder()
                            .setCustomId('ticket_reopen')
                            .setLabel('Ré-ouvrir')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('🔓'),
                        new ButtonBuilder()
                            .setCustomId('ticket_delete')
                            .setLabel('Supprimer')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🗑️')
                    );


                try {
                    if (interaction.message) {
                        await interaction.message.delete();
                    }
                } catch (error) {
                    logger.debug('Failed to delete confirmation message', error);
                }


                await interaction.channel.send({ embeds: [embed], components: [actionRow] });


                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        content: '✅ Ticket fermé avec succès.',
                        components: []
                    });
                } else {
                    await interaction.reply({
                        content: '✅ Ticket fermé avec succès.',
                        ephemeral: true
                    });
                }
            } else {

                const confirmEmbed = TicketEmbedFactory.createCloseConfirmationEmbed(interaction.guild);
                const confirmRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_close_confirm')
                            .setLabel('Confirmer')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅'),
                        new ButtonBuilder()
                            .setCustomId('ticket_close_cancel')
                            .setLabel('Annuler')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('❌')
                    );

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        embeds: [confirmEmbed],
                        components: [confirmRow]
                    });
                } else {
                    await interaction.reply({
                        embeds: [confirmEmbed],
                        components: [confirmRow],
                        ephemeral: false
                    });
                }
            }
        } catch (error) {
            logger.error('Failed to close ticket via button', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ Échec de la fermeture du ticket.'
                }).catch((error) => {
                    logger.debug('Failed to edit reply after ticket close error', error);
                });
            } else {
                await interaction.reply({
                    content: '❌ Échec de la fermeture du ticket.',
                    ephemeral: true
                }).catch((error) => {
                    logger.debug('Failed to reply after ticket close error', error);
                });
            }
        }
    }

    async handleReopen(interaction) {
        try {
            const ticket = await ticketService.getTicketByChannel(interaction.channel.id);

            if (!ticket) {
                if (interaction.deferred) {
                    return interaction.editReply({
                        content: '❌ Ce canal n\'est pas un ticket.'
                    });
                }
                return interaction.reply({
                    content: '❌ Ce canal n\'est pas un ticket.',
                    ephemeral: true
                });
            }

            if (ticket.status !== 'closed') {
                if (interaction.deferred) {
                    return interaction.editReply({
                        content: '❌ Ce ticket n\'est pas fermé.'
                    });
                }
                return interaction.reply({
                    content: '❌ Ce ticket n\'est pas fermé.',
                    ephemeral: true
                });
            }

            await ticketService.reopenTicket(interaction.channel.id);


            try {
                await interaction.channel.permissionOverwrites.edit(ticket.user_id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                logger.info(`Restored creator access for ticket ${ticket.ticket_id}`);
            } catch (error) {
                logger.error(`Failed to restore creator access for ticket ${ticket.ticket_id}`, error);
            }

            const embed = TicketEmbedFactory.createTicketReopenedEmbed(interaction.guild);


            try {
                if (interaction.message) {
                    await interaction.message.delete();
                }
            } catch (error) {
                logger.debug('Failed to delete closed ticket message on reopen', error);
            }


            await interaction.channel.send({ embeds: [embed] });


            const closeButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('Fermer le ticket')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔒')
                );

            if (ticket.welcome_message_id) {
                try {
                    const welcomeMsg = await interaction.channel.messages.fetch(ticket.welcome_message_id);
                    const user = await CacheHelpers.getUser(interaction.client, ticket.user_id, 5 * 60 * 1000).catch(() => ({ id: ticket.user_id }));
                    const ticketEmbed = TicketEmbedFactory.createTicketCreatedEmbed(user, interaction.guild);
                    await welcomeMsg.edit({ embeds: [ticketEmbed], components: [closeButton] });
                } catch (error) {
                    logger.error('Failed to update welcome message on reopen, sending new message instead', error);

                    const user = await CacheHelpers.getUser(interaction.client, ticket.user_id, 5 * 60 * 1000).catch(() => ({ id: ticket.user_id }));
                    const ticketEmbed = TicketEmbedFactory.createTicketCreatedEmbed(user, interaction.guild);
                    const newWelcomeMsg = await interaction.channel.send({ embeds: [ticketEmbed], components: [closeButton] });

                    await ticketService.updateWelcomeMessageId(interaction.channel.id, newWelcomeMsg.id);
                }
            } else {

                const user = await interaction.client.users.fetch(ticket.user_id).catch(() => ({ id: ticket.user_id }));
                const ticketEmbed = TicketEmbedFactory.createTicketCreatedEmbed(user, interaction.guild);
                const newWelcomeMsg = await interaction.channel.send({ embeds: [ticketEmbed], components: [closeButton] });

                await ticketService.updateWelcomeMessageId(interaction.channel.id, newWelcomeMsg.id);
            }

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '✅ Ticket ré-ouvert avec succès.',
                    components: []
                });
            } else {
                await interaction.reply({
                    content: '✅ Ticket ré-ouvert avec succès.',
                    ephemeral: true
                });
            }
        } catch (error) {
            logger.error('Failed to reopen ticket via button', error);
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ Échec de la réouverture du ticket.'
                }).catch((error) => {
                    logger.debug('Failed to edit reply after ticket reopen error', error);
                });
            } else {
                await interaction.reply({
                    content: '❌ Échec de la réouverture du ticket.',
                    ephemeral: true
                }).catch((error) => {
                    logger.debug('Failed to reply after ticket reopen error', error);
                });
            }
        }
    }

    async handleDelete(interaction) {
        try {
            const ticket = await ticketService.getTicketByChannel(interaction.channel.id);

            if (!ticket) {
                return interaction.reply({
                    content: '❌ Ce canal n\'est pas un ticket.',
                    ephemeral: true
                });
            }


            const member = await CacheHelpers.getMember(interaction.guild, interaction.user.id, 2 * 60 * 1000).catch(() => null);
            if (!member) {
                return interaction.reply({
                    content: '❌ Impossible de vérifier vos permissions.',
                    ephemeral: true
                });
            }


            const isCreator = ticket.user_id === interaction.user.id;


            const channel = interaction.channel;
            const hasAccess = channel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel);


            let isStaff = false;
            if (config.tickets.staffRoleId) {
                isStaff = member.roles.cache.has(String(config.tickets.staffRoleId));
            }

            if (!isCreator && !hasAccess && !isStaff) {
                return interaction.reply({
                    content: '❌ Vous n\'avez pas accès à ce ticket.',
                    ephemeral: true
                });
            }


            if (interaction.customId !== 'ticket_delete_confirm') {
                const confirmEmbed = TicketEmbedFactory.createDeleteConfirmationEmbed(interaction.guild);
                const confirmRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_delete_confirm')
                            .setLabel('Confirmer la suppression')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🗑️'),
                        new ButtonBuilder()
                            .setCustomId('ticket_delete_cancel')
                            .setLabel('Annuler')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('❌')
                    );

                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply({
                        embeds: [confirmEmbed],
                        components: [confirmRow]
                    });
                } else {
                    return interaction.reply({
                        embeds: [confirmEmbed],
                        components: [confirmRow],
                        ephemeral: false
                    });
                }
            }


            await ticketService.deleteTicket(interaction.channel.id);
            const embed = TicketEmbedFactory.createTicketDeletedEmbed(interaction.guild);


            try {
                if (interaction.message) {
                    await interaction.message.delete();
                }
            } catch (error) {
                logger.debug('Failed to delete message on ticket delete', error);
            }


            await interaction.channel.send({ embeds: [embed] });

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '✅ Ticket supprimé. Le canal sera supprimé dans quelques secondes.',
                    components: []
                });
            } else {
                await interaction.reply({
                    content: '✅ Ticket supprimé. Le canal sera supprimé dans quelques secondes.',
                    ephemeral: true
                });
            }


            const deleteDelay = config.tickets.deleteDelay ?
                (typeof config.tickets.deleteDelay === 'string' ?
                    require('../utils/helpers').convertDurationToMs(config.tickets.deleteDelay) :
                    config.tickets.deleteDelay) : 5000;

            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (error) {
                    logger.error('Failed to delete ticket channel', error);
                }
            }, deleteDelay);
        } catch (error) {
            logger.error('Failed to delete ticket via button', error);
            await interaction.reply({
                content: '❌ Échec de la suppression du ticket.',
                ephemeral: true
            }).catch((error) => {
                logger.debug('Failed to reply after ticket delete error', error);
            });
        }
    }
    async handleTranscribe(interaction) {
        try {
            const ticket = await ticketService.getTicketByChannel(interaction.channel.id);

            if (!ticket) {
                if (interaction.deferred) {
                    return interaction.editReply({
                        content: '❌ Ce canal n\'est pas un ticket.'
                    });
                }
                return interaction.reply({
                    content: '❌ Ce canal n\'est pas un ticket.',
                    ephemeral: true
                });
            }

            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }

            const messagesCollection = await interaction.channel.messages.fetch({ limit: 100 });


            const transcriptId = crypto.randomUUID();
            const storageDir = path.resolve(__dirname, '../../data/transcripts', transcriptId);

            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }

            const rawMessages = Array.from(messagesCollection.values()).reverse();
            const messages = [];

            for (const msg of rawMessages) {
                const processedAttachments = [];

                if (msg.attachments && msg.attachments.size > 0) {
                    for (const att of msg.attachments.values()) {
                        const attachment = {
                            url: att.url,
                            name: att.name,
                            contentType: att.contentType,
                            height: att.height,
                            width: att.width,
                            proxyURL: att.proxyURL
                        };
                        try {
                            const response = await axios.get(att.url, { responseType: 'arraybuffer' });
                            const fileName = att.name || 'file';
                            const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
                            const filePath = path.join(storageDir, safeName);
                            fs.writeFileSync(filePath, response.data);
                            attachment.url = `/transcripts-files/${transcriptId}/${safeName}`;
                        } catch (e) {
                            logger.error(`DL Error: ${e.message}`);
                        }
                        processedAttachments.push(attachment);
                    }
                }


                const linkReqs = (msg.content.match(/(https?:\/\/[^\s]+)/g) || []).map(async (link) => {
                    if (link.includes('tenor.com/view/')) {
                        try {
                            const html = await axios.get(link);
                            const $ = cheerio.load(html.data);
                            const mediaUrl = $('meta[property="og:video"]').attr('content') ||
                                $('meta[property="og:image"]').attr('content');
                            if (mediaUrl) {
                                const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
                                let ext = 'mp4';
                                if (mediaUrl.includes('.gif')) ext = 'gif';
                                const fileName = `tenor_${crypto.randomUUID().substring(0, 8)}.${ext}`;
                                const filePath = path.join(storageDir, fileName);
                                fs.writeFileSync(filePath, mediaResponse.data);
                                return {
                                    original_url: link,
                                    local_url: `/transcripts-files/${transcriptId}/${fileName}`,
                                    type: ext === 'mp4' ? 'video/mp4' : 'image/gif'
                                };
                            }
                        } catch (e) { /* ignore */ }
                    }
                    return null;
                });

                const previews = (await Promise.all(linkReqs)).filter(p => p !== null);


                let content = msg.content;

                content = content.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL REDACTED]');

                content = content.replace(/[a-zA-Z0-9_\-]{24,26}\.[a-zA-Z0-9_\-]{6}\.[a-zA-Z0-9_\-]{27,38}/g, '[TOKEN REDACTED]');

                content = content.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP REDACTED]');

                messages.push({
                    author: {
                        id: msg.author.id,
                        username: msg.author.username,
                        avatar: msg.author.avatar,
                        bot: msg.author.bot
                    },
                    content: content,
                    timestamp: msg.createdTimestamp,
                    embeds: msg.embeds,
                    attachments: processedAttachments,
                    previews: previews
                });
            }


            await query(
                'INSERT INTO ticket_transcripts (ticket_id, channel_name, closed_by, messages) VALUES (?, ?, ?, ?)',
                [transcriptId, interaction.channel.name, interaction.user.username, JSON.stringify(messages)]
            );
            const transcriptUrl = `${DASHBOARD_URL}/transcript.html?id=${transcriptId}`;
            logger.info(`Transcript generated for ticket ${interaction.channel.id}: ${transcriptUrl}`);


            const transcriptChannelId = config.tickets.transcriptChannelId;
            let logSuccess = false;

            if (transcriptChannelId) {
                try {
                    const transcriptChannel = await CacheHelpers.getChannel(interaction.client, transcriptChannelId);
                    if (transcriptChannel) {

                        let realAttachmentsCount = 0;
                        const usersInTranscript = new Map();

                        messagesCollection.forEach(msg => {
                            if (msg.attachments.size > 0) realAttachmentsCount += msg.attachments.size;

                            const authorTag = msg.author.tag || `${msg.author.username}#${msg.author.discriminator || '0'}`;
                            if (!usersInTranscript.has(msg.author.id)) {
                                usersInTranscript.set(msg.author.id, `<@${msg.author.id}> - ${authorTag}`);
                            }
                        });

                        const user = await CacheHelpers.getUser(interaction.client, ticket.user_id).catch(() => ({ id: ticket.user_id, tag: 'Unknown' }));
                        const infoEmbed = TicketEmbedFactory.createTranscriptInfoEmbed(
                            ticket,
                            interaction.guild,
                            interaction.channel,
                            messages.length,
                            realAttachmentsCount,
                            Array.from(usersInTranscript.values())
                        );

                        if (user.avatarURL) {
                            infoEmbed.setThumbnail(user.avatarURL({ dynamic: true }));
                        }

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('Voir le transcript')
                                .setStyle(ButtonStyle.Link)
                                .setURL(transcriptUrl)
                                .setEmoji('📄')
                        );

                        await transcriptChannel.send({ embeds: [infoEmbed], components: [row] });
                        logSuccess = true;
                    }
                } catch (error) {
                    logger.error('Failed to send transcript to log channel', error);
                }
            }

            const responseContent = logSuccess
                ? `✅ Transcript généré et envoyé dans le canal de logs (<#${transcriptChannelId}>).`
                : `✅ Transcript généré : ${transcriptUrl}`;

            await interaction.editReply({ content: responseContent });
        } catch (error) {
            logger.error('Failed to transcribe ticket', error);
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ Échec de la génération du transcript.'
                }).catch((error) => {
                    logger.debug('Failed to edit reply after transcript error', error);
                });
            } else {
                await interaction.reply({
                    content: '❌ Échec de la génération du transcript.',
                    ephemeral: true
                }).catch((error) => {
                    logger.debug('Failed to reply after transcript error', error);
                });
            }
        }
    }

    async handleEditInfo(interaction) {
        try {
            const ticket = await ticketService.getTicketByChannel(interaction.channel.id);
            if (!ticket) {
                return interaction.reply({ content: '❌ Ce canal n\'est pas un ticket.', ephemeral: true });
            }

            if (ticket.status === 'closed') {
                return interaction.reply({ content: '❌ Ce ticket est fermé. Vous ne pouvez pas modifier les informations.', ephemeral: true });
            }


            let categoryKey = null;
            if (ticket.ticket_id) {

                const categories = loadTicketConfig();
                for (const cat of categories) {
                    if (ticket.ticket_id.startsWith(`${cat.key}-`)) {
                        categoryKey = cat.key;
                        break;
                    }
                }
            }

            if (!categoryKey) {
                categoryKey = 'connexion';
            }

            const categories = loadTicketConfig();
            const categoryConfig = categories.find(c => c.key === categoryKey);
            const inputs = categoryConfig?.inputs || [];

            if (inputs.length === 0) {
                return interaction.reply({ content: '❌ Aucune information à modifier pour ce type de ticket.', ephemeral: true });
            }


            let currentData = {};
            try {
                const embed = interaction.message.embeds[0];
                if (embed && embed.fields) {
                    for (const field of embed.fields) {

                        const cleanValue = field.value.replace(/\*\*/g, '');
                        currentData[field.name] = cleanValue;
                    }
                }
            } catch (e) {
                logger.warn('Failed to parse existing ticket info', e);
            }

            const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
            const modal = new ModalBuilder()
                .setCustomId(`ticket_modal_edit_${categoryKey}`)
                .setTitle('Modifier les informations');

            for (const input of inputs) {
                if (input.type === 'text') {
                    const style = input.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short;
                    const textInput = new TextInputBuilder()
                        .setCustomId(`ticket_field_${input.id}`)
                        .setLabel(input.label)
                        .setStyle(style)
                        .setRequired(input.required !== false)
                        .setPlaceholder(input.placeholder || '');

                    if (currentData[input.label]) {
                        textInput.setValue(currentData[input.label]);
                    }

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
                                emoji: opt.emoji ? (typeof opt.emoji === 'string' ? { name: opt.emoji } : opt.emoji) : undefined,
                                default: currentData[input.label] === opt.value
                            }))
                        }
                    };
                    modal.addComponents(selectComponent);
                }
            }

            await interaction.showModal(modal);

        } catch (error) {
            logger.error('Failed to handle modify info', error);
            await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
        }
    }

    async handleEditInfoSubmit(interaction) {
        try {
            const ticket = await ticketService.getTicketByChannel(interaction.channel.id);
            if (!ticket) return;


            const suffix = interaction.customId.replace('ticket_modal_edit_', '');
            const categoryKey = suffix;

            const categories = loadTicketConfig();
            const categoryConfig = categories.find(c => c.key === categoryKey);
            const inputs = categoryConfig?.inputs || [];

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
                    } catch (e) { }
                } else if (input.type === 'select') {
                    value = checkPlatformSelect(fieldId);
                }

                if (value) {
                    formData[input.label] = value;
                }
            }


            const messages = await interaction.channel.messages.fetch({ limit: 20 });
            const infoMsg = messages.find(m =>
                m.author.id === interaction.client.user.id &&
                m.components.length > 0 &&
                m.components[0].components.some(c => c.customId === 'ticket_edit_info')
            );

            if (infoMsg) {
                const embed = TicketEmbedFactory.createTicketDetailsEmbed(formData, interaction.guild);

                const infoRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_edit_info')
                            .setLabel('Modifier les infos')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('✏️')
                    );

                await infoMsg.edit({ embeds: [embed], components: [infoRow] });
            } else {
                logger.warn('Could not find ticket info message to update');
            }

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '✅ Informations mises à jour.', ephemeral: true });
            } else {
                await interaction.reply({ content: '✅ Informations mises à jour.', ephemeral: true });
            }

        } catch (error) {
            logger.error('Failed to submit edited info', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ Échec de la mise à jour.', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Échec de la mise à jour.', ephemeral: true });
            }
        }
    }





    async handleQuickClose(interaction) {
        try {
            const ticket = await ticketService.getTicketByChannel(interaction.channel.id);
            if (!ticket) {
                return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });
            }



            await interaction.deferReply();
            await ticketService.closeTicket(interaction.channel.id, interaction.user.id);



            await interaction.editReply({ content: '🔒 Fermeture et transcription en cours...' });


            await this.handleTranscribe(interaction, true);


            if (ticket.user_id) {
                try {
                    const user = await this.client.users.fetch(ticket.user_id);
                } catch (e) {
                    logger.warn(`Could not send feedback request to ${ticket.user_id}`, e);
                }
            }


            await interaction.channel.send('🗑️ Suppression du ticket dans 5 secondes...');
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (e) {
                    logger.error('Failed to delete channel in quick close', e);
                }
            }, 5000);

        } catch (error) {
            logger.error('Quick Close Error', error);
            await interaction.editReply({ content: '❌ Erreur lors de la fermeture rapide.' });
        }
    }

    async sendFeedbackRequest(user, ticket) {
        try {
            const { EmbedBuilder } = require('discord.js');
            const feedbackEmbed = new EmbedBuilder()
                .setTitle('📝 Votre avis nous intéresse !')
                .setDescription(`Votre ticket **${ticket.channel_name || 'Support'}** vient d'être fermé.\nMerci de noter votre expérience avec notre équipe.`)
                .setColor('#f1c40f')
                .setFooter({ text: 'Serenity Craft Support' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`feedback_rating_1_${ticket.ticket_id}`).setLabel('1 ⭐').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`feedback_rating_2_${ticket.ticket_id}`).setLabel('2 ⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`feedback_rating_3_${ticket.ticket_id}`).setLabel('3 ⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`feedback_rating_4_${ticket.ticket_id}`).setLabel('4 ⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`feedback_rating_5_${ticket.ticket_id}`).setLabel('5 ⭐').setStyle(ButtonStyle.Success)
                );

            await user.send({ embeds: [feedbackEmbed], components: [row] });
            logger.info(`Feedback request sent to ${user.tag}`);
        } catch (error) {
            logger.warn(`Failed to send DM to ${user.tag}: ${error.message}`);
        }
    }

    async handleFeedback(interaction) {
        try {
            await interaction.deferUpdate();


            const parts = interaction.customId.split('_');
            const score = parseInt(parts[2]);
            const ticketId = parts.slice(3).join('_');

            if (score && ticketId) {


                await query('UPDATE tickets SET rating = ? WHERE ticket_id = ?', [score, ticketId]);


                const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
                disabledRow.components.forEach(btn => btn.setDisabled(true));

                await interaction.editReply({
                    content: `Merci pour votre note de ${score}/5 ! ⭐`,
                    components: [disabledRow],
                    embeds: interaction.message.embeds
                });



            }
        } catch (error) {
            logger.error('Feedback Handle Error', error);
        }
    }
}

module.exports = TicketHandler;