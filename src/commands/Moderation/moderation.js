const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require('discord.js');
const moderationService = require('../../services/moderation.service');
const ModerationEmbedFactory = require('../../utils/moderation-embeds');
const { parseDuration } = require('../../utils/helpers');
const { MOD_ACTION } = require('../../utils/constants');
const { CacheHelpers } = require('../../utils/discord-cache');
const { setServerFooter } = require('../../utils/embed-helper');
const config = require('../../config');
const logger = require('../../utils/logger');

const command = new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Commandes de modération')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.ManageMessages);

command.addSubcommand(subcommand =>
    subcommand
        .setName('ban')
        .setDescription('Bannir un utilisateur')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur à bannir')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Raison du bannissement')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('duration')
                .setDescription('Durée (optionnel, ex: 7d)')
                .setRequired(false)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('kick')
        .setDescription('Expulser un utilisateur')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur à expulser')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Raison de l\'expulsion')
                .setRequired(false)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('mute')
        .setDescription('Muter un utilisateur')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur à muter')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('duration')
                .setDescription('Durée (ex: 1h, 30m, 2d)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Raison du mute')
                .setRequired(false)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('timeout')
        .setDescription('Mettre un utilisateur en timeout')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur à mettre en timeout')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('duration')
                .setDescription('Durée (ex: 1h, 30m, 2d)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Raison du timeout')
                .setRequired(false)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('warn')
        .setDescription('Avertir un utilisateur')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur à avertir')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Raison de l\'avertissement')
                .setRequired(false)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('unban')
        .setDescription('Débannir un utilisateur')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur à débannir')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Raison du débannissement')
                .setRequired(false)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('unmute')
        .setDescription('Démuter un utilisateur')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur à démuter')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Raison du démute')
                .setRequired(false)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('untimeout')
        .setDescription('Retirer le timeout d\'un utilisateur')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Raison')
                .setRequired(false)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('logs')
        .setDescription('Voir les logs de modération d\'un utilisateur')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('page')
                .setDescription('Page (défaut: 1)')
                .setRequired(false)
                .setMinValue(1)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('deletelog')
        .setDescription('Supprimer un log de modération')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('log_id')
                .setDescription('ID du log à supprimer')
                .setRequired(true)
                .setMinValue(1)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('purge')
        .setDescription('Supprimer un certain nombre de messages')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Nombre de messages à supprimer (max 100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Canal où supprimer les messages (par défaut: canal actuel)')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildPublicThread, ChannelType.GuildPrivateThread)
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Filtrer par utilisateur (optionnel)')
                .setRequired(false)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('move')
        .setDescription('Déplacer un utilisateur vers un autre canal vocal')
        .addStringOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur à déplacer (uniquement ceux en vocal)')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option
                .setName('channel')
                .setDescription('Canal vocal de destination')
                .setRequired(true)
                .setAutocomplete(true)
        )
);


const sendDM = async (user, embed) => {
    try {
        await user.send({ embeds: [embed] });
        return true;
    } catch (error) {
        logger.warn(`Failed to send DM to user ${user.id}:`, error.message);
        return false;
    }
};

const sendToLogChannel = async (client, guildId, embed) => {
    try {
        const logChannelId = config.moderation.logChannelId;
        if (!logChannelId) {
            logger.warn('No mod log channel configured');
            return false;
        }

        const channel = await CacheHelpers.getChannel(client, logChannelId, 10 * 60 * 1000).catch(() => null);
        if (!channel) {
            logger.warn(`Mod log channel ${logChannelId} not found`);
            return false;
        }

        await channel.send({ embeds: [embed] });
        return true;
    } catch (error) {
        logger.error('Failed to send to log channel', error);
        return false;
    }
};

const checkHierarchy = (moderator, target, guild) => {
    if (guild.ownerId === target.id) return false;
    if (guild.ownerId === moderator.id) return true;

    const moderatorRole = moderator.roles.highest;
    const targetRole = target.roles.highest;

    return moderatorRole.position > targetRole.position;
};

const handleBan = async (interaction, client) => {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';
    const durationStr = interaction.options.getString('duration');

    const member = await CacheHelpers.getMember(interaction.guild, user.id, 2 * 60 * 1000).catch(() => null);
    if (!member) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Utilisateur introuvable sur ce serveur.', interaction.guild)]
        });
    }

    if (!checkHierarchy(interaction.member, member, interaction.guild)) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Vous ne pouvez pas modérer cet utilisateur (hiérarchie des rôles).', interaction.guild)]
        });
    }

    if (member.bannable === false) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Je ne peux pas bannir cet utilisateur.', interaction.guild)]
        });
    }

    try {
        await member.ban({ reason, deleteMessageDays: 0 });

        const logId = await moderationService.logAction(
            interaction.guild.id,
            user.id,
            interaction.user.id,
            MOD_ACTION.BAN,
            reason,
            durationStr ? parseDuration(durationStr) : null
        );

        const embed = ModerationEmbedFactory.createActionEmbed(
            MOD_ACTION.BAN,
            user,
            interaction.user,
            reason,
            durationStr ? parseDuration(durationStr) : null,
            logId,
            interaction.guild
        );

        const dmEmbed = ModerationEmbedFactory.createDMActionEmbed(
            MOD_ACTION.BAN,
            interaction.guild,
            interaction.user,
            reason,
            durationStr ? parseDuration(durationStr) : null
        );

        await sendDM(user, dmEmbed);
        await sendToLogChannel(client, interaction.guild.id, embed);

        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createSuccessEmbed(MOD_ACTION.BAN, user, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to ban user', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Échec du bannissement.', interaction.guild)]
        });
    }
};

const handleKick = async (interaction, client) => {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    const member = await CacheHelpers.getMember(interaction.guild, user.id, 2 * 60 * 1000).catch(() => null);
    if (!member) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Utilisateur introuvable sur ce serveur.', interaction.guild)]
        });
    }

    if (!checkHierarchy(interaction.member, member, interaction.guild)) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Vous ne pouvez pas modérer cet utilisateur (hiérarchie des rôles).', interaction.guild)]
        });
    }

    if (member.kickable === false) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Je ne peux pas expulser cet utilisateur.', interaction.guild)]
        });
    }

    try {
        await member.kick(reason);

        const logId = await moderationService.logAction(
            interaction.guild.id,
            user.id,
            interaction.user.id,
            MOD_ACTION.KICK,
            reason
        );

        const embed = ModerationEmbedFactory.createActionEmbed(
            MOD_ACTION.KICK,
            user,
            interaction.user,
            reason,
            null,
            logId,
            interaction.guild
        );

        const dmEmbed = ModerationEmbedFactory.createDMActionEmbed(
            MOD_ACTION.KICK,
            interaction.guild,
            interaction.user,
            reason
        );

        await sendDM(user, dmEmbed);
        await sendToLogChannel(client, interaction.guild.id, embed);

        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createSuccessEmbed(MOD_ACTION.KICK, user, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to kick user', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Échec de l\'expulsion.', interaction.guild)]
        });
    }
};

const handleMute = async (interaction, client) => {
    const user = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    const duration = parseDuration(durationStr);
    if (!duration || duration < 60000) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Durée invalide! Utilisez: 1h, 30m, 2d, ou 1h30m (minimum 1 minute)', interaction.guild)]
        });
    }

    const member = await CacheHelpers.getMember(interaction.guild, user.id, 2 * 60 * 1000).catch(() => null);
    if (!member) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Utilisateur introuvable sur ce serveur.', interaction.guild)]
        });
    }

    if (!checkHierarchy(interaction.member, member, interaction.guild)) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Vous ne pouvez pas modérer cet utilisateur (hiérarchie des rôles).', interaction.guild)]
        });
    }

    if (member.manageable === false) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Je ne peux pas muter cet utilisateur.', interaction.guild)]
        });
    }

    try {
        await member.timeout(duration, reason);

        const logId = await moderationService.logAction(
            interaction.guild.id,
            user.id,
            interaction.user.id,
            MOD_ACTION.MUTE,
            reason,
            duration
        );

        const embed = ModerationEmbedFactory.createActionEmbed(
            MOD_ACTION.MUTE,
            user,
            interaction.user,
            reason,
            duration,
            logId,
            interaction.guild
        );

        const dmEmbed = ModerationEmbedFactory.createDMActionEmbed(
            MOD_ACTION.MUTE,
            interaction.guild,
            interaction.user,
            reason,
            duration
        );

        await sendDM(user, dmEmbed);
        await sendToLogChannel(client, interaction.guild.id, embed);

        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createSuccessEmbed(MOD_ACTION.MUTE, user, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to mute user', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Échec du mute.', interaction.guild)]
        });
    }
};

const handleTimeout = async (interaction, client) => {
    const user = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    const duration = parseDuration(durationStr);
    if (!duration || duration < 60000) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Durée invalide! Utilisez: 1h, 30m, 2d, ou 1h30m (minimum 1 minute)', interaction.guild)]
        });
    }

    const member = await CacheHelpers.getMember(interaction.guild, user.id, 2 * 60 * 1000).catch(() => null);
    if (!member) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Utilisateur introuvable sur ce serveur.', interaction.guild)]
        });
    }

    if (!checkHierarchy(interaction.member, member, interaction.guild)) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Vous ne pouvez pas modérer cet utilisateur (hiérarchie des rôles).', interaction.guild)]
        });
    }

    if (member.moderatable === false) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Je ne peux pas mettre cet utilisateur en timeout.', interaction.guild)]
        });
    }

    try {
        await member.timeout(duration, reason);

        const logId = await moderationService.logAction(
            interaction.guild.id,
            user.id,
            interaction.user.id,
            MOD_ACTION.TIMEOUT,
            reason,
            duration
        );

        const embed = ModerationEmbedFactory.createActionEmbed(
            MOD_ACTION.TIMEOUT,
            user,
            interaction.user,
            reason,
            duration,
            logId,
            interaction.guild
        );

        const dmEmbed = ModerationEmbedFactory.createDMActionEmbed(
            MOD_ACTION.TIMEOUT,
            interaction.guild,
            interaction.user,
            reason,
            duration
        );

        await sendDM(user, dmEmbed);
        await sendToLogChannel(client, interaction.guild.id, embed);

        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createSuccessEmbed(MOD_ACTION.TIMEOUT, user, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to timeout user', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Échec du timeout.', interaction.guild)]
        });
    }
};

const handleWarn = async (interaction, client) => {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    const member = await CacheHelpers.getMember(interaction.guild, user.id, 2 * 60 * 1000).catch(() => null);
    if (!member) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Utilisateur introuvable sur ce serveur.', interaction.guild)]
        });
    }

    try {
        const logId = await moderationService.logAction(
            interaction.guild.id,
            user.id,
            interaction.user.id,
            MOD_ACTION.WARN,
            reason
        );

        const embed = ModerationEmbedFactory.createActionEmbed(
            MOD_ACTION.WARN,
            user,
            interaction.user,
            reason,
            null,
            logId,
            interaction.guild
        );

        const dmEmbed = ModerationEmbedFactory.createDMActionEmbed(
            MOD_ACTION.WARN,
            interaction.guild,
            interaction.user,
            reason
        );

        await sendDM(user, dmEmbed);
        await sendToLogChannel(client, interaction.guild.id, embed);

        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createSuccessEmbed(MOD_ACTION.WARN, user, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to warn user', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Échec de l\'avertissement.', interaction.guild)]
        });
    }
};

const handleUnban = async (interaction, client) => {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    try {
        await interaction.guild.bans.remove(user.id, reason);

        const logId = await moderationService.logAction(
            interaction.guild.id,
            user.id,
            interaction.user.id,
            MOD_ACTION.UNBAN,
            reason
        );

        const embed = ModerationEmbedFactory.createActionEmbed(
            MOD_ACTION.UNBAN,
            user,
            interaction.user,
            reason,
            null,
            logId,
            interaction.guild
        );

        await sendToLogChannel(client, interaction.guild.id, embed);

        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createSuccessEmbed(MOD_ACTION.UNBAN, user, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to unban user', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Échec du débannissement. L\'utilisateur n\'est peut-être pas banni.', interaction.guild)]
        });
    }
};

const handleUnmute = async (interaction, client) => {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    const member = await CacheHelpers.getMember(interaction.guild, user.id, 2 * 60 * 1000).catch(() => null);
    if (!member) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Utilisateur introuvable sur ce serveur.', interaction.guild)]
        });
    }

    if (!member.communicationDisabledUntil) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Cet utilisateur n\'est pas muté.', interaction.guild)]
        });
    }

    try {
        await member.timeout(null, reason);

        const logId = await moderationService.logAction(
            interaction.guild.id,
            user.id,
            interaction.user.id,
            MOD_ACTION.UNMUTE,
            reason
        );

        const embed = ModerationEmbedFactory.createActionEmbed(
            MOD_ACTION.UNMUTE,
            user,
            interaction.user,
            reason,
            null,
            logId,
            interaction.guild
        );

        const dmEmbed = ModerationEmbedFactory.createDMActionEmbed(
            MOD_ACTION.UNMUTE,
            interaction.guild,
            interaction.user,
            reason
        );

        await sendDM(user, dmEmbed);
        await sendToLogChannel(client, interaction.guild.id, embed);

        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createSuccessEmbed(MOD_ACTION.UNMUTE, user, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to unmute user', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Échec du démute.', interaction.guild)]
        });
    }
};

const handleUntimeout = async (interaction, client) => {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    const member = await CacheHelpers.getMember(interaction.guild, user.id, 2 * 60 * 1000).catch(() => null);
    if (!member) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Utilisateur introuvable sur ce serveur.', interaction.guild)]
        });
    }

    if (!member.communicationDisabledUntil) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Cet utilisateur n\'est pas en timeout.', interaction.guild)]
        });
    }

    try {
        await member.timeout(null, reason);

        const logId = await moderationService.logAction(
            interaction.guild.id,
            user.id,
            interaction.user.id,
            MOD_ACTION.UNTIMEOUT,
            reason
        );

        const embed = ModerationEmbedFactory.createActionEmbed(
            MOD_ACTION.UNTIMEOUT,
            user,
            interaction.user,
            reason,
            null,
            logId,
            interaction.guild
        );

        const dmEmbed = ModerationEmbedFactory.createDMActionEmbed(
            MOD_ACTION.UNTIMEOUT,
            interaction.guild,
            interaction.user,
            reason
        );

        await sendDM(user, dmEmbed);
        await sendToLogChannel(client, interaction.guild.id, embed);

        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createSuccessEmbed(MOD_ACTION.UNTIMEOUT, user, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to untimeout user', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Échec de la suppression du timeout.', interaction.guild)]
        });
    }
};

const handleLogs = async (interaction, client) => {
    const user = interaction.options.getUser('user');
    const page = interaction.options.getInteger('page') || 1;

    try {
        const { logs, currentPage, totalPages, totalLogs } = await moderationService.getModLogs(
            interaction.guild.id,
            user.id,
            page
        );

        const userMember = await CacheHelpers.getMember(interaction.guild, user.id, 2 * 60 * 1000).catch(() => user);
        const embed = ModerationEmbedFactory.createModLogEmbed(
            logs,
            userMember.user || userMember,
            currentPage,
            totalPages,
            totalLogs,
            interaction.guild
        );

        const { createModLogComponents } = require('../../handlers/modlog.handler');
        const components = createModLogComponents(user.id, currentPage, totalPages);

        await interaction.editReply({
            content: null,
            embeds: [embed],
            components: components ? [components] : []
        });
    } catch (error) {
        logger.error('Failed to get mod logs', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Échec de la récupération des logs.', interaction.guild)]
        });
    }
};

const handleDeleteLog = async (interaction) => {
    const user = interaction.options.getUser('user');
    const logId = interaction.options.getInteger('log_id');

    try {
        const deleted = await moderationService.deleteLog(interaction.guild.id, user.id, logId);

        if (!deleted) {
            return interaction.editReply({
                content: null,
                embeds: [ModerationEmbedFactory.createErrorEmbed(`Log #${logId} introuvable pour cet utilisateur.`, interaction.guild)]
            });
        }

        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createLogDeletedEmbed(user, logId, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to delete log', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Échec de la suppression du log.', interaction.guild)]
        });
    }
};

const handlePurge = async (interaction, client) => {
    const amount = interaction.options.getInteger('amount');
    const targetChannel = interaction.options.getChannel('channel');
    const targetUser = interaction.options.getUser('user');


    const channel = targetChannel || interaction.channel;

    if (!channel) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Canal introuvable.', interaction.guild)]
        });
    }

    if (!channel.isTextBased()) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Cette commande ne peut être utilisée que dans un canal texte.', interaction.guild)]
        });
    }


    if (!channel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Je n\'ai pas la permission de gérer les messages dans ce canal.', interaction.guild)]
        });
    }

    try {

        const messagesToDelete = [];
        let fetchedMessages;
        let lastMessageId = null;
        const maxAge = 14 * 24 * 60 * 60 * 1000;


        while (messagesToDelete.length < amount) {
            const options = { limit: 100 };
            if (lastMessageId) {
                options.before = lastMessageId;
            }

            fetchedMessages = await channel.messages.fetch(options);

            if (fetchedMessages.size === 0) break;

            for (const message of fetchedMessages.values()) {

                if (Date.now() - message.createdTimestamp > maxAge) {
                    continue;
                }


                if (targetUser && message.author.id !== targetUser.id) {
                    continue;
                }


                if (message.id === interaction.id) {
                    continue;
                }

                messagesToDelete.push(message);

                if (messagesToDelete.length >= amount) {
                    break;
                }
            }

            if (fetchedMessages.size < 100) break;
            lastMessageId = fetchedMessages.last().id;
        }

        if (messagesToDelete.length === 0) {
            return interaction.editReply({
                content: null,
                embeds: [ModerationEmbedFactory.createErrorEmbed('Aucun message trouvé à supprimer.', interaction.guild)]
            });
        }


        let deletedCount = 0;
        for (let i = 0; i < messagesToDelete.length; i += 100) {
            const batch = messagesToDelete.slice(i, i + 100);
            try {
                if (batch.length === 1) {
                    await batch[0].delete();
                    deletedCount += 1;
                } else {
                    const deleted = await channel.bulkDelete(batch, true);
                    deletedCount += deleted.size;
                }
            } catch (error) {
                logger.error('Failed to delete message batch', error);

            }
        }


        const channelMention = targetChannel ? ` dans ${channel}` : '';
        const userMention = targetUser ? ` de ${targetUser.tag}` : '';
        const embed = new EmbedBuilder()
            .setTitle('✅ Messages supprimés')
            .setDescription(`**${deletedCount}** message(s) supprimé(s)${userMention}${channelMention}`)
            .setColor(0x5865F2)
            .setTimestamp();

        setServerFooter(embed, interaction.guild);


        const reply = await interaction.editReply({
            content: null,
            embeds: [embed]
        });


        setTimeout(async () => {
            try {
                await reply.delete().catch(() => {});
            } catch (error) {

            }
        }, 5000);


        if (interaction.user.id !== interaction.guild.members.me.id) {
            const logId = await moderationService.logAction(
                interaction.guild.id,
                targetUser?.id || 'all',
                interaction.user.id,
                MOD_ACTION.PURGE,
                `Suppression de ${deletedCount} message(s) dans ${channel.name}`
            );

            const logEmbed = ModerationEmbedFactory.createActionEmbed(
                MOD_ACTION.PURGE,
                targetUser || { id: 'all', tag: 'Tous les utilisateurs' },
                interaction.user,
                `Suppression de ${deletedCount} message(s) dans ${interaction.channel.name}`,
                null,
                logId,
                interaction.guild
            );

            await sendToLogChannel(client, interaction.guild.id, logEmbed);
        }
    } catch (error) {
        logger.error('Failed to purge messages', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Échec de la suppression des messages. Les messages de plus de 14 jours ne peuvent pas être supprimés.', interaction.guild)]
        });
    }
};

const handleMove = async (interaction, client) => {
    const userId = interaction.options.getString('user');
    const channelId = interaction.options.getString('channel');


    const targetChannel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!targetChannel) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Canal vocal introuvable.', interaction.guild)]
        });
    }


    const user = await interaction.client.users.fetch(userId).catch(() => null);
    if (!user) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Utilisateur introuvable.', interaction.guild)]
        });
    }

    const member = await CacheHelpers.getMember(interaction.guild, user.id, 2 * 60 * 1000).catch(() => null);
    if (!member) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Utilisateur introuvable sur ce serveur.', interaction.guild)]
        });
    }


    if (!member.voice.channel) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Cet utilisateur n\'est pas dans un canal vocal.', interaction.guild)]
        });
    }


    if (targetChannel.type !== ChannelType.GuildVoice && targetChannel.type !== ChannelType.GuildStageVoice) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Le canal de destination doit être un canal vocal.', interaction.guild)]
        });
    }


    if (member.voice.channel.id === targetChannel.id) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Cet utilisateur est déjà dans ce canal vocal.', interaction.guild)]
        });
    }


    if (!targetChannel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.MoveMembers)) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Je n\'ai pas la permission de déplacer des membres dans ce canal.', interaction.guild)]
        });
    }

    try {
        const oldChannel = member.voice.channel;
        await member.voice.setChannel(targetChannel, 'Déplacement par modération');

        const reason = `Déplacé de ${oldChannel.name} vers ${targetChannel.name}`;

        const logId = await moderationService.logAction(
            interaction.guild.id,
            user.id,
            interaction.user.id,
            MOD_ACTION.MOVE,
            reason
        );

        const embed = ModerationEmbedFactory.createActionEmbed(
            MOD_ACTION.MOVE,
            user,
            interaction.user,
            reason,
            null,
            logId,
            interaction.guild
        );


        embed.addFields(
            { name: '📤 De', value: `<#${oldChannel.id}>`, inline: true },
            { name: '📥 Vers', value: `<#${targetChannel.id}>`, inline: true }
        );

        await sendToLogChannel(client, interaction.guild.id, embed);

        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createSuccessEmbed(MOD_ACTION.MOVE, user, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to move user', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Échec du déplacement. L\'utilisateur a peut-être quitté le canal vocal.', interaction.guild)]
        });
    }
};

module.exports = {
    data: command,
    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const client = interaction.client;

            switch (subcommand) {
                case 'ban':
                    await handleBan(interaction, client);
                    break;
                case 'kick':
                    await handleKick(interaction, client);
                    break;
                case 'mute':
                    await handleMute(interaction, client);
                    break;
                case 'timeout':
                    await handleTimeout(interaction, client);
                    break;
                case 'warn':
                    await handleWarn(interaction, client);
                    break;
                case 'unban':
                    await handleUnban(interaction, client);
                    break;
                case 'unmute':
                    await handleUnmute(interaction, client);
                    break;
                case 'untimeout':
                    await handleUntimeout(interaction, client);
                    break;
                case 'logs':
                    await handleLogs(interaction, client);
                    break;
                case 'deletelog':
                    await handleDeleteLog(interaction);
                    break;
                case 'purge':
                    await handlePurge(interaction, client);
                    break;
                case 'move':
                    await handleMove(interaction, client);
                    break;
                default:
                    await interaction.editReply({
                        content: null,
                        embeds: [ModerationEmbedFactory.createErrorEmbed('Sous-commande inconnue!', interaction.guild)]
                    });
            }
        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            await handleError(interaction, error, `mod ${subcommand}`);
        }
    },
    async autocomplete(interaction) {
        try {
            const focusedOption = interaction.options.getFocused(true);
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'move') {
                if (focusedOption.name === 'user') {
                    const focusedValue = focusedOption.value.toLowerCase();


                    const voiceMembers = interaction.guild.members.cache.filter(member =>
                        member.voice.channel && !member.user.bot
                    );


                    const filtered = Array.from(voiceMembers.values())
                        .filter(member => {
                            if (!focusedValue) return true;
                            const username = member.user.username.toLowerCase();
                            const displayName = member.displayName.toLowerCase();
                            const tag = member.user.tag.toLowerCase();
                            return username.includes(focusedValue) ||
                                   displayName.includes(focusedValue) ||
                                   tag.includes(focusedValue);
                        })
                        .slice(0, 25)
                        .map(member => ({
                            name: `${member.displayName} (${member.user.tag}) - ${member.voice.channel.name}`.substring(0, 100),
                            value: member.user.id
                        }));

                    await interaction.respond(filtered);
                } else if (focusedOption.name === 'channel') {
                    const focusedValue = focusedOption.value.toLowerCase();


                    const voiceChannels = interaction.guild.channels.cache.filter(channel =>
                        (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice)
                    );


                    const filtered = Array.from(voiceChannels.values())
                        .filter(channel => {
                            if (!focusedValue) return true;
                            return channel.name.toLowerCase().includes(focusedValue);
                        })
                        .slice(0, 25)
                        .map(channel => {

                            const memberCount = channel.members.size;
                            return {
                                name: `${channel.name} (${memberCount} ${memberCount === 1 ? 'utilisateur' : 'utilisateurs'})`.substring(0, 100),
                                value: channel.id
                            };
                        });

                    await interaction.respond(filtered);
                } else {
                    await interaction.respond([]);
                }
            } else {
                await interaction.respond([]);
            }
        } catch (error) {
            logger.error('Error in mod autocomplete', error);
            await interaction.respond([]);
        }
    }
};