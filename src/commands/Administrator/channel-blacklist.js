const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");
const voiceBlacklistService = require('../../services/voice-blacklist.service');
const { EMBED_COLORS } = require('../../utils/constants');
const logger = require('../../utils/logger');
const { setServerFooter } = require('../../utils/embed-helper');

const createErrorEmbed = (message, guild = null) => {
    const embed = new EmbedBuilder()
        .setTitle('❌ Erreur')
        .setDescription(message)
        .setColor(EMBED_COLORS.ERROR)
        .setTimestamp();
    if (guild) setServerFooter(embed, guild);
    return embed;
};

const createSuccessEmbed = (message, guild = null) => {
    const embed = new EmbedBuilder()
        .setTitle('✅ Succès')
        .setDescription(message)
        .setColor(EMBED_COLORS.SUCCESS)
        .setTimestamp();
    if (guild) setServerFooter(embed, guild);
    return embed;
};

const command = new SlashCommandBuilder()
    .setName('channel-blacklist')
    .setDescription('Gérer la liste noire des salons vocaux')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

command.addSubcommand(subcommand =>
    subcommand
        .setName('add')
        .setDescription('Interdire à un utilisateur l\'accès à un salon vocal')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Le salon vocal')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice)
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('L\'utilisateur à bannir du salon')
                .setRequired(true)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('remove')
        .setDescription('Autoriser à nouveau un utilisateur à accéder à un salon vocal')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Le salon vocal')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice)
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('L\'utilisateur à débannir du salon')
                .setRequired(true)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('list')
        .setDescription('Voir la liste noire des salons vocaux')
);

module.exports = {
    data: command,
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'add') {
                const channel = interaction.options.getChannel('channel');
                const user = interaction.options.getUser('user');

                await voiceBlacklistService.blacklistUser(interaction.guild.id, channel.id, user.id, interaction.user.id);

                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                if (member && member.voice.channelId === channel.id) {
                    await member.voice.disconnect('Banni du salon vocal');
                }

                await interaction.editReply({
                    embeds: [createSuccessEmbed(`${user} a été banni du salon vocal ${channel}.`, interaction.guild)]
                });

            } else if (subcommand === 'remove') {
                const channel = interaction.options.getChannel('channel');
                const user = interaction.options.getUser('user');

                const isBlacklisted = await voiceBlacklistService.isUserBlacklisted(interaction.guild.id, channel.id, user.id);
                if (!isBlacklisted) {
                    return interaction.editReply({
                        embeds: [createErrorEmbed(`${user} n'est pas banni du salon vocal ${channel}.`, interaction.guild)]
                    });
                }

                await voiceBlacklistService.unblacklistUser(interaction.guild.id, channel.id, user.id);

                await interaction.editReply({
                    embeds: [createSuccessEmbed(`${user} a été débanni du salon vocal ${channel}.`, interaction.guild)]
                });

            } else if (subcommand === 'list') {
                const blacklist = await voiceBlacklistService.getBlacklist(interaction.guild.id);

                if (blacklist.length === 0) {
                    return interaction.editReply({
                        embeds: [createSuccessEmbed('La liste noire des salons vocaux est vide.', interaction.guild)]
                    });
                }

                const description = blacklist.map(entry => {
                    return `<#${entry.channel_id}>: <@${entry.user_id}> (par <@${entry.moderator_id}>)`;
                }).join('\n');

                const embed = new EmbedBuilder()
                    .setTitle('📋 Liste noire des salons vocaux')
                    .setDescription(description)
                    .setColor(EMBED_COLORS.PRIMARY)
                    .setTimestamp();
                setServerFooter(embed, interaction.guild);

                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            logger.error(`Error in channel-blacklist command (${subcommand})`, error);
            await interaction.editReply({
                embeds: [createErrorEmbed('Une erreur est survenue lors de l\'exécution de la commande.', interaction.guild)]
            });
        }
    }
};