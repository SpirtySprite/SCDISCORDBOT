const logger = require('../utils/logger');
const clashRoyalRepository = require('../database/repositories/clash-royal.repository');
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

class ClashRoyalHandler {
    constructor(client) {
        this.client = client;
    }

    async handleJoin(interaction) {
        try {
            const roleId = '1460781490827956316';
            const added = await clashRoyalRepository.addEntry(interaction.user.id, interaction.user.username);

            if (added) {

                try {
                    const member = interaction.member;
                    if (member) {
                        await member.roles.add(roleId);
                        logger.info(`Gave Clash Royale role to ${interaction.user.tag}`);
                    }
                } catch (roleError) {
                    logger.error(`Failed to give role to ${interaction.user.tag}`, roleError);
                }

                await this.updateEventMessage(interaction);
                await interaction.editReply({ content: '✅ Vous avez rejoint l\'événement !' });
            } else {
                await interaction.editReply({ content: '❌ Vous êtes déjà inscrit !' });
            }

        } catch (error) {
            if (error.code === 10062) return;
            logger.error('Error handling Clash Royale join', error);
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: '❌ Une erreur est survenue.' });
                } else {
                    await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
                }
            } catch (replyError) {

            }
        }
    }

    async handleLeave(interaction) {
        try {
            const roleId = '1460781490827956316';

            const removed = await clashRoyalRepository.removeEntry(interaction.user.id);

            if (removed) {

                try {
                    const member = interaction.member;
                    if (member) {
                        await member.roles.remove(roleId);
                        logger.info(`Removed Clash Royale role from ${interaction.user.tag}`);
                    }
                } catch (roleError) {
                    logger.error(`Failed to remove role from ${interaction.user.tag}`, roleError);
                }

                await this.updateEventMessage(interaction);
                await interaction.editReply({ content: '✅ Vous vous êtes désinscrit de l\'événement.' });
            } else {
                await interaction.editReply({ content: '❌ Vous n\'êtes pas inscrit !' });
            }
        } catch (error) {
            if (error.code === 10062) return;
            logger.error('Error handling Clash Royale leave', error);
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: '❌ Une erreur est survenue.' });
                } else {
                    await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
                }
            } catch (replyError) {

            }
        }
    }

    async updateEventMessage(interaction) {

        try {
            const message = interaction.message;

            if (message) {
                const entries = await clashRoyalRepository.getEntries();


                const mainEmbed = message.embeds[0];
                const participantEmbed = message.embeds[1];

                if (participantEmbed) {
                    const newParticipantEmbed = EmbedBuilder.from(participantEmbed);


                    let participantList = '';
                    if (entries.length > 0) {
                        const total = entries.length;

                        const visibleEntries = entries.slice(-50);
                        const isTruncated = total > 50;

                        if (isTruncated) {
                            participantList = `> *... et ${total - 50} autres participants*\n\n`;
                        }

                        participantList += visibleEntries.map((e, i) => `**${total - visibleEntries.length + i + 1}.** ${e.username}`).join('\n');
                    } else {
                        participantList = '> *Aucun participant pour le moment*';
                    }

                    newParticipantEmbed.setDescription(participantList.substring(0, 4000));
                    newParticipantEmbed.setFooter({ text: `Total: ${entries.length} participant(s)` });

                    await message.edit({ embeds: [mainEmbed, newParticipantEmbed] });
                } else if (mainEmbed) {

                    const newEmbed = EmbedBuilder.from(mainEmbed);
                    const fieldName = 'Participants';

                    const total = entries.length;
                    const visibleEntries = entries.slice(-15);
                    const isTruncated = total > 15;

                    let participantList = visibleEntries.map(e => e.username).join('\n');
                    if (isTruncated) {
                        participantList = `... et ${total - 15} autres\n` + participantList;
                    }

                    const fields = newEmbed.data.fields || [];
                    const existingFieldIndex = fields.findIndex(f => f.name === fieldName);

                    if (existingFieldIndex !== -1) {
                        fields[existingFieldIndex].value = participantList.substring(0, 1024);
                        newEmbed.setFooter({ text: `Total: ${entries.length}` });
                    } else {
                        newEmbed.addFields({ name: fieldName, value: participantList.substring(0, 1024), inline: false });
                        newEmbed.setFooter({ text: `Total: ${entries.length}` });
                    }
                    await message.edit({ embeds: [newEmbed] });
                }
            }
        } catch (err) {
            logger.error('Failed to update event message', err);
        }
    }

    async syncExistingParticipants() {
        try {
            const roleId = '1460781490827956316';
            const entries = await clashRoyalRepository.getEntries();
            const guildId = config.bot.guildId;

            if (!entries.length) return;


            const guild = await this.client.guilds.fetch(guildId).catch(() => null);
            if (!guild) {
                logger.error('Could not find guild for Clash Royale role sync');
                return;
            }

            logger.info(`Found ${entries.length} participants to sync Clash Royale role. Starting background sync in 10 seconds...`);


            setTimeout(async () => {
                logger.debug('Starting Clash Royale role synchronization loop...');
                let count = 0;
                let alreadyHad = 0;
                let errorCount = 0;

                for (const entry of entries) {
                    try {

                        await new Promise(resolve => setTimeout(resolve, 200));

                        const member = await guild.members.fetch(entry.user_id).catch(() => null);
                        if (member) {
                            if (!member.roles.cache.has(roleId)) {
                                await member.roles.add(roleId);
                                count++;
                                if (count % 10 === 0) {
                                    logger.info(`Clash Royale sync progress: ${count} roles assigned...`);
                                }
                            } else {
                                alreadyHad++;
                            }
                        } else {
                            errorCount++;
                        }
                    } catch (err) {
                        errorCount++;
                        if (err.code !== 10007) {
                            logger.debug(`Could not sync role for ${entry.user_id}: ${err.message}`);
                        }
                    }
                }

                logger.success(`Clash Royale Sync Complete: ${count} assigned, ${alreadyHad} already had it, ${errorCount} errors/not in guild.`);
            }, 10000);

        } catch (error) {
            logger.error('Error starting Clash Royale background sync', error);
        }
    }
}

module.exports = ClashRoyalHandler;