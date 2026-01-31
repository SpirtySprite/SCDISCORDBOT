const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const giveawayService = require('../../services/giveaway.service');
const EmbedFactory = require('../../utils/embeds');
const { parseDuration, formatTime } = require('../../utils/helpers');
const config = require('../../config');
const logger = require('../../utils/logger');

const command = new SlashCommandBuilder()
    .setName('concours')
    .setDescription('Gérer les concours')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

command.addSubcommand(subcommand =>
    subcommand
        .setName('creer')
        .setDescription('Créer un nouveau concours')
        .addStringOption(option =>
            option
                .setName('duree')
                .setDescription('Durée (ex: 1h, 30m, 2d)')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('gagnants')
                .setDescription('Nombre de gagnants')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(config.giveaway.maxWinners)
        )
        .addStringOption(option =>
            option
                .setName('prix')
                .setDescription('Description du prix')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName('role_requis')
                .setDescription('Rôle requis (optionnel)')
                .setRequired(false)
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
        .setName('terminer')
        .setDescription('Terminer un concours plus tôt')
        .addStringOption(option =>
            option
                .setName('message_id')
                .setDescription('ID du message')
                .setRequired(true)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('retirer')
        .setDescription('Retirer les gagnants')
        .addStringOption(option =>
            option
                .setName('message_id')
                .setDescription('ID du message')
                .setRequired(true)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('reroll')
        .setDescription('Relancer le tirage au sort (nouveaux gagnants)')
        .addStringOption(option =>
            option
                .setName('message_id')
                .setDescription('ID du message du concours')
                .setRequired(true)
        )
);

command.addSubcommand(subcommand =>
    subcommand
        .setName('liste')
        .setDescription('Lister les concours actifs')
);

const createGiveawayComponents = (messageId) => {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`giveaway_enter_${messageId}`)
            .setLabel('Participer')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎉'),
        new ButtonBuilder()
            .setCustomId(`giveaway_leave_${messageId}`)
            .setLabel('Quitter')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🚪')
    );
};

const handleCreate = async (interaction) => {
    try {

        if (!interaction || !interaction.options) {
            return interaction.editReply({
                content: '❌ Erreur: Interaction invalide.'
            });
        }

        const durationOption = interaction.options.get('duree');
        if (!durationOption || durationOption.type !== 3 || !durationOption.value) {
            return interaction.editReply({
                content: '❌ Durée invalide! Utilisez: 1h, 30m, 2d, ou 1h30m'
            });
        }

        const duration = parseDuration(durationOption.value);
        if (!duration || duration < config.giveaway.minDuration) {
            return interaction.editReply({
                content: `❌ Durée invalide! La durée minimale est ${config.giveaway.minDuration}ms. Utilisez: 1h, 30m, 2d, ou 1h30m`
            });
        }

        const winners = interaction.options.getInteger('gagnants');
        if (!winners || winners < 1 || winners > config.giveaway.maxWinners) {
            return interaction.editReply({
                content: `❌ Nombre de gagnants invalide! Doit être entre 1 et ${config.giveaway.maxWinners}.`
            });
        }

        const prize = interaction.options.getString('prix');
        if (!prize || prize.trim().length === 0) {
            return interaction.editReply({
                content: '❌ Le prix est requis et ne peut pas être vide!'
            });
        }

        if (prize.length > 256) {
            return interaction.editReply({
                content: '❌ Le prix est trop long! Maximum 256 caractères.'
            });
        }

        const role = interaction.options.getRole('role_requis');
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

        const endTime = new Date(Date.now() + duration);
        const endTimeStr = endTime.toISOString().slice(0, 19).replace('T', ' ');

        const giveawayData = {
            prize,
            winners,
            end_time: endTime,
            created_by: interaction.user.id,
            requirements: role ? `Rôle requis: ${role}` : null
        };

        const embed = EmbedFactory.createGiveawayEmbed(giveawayData, [], interaction.client, interaction.guild);
        const components = createGiveawayComponents('temp');

        const message = await channel.send({ embeds: [embed], components: [components] });

        await giveawayService.createGiveaway({
            messageId: message.id,
            channelId: channel.id,
            guildId: interaction.guild.id,
            prize,
            winners,
            endTime: endTimeStr,
            createdBy: interaction.user.id,
            requirements: role ? `Rôle requis: ${role}` : null
        });

        await message.edit({ components: [createGiveawayComponents(message.id)] });
        await interaction.editReply({ content: `✅ Concours créé dans ${channel}!` });
    } catch (error) {
        logger.error('Failed to create giveaway', error);
        await interaction.editReply({
            content: `❌ Échec de la création du concours: ${error.message || 'Erreur inconnue'}`
        });
    }
};

const handleEnd = async (interaction) => {
    try {
        const messageId = interaction.options.getString('message_id');
        const giveaway = await giveawayService.getGiveawayByMessageId(messageId);

        if (!giveaway || giveaway.status === 'ended' || giveaway.guild_id !== interaction.guild.id) {
            return interaction.editReply({
                content: '❌ Concours introuvable ou déjà terminé!'
            });
        }

        const { CacheHelpers } = require('../../utils/discord-cache');
        const channel = await CacheHelpers.getChannel(interaction.client, giveaway.channel_id, 5 * 60 * 1000).catch(() => null);
        if (!channel) {
            return interaction.editReply({ content: '❌ Canal introuvable!' });
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
            return interaction.editReply({ content: '❌ Message introuvable!' });
        }

        const participants = await giveawayService.getParticipants(messageId);
        const winners = giveawayService.pickWinners(participants, giveaway.winners);

        await giveawayService.endGiveaway(messageId, winners);
        await message.edit({
            embeds: [EmbedFactory.createEndedEmbed(giveaway, winners, interaction.client, interaction.guild)],
            components: []
        });

        if (winners.length) {
            const giveawayHandler = require('../../handlers/giveaway.handler');
            const handler = new giveawayHandler(interaction.client);
            await Promise.all(winners.map(winnerId =>
                handler.sendWinnerMessage(channel, winnerId, giveaway.prize, false)
            ));
        }

        await interaction.editReply({
            content: `✅ Terminé! ${winners.length} gagnant(s).`
        });
    } catch (error) {
        logger.error('Failed to end giveaway', error);
        await interaction.editReply({
            content: `❌ Échec de la fin du concours: ${error.message || 'Erreur inconnue'}`
        });
    }
};

const handleReroll = async (interaction) => {
    try {
        const messageId = interaction.options.getString('message_id');
        const giveaway = await giveawayService.getGiveawayByMessageId(messageId);

        if (!giveaway || giveaway.status !== 'ended' || giveaway.guild_id !== interaction.guild.id) {
            return interaction.editReply({
                content: '❌ Concours introuvable ou encore actif!'
            });
        }

        const { CacheHelpers } = require('../../utils/discord-cache');
        const channel = await CacheHelpers.getChannel(interaction.client, giveaway.channel_id, 5 * 60 * 1000).catch(() => null);
        if (!channel) {
            return interaction.editReply({ content: '❌ Canal introuvable!' });
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
            return interaction.editReply({ content: '❌ Message introuvable!' });
        }

        const participants = await giveawayService.getParticipants(messageId);
        if (!participants.length) {
            return interaction.editReply({ content: '❌ Aucun participant!' });
        }


        const { safeJsonParse } = require('../../utils/helpers');
        const previousWinners = giveaway.winner_ids ? safeJsonParse(giveaway.winner_ids, []) : [];


        const eligibleParticipants = participants.filter(p => !previousWinners.includes(p));

        if (!eligibleParticipants.length) {
            return interaction.editReply({
                content: '❌ Aucun participant éligible! Tous les participants ont déjà gagné.'
            });
        }


        const winnerCount = Math.min(giveaway.winners || 1, eligibleParticipants.length);
        const newWinners = giveawayService.pickWinners(eligibleParticipants, winnerCount);



        await giveawayService.endGiveaway(messageId, newWinners);


        await message.edit({
            embeds: [EmbedFactory.createEndedEmbed(giveaway, newWinners, interaction.client, interaction.guild)],
            components: []
        });


        const giveawayHandler = require('../../handlers/giveaway.handler');
        const handler = new giveawayHandler(interaction.client);
        await Promise.all(newWinners.map(winnerId =>
            handler.sendWinnerMessage(channel, winnerId, giveaway.prize, true).catch(err => {
                logger.error(`Failed to send reroll winner message to ${winnerId}`, err);
            })
        ));


        const previousWinnersText = previousWinners.length
            ? previousWinners.map(id => `<@${id}>`).join(', ')
            : 'Aucun';

        await channel.send({
            content: `🎲 **Nouveau tirage au sort effectué!**\n\n**Anciens gagnants:** ${previousWinnersText}\n**Nouveaux gagnants:** ${newWinners.map(id => `<@${id}>`).join(', ')}`
        });

        await interaction.editReply({
            content: `✅ Nouveau tirage effectué! ${newWinners.length} nouveau(x) gagnant(s) sélectionné(s).`
        });
    } catch (error) {
        logger.error('Failed to reroll giveaway', error);
        await interaction.editReply({
            content: `❌ Échec du retirage: ${error.message || 'Erreur inconnue'}`
        });
    }
};

const handleList = async (interaction) => {
    try {
        const giveaways = await giveawayService.getActiveGiveaways(interaction.guild.id);

        if (!giveaways.length) {
            return interaction.editReply({ content: '📭 Aucun concours actif!' });
        }

        const embed = EmbedFactory.createListEmbed(giveaways, interaction.client, interaction.guild);
        const displayGiveaways = giveaways.slice(0, config.giveaway.maxListItems);

        for (const giveaway of displayGiveaways) {
            const { CacheHelpers } = require('../../utils/discord-cache');
        const channel = await CacheHelpers.getChannel(interaction.client, giveaway.channel_id, 5 * 60 * 1000).catch(() => null);
            const channelText = channel ? `<#${channel.id}>` : 'Inconnu';
            const timeText = formatTime(giveaway.end_time);

            embed.addFields({
                name: giveaway.prize,
                value: `**Canal:** ${channelText}\n**Se termine:** ${timeText}\n**Gagnants:** ${giveaway.winners}\n**ID:** \`${giveaway.message_id}\``,
                inline: false
            });
        }

        if (giveaways.length > config.giveaway.maxListItems) {
            const footerText = `Affichage de ${config.giveaway.maxListItems} sur ${giveaways.length} • 🔹 ${interaction.guild?.name || ''}`;
            embed.setFooter({
                text: footerText,
                iconURL: interaction.guild?.iconURL({ dynamic: true, size: 32 }) || undefined
            });
        } else {
            setServerFooter(embed, interaction.guild);
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.error('Failed to list giveaways', error);
        await interaction.editReply({
            content: `❌ Échec de la liste des concours: ${error.message || 'Erreur inconnue'}`
        });
    }
};

module.exports = {
    data: command,
    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'creer':
                    await handleCreate(interaction);
                    break;
                case 'terminer':
                    await handleEnd(interaction);
                    break;
                case 'retirer':
                    await handleReroll(interaction);
                    break;
                case 'reroll':
                    await handleReroll(interaction);
                    break;
                case 'liste':
                    await handleList(interaction);
                    break;
                default:
                    await interaction.editReply({
                        content: '❌ Sous-commande inconnue!'
                    });
            }
        } catch (error) {
            logger.error('Error in giveaway command', error);
            await interaction.editReply({
                content: '❌ Une erreur est survenue lors de l\'exécution de la commande!'
            });
        }
    },
    createGiveawayEmbed: EmbedFactory.createGiveawayEmbed,
    createGiveawayComponents
};