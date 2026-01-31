const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');
const { EMBED_COLORS } = require('../../utils/constants');
const { setServerFooter } = require('../../utils/embed-helper');
const logger = require('../../utils/logger');


const modalParams = new Map();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

setInterval(() => {
    const now = Date.now();
    for (const [id, data] of modalParams.entries()) {
        if (now - data.timestamp > CLEANUP_INTERVAL) {
            modalParams.delete(id);
        }
    }
}, CLEANUP_INTERVAL);

const command = new SlashCommandBuilder()
    .setName('ping-embed')
    .setDescription('Créer un embed de ping stylisé')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(option =>
        option
            .setName('ping_everyone')
            .setDescription('Mentionner @everyone (défaut: false)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('couleur')
            .setDescription('Couleur de l\'embed (hex, ex: #5865F2) ou nom (primary, success, error, warning)')
            .setRequired(false)
    )
    .addChannelOption(option =>
        option
            .setName('canal')
            .setDescription('Canal où envoyer l\'embed (défaut: canal actuel)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('image')
            .setDescription('URL de l\'image à afficher (optionnel)')
            .setRequired(false)
    )
    .addBooleanOption(option =>
        option
            .setName('utiliser_image_serveur')
            .setDescription('Utiliser l\'image du serveur (défaut: false)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('message_id')
            .setDescription('ID du message à convertir en embed (optionnel, si fourni, pas de modal)')
            .setRequired(false)
    );

const parseColor = (colorInput) => {
    if (!colorInput) return EMBED_COLORS.PRIMARY;


    const colorMap = {
        'primary': EMBED_COLORS.PRIMARY,
        'success': EMBED_COLORS.SUCCESS,
        'error': EMBED_COLORS.ERROR,
        'warning': EMBED_COLORS.WARNING
    };

    if (colorMap[colorInput.toLowerCase()]) {
        return colorMap[colorInput.toLowerCase()];
    }


    if (colorInput.startsWith('#')) {
        const hex = colorInput.slice(1);
        const parsed = parseInt(hex, 16);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFFFFFF) {
            return parsed;
        }
    }


    const parsed = parseInt(colorInput, 16);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFFFFFF) {
        return parsed;
    }


    return EMBED_COLORS.PRIMARY;
};

const createPingEmbedModal = (pingEveryone, couleur, channelId, imageUrl, utiliserImageServeur) => {

    const randomId = Math.random().toString(36).substr(2, 9);
    const modalId = `ping_embed_${randomId}`;


    modalParams.set(modalId, {
        pingEveryone,
        couleur,
        channelId,
        imageUrl,
        utiliserImageServeur,
        timestamp: Date.now()
    });

    const modal = new ModalBuilder()
        .setCustomId(modalId)
        .setTitle('Créer un embed de ping');

    const titreInput = new TextInputBuilder()
        .setCustomId('titre')
        .setLabel('Titre de l\'embed')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('🚀 SAISON 3 — C\'EST PARTI ! 🚀')
        .setRequired(false)
        .setMaxLength(256);

    const contenuInput = new TextInputBuilder()
        .setCustomId('contenu')
        .setLabel('Contenu de l\'embed')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Collez votre texte ici avec les sauts de ligne...')
        .setRequired(true)
        .setMaxLength(2000);

    const titreRow = new ActionRowBuilder().addComponents(titreInput);
    const contenuRow = new ActionRowBuilder().addComponents(contenuInput);
    modal.addComponents(titreRow, contenuRow);

    return modal;
};

const handlePingEmbed = async (interaction) => {
    try {

        if (interaction.isModalSubmit()) {
            const modalId = interaction.customId;
            const params = modalParams.get(modalId);

            if (!params) {
                return interaction.reply({
                    content: '❌ Session expirée. Veuillez relancer la commande.',
                    ephemeral: true
                });
            }


            modalParams.delete(modalId);

            const { pingEveryone, couleur, channelId, imageUrl, utiliserImageServeur } = params;
            const titre = interaction.fields.getTextInputValue('titre');
            const contenu = interaction.fields.getTextInputValue('contenu');
            const channel = channelId
                ? await (async () => {
                    const { CacheHelpers } = require('../../utils/discord-cache');
                    return CacheHelpers.getChannel(interaction.client, channelId, 5 * 60 * 1000).catch(() => null);
                })()
                : interaction.channel;

            if (!contenu || contenu.trim().length === 0) {
                return interaction.reply({
                    content: '❌ Le contenu ne peut pas être vide!',
                    ephemeral: true
                });
            }

            if (!channel || !channel.isTextBased()) {
                return interaction.reply({
                    content: '❌ Canal invalide ou non accessible!',
                    ephemeral: true
                });
            }

            if (!interaction.guild) {
                return interaction.reply({
                    content: '❌ Cette commande doit être utilisée dans un serveur!',
                    ephemeral: true
                });
            }


            if (contenu.length > 2000) {
                return interaction.reply({
                    content: '❌ Le contenu est trop long! Maximum 2000 caractères.',
                    ephemeral: true
                });
            }


            const embed = new EmbedBuilder()
                .setDescription(contenu)
                .setColor(parseColor(couleur))
                .setTimestamp();


            if (titre && titre.trim().length > 0) {
                embed.setTitle(titre.trim());
            }


            if (imageUrl && imageUrl !== 'default') {
                embed.setImage(imageUrl);
            } else if (utiliserImageServeur && interaction.guild.iconURL()) {
                embed.setImage(interaction.guild.iconURL({ dynamic: true, size: 1024 }));
            }


            setServerFooter(embed, interaction.guild);


            const content = pingEveryone ? '@everyone' : null;


            await channel.send({
                content: content,
                embeds: [embed]
            });

            await interaction.reply({
                content: `✅ Embed créé dans ${channel}!`,
                ephemeral: true
            });
            return;
        }


        if (!interaction.deferred && !interaction.replied) {
            const messageId = interaction.options.getString('message_id');


            if (messageId) {
                try {

                    const targetChannel = interaction.options.getChannel('canal') || interaction.channel;
                    const message = await targetChannel.messages.fetch(messageId).catch(() => null);

                    if (!message) {
                        return interaction.reply({
                            content: '❌ Message introuvable! Vérifiez l\'ID du message et que le bot peut accéder au canal.',
                            ephemeral: true
                        });
                    }

                    const messageContent = message.content.trim();
                    if (!messageContent || messageContent.length === 0) {
                        return interaction.reply({
                            content: '❌ Le message est vide!',
                            ephemeral: true
                        });
                    }


                    const lines = messageContent.split('\n');
                    const titre = lines[0].trim();
                    const description = lines.slice(1).join('\n').trim();

                    if (!description || description.length === 0) {
                        return interaction.reply({
                            content: '❌ Le message doit contenir au moins 2 lignes (titre + contenu)!',
                            ephemeral: true
                        });
                    }

                    if (titre.length > 256) {
                        return interaction.reply({
                            content: '❌ Le titre (première ligne) est trop long! Maximum 256 caractères.',
                            ephemeral: true
                        });
                    }

                    if (description.length > 2000) {
                        return interaction.reply({
                            content: '❌ Le contenu est trop long! Maximum 2000 caractères.',
                            ephemeral: true
                        });
                    }

                    const pingEveryone = interaction.options.getBoolean('ping_everyone') || false;
                    const couleur = interaction.options.getString('couleur');
                    const sendChannel = interaction.options.getChannel('canal') || interaction.channel;
                    const imageUrl = interaction.options.getString('image');
                    const utiliserImageServeur = interaction.options.getBoolean('utiliser_image_serveur') || false;

                    if (!sendChannel || !sendChannel.isTextBased()) {
                        return interaction.reply({
                            content: '❌ Canal invalide ou non accessible!',
                            ephemeral: true
                        });
                    }

                    if (!interaction.guild) {
                        return interaction.reply({
                            content: '❌ Cette commande doit être utilisée dans un serveur!',
                            ephemeral: true
                        });
                    }


                    const embed = new EmbedBuilder()
                        .setTitle(titre)
                        .setDescription(description)
                        .setColor(parseColor(couleur))
                        .setTimestamp();


                    if (imageUrl && imageUrl !== 'default') {
                        embed.setImage(imageUrl);
                    } else if (utiliserImageServeur && interaction.guild.iconURL()) {
                        embed.setImage(interaction.guild.iconURL({ dynamic: true, size: 1024 }));
                    }


                    setServerFooter(embed, interaction.guild);


                    const content = pingEveryone ? '@everyone' : null;


                    await sendChannel.send({
                        content: content,
                        embeds: [embed]
                    });

                    await interaction.reply({
                        content: `✅ Embed créé dans ${sendChannel} à partir du message!`,
                        ephemeral: true
                    });
                    return;
                } catch (error) {
                    logger.error('Failed to create embed from message', error);
                    return interaction.reply({
                        content: `❌ Échec: ${error.message || 'Erreur inconnue'}`,
                        ephemeral: true
                    });
                }
            }


            const pingEveryone = interaction.options.getBoolean('ping_everyone') || false;
            const couleur = interaction.options.getString('couleur');
            const channel = interaction.options.getChannel('canal');
            const imageUrl = interaction.options.getString('image');
            const utiliserImageServeur = interaction.options.getBoolean('utiliser_image_serveur') || false;

            const modal = createPingEmbedModal(
                pingEveryone,
                couleur,
                channel?.id || null,
                imageUrl || null,
                utiliserImageServeur
            );

            await interaction.showModal(modal);
        }
    } catch (error) {
        logger.error('Failed to create ping embed', error);
        if (interaction.isModalSubmit()) {
            await interaction.reply({
                content: `❌ Échec de la création de l'embed: ${error.message || 'Erreur inconnue'}`,
                ephemeral: true
            }).catch(() => {});
        } else {

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: `❌ Échec: ${error.message || 'Erreur inconnue'}`
                }).catch(() => {});
            } else {
                await interaction.reply({
                    content: `❌ Échec: ${error.message || 'Erreur inconnue'}`,
                    ephemeral: true
                }).catch(() => {});
            }
        }
    }
};

module.exports = {
    data: command,
    async execute(interaction) {
        try {
            await handlePingEmbed(interaction);
        } catch (error) {
            logger.error('Error in ping-embed command', error);
            if (interaction.isModalSubmit()) {
                await interaction.reply({
                    content: '❌ Une erreur est survenue lors de l\'exécution de la commande!',
                    ephemeral: true
                }).catch(() => {});
            } else {
                await interaction.editReply({
                    content: '❌ Une erreur est survenue lors de l\'exécution de la commande!'
                }).catch(() => {});
            }
        }
    },
    async handleModalSubmit(interaction) {
        try {
            await handlePingEmbed(interaction);
        } catch (error) {
            logger.error('Error in ping-embed modal', error);
            await interaction.reply({
                content: '❌ Une erreur est survenue lors de l\'exécution de la commande!',
                ephemeral: true
            }).catch(() => {});
        }
    }
};