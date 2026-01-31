//const {
//    SlashCommandBuilder,
//    PermissionFlagsBits,
//    ModalBuilder,
//    TextInputBuilder,
//    TextInputStyle,
//    ActionRowBuilder,
//    EmbedBuilder,
//    StringSelectMenuBuilder,
//    StringSelectMenuOptionBuilder
//} = require('discord.js');
//const fs = require('fs');
//const path = require('path');
//const yaml = require('js-yaml');
//const { loadDiscordConfig, reloadDiscordConfig } = require('../../utils/yaml-loader');
//const { convertDurationToMs } = require('../../utils/helpers');
//const logger = require('../../utils/logger');
//const { setServerFooter } = require('../../utils/embed-helper');
//
//const command = new SlashCommandBuilder()
//    .setName('config')
//    .setDescription('Gérer la configuration du bot')
//    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
//
//command.addSubcommand(subcommand =>
//    subcommand
//        .setName('view')
//        .setDescription('Voir la configuration actuelle')
//        .addStringOption(option =>
//            option
//                .setName('section')
//                .setDescription('Section à afficher')
//                .setRequired(false)
//                .addChoices(
//                    { name: 'Bot', value: 'bot' },
//                    { name: 'Canaux', value: 'channels' },
//                    { name: 'Rôles', value: 'roles' },
//                    { name: 'Modération', value: 'moderation' },
//                    { name: 'Concours', value: 'giveaway' },
//                    { name: 'Tickets', value: 'tickets' },
//                    { name: 'Suggestions', value: 'suggestion' },
//                    { name: 'Marché', value: 'market' },
//                    { name: 'Logs d\'événements', value: 'eventLogs' },
//                    { name: 'Couleurs', value: 'colors' },
//                    { name: 'Messages', value: 'messages' },
//                    { name: 'Limites de débit', value: 'rateLimits' },
//                    { name: 'Fonctionnalités', value: 'features' },
//                    { name: 'Avancé', value: 'advanced' }
//                )
//        )
//);
//
//command.addSubcommand(subcommand =>
//    subcommand
//        .setName('edit')
//        .setDescription('Modifier une section de la configuration')
//        .addStringOption(option =>
//            option
//                .setName('section')
//                .setDescription('Section à modifier')
//                .setRequired(true)
//                .addChoices(
//                    { name: 'Bot', value: 'bot' },
//                    { name: 'Canaux', value: 'channels' },
//                    { name: 'Rôles', value: 'roles' },
//                    { name: 'Modération', value: 'moderation' },
//                    { name: 'Concours', value: 'giveaway' },
//                    { name: 'Tickets', value: 'tickets' },
//                    { name: 'Suggestions', value: 'suggestion' },
//                    { name: 'Marché', value: 'market' },
//                    { name: 'Logs d\'événements', value: 'eventLogs' },
//                    { name: 'Couleurs', value: 'colors' },
//                    { name: 'Messages', value: 'messages' },
//                    { name: 'Limites de débit', value: 'rateLimits' },
//                    { name: 'Fonctionnalités', value: 'features' },
//                    { name: 'Avancé', value: 'advanced' }
//                )
//        )
//);
//
//command.addSubcommand(subcommand =>
//    subcommand
//        .setName('reload')
//        .setDescription('Forcer le rechargement de la configuration')
//);
//
//function createEditModal(section, currentConfig) {
//    const modal = new ModalBuilder()
//        .setCustomId(`config_edit_${section}`)
//        .setTitle(`Modifier: ${section}`);
//
//    const components = [];
//    const sectionData = currentConfig[section] || {};
//
//    switch (section) {
//        case 'bot':
//            components.push(
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('status')
//                        .setLabel('Statut (online/idle/dnd/invisible)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.status || 'online')
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('activity_type')
//                        .setLabel('Type activité (PLAYING/WATCHING/etc)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.activity?.type || 'WATCHING')
//                        .setRequired(true)
//                        .setPlaceholder('PLAYING, WATCHING, LISTENING, STREAMING, COMPETING')
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('activity_text')
//                        .setLabel('Texte de l\'activité')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.activity?.text || 'Serenity Craft')
//                        .setRequired(true)
//                )
//            );
//            break;
//
//        case 'channels':
//            components.push(
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('modLogChannelId')
//                        .setLabel('ID Canal Logs Modération')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.modLogChannelId || '')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('eventLogChannelId')
//                        .setLabel('ID Canal Logs Événements')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.eventLogChannelId || '')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('suggestionChannelId')
//                        .setLabel('ID Canal Suggestions')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.suggestionChannelId || '')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('transcriptChannelId')
//                        .setLabel('ID Canal Transcripts')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.transcriptChannelId || '')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('giveawayChannelId')
//                        .setLabel('ID Canal Concours')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.giveawayChannelId || '')
//                        .setRequired(false)
//                )
//            );
//            break;
//
//        case 'roles':
//            components.push(
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('staffRoleId')
//                        .setLabel('ID Rôle Staff')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.staffRoleId || '')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('adminRoleId')
//                        .setLabel('ID Rôle Admin')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.adminRoleId || '')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('moderatorRoleId')
//                        .setLabel('ID Rôle Modérateur')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.moderatorRoleId || '')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('autoRoles')
//                        .setLabel('Auto-rôles (IDs séparés par des virgules)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(Array.isArray(sectionData.autoRoles) ? sectionData.autoRoles.join(', ') : '')
//                        .setRequired(false)
//                )
//            );
//            break;
//
//        case 'moderation':
//            components.push(
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('enabled')
//                        .setLabel('Activé (true/false)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.enabled ?? true))
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('logChannelId')
//                        .setLabel('ID Canal Logs')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.logChannelId || '')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('defaultTimeoutDuration')
//                        .setLabel('Durée Timeout par défaut (ex: 10m, 1h)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.defaultTimeoutDuration ? String(sectionData.defaultTimeoutDuration) : '10m')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('requireReason')
//                        .setLabel('Raison requise (true/false)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.requireReason ?? false))
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('sendDM')
//                        .setLabel('Envoyer MP (true/false)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.sendDM ?? true))
//                        .setRequired(true)
//                )
//            );
//            break;
//
//        case 'giveaway':
//            components.push(
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('enabled')
//                        .setLabel('Activé (true/false)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.enabled ?? true))
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('checkInterval')
//                        .setLabel('Intervalle vérification (ex: 5m, 1h)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.checkInterval ? String(sectionData.checkInterval) : '5m')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('minDuration')
//                        .setLabel('Durée minimale (ex: 1m, 30s)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.minDuration ? String(sectionData.minDuration) : '1m')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('maxWinners')
//                        .setLabel('Gagnants maximum')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.maxWinners ?? 20))
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('defaultChannelId')
//                        .setLabel('ID Canal par défaut')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.defaultChannelId || '')
//                        .setRequired(false)
//                )
//            );
//            break;
//
//        case 'tickets':
//            components.push(
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('enabled')
//                        .setLabel('Activé (true/false)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.enabled ?? true))
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('staffRoleId')
//                        .setLabel('ID Rôle Staff')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.staffRoleId || '')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('transcriptChannelId')
//                        .setLabel('ID Canal Transcripts')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.transcriptChannelId || '')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('deleteAfterClose')
//                        .setLabel('Supprimer après fermeture (true/false)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.deleteAfterClose ?? false))
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('deleteDelay')
//                        .setLabel('Délai suppression (ex: 5s, 1m)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.deleteDelay ? String(sectionData.deleteDelay) : '5s')
//                        .setRequired(false)
//                )
//            );
//            break;
//
//        case 'suggestion':
//            components.push(
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('enabled')
//                        .setLabel('Activé (true/false)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.enabled ?? true))
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('channelId')
//                        .setLabel('ID Canal Suggestions')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.channelId || '')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('requireApproval')
//                        .setLabel('Approbation requise (true/false)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.requireApproval ?? false))
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('allowAnonymous')
//                        .setLabel('Autoriser anonyme (true/false)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.allowAnonymous ?? false))
//                        .setRequired(true)
//                )
//            );
//            break;
//
//        case 'market':
//            components.push(
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('enabled')
//                        .setLabel('Activé (true/false)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.enabled ?? true))
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('rotationEnabled')
//                        .setLabel('Rotation activée (true/false)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.rotationEnabled ?? true))
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('itemsPerRotation')
//                        .setLabel('Objets par rotation')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.itemsPerRotation ?? 8))
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('buffMultiplier')
//                        .setLabel('Multiplicateur Buff')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.buffMultiplier ?? 1.5))
//                        .setRequired(true)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('nerfMultiplier')
//                        .setLabel('Multiplicateur Nerf')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(String(sectionData.nerfMultiplier ?? 0.6666667))
//                        .setRequired(true)
//                )
//            );
//            break;
//
//        case 'rateLimits':
//            components.push(
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('commandCooldown')
//                        .setLabel('Cooldown Commandes (ex: 3s, 1m)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.commandCooldown ? String(sectionData.commandCooldown) : '3s')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('giveawayCreateCooldown')
//                        .setLabel('Cooldown Création Concours (ex: 1m)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.giveawayCreateCooldown ? String(sectionData.giveawayCreateCooldown) : '1m')
//                        .setRequired(false)
//                ),
//                new ActionRowBuilder().addComponents(
//                    new TextInputBuilder()
//                        .setCustomId('ticketCreateCooldown')
//                        .setLabel('Cooldown Création Tickets (ex: 30s)')
//                        .setStyle(TextInputStyle.Short)
//                        .setValue(sectionData.ticketCreateCooldown ? String(sectionData.ticketCreateCooldown) : '30s')
//                        .setRequired(false)
//                )
//            );
//            break;
//
//        default:
//            return null;
//    }
//
//    modal.addComponents(...components);
//    return modal;
//}
//
//function updateConfigFile(section, values) {
//    const configPath = path.join(__dirname, '../../config/discordconfig.yml');
//
//    try {
//        const fileContents = fs.readFileSync(configPath, 'utf8');
//        const yamlConfig = yaml.load(fileContents) || {};
//
//        if (!yamlConfig.Discord) {
//            yamlConfig.Discord = {};
//        }
//
//        if (!yamlConfig.Discord[section]) {
//            yamlConfig.Discord[section] = {};
//        }
//
//
//        Object.keys(values).forEach(key => {
//            if (values[key] !== null && values[key] !== undefined && values[key] !== '') {
//
//                if (key === 'autoRoles' && typeof values[key] === 'string') {
//                    yamlConfig.Discord[section][key] = values[key].split(',').map(id => id.trim()).filter(id => id);
//                } else if (typeof values[key] === 'string' && (values[key].toLowerCase() === 'true' || values[key].toLowerCase() === 'false')) {
//                    yamlConfig.Discord[section][key] = values[key].toLowerCase() === 'true';
//                } else if (section === 'channels' && (key.includes('ChannelId') || key.includes('channelId'))) {
//
//                    yamlConfig.Discord[section][key] = String(values[key]);
//                } else if (section === 'roles' && (key.includes('RoleId') || key.includes('roleId') || key === 'autoRoles')) {
//
//                    if (key === 'autoRoles') {
//                        yamlConfig.Discord[section][key] = Array.isArray(values[key])
//                            ? values[key].map(id => String(id))
//                            : values[key].split(',').map(id => String(id.trim())).filter(id => id);
//                    } else {
//                        yamlConfig.Discord[section][key] = String(values[key]);
//                    }
//                } else if (typeof values[key] === 'string' && !isNaN(values[key]) && values[key] !== '' && !values[key].includes('ms') && !values[key].includes('s') && !values[key].includes('m') && !values[key].includes('h') && !values[key].includes('d')) {
//
//                    const num = parseFloat(values[key]);
//                    if (!isNaN(num) && isFinite(num)) {
//                        yamlConfig.Discord[section][key] = num;
//                    } else {
//                        yamlConfig.Discord[section][key] = values[key];
//                    }
//                } else {
//                    yamlConfig.Discord[section][key] = values[key];
//                }
//            } else if (values[key] === '' || values[key] === null) {
//
//                yamlConfig.Discord[section][key] = null;
//            }
//        });
//
//
//        if (section === 'bot' && values.activity_type && values.activity_text) {
//            if (!yamlConfig.Discord.bot.activity) {
//                yamlConfig.Discord.bot.activity = {};
//            }
//            yamlConfig.Discord.bot.activity.type = values.activity_type;
//            yamlConfig.Discord.bot.activity.text = values.activity_text;
//            delete values.activity_type;
//            delete values.activity_text;
//        }
//
//
//        const yamlString = yaml.dump(yamlConfig, {
//            indent: 2,
//            lineWidth: -1,
//            noRefs: true,
//            sortKeys: false
//        });
//
//        fs.writeFileSync(configPath, yamlString, 'utf8');
//        return true;
//    } catch (error) {
//        logger.error('Erreur lors de la mise à jour du fichier de configuration', error);
//        throw error;
//    }
//}
//
//function formatConfigValue(value) {
//    if (value === null || value === undefined) return '`null`';
//    if (typeof value === 'object') {
//        return '```json\n' + JSON.stringify(value, null, 2) + '\n```';
//    }
//    return `\`${value}\``;
//}
//
//async function handleView(interaction) {
//    const section = interaction.options.getString('section');
//    const config = loadDiscordConfig();
//
//    if (!section) {
//
//        const embed = new EmbedBuilder()
//            .setTitle('📋 Configuration du Bot')
//            .setDescription('Utilisez `/config view <section>` pour voir les détails d\'une section')
//            .addFields(
//                { name: 'Bot', value: 'Statut et activité', inline: true },
//                { name: 'Canaux', value: 'IDs des canaux', inline: true },
//                { name: 'Rôles', value: 'IDs des rôles', inline: true },
//                { name: 'Modération', value: 'Paramètres de modération', inline: true },
//                { name: 'Concours', value: 'Paramètres des concours', inline: true },
//                { name: 'Tickets', value: 'Paramètres des tickets', inline: true },
//                { name: 'Suggestions', value: 'Paramètres des suggestions', inline: true },
//                { name: 'Marché', value: 'Paramètres du marché', inline: true },
//                { name: 'Logs d\'événements', value: 'Paramètres des logs', inline: true }
//            )
//            .setColor(0x5865F2)
//            .setTimestamp();
//
//        setServerFooter(embed, interaction.guild);
//        await interaction.editReply({ embeds: [embed] });
//        return;
//    }
//
//    const sectionData = config[section];
//    if (!sectionData) {
//        await interaction.editReply({
//            content: `❌ Section "${section}" introuvable.`
//        });
//        return;
//    }
//
//    const embed = new EmbedBuilder()
//        .setTitle(`📋 Configuration: ${section}`)
//        .setColor(0x5865F2)
//        .setTimestamp();
//
//
//    const fields = [];
//    for (const [key, value] of Object.entries(sectionData)) {
//        if (key === 'activity' && typeof value === 'object') {
//            fields.push({
//                name: 'Activity',
//                value: `Type: ${value.type || 'N/A'}\nText: ${value.text || 'N/A'}`,
//                inline: false
//            });
//        } else if (Array.isArray(value)) {
//            fields.push({
//                name: key,
//                value: value.length > 0 ? value.join(', ') : 'Aucun',
//                inline: true
//            });
//        } else {
//            fields.push({
//                name: key,
//                value: formatConfigValue(value),
//                inline: true
//            });
//        }
//    }
//
//    embed.addFields(fields);
//    setServerFooter(embed, interaction.guild);
//    await interaction.editReply({ embeds: [embed] });
//}
//
//async function handleEdit(interaction) {
//    const section = interaction.options.getString('section');
//    const config = loadDiscordConfig();
//
//    const modal = createEditModal(section, config);
//    if (!modal) {
//        if (interaction.deferred || interaction.replied) {
//            await interaction.editReply({
//                content: `❌ Section "${section}" ne peut pas être modifiée via cette commande.`
//            });
//        } else {
//            await interaction.reply({
//                content: `❌ Section "${section}" ne peut pas être modifiée via cette commande.`,
//                ephemeral: true
//            });
//        }
//        return;
//    }
//
//
//    if (interaction.deferred || interaction.replied) {
//        await interaction.followUp({
//            content: '❌ Impossible d\'afficher le modal car l\'interaction a déjà été répondue.',
//            ephemeral: true
//        });
//        return;
//    }
//
//    await interaction.showModal(modal);
//}
//
//async function handleModalSubmit(interaction) {
//    const section = interaction.customId.replace('config_edit_', '');
//    const fields = interaction.fields;
//
//    const values = {};
//    fields.fields.forEach(field => {
//        values[field.customId] = field.value;
//    });
//
//    try {
//        updateConfigFile(section, values);
//
//
//        reloadDiscordConfig();
//
//        const embed = new EmbedBuilder()
//            .setTitle('✅ Configuration mise à jour')
//            .setDescription(`La section **${section}** a été mise à jour avec succès.\n\nLes changements seront appliqués automatiquement.`)
//            .setColor(0x57F287)
//            .setTimestamp();
//
//        setServerFooter(embed, interaction.guild);
//        await interaction.reply({ embeds: [embed], ephemeral: true });
//    } catch (error) {
//        const { handleError, createError, ERROR_CODES } = require('../../utils/error-handler');
//        const configError = error.code ? error : createError(
//            ERROR_CODES.CONFIG_LOAD_ERROR,
//            `Erreur lors de la mise à jour de la section ${section}`,
//            { section, originalError: error.message }
//        );
//        await handleError(interaction, configError, `config edit ${section}`);
//    }
//}
//
//async function handleReload(interaction) {
//    try {
//        reloadDiscordConfig();
//        const embed = new EmbedBuilder()
//            .setTitle('✅ Configuration rechargée')
//            .setDescription('La configuration a été rechargée avec succès.')
//            .setColor(0x57F287)
//            .setTimestamp();
//
//        setServerFooter(embed, interaction.guild);
//        await interaction.editReply({ embeds: [embed] });
//    } catch (error) {
//        logger.error('Erreur lors du rechargement de la configuration', error);
//        await interaction.editReply({
//            content: `❌ Erreur lors du rechargement: ${error.message}`
//        });
//    }
//}
//
//module.exports = {
//    data: command,
//    async execute(interaction) {
//        try {
//            const subcommand = interaction.options.getSubcommand();
//
//
//
//            if (subcommand === 'edit') {
//                if (interaction.deferred || interaction.replied) {
//                    await interaction.followUp({
//                        content: '❌ Impossible d\'afficher le modal car l\'interaction a déjà été répondue.',
//                        ephemeral: true
//                    });
//                    return;
//                }
//                await handleEdit(interaction);
//                return;
//            }
//
//
//            if (!interaction.deferred && !interaction.replied) {
//                await interaction.deferReply({ ephemeral: true });
//            }
//
//            switch (subcommand) {
//                case 'view':
//                    await handleView(interaction);
//                    break;
//                case 'reload':
//                    await handleReload(interaction);
//                    break;
//                default:
//                    if (interaction.deferred || interaction.replied) {
//                        await interaction.editReply({
//                            content: '❌ Sous-commande inconnue.'
//                        });
//                    } else {
//                        await interaction.reply({
//                            content: '❌ Sous-commande inconnue.',
//                            ephemeral: true
//                        });
//                    }
//            }
//        } catch (error) {
//            const { handleError } = require('../../utils/error-handler');
//            await handleError(interaction, error, 'config');
//        }
//    },
//    handleModalSubmit
//};