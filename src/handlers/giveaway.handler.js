const giveawayService = require('../services/giveaway.service');
const EmbedFactory = require('../utils/embeds');
const logger = require('../utils/logger');
const config = require('../config');

class GiveawayHandler {
    constructor(client) {
        this.client = client;
        this.embedUpdateQueue = new Map();
        const handlerConfig = config.handlers?.giveaway || {};
        this.maxQueueSize = handlerConfig.maxQueueSize || 100;
        this.embedUpdateDebounce = handlerConfig.embedUpdateDebounce || 500;
    }

    async endGiveaway(giveaway) {
        try {
            if (!giveaway || !giveaway.channel_id || !giveaway.message_id) {
                logger.error('Invalid giveaway data provided to endGiveaway');
                return;
            }

            logger.info(`Ending giveaway ${giveaway.message_id} - Prize: ${giveaway.prize}`);

            const channel = await this.client.channels.fetch(giveaway.channel_id).catch((err) => {
                logger.error(`Failed to fetch channel ${giveaway.channel_id}`, err);
                return null;
            });
            if (!channel) {
                logger.error(`Channel ${giveaway.channel_id} not found, ending giveaway without announcement`);
                await giveawayService.endGiveaway(giveaway.message_id, []);
                return;
            }

            const message = await channel.messages.fetch(giveaway.message_id).catch((err) => {
                logger.error(`Failed to fetch message ${giveaway.message_id}`, err);
                return null;
            });
            if (!message) {
                logger.error(`Message ${giveaway.message_id} not found, ending giveaway without announcement`);
                await giveawayService.endGiveaway(giveaway.message_id, []);
                return;
            }

            const participants = await giveawayService.getParticipants(giveaway.message_id);
            if (!Array.isArray(participants)) {
                logger.error('Invalid participants data received', { participants });
                await giveawayService.endGiveaway(giveaway.message_id, []);
                return;
            }

            logger.info(`Giveaway ${giveaway.message_id} has ${participants.length} participants`);

            const winnerCount = Math.min(giveaway.winners || 1, participants.length);
            const winners = giveawayService.pickWinners(participants, winnerCount);

            logger.info(`Giveaway ${giveaway.message_id} - Selected ${winners.length} winner(s): ${winners.join(', ')}`);

            await giveawayService.endGiveaway(giveaway.message_id, winners);

            const guild = channel.guild;
            if (!guild) {
                logger.error('Channel has no guild property');
                return;
            }


            try {
                await message.edit({
                    embeds: [EmbedFactory.createEndedEmbed(giveaway, winners, this.client, guild)],
                    components: []
                });
                logger.info(`Updated giveaway message ${giveaway.message_id} with ended embed`);
            } catch (error) {
                logger.error(`Failed to update giveaway message ${giveaway.message_id}`, error);
            }


            if (winners.length > 0) {
                logger.info(`Sending winner messages for ${winners.length} winner(s)`);
                await Promise.all(winners.map(winnerId =>
                    this.sendWinnerMessage(channel, winnerId, giveaway.prize, false).catch(err => {
                        logger.error(`Failed to send winner message to ${winnerId}`, err);
                    })
                ));
            } else {
                logger.warn(`No winners selected for giveaway ${giveaway.message_id} - ${participants.length} participants`);

                try {
                    await channel.send({
                        content: `🎉 **Concours terminé !**\n\n**Prix:** ${giveaway.prize}\n\n❌ Aucun participant valide pour ce concours.`
                    });
                } catch (error) {
                    logger.error(`Failed to send no-winners announcement for giveaway ${giveaway.message_id}`, error);
                }
            }
        } catch (error) {
            logger.error(`Failed to end giveaway ${giveaway.message_id}`, error);
            logger.error('Stack trace:', error.stack);
        }
    }

    async sendWinnerMessage(channel, winnerId, prize, isReroll = false) {
        try {
            if (!channel || !winnerId || !prize) {
                logger.error('Invalid parameters for sendWinnerMessage', { channel: !!channel, winnerId, prize: !!prize });
                return;
            }

            const winner = await this.client.users.fetch(winnerId).catch(() => null);
            const guild = channel.guild;
            if (!guild) {
                logger.error('Channel has no guild property in sendWinnerMessage');
                return;
            }

            const embed = EmbedFactory.createWinnerEmbed(winnerId, prize, isReroll, guild);
            if (!embed) {
                logger.error('Failed to create winner embed');
                return;
            }

            if (winner && winner.displayAvatarURL) {
                embed.setThumbnail(winner.displayAvatarURL());
            }


            const ticketMessage = '🎫 **Pour réclamer votre prix, ouvrez un ticket avec la catégorie "giveaway" !**';
            const currentDescription = embed.data.description || '';
            embed.setDescription(`${currentDescription}\n\n${ticketMessage}`);

            await channel.send({ content: `<@${winnerId}>`, embeds: [embed] });
        } catch (error) {
            logger.error(`Failed to send winner message to ${winnerId}`, error);
        }
    }

    updateEmbedDebounced(messageId, giveaway, delay = null) {

        if (delay === null) {
            delay = this.embedUpdateDebounce;
        }

        if (this.embedUpdateQueue.size > this.maxQueueSize) {

            const entriesToRemove = Math.floor(this.maxQueueSize * 0.2);
            let removed = 0;
            for (const [key, timeout] of this.embedUpdateQueue.entries()) {
                if (removed >= entriesToRemove) break;
                clearTimeout(timeout);
                this.embedUpdateQueue.delete(key);
                removed++;
            }
        }

        if (this.embedUpdateQueue.has(messageId)) {
            clearTimeout(this.embedUpdateQueue.get(messageId));
        }

        const timeout = setTimeout(async () => {
            try {
                const channel = await this.client.channels.fetch(giveaway.channel_id).catch(() => null);
                if (!channel) return;

                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (!message) return;

                const participants = await giveawayService.getParticipants(messageId);
                const { createGiveawayEmbed, createGiveawayComponents } = require('../commands/Administrator/giveaway');

                const embed = createGiveawayEmbed(giveaway, participants, this.client, channel.guild);
                const components = createGiveawayComponents(messageId);

                await message.edit({ embeds: [embed], components: [components] });
            } catch (error) {
                logger.error(`Failed to update embed ${messageId}`, error);
            } finally {
                this.embedUpdateQueue.delete(messageId);
            }
        }, delay);

        this.embedUpdateQueue.set(messageId, timeout);
    }

    async handleEnter(interaction, messageId) {
        try {
            const giveaway = await giveawayService.getGiveawayByMessageId(messageId);

            if (!giveaway || giveaway.status === 'ended') {
                return interaction.editReply({ content: '❌ Ce concours est terminé!' });
            }

            if (giveaway.guild_id !== interaction.guild.id) {
                return interaction.editReply({ content: '❌ Ce concours n\'est pas de ce serveur!' });
            }

            const participants = await giveawayService.getParticipants(messageId);

            if (participants.includes(interaction.user.id)) {
                return interaction.editReply({
                    content: '❌ Vous êtes déjà inscrit! Utilisez le bouton "Quitter" pour vous désinscrire.'
                });
            }

            if (giveaway.requirements) {
                const roleMatch = giveaway.requirements.match(/<@&(\d+)>/);
                if (roleMatch && !interaction.member.roles.cache.has(roleMatch[1])) {
                    return interaction.editReply({
                        content: '❌ Vous avez besoin du rôle requis pour participer à ce concours!'
                    });
                }
            }

            await giveawayService.addParticipant(messageId, interaction.user.id);
            this.updateEmbedDebounced(messageId, giveaway);

            await interaction.editReply({
                content: '✅ Vous avez participé au concours avec succès! Bonne chance! 🎉'
            });
        } catch (error) {
            logger.error('Failed to handle giveaway enter', error);
            await interaction.editReply({
                content: '❌ Erreur lors de la participation. Veuillez réessayer.'
            });
        }
    }

    async handleLeave(interaction, messageId) {
        try {
            const giveaway = await giveawayService.getGiveawayByMessageId(messageId);

            if (!giveaway || giveaway.status === 'ended') {
                return interaction.editReply({ content: '❌ Ce concours est terminé!' });
            }

            const participants = await giveawayService.getParticipants(messageId);

            if (!participants.includes(interaction.user.id)) {
                return interaction.editReply({
                    content: '❌ Vous n\'êtes pas inscrit à ce concours! Utilisez le bouton "Participer" pour vous inscrire.'
                });
            }

            await giveawayService.removeParticipant(messageId, interaction.user.id);
            this.updateEmbedDebounced(messageId, giveaway);

            await interaction.editReply({ content: '✅ Vous avez quitté le concours.' });
        } catch (error) {
            logger.error('Failed to handle giveaway leave', error);
            await interaction.editReply({
                content: '❌ Erreur lors de la désinscription. Veuillez réessayer.'
            });
        }
    }
}

module.exports = GiveawayHandler;