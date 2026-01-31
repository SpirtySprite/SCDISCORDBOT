const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');

const command = new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('Créer une suggestion');

module.exports = {
    data: command,
    async execute(interaction) {
        try {
            const modal = new ModalBuilder()
                .setCustomId('suggestion_modal')
                .setTitle('Nouvelle suggestion');

            const titleInput = new TextInputBuilder()
                .setCustomId('suggestion_title')
                .setLabel('Titre')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(100)
                .setRequired(true)
                .setPlaceholder('Entrez le titre de votre suggestion')
                .setValue('');

            const descriptionInput = new TextInputBuilder()
                .setCustomId('suggestion_description')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(1000)
                .setRequired(true)
                .setPlaceholder('Décrivez votre suggestion en détail')
                .setValue('');

            const titleRow = new ActionRowBuilder().addComponents(titleInput);
            const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);

            modal.addComponents(titleRow, descriptionRow);

            await interaction.showModal(modal);
        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            await handleError(interaction, error, 'suggestion modal');
        }
    }
};