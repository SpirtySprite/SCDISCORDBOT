const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    PermissionsBitField,
    EmbedBuilder
} = require('discord.js');
const ModerationEmbedFactory = require('../../utils/moderation-embeds');
const { CacheHelpers } = require('../../utils/discord-cache');
const logger = require('../../utils/logger');
const { EMBED_COLORS } = require('../../utils/constants');



const command = new SlashCommandBuilder()
    .setName('role')
    .setDescription('Gérer les rôles des utilisateurs')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

command.addSubcommand(subcommand =>
    subcommand
        .setName('add')
        .setDescription('Ajouter un rôle à un utilisateur')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('Rôle à ajouter')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Raison (optionnel)')
                .setRequired(false)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('remove')
        .setDescription('Retirer un rôle à un utilisateur')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('Rôle à retirer')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Raison (optionnel)')
                .setRequired(false)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('permission')
        .setDescription('Modifier les permissions Discord d\'un rôle')
        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('Le rôle à modifier')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('permission')
                .setDescription('La permission à modifier')
                .setRequired(true)
                .addChoices(
                    { name: 'Administrator', value: 'Administrator' },
                    { name: 'ManageMembers', value: 'ManageMembers' },
                    { name: 'ManageRoles', value: 'ManageRoles' },
                    { name: 'ManageChannels', value: 'ManageChannels' },
                    { name: 'ManageMessages', value: 'ManageMessages' },
                    { name: 'KickMembers', value: 'KickMembers' },
                    { name: 'BanMembers', value: 'BanMembers' },
                    { name: 'ViewAuditLog', value: 'ViewAuditLog' },
                    { name: 'ManageGuild', value: 'ManageGuild' },
                    { name: 'MentionEveryone', value: 'MentionEveryone' }
                )
        )
        .addBooleanOption(option =>
            option
                .setName('state')
                .setDescription('Activer (Vrai) ou Désactiver (Faux)')
                .setRequired(true)
        )
);

const handleAddRole = async (interaction) => {
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    const member = await CacheHelpers.getMember(interaction.guild, user.id, 2 * 60 * 1000).catch(() => null);
    if (!member) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Utilisateur introuvable sur ce serveur.', interaction.guild)]
        });
    }

    try {

        if (member.roles.cache.has(role.id)) {
            return interaction.editReply({
                content: null,
                embeds: [ModerationEmbedFactory.createErrorEmbed(`${user.tag} a déjà le rôle ${role.name}.`, interaction.guild)]
            });
        }


        const botMember = await CacheHelpers.getMember(interaction.guild, interaction.client.user.id, 2 * 60 * 1000);
        if (role.position >= botMember.roles.highest.position) {
            return interaction.editReply({
                content: null,
                embeds: [ModerationEmbedFactory.createErrorEmbed(`Je ne peux pas gérer ce rôle car il est supérieur ou égal à mon rôle le plus élevé.`, interaction.guild)]
            });
        }


        const isOwner = interaction.guild.ownerId === interaction.user.id;
        if (!isOwner) {
            const executorMember = await CacheHelpers.getMember(interaction.guild, interaction.user.id, 2 * 60 * 1000);
            if (role.position >= executorMember.roles.highest.position) {
                return interaction.editReply({
                    content: null,
                    embeds: [ModerationEmbedFactory.createErrorEmbed(`Vous ne pouvez pas gérer ce rôle car il est supérieur ou égal à votre rôle le plus élevé.`, interaction.guild)]
                });
            }
        }

        await member.roles.add(role, reason);

        logger.info(`Role ${role.name} added to ${user.tag} by ${interaction.user.tag} - Reason: ${reason}`);

        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createRoleAddedEmbed(user, role, interaction.user, reason, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to add role', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed(`Échec de l'ajout du rôle: ${error.message}`, interaction.guild)]
        });
    }
};

const handleRemoveRole = async (interaction) => {
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    const member = await CacheHelpers.getMember(interaction.guild, user.id, 2 * 60 * 1000).catch(() => null);
    if (!member) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed('Utilisateur introuvable sur ce serveur.', interaction.guild)]
        });
    }

    try {

        if (!member.roles.cache.has(role.id)) {
            return interaction.editReply({
                content: null,
                embeds: [ModerationEmbedFactory.createErrorEmbed(`${user.tag} n'a pas le rôle ${role.name}.`, interaction.guild)]
            });
        }


        const botMember = await CacheHelpers.getMember(interaction.guild, interaction.client.user.id, 2 * 60 * 1000);
        if (role.position >= botMember.roles.highest.position) {
            return interaction.editReply({
                content: null,
                embeds: [ModerationEmbedFactory.createErrorEmbed(`Je ne peux pas gérer ce rôle car il est supérieur ou égal à mon rôle le plus élevé.`, interaction.guild)]
            });
        }


        const isOwner = interaction.guild.ownerId === interaction.user.id;
        if (!isOwner) {
            const executorMember = await CacheHelpers.getMember(interaction.guild, interaction.user.id, 2 * 60 * 1000);
            if (role.position >= executorMember.roles.highest.position) {
                return interaction.editReply({
                    content: null,
                    embeds: [ModerationEmbedFactory.createErrorEmbed(`Vous ne pouvez pas gérer ce rôle car il est supérieur ou égal à votre rôle le plus élevé.`, interaction.guild)]
                });
            }
        }

        await member.roles.remove(role, reason);

        logger.info(`Role ${role.name} removed from ${user.tag} by ${interaction.user.tag} - Reason: ${reason}`);

        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createRoleRemovedEmbed(user, role, interaction.user, reason, interaction.guild)]
        });
    } catch (error) {
        logger.error('Failed to remove role', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed(`Échec du retrait du rôle: ${error.message}`, interaction.guild)]
        });
    }
};

const handlePermission = async (interaction) => {
    const role = interaction.options.getRole('role');
    const permission = interaction.options.getString('permission');
    const state = interaction.options.getBoolean('state');


    const botMember = await CacheHelpers.getMember(interaction.guild, interaction.client.user.id, 2 * 60 * 1000);
    if (role.position >= botMember.roles.highest.position) {
        return interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed(`Je ne peux pas modifier ce rôle car il est supérieur ou égal à mon rôle le plus élevé.`, interaction.guild)]
        });
    }


    const isOwner = interaction.guild.ownerId === interaction.user.id;
    if (!isOwner) {
        const executorMember = await CacheHelpers.getMember(interaction.guild, interaction.user.id, 2 * 60 * 1000);
        if (role.position >= executorMember.roles.highest.position) {
            return interaction.editReply({
                content: null,
                embeds: [ModerationEmbedFactory.createErrorEmbed(`Vous ne pouvez pas modifier ce rôle car il est supérieur ou égal à votre rôle le plus élevé.`, interaction.guild)]
            });
        }
    }

    try {

        const currentPermissions = new PermissionsBitField(role.permissions.bitfield);
        const permissionFlag = PermissionFlagsBits[permission];

        if (!permissionFlag) {
            return interaction.editReply({
                content: null,
                embeds: [ModerationEmbedFactory.createErrorEmbed(`Permission inconnue: ${permission}`, interaction.guild)]
            });
        }

        if (state) {
            currentPermissions.add(permissionFlag);
        } else {
            currentPermissions.remove(permissionFlag);
        }

        await role.setPermissions(currentPermissions);

        logger.info(`Permission ${permission} ${state ? 'added to' : 'removed from'} role ${role.name} by ${interaction.user.tag}`);

        const successEmbed = new EmbedBuilder()
            .setTitle(`✅ Permissions mises à jour`)
            .setColor(EMBED_COLORS.SUCCESS || '#57F287')
            .setDescription(`Les permissions du rôle <@&${role.id}> ont été modifiées avec succès.`)
            .addFields(
                { name: 'Permission', value: `\`${permission}\``, inline: true },
                { name: 'Nouvel état', value: state ? '✅ Activé' : '❌ Désactivé', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

        await interaction.editReply({
            content: null,
            embeds: [successEmbed]
        });

    } catch (error) {
        logger.error('Failed to update role permissions', error);
        await interaction.editReply({
            content: null,
            embeds: [ModerationEmbedFactory.createErrorEmbed(`Échec de la mise à jour des permissions: ${error.message}`, interaction.guild)]
        });
    }
};

module.exports = {
    data: command,
    async execute(interaction) {
        let subcommand = 'unknown';
        try {


            const member = interaction.member || await CacheHelpers.getMember(interaction.guild, interaction.user.id, 2 * 60 * 1000).catch(() => null);
            const isOwner = interaction.guild.ownerId === interaction.user.id;

            let hasAdminPermission = false;
            if (member) {
                try {
                    hasAdminPermission = member.permissionsIn(interaction.channel).has(PermissionFlagsBits.Administrator);
                } catch (error) {
                    hasAdminPermission = member.permissions.has(PermissionFlagsBits.Administrator);
                }
            }

            if (!isOwner && !hasAdminPermission) {

                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply({
                        content: null,
                        embeds: [ModerationEmbedFactory.createErrorEmbed('❌ Vous n\'avez pas la permission d\'utiliser cette commande.', interaction.guild)]
                    });
                } else {
                    return interaction.reply({
                        content: null,
                        embeds: [ModerationEmbedFactory.createErrorEmbed('❌ Vous n\'avez pas la permission d\'utiliser cette commande.', interaction.guild)],
                        ephemeral: true
                    });
                }
            }

            subcommand = interaction.options.getSubcommand();


            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }

            switch (subcommand) {
                case 'add':
                    await handleAddRole(interaction);
                    break;
                case 'remove':
                    await handleRemoveRole(interaction);
                    break;
                case 'permission':
                    await handlePermission(interaction);
                    break;
                default:
                    await interaction.editReply({
                        content: null,
                        embeds: [ModerationEmbedFactory.createErrorEmbed('Sous-commande inconnue!', interaction.guild)]
                    });
            }
        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            await handleError(interaction, error, `role ${subcommand}`);
        }
    }
};