const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelType,
    EmbedBuilder
} = require('discord.js');
const ticketService = require('../../services/ticket.service');
const TicketEmbedFactory = require('../../utils/ticket-embeds');
const { EMBED_COLORS } = require('../../utils/constants');
const logger = require('../../utils/logger');
const { loadTicketConfig } = require('../../utils/yaml-loader');
const { setServerFooter } = require('../../utils/embed-helper');

const createErrorEmbed = (message, guild = null) => {
    const embed = new EmbedBuilder()
        .setTitle('❌ Erreur')
        .setDescription(message)
        .setColor(EMBED_COLORS.ERROR)
        .setTimestamp();
    setServerFooter(embed, guild);
    return embed;
};

const createSuccessEmbed = (message, guild = null) => {
    const embed = new EmbedBuilder()
        .setTitle('✅ Succès')
        .setDescription(message)
        .setColor(EMBED_COLORS.SUCCESS)
        .setTimestamp();
    setServerFooter(embed, guild);
    return embed;
};

const command = new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Gestion du système de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

command.addSubcommand(subcommand =>
    subcommand
        .setName('setup')
        .setDescription('Créer le panneau de création de tickets')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Canal où créer le panneau')
                .setRequired(false)
        )
        .addChannelOption(option =>
            option
                .setName('category')
                .setDescription('Catégorie pour les nouveaux tickets')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildCategory)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('setcategory')
        .setDescription('Changer la catégorie d\'un ticket')
        .addStringOption(option =>
            option
                .setName('category')
                .setDescription('Nouvelle catégorie')
                .setRequired(true)
                .addChoices(
                    ...loadTicketConfig().map(cat => ({ name: cat.name, value: cat.key })).slice(0, 25)
                )
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('setowner')
        .setDescription('Changer le propriétaire du ticket')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Nouveau propriétaire')
                .setRequired(true)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('close')
        .setDescription('Fermer un ticket')
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('reopen')
        .setDescription('Ré-ouvrir un ticket')
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('delete')
        .setDescription('Supprimer un ticket')
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('info')
        .setDescription('Informations sur le ticket actuel')
);

command.addSubcommandGroup(group =>
    group
        .setName('blacklist')
        .setDescription('Gérer la liste noire des tickets')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Ajouter un utilisateur à la liste noire')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Utilisateur à bannir des tickets')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Raison du bannissement')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Retirer un utilisateur de la liste noire')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Utilisateur à débannir des tickets')
                        .setRequired(true)
                )
        )
);

const createTicketPanel = async (channel, categoryId = null) => {

    const categories = loadTicketConfig();

    if (categories.length === 0) {
        throw new Error('Aucune catégorie de ticket configurée. Veuillez configurer discordconfig.yml');
    }


    const embed = TicketEmbedFactory.createPanelEmbed(channel.guild);


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
        throw new Error('Aucune catégorie de ticket valide configurée. Le menu de sélection nécessite au moins une catégorie.');
    }

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const message = await channel.send({ embeds: [embed], components: [row] });

    await ticketService.createPanel(channel.guild.id, channel.id, message.id, categoryId);

    return message;
};

const handleSetup = async (interaction) => {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const category = interaction.options.getChannel('category');

    if (channel.type !== ChannelType.GuildText) {
        return interaction.editReply({
            embeds: [createErrorEmbed('Le canal doit être un canal texte.', interaction.guild)]
        });
    }

    try {


        await createTicketPanel(channel, null);
        await interaction.editReply({
            embeds: [createSuccessEmbed(`Panneau de tickets créé dans ${channel}!`, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to create ticket panel', error);
        await interaction.editReply({
            embeds: [createErrorEmbed('Échec de la création du panneau.', interaction.guild)]
        });
    }
};

const handleClose = async (interaction) => {
    const ticket = await ticketService.getTicketByChannel(interaction.channel.id);

    if (!ticket) {
        return interaction.editReply({
            embeds: [createErrorEmbed('Ce canal n\'est pas un ticket.', interaction.guild)]
        });
    }

    if (ticket.status === 'closed') {
        return interaction.editReply({
            embeds: [createErrorEmbed('Ce ticket est déjà fermé.', interaction.guild)]
        });
    }

    try {
        await ticketService.closeTicket(interaction.channel.id, interaction.user.id);
        const embed = TicketEmbedFactory.createTicketClosedEmbed(interaction.user, interaction.guild);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_reopen')
                    .setLabel('Ré-ouvrir le ticket')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔓')
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.editReply({
            embeds: [createSuccessEmbed('Ticket fermé avec succès.', interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to close ticket', error);
        await interaction.editReply({
            embeds: [createErrorEmbed('Échec de la fermeture du ticket.', interaction.guild)]
        });
    }
};

const handleReopen = async (interaction) => {
    const ticket = await ticketService.getTicketByChannel(interaction.channel.id);

    if (!ticket) {
        return interaction.editReply({
            embeds: [createErrorEmbed('Ce canal n\'est pas un ticket.', interaction.guild)]
        });
    }

    if (ticket.status !== 'closed') {
        return interaction.editReply({
            embeds: [createErrorEmbed('Ce ticket n\'est pas fermé.', interaction.guild)]
        });
    }

    try {
        await ticketService.reopenTicket(interaction.channel.id);
        const embed = TicketEmbedFactory.createTicketReopenedEmbed(interaction.guild);
        await interaction.channel.send({ embeds: [embed] });
        await interaction.editReply({
            embeds: [createSuccessEmbed('Ticket ré-ouvert avec succès.', interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to reopen ticket', error);
        await interaction.editReply({
            embeds: [createErrorEmbed('Échec de la réouverture du ticket.', interaction.guild)]
        });
    }
};

const handleDelete = async (interaction) => {
    const ticket = await ticketService.getTicketByChannel(interaction.channel.id);

    if (!ticket) {
        return interaction.editReply({
            embeds: [createErrorEmbed('Ce canal n\'est pas un ticket.', interaction.guild)]
        });
    }

    try {
        await ticketService.deleteTicket(interaction.channel.id);
        const embed = TicketEmbedFactory.createTicketDeletedEmbed(interaction.guild);
        await interaction.channel.send({ embeds: [embed] });

        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (error) {
                logger.error('Failed to delete ticket channel', error);
            }
        }, 5000);

        await interaction.editReply({
            embeds: [createSuccessEmbed('Ticket supprimé. Le canal sera supprimé dans 5 secondes.', interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to delete ticket', error);
        await interaction.editReply({
            embeds: [createErrorEmbed('Échec de la suppression du ticket.', interaction.guild)]
        });
    }
};

const handleInfo = async (interaction) => {
    const ticket = await ticketService.getTicketByChannel(interaction.channel.id);

    if (!ticket) {
        return interaction.editReply({
            embeds: [createErrorEmbed('Ce canal n\'est pas un ticket.', interaction.guild)]
        });
    }

    try {
        const { CacheHelpers } = require('../../utils/discord-cache');
        const user = await CacheHelpers.getUser(interaction.client, ticket.user_id, 5 * 60 * 1000).catch(() => null);
        const embed = TicketEmbedFactory.createTicketInfoEmbed(ticket, user, interaction.guild);
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.error('Failed to get ticket info', error);
        await interaction.editReply({
            embeds: [createErrorEmbed('Échec de la récupération des informations.', interaction.guild)]
        });
    }
};

const handleSetCategory = async (interaction) => {
    const ticket = await ticketService.getTicketByChannel(interaction.channel.id);

    if (!ticket) {
        return interaction.editReply({
            embeds: [createErrorEmbed('Ce canal n\'est pas un ticket.', interaction.guild)]
        });
    }

    const categoryKey = interaction.options.getString('category');
    const categories = loadTicketConfig();
    const categoryConfig = categories.find(c => c.key === categoryKey);

    if (!categoryConfig) {
        return interaction.editReply({
            embeds: [createErrorEmbed('Catégorie introuvable.', interaction.guild)]
        });
    }

    try {
        await interaction.channel.setParent(categoryConfig.categoryId, { lockPermissions: false });

        let suffix = interaction.channel.name.split('-').slice(1).join('-');


        if (!suffix || suffix.trim() === '') {
            try {
                const member = await interaction.guild.members.fetch(ticket.user_id).catch(() => null);
                if (member) {
                    suffix = member.user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '').substring(0, 20);
                }
            } catch (e) {

                suffix = 'ticket';
            }
        } else {





            try {
                const member = await interaction.guild.members.fetch(ticket.user_id).catch(() => null);
                if (member) {
                    suffix = member.user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '').substring(0, 15);
                }
            } catch (e) {






                const parts = interaction.channel.name.split('-');
                if (parts.length >= 2) {
                    suffix = parts[parts.length - 1];
                }
            }
        }


        let categoryEmoji = '';
        if (categoryConfig.name) {
            const emojiMatch = categoryConfig.name.match(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}]+/u);
            if (emojiMatch) {
                categoryEmoji = emojiMatch[0];
            }
        }

        const newName = categoryEmoji ? `${categoryEmoji}-${categoryConfig.key}-${suffix}` : `${categoryConfig.key}-${suffix}`;
        await interaction.channel.setName(newName);

        await interaction.editReply({
            embeds: [createSuccessEmbed(`Ticket déplacé vers la catégorie **${categoryConfig.name}**.`, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to set ticket category', error);
        await interaction.editReply({
            embeds: [createErrorEmbed('Échec du déplacement du ticket.', interaction.guild)]
        });
    }
};

const handleSetOwner = async (interaction) => {
    const ticket = await ticketService.getTicketByChannel(interaction.channel.id);

    if (!ticket) {
        return interaction.editReply({
            embeds: [createErrorEmbed('Ce canal n\'est pas un ticket.', interaction.guild)]
        });
    }

    const newUser = interaction.options.getUser('user');

    if (newUser.bot) {
        return interaction.editReply({
            embeds: [createErrorEmbed('Un bot ne peut pas être propriétaire d\'un ticket.', interaction.guild)]
        });
    }

    if (newUser.id === ticket.user_id) {
        return interaction.editReply({
            embeds: [createErrorEmbed('Cet utilisateur est déjà le propriétaire du ticket.', interaction.guild)]
        });
    }

    try {

        await ticketService.transferTicket(interaction.channel.id, newUser.id);


        await interaction.channel.permissionOverwrites.edit(ticket.user_id, {
            ViewChannel: false,
            SendMessages: false,
            ReadMessageHistory: false
        });

        await interaction.channel.permissionOverwrites.edit(newUser.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });




        const parts = interaction.channel.name.split('-');
        let prefix = parts.slice(0, parts.length - 1).join('-');



        const newSuffix = newUser.username.toLowerCase().replace(/[^a-z0-9_-]/g, '').substring(0, 15);

        let newName;
        if (prefix) {
            newName = `${prefix}-${newSuffix}`;
        } else {

            newName = `ticket-${newSuffix}`;
        }

        await interaction.channel.setName(newName);

        await interaction.editReply({
            embeds: [createSuccessEmbed(`Propriétaire du ticket changé pour ${newUser}.`, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to set ticket owner', error);
        await interaction.editReply({
            embeds: [createErrorEmbed('Échec du changement de propriétaire.', interaction.guild)]
        });
    }
};

const handleBlacklist = async (interaction) => {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');

    if (subcommand === 'add') {
        const reason = interaction.options.getString('reason') || 'Aucune raison fournie';
        try {
            await ticketService.blacklistUser(interaction.guild.id, user.id, interaction.user.id, reason);
            await interaction.editReply({
                embeds: [createSuccessEmbed(`${user} a été ajouté à la liste noire des tickets.\nRaison: ${reason}`, interaction.guild)]
            });
        } catch (error) {
            logger.error('Failed to blacklist user', error);
            await interaction.editReply({
                embeds: [createErrorEmbed(`Échec de l'ajout de ${user} à la liste noire.`, interaction.guild)]
            });
        }
    } else if (subcommand === 'remove') {
        try {
            const isBlacklisted = await ticketService.isUserBlacklisted(interaction.guild.id, user.id);
            if (!isBlacklisted) {
                return interaction.editReply({
                    embeds: [createErrorEmbed(`${user} n'est pas dans la liste noire.`, interaction.guild)]
                });
            }

            await ticketService.unblacklistUser(interaction.guild.id, user.id);
            await interaction.editReply({
                embeds: [createSuccessEmbed(`${user} a été retiré de la liste noire des tickets.`, interaction.guild)]
            });
        } catch (error) {
            logger.error('Failed to unblacklist user', error);
            await interaction.editReply({
                embeds: [createErrorEmbed(`Échec du retrait de ${user} de la liste noire.`, interaction.guild)]
            });
        }
    }
};

module.exports = {
    data: command,
    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'setup':
                    await handleSetup(interaction);
                    break;
                case 'close':
                    await handleClose(interaction);
                    break;
                case 'reopen':
                    await handleReopen(interaction);
                    break;
                case 'delete':
                    await handleDelete(interaction);
                    break;
                case 'info':
                    await handleInfo(interaction);
                    break;
                case 'setcategory':
                    await handleSetCategory(interaction);
                    break;
                case 'setowner':
                    await handleSetOwner(interaction);
                    break;
                default:

                    const group = interaction.options.getSubcommandGroup(false);
                    if (group === 'blacklist') {
                        await handleBlacklist(interaction);
                    } else {
                        await interaction.editReply({
                            embeds: [createErrorEmbed('Sous-commande inconnue!', interaction.guild)]
                        });
                    }
            }
        } catch (error) {
            logger.error('Error in ticket command', error);
            await interaction.editReply({
                embeds: [createErrorEmbed('Une erreur est survenue lors de l\'exécution de la commande!', interaction.guild)]
            });
        }
    }
};