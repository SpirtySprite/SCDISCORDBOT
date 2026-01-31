const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');
const config = require('../../config');
const SuggestionEmbedFactory = require('../../utils/suggestion-embeds');
const logger = require('../../utils/logger');

const command = new SlashCommandBuilder()
    .setName('suggestion-mod')
    .setDescription('Créer un message de suggestion acceptée par la modération')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages | PermissionFlagsBits.ModerateMembers)
    .addStringOption(option =>
        option
            .setName('message_id')
            .setDescription('L\'ID du message de suggestion à accepter')
            .setRequired(true))
    .addStringOption(option =>
        option
            .setName('accepted_by')
            .setDescription('Le nom du modérateur qui a accepté (optionnel, utilise votre nom par défaut)')
            .setRequired(false)
            .setMaxLength(100));

module.exports = {
    data: command,
    async execute(interaction) {
        try {

            if (interaction.replied || interaction.deferred) {

                if (interaction.deferred) {

                } else {
                    return;
                }
            }

            const messageId = interaction.options.getString('message_id');
            const acceptedByUserId = interaction.user.id;
            const acceptedByName = interaction.options.getString('accepted_by') || interaction.member?.displayName || interaction.user.displayName || interaction.user.username;

            const suggestionChannelId = config.suggestion.channelId;
            if (!suggestionChannelId) {
                if (interaction.deferred) {
                    return await interaction.editReply({
                        content: '❌ Le canal de suggestions n\'est pas configuré. Veuillez contacter un administrateur.'
                    });
                }
                return await interaction.reply({
                    content: '❌ Le canal de suggestions n\'est pas configuré. Veuillez contacter un administrateur.',
                    ephemeral: true
                });
            }

            const { CacheHelpers } = require('../../utils/discord-cache');
            const channel = await CacheHelpers.getChannel(interaction.client, suggestionChannelId, 10 * 60 * 1000).catch(() => null);
            if (!channel) {
                if (interaction.deferred) {
                    return await interaction.editReply({
                        content: '❌ Le canal de suggestions est introuvable. Veuillez contacter un administrateur.'
                    });
                }
                return await interaction.reply({
                    content: '❌ Le canal de suggestions est introuvable. Veuillez contacter un administrateur.',
                    ephemeral: true
                });
            }


            let originalMessage;
            try {
                originalMessage = await channel.messages.fetch(messageId);
            } catch (error) {
                if (interaction.deferred) {
                    return await interaction.editReply({
                        content: '❌ Message introuvable. Vérifiez que l\'ID du message est correct et qu\'il se trouve dans le canal de suggestions.'
                    });
                }
                return await interaction.reply({
                    content: '❌ Message introuvable. Vérifiez que l\'ID du message est correct et qu\'il se trouve dans le canal de suggestions.',
                    ephemeral: true
                });
            }


            if (!originalMessage.embeds || originalMessage.embeds.length === 0) {
                if (interaction.deferred) {
                    return await interaction.editReply({
                        content: '❌ Ce message n\'est pas une suggestion valide (pas d\'embed trouvé).'
                    });
                }
                return await interaction.reply({
                    content: '❌ Ce message n\'est pas une suggestion valide (pas d\'embed trouvé).',
                    ephemeral: true
                });
            }

            const originalEmbed = originalMessage.embeds[0];


            if (!originalEmbed.title || !originalEmbed.title.startsWith('💡')) {
                if (interaction.deferred) {
                    return await interaction.editReply({
                        content: '❌ Ce message n\'est pas une suggestion valide (le titre ne correspond pas au format de suggestion).'
                    });
                }
                return await interaction.reply({
                    content: '❌ Ce message n\'est pas une suggestion valide (le titre ne correspond pas au format de suggestion).',
                    ephemeral: true
                });
            }


            const title = originalEmbed.title.replace(/^💡\s*/, '');


            const description = originalEmbed.description || '*Aucune description*';


            let userId = null;
            let userTag = 'Utilisateur inconnu';


            const proposedByField = originalEmbed.fields?.find(field => field.name === '👤 Proposé par' || field.name.includes('Proposé par'));
            if (proposedByField) {
                const mentionMatch = proposedByField.value.match(/<@(\d+)>/);
                if (mentionMatch) {
                    userId = mentionMatch[1];
                    try {
                        const user = await interaction.client.users.fetch(userId);
                        userTag = user.tag;
                    } catch (error) {

                        userTag = `User (${userId})`;
                    }
                }
            }


            if (!userId && originalMessage.author) {
                userId = originalMessage.author.id;
                userTag = originalMessage.author.tag;
            }

            if (!userId) {
                if (interaction.deferred) {
                    return await interaction.editReply({
                        content: '❌ Impossible de déterminer l\'auteur de la suggestion.'
                    });
                }
                return await interaction.reply({
                    content: '❌ Impossible de déterminer l\'auteur de la suggestion.',
                    ephemeral: true
                });
            }


            let suggestionUser = null;
            try {
                suggestionUser = await interaction.client.users.fetch(userId);
            } catch (error) {

                logger.debug('Could not fetch user for thumbnail', error);
            }

            const embed = SuggestionEmbedFactory.createModAcceptanceEmbed(
                userId,
                acceptedByUserId,
                acceptedByName,
                title,
                description,
                interaction.user.tag,
                suggestionUser
            );


            await channel.send({
                embeds: [embed]
            });

            if (interaction.deferred) {
                await interaction.editReply({
                    content: '✅ Message de suggestion acceptée envoyé avec succès!'
                });
            } else {
                await interaction.reply({
                    content: '✅ Message de suggestion acceptée envoyé avec succès!',
                    ephemeral: true
                });
            }
        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            await handleError(interaction, error, 'suggestion-mod');
        }
    }
};