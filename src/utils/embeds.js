const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('./constants');
const { formatTime } = require('./helpers');
const { setServerFooter } = require('./embed-helper');

class EmbedFactory {
    static createGiveawayEmbed(giveaway, participants = [], client = null, guild = null) {
        const endTime = typeof giveaway.end_time === 'string'
            ? new Date(giveaway.end_time + 'Z')
            : giveaway.end_time;

        const endDate = new Date(endTime);
        const endDateStr = endDate.toLocaleDateString('fr-FR', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        const endTimeStr = endDate.toLocaleTimeString('fr-FR', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: false
        });

        const createdDate = giveaway.created_at
            ? new Date(giveaway.created_at + 'Z')
            : new Date();
        const footerDate = createdDate.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const diff = endTime.getTime() - Date.now();
        const timestamp = Math.floor(endTime.getTime() / 1000);
        const endsValue = diff > 0
            ? `<t:${timestamp}:F> (<t:${timestamp}:R>)`
            : `Terminé (${endDateStr} ${endTimeStr})`;

        const embed = new EmbedBuilder()
            .setTitle(`🎉 ${giveaway.prize}`)
            .setDescription('\u200b')
            .setColor(EMBED_COLORS.PRIMARY)
            .addFields(
                { name: '⏰ Se termine:', value: endsValue, inline: false },
                { name: '👤 Organisé par:', value: giveaway.created_by ? `<@${giveaway.created_by}>` : 'Inconnu', inline: true },
                { name: '📝 Participants:', value: `${participants.length}`, inline: true },
                { name: '🏆 Gagnants:', value: `${giveaway.winners}`, inline: true }
            )
            .setTimestamp(createdDate);

        if (guild?.iconURL()) {
            embed.setThumbnail(guild.iconURL());
        } else if (client?.user) {
            embed.setThumbnail(client.user.displayAvatarURL());
        }

        if (giveaway.requirements) {
            embed.addFields({
                name: '📋 Conditions',
                value: giveaway.requirements,
                inline: false
            });
        }

        if (guild) {
            const footerText = `Créé le ${footerDate} • 🔹 ${guild.name}`;
            embed.setFooter({
                text: footerText,
                iconURL: guild.iconURL({ dynamic: true, size: 32 }) || undefined
            });
        } else {
            embed.setFooter({ text: footerDate });
        }

        return embed;
    }

    static createEndedEmbed(giveaway, winners, client = null, guild = null) {
        const embed = new EmbedBuilder()
            .setTitle('🎉 CONCOURS TERMINÉ')
            .setDescription(`**${giveaway.prize}**`)
            .setColor(EMBED_COLORS.ERROR)
            .setTimestamp();

        if (guild?.iconURL()) {
            embed.setThumbnail(guild.iconURL());
        } else if (client?.user) {
            embed.setThumbnail(client.user.displayAvatarURL());
        }

        const winnersText = winners.length
            ? winners.map(id => `<@${id}>`).join(', ')
            : 'Aucun participant valide';

        embed.addFields({
            name: '🏆 Gagnant(s)',
            value: winnersText,
            inline: false
        });

        if (guild) {
            const footerText = `Le concours est terminé • 🔹 ${guild.name}`;
            embed.setFooter({
                text: footerText,
                iconURL: guild.iconURL({ dynamic: true, size: 32 }) || undefined
            });
        } else {
            embed.setFooter({ text: 'Le concours est terminé' });
        }

        return embed;
    }

    static createWinnerEmbed(winnerId, prize, isReroll = false, guild = null) {
        const embed = new EmbedBuilder()
            .setTitle(isReroll ? '🎲 Nouveau tirage!' : '🎉 Félicitations!')
            .setDescription(`Vous avez gagné le concours!\n\n**Prix:** ${prize}`)
            .setColor(EMBED_COLORS.SUCCESS)
            .setFooter({ text: isReroll ? 'Félicitations!' : 'Merci d\'avoir participé!' })
            .setTimestamp();

        if (guild) {
            const footerText = `${isReroll ? 'Félicitations!' : 'Merci d\'avoir participé!'} • 🔹 ${guild.name}`;
            embed.setFooter({
                text: footerText,
                iconURL: guild.iconURL({ dynamic: true, size: 32 }) || undefined
            });
        }

        return embed;
    }

    static createListEmbed(giveaways, client, guild = null) {
        const embed = new EmbedBuilder()
            .setTitle('🎉 Concours Actifs')
            .setDescription(`**${giveaways.length}** concours actif(s)`)
            .setColor(EMBED_COLORS.SUCCESS)
            .setThumbnail(client.user.displayAvatarURL())
            .setTimestamp();

        setServerFooter(embed, guild || client?.guilds?.cache?.first() || null);
        return embed;
    }
}

module.exports = EmbedFactory;