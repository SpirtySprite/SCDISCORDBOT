const tournamentService = require('../services/pvp-tournament.service');
const PvpTournamentEmbedFactory = require('../utils/pvp-tournament-embeds');
const logger = require('../utils/logger');

class PvpTournamentHandler {
    constructor(client) {
        this.client = client;
    }

    async handleRegister(interaction, tournamentId) {
        try {
            const tournament = await tournamentService.getTournament(tournamentId);

            if (!tournament) {
                return interaction.editReply({ content: '❌ Tournoi introuvable!' });
            }

            if (tournament.status !== 'registration') {
                return interaction.editReply({ content: '❌ Les inscriptions sont fermées!' });
            }

            if (tournament.guild_id !== interaction.guild.id) {
                return interaction.editReply({ content: '❌ Ce tournoi n\'est pas de ce serveur!' });
            }

            const participants = await tournamentService.getParticipants(tournamentId);
            const isAlreadyRegistered = participants.some(p => p.user_id === interaction.user.id);

            if (isAlreadyRegistered) {
                return interaction.editReply({
                    content: '❌ Vous êtes déjà inscrit! Utilisez le bouton "Se désinscrire" pour quitter.'
                });
            }

            const userTag = interaction.user.tag || `${interaction.user.username}#${interaction.user.discriminator || '0'}`;
            const success = await tournamentService.addParticipant(
                tournamentId,
                interaction.user.id,
                interaction.user.username,
                userTag
            );

            if (!success) {
                return interaction.editReply({
                    content: '❌ Échec de l\'inscription. Le tournoi est peut-être plein.'
                });
            }

            const updatedParticipants = await tournamentService.getParticipants(tournamentId);
            const participantCount = updatedParticipants.length;

            const channel = await this.client.channels.fetch(tournament.channel_id).catch(() => null);
            if (channel) {
                try {
                    const mainMessage = await channel.messages.fetch(tournament.message_id).catch(() => null);
                    if (mainMessage) {
                        const updatedEmbed = PvpTournamentEmbedFactory.createRegistrationEmbed(
                            tournament,
                            participantCount,
                            interaction.guild
                        );
                        await mainMessage.edit({ embeds: [updatedEmbed] });
                    }

                    if (tournament.participant_list_message_id) {
                        const listMessage = await channel.messages.fetch(tournament.participant_list_message_id).catch(() => null);
                        if (listMessage) {
                            const newEmbed = PvpTournamentEmbedFactory.createParticipantListEmbed(
                                updatedParticipants,
                                tournament,
                                interaction.guild
                            );
                            await channel.send({ embeds: [newEmbed] });
                        }
                    }
                } catch (error) {
                    logger.error('Failed to update tournament embeds', error);
                }
            }

            await interaction.editReply({
                content: `✅ Vous êtes maintenant inscrit au tournoi! (${participantCount}/${tournament.max_entries} participants)`
            });
        } catch (error) {
            logger.error('Failed to handle tournament register', error);
            await interaction.editReply({
                content: `❌ Erreur lors de l'inscription: ${error.message || 'Erreur inconnue'}`
            });
        }
    }

    async handleLeave(interaction, tournamentId) {
        try {
            const tournament = await tournamentService.getTournament(tournamentId);

            if (!tournament) {
                return interaction.editReply({ content: '❌ Tournoi introuvable!' });
            }

            if (tournament.status !== 'registration') {
                return interaction.editReply({ content: '❌ Les inscriptions sont fermées! Vous ne pouvez plus quitter.' });
            }

            if (tournament.guild_id !== interaction.guild.id) {
                return interaction.editReply({ content: '❌ Ce tournoi n\'est pas de ce serveur!' });
            }

            const participants = await tournamentService.getParticipants(tournamentId);
            const isRegistered = participants.some(p => p.user_id === interaction.user.id);

            if (!isRegistered) {
                return interaction.editReply({
                    content: '❌ Vous n\'êtes pas inscrit! Utilisez le bouton "S\'inscrire" pour participer.'
                });
            }

            const success = await tournamentService.removeParticipant(tournamentId, interaction.user.id);

            if (!success) {
                return interaction.editReply({
                    content: '❌ Échec de la désinscription. Veuillez réessayer.'
                });
            }

            const updatedParticipants = await tournamentService.getParticipants(tournamentId);
            const participantCount = updatedParticipants.length;

            const channel = await this.client.channels.fetch(tournament.channel_id).catch(() => null);
            if (channel) {
                try {
                    const mainMessage = await channel.messages.fetch(tournament.message_id).catch(() => null);
                    if (mainMessage) {
                        const updatedEmbed = PvpTournamentEmbedFactory.createRegistrationEmbed(
                            tournament,
                            participantCount,
                            interaction.guild
                        );
                        await mainMessage.edit({ embeds: [updatedEmbed] });
                    }

                    if (tournament.participant_list_message_id) {
                        const listMessage = await channel.messages.fetch(tournament.participant_list_message_id).catch(() => null);
                        if (listMessage) {
                            const newEmbed = PvpTournamentEmbedFactory.createParticipantListEmbed(
                                updatedParticipants,
                                tournament,
                                interaction.guild
                            );
                            await channel.send({ embeds: [newEmbed] });
                        }
                    }
                } catch (error) {
                    logger.error('Failed to update tournament embeds', error);
                }
            }

            await interaction.editReply({
                content: `✅ Vous avez quitté le tournoi. (${participantCount}/${tournament.max_entries} participants)`
            });
        } catch (error) {
            logger.error('Failed to handle tournament leave', error);
            await interaction.editReply({
                content: `❌ Erreur lors de la désinscription: ${error.message || 'Erreur inconnue'}`
            });
        }
    }
}

module.exports = PvpTournamentHandler;