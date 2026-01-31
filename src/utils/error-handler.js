const { formatUserErrorMessage, getErrorCode, BotError, ERROR_CODES } = require('./error-codes');
const logger = require('./logger');
const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('./constants');
const { setServerFooter } = require('./embed-helper');


async function handleError(interaction, error, context = '') {
    const errorCode = getErrorCode(error);
    const userMessage = formatUserErrorMessage(error, false);

    logger.error(`Erreur${context ? ` dans ${context}` : ''}`, error);


    if (error.code === 10062) {
        logger.debug('Interaction expired, skipping error handling');
        return;
    }


    const isReplied = interaction.replied || interaction.deferred;

    try {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription(userMessage)
            .setColor(EMBED_COLORS.ERROR)
            .setTimestamp();

        if (error instanceof BotError && error.context) {
            errorEmbed.setFooter({
                text: `Code: ${errorCode}${context ? ` • ${context}` : ''}`
            });
        } else {
            setServerFooter(errorEmbed, interaction.guild);
        }

        if (isReplied) {
            await interaction.editReply({
                content: null,
                embeds: [errorEmbed]
            }).catch(async (editError) => {

                if (editError.code === 10062) {
                    logger.debug('Interaction expired during error handling');
                    return;
                }
                await interaction.followUp({
                    embeds: [errorEmbed],
                    ephemeral: true
                }).catch((followUpError) => {
                    if (followUpError.code !== 10062) {
                        logger.debug('Échec de l\'envoi de l\'embed d\'erreur', followUpError);
                    }
                });
            });
        } else {
            await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            }).catch((replyError) => {

                if (replyError.code === 10062) {
                    return interaction.followUp({
                        embeds: [errorEmbed],
                        ephemeral: true
                    }).catch(() => {
                        logger.debug('Interaction expired, could not send error message');
                    });
                }
                throw replyError;
            });
        }
    } catch (replyError) {

        if (replyError.code !== 10062) {
            logger.error('Échec de l\'envoi du message d\'erreur à l\'utilisateur', replyError);
        }


        if (replyError.code !== 10062) {
            try {
                if (isReplied) {
                    await interaction.editReply({ content: `❌ ${userMessage}` });
                } else {
                    await interaction.reply({ content: `❌ ${userMessage}`, ephemeral: true });
                }
            } catch {

            }
        }
    }
}


function createError(code, message, context = {}) {
    return new BotError(code, message, context);
}

module.exports = {
    handleError,
    createError,
    formatUserErrorMessage,
    getErrorCode,
    BotError,
    ERROR_CODES
};