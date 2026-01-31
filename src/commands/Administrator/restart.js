const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const GitManager = require('../../utils/git-manager');
const logger = require('../../utils/logger');
const { EMBED_COLORS } = require('../../utils/constants');
const { setServerFooter } = require('../../utils/embed-helper');

const command = new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Redémarrer le bot et récupérer les dernières modifications depuis GitHub')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

const createSuccessEmbed = (message, guild = null) => {
    const embed = new EmbedBuilder()
        .setTitle('✅ Succès')
        .setDescription(message)
        .setColor(EMBED_COLORS.SUCCESS)
        .setTimestamp();
    setServerFooter(embed, guild);
    return embed;
};

const createErrorEmbed = (message, guild = null) => {
    const embed = new EmbedBuilder()
        .setTitle('❌ Erreur')
        .setDescription(message)
        .setColor(EMBED_COLORS.ERROR)
        .setTimestamp();
    setServerFooter(embed, guild);
    return embed;
};

const createInfoEmbed = (message, guild = null) => {
    const embed = new EmbedBuilder()
        .setTitle('ℹ️ Information')
        .setDescription(message)
        .setColor(EMBED_COLORS.PRIMARY)
        .setTimestamp();
    setServerFooter(embed, guild);
    return embed;
};

let restartInProgress = false;

module.exports = {
    data: command,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        embeds: [createErrorEmbed('❌ Vous n\'avez pas la permission d\'utiliser cette commande.', interaction.guild)]
                    });
                } else {
                    await interaction.reply({
                        embeds: [createErrorEmbed('❌ Vous n\'avez pas la permission d\'utiliser cette commande.', interaction.guild)],
                        ephemeral: true
                    });
                }
            } catch (error) {
                logger.error('Failed to send permission error', error);
            }
            return;
        }

        let replied = interaction.deferred || interaction.replied;

        if (restartInProgress) {
            try {
                if (replied) {
                    await interaction.editReply({
                        embeds: [createInfoEmbed('🔄 Redémarrage déjà en cours. Veuillez patienter...', interaction.guild)]
                    });
                } else {
                    await interaction.reply({
                        embeds: [createInfoEmbed('🔄 Redémarrage déjà en cours. Veuillez patienter...', interaction.guild)],
                        ephemeral: true
                    });
                }
            } catch (error) {
                logger.error('Failed to send restart in progress message', error);
            }
            return;
        }

        try {
            if (!replied) {
                await interaction.deferReply({ ephemeral: true });
                replied = true;
            }

            restartInProgress = true;


            GitManager.pullFromGitHub().catch(() => { });

            await interaction.editReply({
                embeds: [createSuccessEmbed('🔄 Redémarrage immédiat...', interaction.guild)]
            }).catch(() => { });


            Object.keys(require.cache).forEach(key => {
                delete require.cache[key];
            });


            try {
                if (interaction.client && !interaction.client.destroyed) {
                    interaction.client.destroy();
                }
            } catch (error) {

            }

            restartInProgress = false;
            process.exit(0);

        } catch (error) {
            logger.error('Error in restart command', error);
            restartInProgress = false;

            if (replied && (interaction.deferred || interaction.replied)) {
                try {
                    await interaction.editReply({
                        embeds: [createErrorEmbed(
                            `Erreur lors du redémarrage:\n\`\`\`\n${error.message}\`\`\``,
                            interaction.guild
                        )]
                    }).catch(() => {
                        if (interaction.channel) {
                            interaction.channel.send({
                                embeds: [createErrorEmbed(
                                    `Erreur lors du redémarrage:\n\`\`\`\n${error.message}\`\`\``,
                                    interaction.guild
                                )]
                            }).catch(() => { });
                        }
                    });
                } catch (replyError) {
                    logger.error('Failed to send error message', replyError);
                }
            } else if (!replied) {
                try {
                    if (interaction.deferred) {
                        await interaction.editReply({
                            embeds: [createErrorEmbed(
                                `Erreur lors du redémarrage:\n\`\`\`\n${error.message}\`\`\``,
                                interaction.guild
                            )]
                        });
                    } else {
                        await interaction.reply({
                            embeds: [createErrorEmbed(
                                `Erreur lors du redémarrage:\n\`\`\`\n${error.message}\`\`\``,
                                interaction.guild
                            )],
                            ephemeral: true
                        });
                    }
                } catch (replyError) {
                    logger.error('Failed to send error message', replyError);
                }
            }
        }
    }
};