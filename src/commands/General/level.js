const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const levelRepository = require('../../database/repositories/level.repository');
const { calculateLevel, getProgressPercentage } = require('../../utils/level-calculator');
const logger = require('../../utils/logger');
const { setServerFooter } = require('../../utils/embed-helper');
const config = require('../../config');

function buildCommand() {
    const command = new SlashCommandBuilder()
        .setName('level')
        .setDescription('Affiche le niveau et l\'XP d\'un utilisateur')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('L\'utilisateur dont vous voulez voir le niveau (vous-même par défaut)')
                .setRequired(false)
        );

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

function calculateProgressBar(currentXP, nextXP, length = 10) {
    if (!nextXP || nextXP === 0) return '█'.repeat(length);
    const percentage = Math.min(100, (currentXP / nextXP) * 100);
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

module.exports = {
    get data() {
        return buildCommand();
    },
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;


            let userLevel = await levelRepository.findByUser(guildId, targetUser.id);

            if (!userLevel) {
                return interaction.reply({
                    content: `❌ ${targetUser.id === interaction.user.id ? 'Vous n\'avez' : `${targetUser.tag} n'a`} pas encore de niveau enregistré.`,
                    ephemeral: true
                });
            }


            const calculatedLevel = calculateLevel(userLevel.total_xp);


            const level = calculatedLevel.level;
            const currentXP = calculatedLevel.currentXP;
            const nextXP = calculatedLevel.nextXP;


            const userRank = userLevel.user_rank || await levelRepository.getUserRank(guildId, targetUser.id);
            const totalUsers = await levelRepository.getTotalUsers(guildId);


            const progressPercent = getProgressPercentage(currentXP, nextXP);


            const embed = new EmbedBuilder()
                .setAuthor({
                    name: `${targetUser.tag}`,
                    iconURL: targetUser.displayAvatarURL()
                })
                .setTitle('📊 Niveau')
                .setDescription(`**Niveau ${level}**`)
                .addFields(
                    {
                        name: '💎 XP Total',
                        value: `**${formatXP(userLevel.total_xp)}**`,
                        inline: true
                    },
                    {
                        name: '📈 Rang',
                        value: `**#${userRank}** / ${totalUsers}`,
                        inline: true
                    },
                    {
                        name: '🎯 XP dans le niveau',
                        value: `${formatXP(currentXP)} / ${formatXP(nextXP)}`,
                        inline: true
                    },
                    {
                        name: '📊 Progression',
                        value: `\`${calculateProgressBar(currentXP, nextXP)}\` ${progressPercent}%`,
                        inline: false
                    }
                )
                .setColor(0x5865F2)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            setServerFooter(embed, interaction.guild);


            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            await handleError(interaction, error, 'level');
        }
    }
};