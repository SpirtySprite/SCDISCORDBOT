const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('./constants');
const { setServerFooter } = require('./embed-helper');

class SuggestionEmbedFactory {
    static createSuggestionEmbed(title, description, user, guild = null) {

        const embedDescription = description && description.trim() ? description.trim() : '*Aucune description fournie*';

        const embed = new EmbedBuilder()
            .setTitle(`💡 ${title}`)
            .setDescription(embedDescription)
            .setColor(EMBED_COLORS.PRIMARY)
            .addFields({
                name: '👤 Proposé par',
                value: `<@${user.id}>`,
                inline: true
            })
            .setTimestamp();


        if (user.displayAvatarURL) {
            embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));
        } else if (user.avatarURL) {
            embed.setThumbnail(user.avatarURL({ dynamic: true, size: 256 }));
        }

        setServerFooter(embed, guild);
        return embed;
    }

    static createSuccessEmbed(guild = null) {
        const embed = new EmbedBuilder()
            .setTitle('✅ Succès')
            .setDescription('Votre suggestion a été envoyée avec succès!')
            .setColor(EMBED_COLORS.SUCCESS)
            .setTimestamp();

        setServerFooter(embed, guild);
        return embed;
    }

    static createErrorEmbed(message, guild = null) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription(message)
            .setColor(EMBED_COLORS.ERROR)
            .setTimestamp();

        setServerFooter(embed, guild);
        return embed;
    }

    static createModAcceptanceEmbed(userId, acceptedByUserId, acceptedByName, title, description, authorName, user = null, timestamp = null) {


        const headerText = `<@${userId}> - ✅ Suggestion acceptée par <@${acceptedByUserId}>`;

        const embed = new EmbedBuilder()
            .setTitle(title || 'Revue de la modération')
            .setDescription(`${headerText}\n\n${description || ''}`)
            .setColor(0x00FF00)
            .setTimestamp(timestamp || new Date());


        if (user) {
            if (user.displayAvatarURL) {
                embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));
            } else if (user.avatarURL) {
                embed.setThumbnail(user.avatarURL({ dynamic: true, size: 256 }));
            }
        }

        if (authorName) {
            embed.setFooter({ text: authorName });
        }

        return embed;
    }
}

module.exports = SuggestionEmbedFactory;