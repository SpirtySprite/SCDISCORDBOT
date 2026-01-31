const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const clashRoyalRepository = require('../../database/repositories/clash-royal.repository');
const logger = require('../../utils/logger');

const command = new SlashCommandBuilder()
    .setName('event')
    .setDescription('Gérer les événements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageAttributes)
    .addSubcommand(subcommand =>
        subcommand
            .setName('setup')
            .setDescription('Configurer l\'événement Clash Royale (Efface les anciennes données)')
            .addStringOption(option =>
                option
                    .setName('type')
                    .setDescription('Type d\'événement')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Clash Royale', value: 'clash_royale' }
                    )
            )
            .addChannelOption(option =>
                option
                    .setName('canal')
                    .setDescription('Canal pour l\'événement (facultatif)')
            )
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription('Utilisateur à mettre en avant (Thumbnail)')
            )
            .addBooleanOption(option =>
                option
                    .setName('reset')
                    .setDescription('Réinitialiser la liste des participants ? (Défaut: Non)')
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('entry')
            .setDescription('Voir les inscriptions actuelles')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('announce')
            .setDescription('Annoncer le début du tournoi Clash Royale')
            .addStringOption(option =>
                option
                    .setName('code')
                    .setDescription('Le code du tournoi')
                    .setRequired(true)
            )
    );

const createJoinButton = () => {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('clash_royal_join')
            .setLabel('Rejoindre')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚔️'),
        new ButtonBuilder()
            .setCustomId('clash_royal_leave')
            .setLabel('Se désinscrire')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✖️')
    );
};

const handleSetup = async (interaction) => {
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('canal') || interaction.channel;
    const user = interaction.options.getUser('user');
    const reset = interaction.options.getBoolean('reset') || false;

    if (type !== 'clash_royale') {
        return interaction.reply({ content: '❌ Type d\'événement non supporté pour le moment.', ephemeral: true });
    }

    if (!channel.isTextBased()) {
        return interaction.reply({ content: '❌ Le canal doit être textuel.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {

        if (reset) {
            await clashRoyalRepository.clearEntries();
        }


        const entries = await clashRoyalRepository.getEntries();

        const mainEmbed = new EmbedBuilder()
            .setTitle('🏆 Événement Clash Royale')
            .setDescription('**Un nouvel événement est lancé !**\n\nAppuyez sur le bouton **Rejoindre** ci-dessous pour participer.')
            .setColor(0xFFD700)
            .setTimestamp();

        if (user) {
            mainEmbed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }));
            mainEmbed.setFooter({ text: `Organisé par ${user.username}`, iconURL: user.displayAvatarURL() });
        } else {
            mainEmbed.setFooter({ text: 'Événement Clash Royale' });
        }

        const participantEmbed = new EmbedBuilder()
            .setTitle('👥 Participants')
            .setColor(0x2ecc71);

        if (entries.length > 0) {
            const participantList = entries.map((e, i) => `**${i + 1}.** ${e.username}`).join('\n');
            participantEmbed.setDescription(participantList.substring(0, 4096));
            participantEmbed.setFooter({ text: `Total: ${entries.length} participant(s)` });
        } else {
            participantEmbed.setDescription('> *Aucun participant pour le moment*');
            participantEmbed.setFooter({ text: 'Total: 0' });
        }

        const message = await channel.send({ embeds: [mainEmbed, participantEmbed], components: [createJoinButton()] });

        let statusMsg = `✅ Événement Clash Royale initialisé dans ${channel}.`;
        if (reset) {
            statusMsg += ' Les anciennes inscriptions ont été effacées.';
        } else {
            statusMsg += ` ${entries.length} participants récupérés.`;
        }

        await interaction.editReply({ content: statusMsg });

    } catch (error) {
        logger.error('Error setting up Clash Royale event', error);
        await interaction.editReply({ content: '❌ Une erreur est survenue lors de la configuration de l\'événement.' });
    }
};

const handleEntry = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
        const entries = await clashRoyalRepository.getEntries();

        const embed = new EmbedBuilder()
            .setTitle(`📜 Liste des Participants`)
            .setColor(0x2ecc71)
            .setTimestamp();

        if (entries.length > 0) {
            let description = entries.map((e, i) => `**${i + 1}.** <@${e.user_id}> (${e.username})`).join('\n');

            if (description.length > 4096) {
                const suffix = '\n... et d\'autres.';
                const cutOff = 4096 - suffix.length;
                const lastNeLine = description.lastIndexOf('\n', cutOff);
                description = description.substring(0, lastNeLine > 0 ? lastNeLine : cutOff) + suffix;
            }

            embed.setDescription(description);
            embed.setFooter({ text: `Total: ${entries.length} participant(s)` });
        } else {
            embed.setDescription('> *Aucun participant pour le moment.*');
            embed.setFooter({ text: 'Total: 0' });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error fetching entries', error);
        await interaction.editReply({ content: '❌ Une erreur est survenue lors de la récupération des inscriptions.' });
    }
};

const handleAnnounce = async (interaction) => {
    const code = interaction.options.getString('code');
    const roleId = '1460781490827956316';

    const message = `⚔️ **C’EST PARTI POUR LE TOURNOI CLASH ROYALE !** ⚔️

Salut <@&${roleId}> ! L’heure de s'affronter est arrivée. Le tournoi commence dès maintenant !

Rejoignez l'arène tout de suite avec les informations suivantes :

🔑 **Code du tournoi :** \`${code}\`

Préparez vos meilleurs decks et que le meilleur gagne ! Bonne chance à tous ! 🔥`;

    try {
        await interaction.reply({ content: message });
    } catch (error) {
        logger.error('Error sending announcement', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Une erreur est survenue lors de l\'envoi de l\'annonce.', ephemeral: true });
        }
    }
};

module.exports = {
    data: command,
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') {
            await handleSetup(interaction);
        } else if (subcommand === 'entry') {
            await handleEntry(interaction);
        } else if (subcommand === 'announce') {
            await handleAnnounce(interaction);
        }
    }
};