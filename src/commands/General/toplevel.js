const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const levelRepository = require('../../database/repositories/level.repository');
const { calculateLevel } = require('../../utils/level-calculator');
const { CacheHelpers } = require('../../utils/discord-cache');
const logger = require('../../utils/logger');

function buildCommand() {
    const command = new SlashCommandBuilder()
        .setName('toplevel')
        .setDescription('Affiche le classement des niveaux');

    return command;
}

function formatXP(xp) {
    if (typeof xp !== 'number') return '0';
    if (xp >= 1000000) {
        return `${(xp / 1000000).toFixed(2)}M`;
    }
    if (xp >= 1000) {
        return `${(xp / 1000).toFixed(1)}k`;
    }
    return xp.toString();
}

function getRankDisplay(rank) {

    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    if (rank === 4) return '🏅';
    if (rank === 5) return '🎖️';
    return `#${rank}`;
}

function formatXPWithSpaces(xp) {

    return xp.toLocaleString('fr-FR', { useGrouping: true });
}

module.exports = {
    get data() {
        return buildCommand();
    },
    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;
            const maxEntries = 5;


            const leaderboard = await levelRepository.getLeaderboard(guildId, maxEntries, 0);

            if (leaderboard.length === 0) {
                return interaction.reply({
                    content: '❌ Aucun utilisateur dans le classement.',
                    ephemeral: true
                });
            }


            let leaderboardText = '';
            for (let i = 0; i < leaderboard.length; i++) {
                const user = leaderboard[i];
                const rank = i + 1;
                const rankDisplay = getRankDisplay(rank);


                const calculatedLevel = calculateLevel(user.total_xp);
                const level = calculatedLevel.level;


                const xpFormatted = formatXPWithSpaces(user.total_xp);

                try {

                    let discordUser = null;
                    let displayName = null;

                    try {
                        const guildMember = await CacheHelpers.getMember(interaction.guild, user.user_id, 2 * 60 * 1000);
                        discordUser = guildMember.user;

                        displayName = guildMember.displayName || guildMember.user.username;
                    } catch (guildError) {

                        discordUser = await CacheHelpers.getUser(interaction.client, user.user_id, 5 * 60 * 1000);
                        displayName = discordUser.username;
                    }




                    leaderboardText += `${rankDisplay} ${displayName} (@${discordUser.username})\n\n➥ Niveau ${level} (${xpFormatted} xp)\n\n`;
                } catch (error) {

                    logger.warn(`User ID ${user.user_id} not found or invalid: ${error.message}`);

                    leaderboardText += `${rankDisplay} <@${user.user_id}>\n\n➥ Niveau ${level} (${xpFormatted} xp)\n`;
                }
            }


            const minecraftVersion = '1.17 - 1.21.10';
            const guildName = interaction.guild.name;


            const embed = new EmbedBuilder()
                .setTitle(`Classement de niveaux de : ${guildName}`)
                .setDescription(leaderboardText || 'Aucun utilisateur trouvé')
                .setColor(0x0099FF)
                .setTimestamp();


            if (interaction.guild.iconURL()) {
                embed.setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }));
            }


            const footerText = `${guildName} : ${minecraftVersion}`;
            embed.setFooter({
                text: `🔹 ${footerText}`
            });


            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            await handleError(interaction, error, 'toplevel');
        }
    }
};