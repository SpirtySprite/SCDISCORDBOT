const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const tournamentService = require('../../services/pvp-tournament.service');
const PvpTournamentEmbedFactory = require('../../utils/pvp-tournament-embeds');
const { parseDuration } = require('../../utils/helpers');
const logger = require('../../utils/logger');

const command = new SlashCommandBuilder()
    .setName('pvp')
    .setDescription('Gérer les événements PvP')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

command.addSubcommand(subcommand =>
    subcommand
        .setName('creer')
        .setDescription('Créer un nouvel événement PvP')
        .addStringOption(option =>
            option
                .setName('duree_inscription')
                .setDescription('Durée des inscriptions (ex: 1h, 30m, 2d)')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('max_participants')
                .setDescription('Nombre maximum de participants')
                .setRequired(true)
                .addChoices(
                    { name: '8 participants', value: 8 },
                    { name: '16 participants', value: 16 },
                    { name: '32 participants', value: 32 },
                    { name: '64 participants', value: 64 }
                )
        )
        .addChannelOption(option =>
            option
                .setName('canal')
                .setDescription('Canal (par défaut: canal actuel)')
                .setRequired(false)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('ajouter-participant')
        .setDescription('Ajouter manuellement un participant à un tournoi (pour tests)')
        .addIntegerOption(option =>
            option
                .setName('tournament_id')
                .setDescription('ID du tournoi')
                .setRequired(true)
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Utilisateur à ajouter')
                .setRequired(true)
        )
);

const createRegistrationComponents = (tournamentId) => {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pvp_register_${tournamentId}`)
            .setLabel('S\'inscrire')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId(`pvp_leave_${tournamentId}`)
            .setLabel('Se désinscrire')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
    );
};

const handleCreate = async (interaction) => {
    try {
        if (!interaction || !interaction.options) {
            return interaction.editReply({
                content: '❌ Erreur: Interaction invalide.'
            });
        }

        const durationOption = interaction.options.get('duree_inscription');
        if (!durationOption || durationOption.type !== 3 || !durationOption.value) {
            return interaction.editReply({
                content: '❌ Durée invalide! Utilisez: 1h, 30m, 2d, ou 1h30m'
            });
        }

        const duration = parseDuration(durationOption.value);
        if (!duration || duration < 60000) {
            return interaction.editReply({
                content: '❌ Durée invalide! La durée minimale est 1 minute. Utilisez: 1h, 30m, 2d, ou 1h30m'
            });
        }

        const maxParticipants = interaction.options.getInteger('max_participants');
        if (!maxParticipants || ![8, 16, 32, 64].includes(maxParticipants)) {
            return interaction.editReply({
                content: '❌ Nombre de participants invalide! Doit être 8, 16, 32 ou 64.'
            });
        }

        const channel = interaction.options.getChannel('canal') || interaction.channel;

        if (!channel || !channel.isTextBased()) {
            return interaction.editReply({
                content: '❌ Canal invalide ou non accessible!'
            });
        }

        if (!interaction.guild) {
            return interaction.editReply({
                content: '❌ Cette commande doit être utilisée dans un serveur!'
            });
        }

        const entryEndTime = new Date(Date.now() + duration);
        const entryEndTimeStr = entryEndTime.toISOString().slice(0, 19).replace('T', ' ');

        const embed = PvpTournamentEmbedFactory.createRegistrationEmbed(
            { max_entries: maxParticipants, entry_end_time: entryEndTime },
            0,
            interaction.guild
        );
        const components = createRegistrationComponents(0);

        const message = await channel.send({ embeds: [embed], components: [components] });

        const tournamentId = await tournamentService.createTournament({
            messageId: message.id,
            channelId: channel.id,
            guildId: interaction.guild.id,
            maxEntries: maxParticipants,
            entryDurationMs: duration,
            entryEndTime: entryEndTimeStr,
            createdBy: interaction.user.id
        });

        await message.edit({ components: [createRegistrationComponents(tournamentId)] });

        const participantListEmbed = PvpTournamentEmbedFactory.createParticipantListEmbed(
            [],
            { max_entries: maxParticipants },
            interaction.guild
        );
        const participantListMessage = await channel.send({ embeds: [participantListEmbed] });
        await tournamentService.updateParticipantListMessageId(tournamentId, participantListMessage.id);


        const registrationTimer = setTimeout(async () => {
            try {
                const tournament = await tournamentService.getTournament(tournamentId);
                if (!tournament) {
                    logger.error(`Tournament ${tournamentId} not found when registration ended`);
                    return;
                }

                if (tournament.status !== 'registration') {
                    logger.info(`Tournament ${tournamentId} status is ${tournament.status}, skipping bracket generation`);
                    return;
                }

                const participants = await tournamentService.getParticipants(tournamentId);
                const participantCount = participants.length;

                if (participantCount >= 2) {
                    logger.info(`Generating brackets for tournament ${tournamentId} with ${participantCount} participants`);
                    await tournamentService.generateBrackets(tournamentId);

                    const updatedTournament = await tournamentService.getTournament(tournamentId);
                    const startEmbed = PvpTournamentEmbedFactory.createTournamentStartEmbed(
                        updatedTournament,
                        interaction.guild
                    );
                    await channel.send({ embeds: [startEmbed] });
                } else {
                    logger.warn(`Tournament ${tournamentId} cancelled: only ${participantCount} participants (minimum 2)`);
                    await tournamentService.updateStatus(tournamentId, 'cancelled');
                    await channel.send({
                        content: `❌ L'événement PvP a été annulé car il n'y a pas assez de participants (${participantCount}/2 minimum requis).`
                    });
                }
            } catch (error) {
                logger.error(`Failed to end registration period for tournament ${tournamentId}`, error);
                try {
                    const channel = await interaction.client.channels.fetch(tournament.channel_id).catch(() => null);
                    if (channel) {
                        await channel.send({
                            content: `❌ Erreur lors de la génération des brackets: ${error.message || 'Erreur inconnue'}`
                        });
                    }
                } catch (sendError) {
                    logger.error('Failed to send error message to channel', sendError);
                }
            }
        }, duration);




        await interaction.editReply({ content: `✅ Événement PvP créé dans ${channel}!` });
    } catch (error) {
        logger.error('Failed to create PvP event', error);
        await interaction.editReply({
            content: `❌ Échec de la création de l'événement PvP: ${error.message || 'Erreur inconnue'}`
        });
    }
};

const handleAddParticipant = async (interaction) => {
    try {
        const tournamentId = interaction.options.getInteger('tournament_id');
        const user = interaction.options.getUser('user');

        if (!tournamentId || !user) {
            return interaction.editReply({
                content: '❌ Tournament ID et utilisateur sont requis.'
            });
        }

        const tournament = await tournamentService.getTournament(tournamentId);
        if (!tournament) {
            return interaction.editReply({
                content: '❌ Tournoi introuvable!'
            });
        }

        if (tournament.guild_id !== interaction.guild.id) {
            return interaction.editReply({
                content: '❌ Ce tournoi n\'est pas de ce serveur!'
            });
        }

        if (tournament.status !== 'registration') {
            return interaction.editReply({
                content: '❌ Les inscriptions sont fermées pour ce tournoi!'
            });
        }

        const participants = await tournamentService.getParticipants(tournamentId);
        const isAlreadyRegistered = participants.some(p => p.user_id === user.id);

        if (isAlreadyRegistered) {
            return interaction.editReply({
                content: '❌ Cet utilisateur est déjà inscrit au tournoi!'
            });
        }

        const participantCount = participants.length;
        if (participantCount >= tournament.max_entries) {
            return interaction.editReply({
                content: `❌ Le tournoi est plein! (${participantCount}/${tournament.max_entries} participants)`
            });
        }

        const userTag = user.tag || `${user.username}#${user.discriminator || '0'}`;
        const success = await tournamentService.addParticipant(
            tournamentId,
            user.id,
            user.username,
            userTag
        );

        if (!success) {
            return interaction.editReply({
                content: '❌ Échec de l\'ajout du participant. L\'utilisateur est peut-être déjà inscrit.'
            });
        }

        const updatedParticipants = await tournamentService.getParticipants(tournamentId);
        const newParticipantCount = updatedParticipants.length;

        const channel = await interaction.client.channels.fetch(tournament.channel_id).catch(() => null);
        if (channel) {
            try {
                const mainMessage = await channel.messages.fetch(tournament.message_id).catch(() => null);
                if (mainMessage) {
                    const updatedEmbed = PvpTournamentEmbedFactory.createRegistrationEmbed(
                        tournament,
                        newParticipantCount,
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
            content: `✅ Participant ajouté avec succès! <@${user.id}> est maintenant inscrit. (${newParticipantCount}/${tournament.max_entries} participants)`
        });
    } catch (error) {
        logger.error('Failed to add participant manually', error);
        await interaction.editReply({
            content: `❌ Échec de l'ajout du participant: ${error.message || 'Erreur inconnue'}`
        });
    }
};

module.exports = {
    data: command,
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'creer') {
            await handleCreate(interaction);
        } else if (subcommand === 'ajouter-participant') {
            await handleAddParticipant(interaction);
        }
    }
};