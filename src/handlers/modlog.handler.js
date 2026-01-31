const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moderationService = require('../services/moderation.service');
const ModerationEmbedFactory = require('../utils/moderation-embeds');
const logger = require('../utils/logger');

const createModLogComponents = (userId, currentPage, totalPages) => {
    if (totalPages <= 1) return null;

    const row = new ActionRowBuilder();

    if (currentPage > 1) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`modlog_prev_${userId}_${currentPage}`)
                .setLabel('◀ Précédent')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    if (currentPage < totalPages) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`modlog_next_${userId}_${currentPage}`)
                .setLabel('Suivant ▶')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    return row.components.length > 0 ? row : null;
};

const handleModLogPagination = async (interaction, userId, page, direction) => {
    try {
        const { logs, currentPage, totalPages, totalLogs } = await moderationService.getModLogs(
            interaction.guild.id,
            userId,
            page
        );

        const user = await interaction.client.users.fetch(userId).catch(() => ({ id: userId, tag: userId }));
        const embed = ModerationEmbedFactory.createModLogEmbed(
            logs,
            user,
            currentPage,
            totalPages,
            totalLogs,
            interaction.guild
        );

        const components = createModLogComponents(userId, currentPage, totalPages);


        await interaction.update({
            embeds: [embed],
            components: components ? [components] : []
        });
    } catch (error) {
        logger.error('Failed to handle mod log pagination', error);

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
                content: null,
                embeds: [ModerationEmbedFactory.createErrorEmbed('Échec de la récupération des logs.', interaction.guild)]
            }).catch(() => {

                interaction.followUp({
                    embeds: [ModerationEmbedFactory.createErrorEmbed('Échec de la récupération des logs.', interaction.guild)],
                    ephemeral: true
                }).catch(() => {
                    logger.debug('Failed to send error message for mod log pagination');
                });
            });
        } else {
            await interaction.reply({
                embeds: [ModerationEmbedFactory.createErrorEmbed('Échec de la récupération des logs.', interaction.guild)],
                ephemeral: true
            }).catch(() => {
                logger.debug('Failed to reply with error message for mod log pagination');
            });
        }
    }
};

module.exports = {
    createModLogComponents,
    handleModLogPagination
};