const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('./constants');
const { formatTime } = require('./helpers');
const { setServerFooter } = require('./embed-helper');

class PvpTournamentEmbedFactory {
    static createRegistrationEmbed(tournament, participantCount, guild = null) {
        const entryEndTime = typeof tournament.entry_end_time === 'string'
            ? new Date(tournament.entry_end_time + 'Z')
            : tournament.entry_end_time;

        const timestamp = Math.floor(entryEndTime.getTime() / 1000);
        const endsValue = `<t:${timestamp}:F> (<t:${timestamp}:R>)`;

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Tournoi PvP - Inscriptions')
            .setDescription('Inscrivez-vous pour participer au tournoi PvP !\n\nCliquez sur le bouton ci-dessous pour vous inscrire ou vous désinscrire.')
            .setColor(EMBED_COLORS.PRIMARY)
            .addFields(
                { name: '👥 Participants', value: `**${participantCount}/${tournament.max_entries}**`, inline: true },
                { name: '⏰ Inscriptions se terminent', value: endsValue, inline: true },
                { name: '📊 Format', value: `**${tournament.max_entries} participants**`, inline: true }
            )
            .setTimestamp();

        if (guild?.iconURL()) {
            embed.setThumbnail(guild.iconURL());
        }

        setServerFooter(embed, guild);

        return embed;
    }

    static createParticipantListEmbed(participants, tournament, guild = null) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Liste des Participants')
            .setColor(EMBED_COLORS.SUCCESS)
            .setTimestamp();

        if (participants.length === 0) {
            embed.setDescription('**Aucun participant inscrit pour le moment.**\n\nUtilisez le bouton "S\'inscrire" pour rejoindre le tournoi !');
        } else {

            const maxPerField = 15;
            const chunks = [];
            for (let i = 0; i < participants.length; i += maxPerField) {
                chunks.push(participants.slice(i, i + maxPerField));
            }

            embed.setDescription(`**${participants.length}/${tournament.max_entries} participants inscrits**\n`);

            chunks.forEach((chunk, index) => {
                const participantList = chunk.map((p, idx) => {
                    const num = index * maxPerField + idx + 1;
                    return `${num}. <@${p.user_id}> - ${p.user_tag}`;
                }).join('\n');

                embed.addFields({
                    name: index === 0 ? 'Participants' : '\u200b',
                    value: participantList,
                    inline: false
                });
            });
        }

        if (guild?.iconURL()) {
            embed.setThumbnail(guild.iconURL());
        }

        setServerFooter(embed, guild);

        return embed;
    }

    static createMatchNotificationEmbed(match, player1, player2, tournament, guild = null) {
        const totalRounds = Math.log2(tournament.max_entries);
        const roundNames = {
            1: 'Premier Tour',
            2: 'Huitièmes de Finale',
            3: 'Quarts de Finale',
            4: 'Demi-Finales',
            5: 'Finale',
            6: 'Finale'
        };
        const roundName = roundNames[match.round] || `Round ${match.round}`;

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Match à venir !')
            .setDescription(`**C'est votre tour de combattre !**\n\nPréparez-vous pour votre match PvP sur le serveur Minecraft.`)
            .setColor(EMBED_COLORS.WARNING)
            .addFields(
                { name: '👤 Joueur 1', value: `<@${match.player1_id}>`, inline: true },
                { name: '⚔️ VS', value: '\u200b', inline: true },
                { name: '👤 Joueur 2', value: `<@${match.player2_id}>`, inline: true },
                { name: '📊 Phase', value: roundName, inline: true },
                { name: '🎯 Match', value: `Match #${match.match_number}`, inline: true },
                { name: '📋 Instructions', value: 'Connectez-vous sur le serveur et préparez-vous pour le combat !', inline: false }
            )
            .setTimestamp();

        if (guild?.iconURL()) {
            embed.setThumbnail(guild.iconURL());
        }

        setServerFooter(embed, guild);

        return embed;
    }

    static createTournamentStartEmbed(tournament, guild = null) {
        const embed = new EmbedBuilder()
            .setTitle('⚔️ Tournoi PvP - Début imminent !')
            .setDescription('**Les inscriptions sont terminées !**\n\nLe tournoi va commencer bientôt. Les brackets ont été générés et sont maintenant disponibles sur le dashboard.\n\nLes administrateurs vont maintenant organiser les matches.')
            .setColor(EMBED_COLORS.SUCCESS)
            .addFields(
                { name: '📊 Format', value: `${tournament.max_entries} participants`, inline: true },
                { name: '📋 Status', value: 'Brackets générés', inline: true },
                { name: '🎮 Prochaines étapes', value: 'Les matches seront annoncés ici', inline: false }
            )
            .setTimestamp();

        if (guild?.iconURL()) {
            embed.setThumbnail(guild.iconURL());
        }

        setServerFooter(embed, guild);

        return embed;
    }

    static createMatchResultEmbed(match, winnerId, tournament, guild = null) {
        const totalRounds = Math.log2(tournament.max_entries);
        const roundNames = {
            1: 'Premier Tour',
            2: 'Huitièmes de Finale',
            3: 'Quarts de Finale',
            4: 'Demi-Finales',
            5: 'Finale'
        };
        const roundName = roundNames[match.round] || `Round ${match.round}`;
        const isFinal = match.round === totalRounds;

        const embed = new EmbedBuilder()
            .setTitle(isFinal ? '🏆 TOURNOI TERMINÉ !' : '✅ Match terminé')
            .setDescription(isFinal
                ? `**Le tournoi est terminé !**\n\nFélicitations au vainqueur ! 🎉`
                : `**Le match est terminé !**\n\nLe vainqueur avance au prochain round.`
            )
            .setColor(isFinal ? EMBED_COLORS.SUCCESS : EMBED_COLORS.PRIMARY)
            .addFields(
                { name: '👑 Vainqueur', value: `<@${winnerId}>`, inline: false },
                { name: '📊 Phase', value: roundName, inline: true },
                { name: '🎯 Match', value: `Match #${match.match_number}`, inline: true }
            )
            .setTimestamp();

        if (guild?.iconURL()) {
            embed.setThumbnail(guild.iconURL());
        }

        setServerFooter(embed, guild);

        return embed;
    }
}

module.exports = PvpTournamentEmbedFactory;