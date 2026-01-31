const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const { EMBED_COLORS } = require('../../utils/constants');
const { setServerFooter } = require('../../utils/embed-helper');

const command = new SlashCommandBuilder()
    .setName('servericon')
    .setDescription('Afficher l\'icône du serveur (Admin uniquement)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

module.exports = {
    data: command,
    async execute(interaction) {
        const guild = interaction.guild;
        const deferred = interaction.deferred || interaction.replied;

        if (!guild) {
            const content = 'Cette commande ne peut être utilisée que sur un serveur.';
            if (deferred) {
                return interaction.editReply({ content });
            }
            return interaction.reply({ content, ephemeral: true });
        }

        const iconUrl = guild.iconURL({ dynamic: true, size: 4096 });

        if (!iconUrl) {
            const content = 'Ce serveur n\'a pas d\'icône.';
            if (deferred) {
                return interaction.editReply({ content });
            }
            return interaction.reply({ content, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`Icône de ${guild.name}`)
            .setImage(iconUrl)
            .setColor(EMBED_COLORS.PRIMARY)
            .setTimestamp();

        setServerFooter(embed, guild);

        if (deferred) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    }
};