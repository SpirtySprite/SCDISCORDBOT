const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('./constants');
const { setServerFooter } = require('./embed-helper');

class TicketEmbedFactory {
    static createPanelEmbed(guild = null, stats = null) {
        const description = 'Souhaitez vous contacter le Staff ?\n\n' +
            'Si oui, alors vous êtes au bon endroit. Il vous suffit de créer un ticket !\n\n' +
            '**Rappel :** Tous ticket inutile pourra être sanctionné.';

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.PRIMARY)
            .setTitle('Ticket Staff')
            .setDescription(description)
            .setTimestamp();

        setServerFooter(embed, guild);
        return embed;
    }

    static createTicketCreatedEmbed(user, guild = null, customMessage = null) {
        let defaultDescription = `**Bienvenue ${user ? `<@${user.id}>` : 'dans votre ticket'} !**\n\nNotre équipe va vous répondre prochainement.\n\nUtilisez le bouton ci-dessous pour fermer ce ticket lorsque votre demande est résolue.`;

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.SUCCESS)
            .setTitle('✅ Ticket créé')
            .setDescription(customMessage || defaultDescription)
            .setTimestamp();

        setServerFooter(embed, guild);
        return embed;
    }

    static createTicketDetailsEmbed(formData, guild = null) {
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.PRIMARY)
            .setTitle('📋 Informations du ticket')
            .setDescription('Voici les informations fournies lors de la création du ticket :')
            .setTimestamp();

        if (formData && typeof formData === 'object') {
            for (const [label, value] of Object.entries(formData)) {
                embed.addFields({ name: label, value: `**${value}**`, inline: false });
            }
        } else {
            embed.setDescription('Aucune information supplémentaire fournie.');
        }

        setServerFooter(embed, guild);
        return embed;
    }

    static createTicketClosedEmbed(closedBy, guild = null) {
        const closedByTag = closedBy?.tag || closedBy?.username || 'Inconnu';
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.ERROR)
            .setTitle('🔒 Ticket fermé')
            .setDescription(`Ce ticket a été fermé par ${closedBy ? `<@${closedBy.id}>` : closedByTag}.\n\nVous pouvez ré-ouvrir ce ticket ou le supprimer définitivement.`)
            .setTimestamp();

        setServerFooter(embed, guild);
        return embed;
    }

    static createTicketReopenedEmbed(guild = null) {
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.SUCCESS)
            .setTitle('🔓 Ticket ré-ouvert')
            .setDescription('Ce ticket a été ré-ouvert avec succès.\n\nVous pouvez continuer votre conversation.')
            .setTimestamp();

        setServerFooter(embed, guild);
        return embed;
    }

    static createTicketDeletedEmbed(guild = null) {
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.ERROR)
            .setTitle('🗑️ Ticket supprimé')
            .setDescription('Ce ticket a été supprimé définitivement.')
            .setTimestamp();

        setServerFooter(embed, guild);
        return embed;
    }

    static createCloseConfirmationEmbed(guild = null) {
        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('⚠️ Confirmation requise')
            .setDescription('Êtes-vous sûr de vouloir fermer ce ticket ?\n\nCette action peut être annulée en ré-ouvrant le ticket.')
            .setTimestamp();

        setServerFooter(embed, guild);
        return embed;
    }

    static createDeleteConfirmationEmbed(guild = null) {
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.ERROR)
            .setTitle('⚠️ Confirmation de suppression')
            .setDescription('⚠️ **ATTENTION : Cette action est irréversible !**\n\nÊtes-vous sûr de vouloir supprimer définitivement ce ticket ?\n\nLe canal sera supprimé et toutes les données seront perdues.')
            .setTimestamp();

        setServerFooter(embed, guild);
        return embed;
    }

    static createTranscriptSavedEmbed(channel, guild = null) {
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.SUCCESS)
            .setTitle('📄 Transcript généré')
            .setDescription(`Le transcript a été sauvegardé dans ${channel}.`)
            .setTimestamp();

        setServerFooter(embed, guild);
        return embed;
    }

    static createTranscriptInfoEmbed(ticket, guild, channel, messages, attachmentsCount, usersInTranscript) {
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.PRIMARY)
            .setTitle('📄 Informations du transcript')
            .addFields(
                {
                    name: '🎫 ID du ticket',
                    value: `\`${ticket.ticket_id}\``,
                    inline: true
                },
                {
                    name: '👤 Propriétaire',
                    value: `<@${ticket.user_id}>`,
                    inline: true
                },
                {
                    name: '📊 Messages',
                    value: `${messages}`,
                    inline: true
                },
                {
                    name: '📎 Pièces jointes',
                    value: `${attachmentsCount}`,
                    inline: true
                },
                {
                    name: '🏷️ Serveur',
                    value: guild ? `${guild.name}` : 'N/A',
                    inline: true
                },
                {
                    name: '📁 Canal',
                    value: channel ? `#${channel.name}` : 'N/A',
                    inline: true
                }
            )
            .setTimestamp();

        if (usersInTranscript.length > 0) {
            const usersList = usersInTranscript.slice(0, 10).map((u, i) => `${i + 1}. ${u}`).join('\n');
            embed.addFields({
                name: `👥 Utilisateurs (${usersInTranscript.length})`,
                value: usersList + (usersInTranscript.length > 10 ? `\n*... et ${usersInTranscript.length - 10} autres*` : ''),
                inline: false
            });
        }

        setServerFooter(embed, guild);
        return embed;
    }

    static createTicketInfoEmbed(ticket, user, guild = null) {
        const statusEmoji = {
            'open': '🟢',
            'closed': '🔴',
            'deleted': '⚫'
        };

        const statusText = {
            'open': 'Ouvert',
            'closed': 'Fermé',
            'deleted': 'Supprimé'
        };

        const embed = new EmbedBuilder()
            .setTitle('📋 Informations du ticket')
            .setColor(EMBED_COLORS.PRIMARY)
            .addFields(
                {
                    name: '🎫 ID du ticket',
                    value: ticket.ticket_id,
                    inline: true
                },
                {
                    name: '👤 Créateur',
                    value: user ? `<@${user.id}>` : `<@${ticket.user_id}>`,
                    inline: true
                },
                {
                    name: '📊 Statut',
                    value: `${statusEmoji[ticket.status]} ${statusText[ticket.status]}`,
                    inline: true
                },
                {
                    name: '📅 Créé le',
                    value: new Date(ticket.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Europe/Paris'
                    }),
                    inline: true
                }
            )
            .setTimestamp();

        if (ticket.closed_by && ticket.closed_at) {
            embed.addFields({
                name: '🔒 Fermé par',
                value: `<@${ticket.closed_by}>`,
                inline: true
            }, {
                name: '🕐 Fermé le',
                value: new Date(ticket.closed_at).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Paris'
                }),
                inline: true
            });
        }

        return embed;
    }
}

module.exports = TicketEmbedFactory;