const { EmbedBuilder } = require('discord.js');
const { MOD_ACTION_COLORS, EMBED_COLORS } = require('./constants');
const { formatTime } = require('./helpers');
const { setServerFooter } = require('./embed-helper');

const formatDuration = (ms) => {
    if (!ms) return 'Permanent';
    return formatTime(new Date(Date.now() + ms));
};

const getActionName = (action) => {
    const names = {
        ban: 'Bannissement',
        kick: 'Expulsion',
        mute: 'Mute',
        timeout: 'Timeout',
        warn: 'Avertissement',
        unban: 'Débannissement',
        unmute: 'Démute',
        untimeout: 'Fin du timeout',
        purge: 'Suppression de messages',
        move: 'Déplacement vocal'
    };
    return names[action] || action;
};

class ModerationEmbedFactory {
    static createActionEmbed(action, user, moderator, reason, duration = null, logId = null, guild = null) {
        const color = MOD_ACTION_COLORS[action] || EMBED_COLORS.PRIMARY;
        const actionName = getActionName(action);

        const userTag = user.tag || user.username || `User#${user.discriminator || '0000'}`;
        const moderatorTag = moderator.tag || moderator.username || `User#${moderator.discriminator || '0000'}`;
        const timestamp = new Date().toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Paris'
        });

        const embed = new EmbedBuilder()
            .setTitle(`🔨 ${actionName}`)
            .setColor(color)
            .addFields(
                { name: '👤 Utilisateur sanctionné', value: `<@${user.id}>\n**Tag:** ${userTag}\n**ID:** ${user.id}`, inline: true },
                { name: '🛡️ Modérateur', value: `<@${moderator.id}>\n**Tag:** ${moderatorTag}\n**ID:** ${moderator.id}`, inline: true },
                { name: '🕐 Date et heure', value: timestamp, inline: true }
            )
            .setTimestamp();

        embed.addFields({ name: '📝 Raison', value: reason || 'Aucune raison spécifiée', inline: false });

        if (duration) {
            embed.addFields({ name: '⏰ Durée', value: formatDuration(duration), inline: true });
        }

        if (user.avatarURL()) {
            embed.setThumbnail(user.avatarURL());
        }

        if (logId) {
            const footerText = guild
                ? `ID du log: ${logId} • 🔹 ${guild.name}`
                : `ID du log: ${logId}`;
            embed.setFooter({
                text: footerText,
                iconURL: guild?.iconURL({ dynamic: true, size: 32 }) || undefined
            });
        } else {
            setServerFooter(embed, guild);
        }

        return embed;
    }

    static createDMActionEmbed(action, guild, moderator, reason, duration = null) {
        const color = MOD_ACTION_COLORS[action] || EMBED_COLORS.PRIMARY;
        const actionName = getActionName(action);

        const embed = new EmbedBuilder()
            .setTitle(`🔨 ${actionName}`)
            .setDescription(`Vous avez reçu une sanction sur **${guild.name}**`)
            .setColor(color)
            .addFields(
                { name: '🛡️ Modérateur', value: `<@${moderator.id}>`, inline: true }
            )
            .setTimestamp();

        if (reason) {
            embed.addFields({ name: '📝 Raison', value: reason, inline: false });
        }

        if (duration) {
            embed.addFields({ name: '⏰ Durée', value: formatDuration(duration), inline: true });
        }

        if (guild.iconURL()) {
            embed.setThumbnail(guild.iconURL());
        }

        setServerFooter(embed, guild);
        return embed;
    }

    static createModLogEmbed(logs, user, currentPage, totalPages, totalLogs, guild = null) {
        const embed = new EmbedBuilder()
            .setTitle(`📋 Journal de modération - ${user.tag || user.id}`)
            .setColor(EMBED_COLORS.PRIMARY)
            .setTimestamp();

        if (user.avatarURL()) {
            embed.setThumbnail(user.avatarURL());
        }

        if (logs.length === 0) {
            embed.setDescription('Aucun log de modération trouvé pour cet utilisateur.');
        } else {
            const logText = logs.map(log => {
                const actionName = getActionName(log.action);
                const date = new Date(log.created_at).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: 'Europe/Paris'
                });
                const durationText = log.duration ? `\n**Durée:** ${formatDuration(log.duration)}` : '';
                const reasonText = log.reason ? `\n**Raison:** ${log.reason}` : '\n**Raison:** Aucune raison spécifiée';
                const sequentialId = log.sequentialId || log.id;
                return `**ID ${sequentialId}** - ${actionName}\n**Modérateur:** <@${log.moderator_id}>\n**Date et heure:** ${date}${durationText}${reasonText}`;
            }).join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

            embed.setDescription(logText);
        }

        embed.setFooter({ text: `Page ${currentPage}/${totalPages} • Total: ${totalLogs} logs` });

        return embed;
    }

    static createLogDeletedEmbed(user, logId, guild = null) {
        const embed = new EmbedBuilder()
            .setTitle('✅ Log supprimé')
            .setDescription(`Le log #${logId} de <@${user.id}> a été supprimé avec succès.`)
            .setColor(EMBED_COLORS.SUCCESS)
            .setTimestamp();
        setServerFooter(embed, guild);
        return embed;
    }

    static createSuccessEmbed(action, user, guild = null) {
        const actionName = getActionName(action);
        const embed = new EmbedBuilder()
            .setTitle(`✅ ${actionName} réussi`)
            .setDescription(`${actionName} appliqué avec succès à <@${user.id}>.`)
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

    static createRoleAddedEmbed(user, role, moderator, reason, guild = null) {
        const userTag = user.tag || user.username || `User#${user.discriminator || '0000'}`;
        const moderatorTag = moderator.tag || moderator.username || `User#${moderator.discriminator || '0000'}`;
        const timestamp = new Date().toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Paris'
        });

        const embed = new EmbedBuilder()
            .setTitle('✅ Rôle ajouté')
            .setColor(EMBED_COLORS.SUCCESS)
            .addFields(
                { name: '👤 Utilisateur', value: `<@${user.id}>\n**Tag:** ${userTag}\n**ID:** ${user.id}`, inline: true },
                { name: '🎭 Rôle', value: `<@&${role.id}>\n**Nom:** ${role.name}\n**ID:** ${role.id}`, inline: true },
                { name: '🛡️ Modérateur', value: `<@${moderator.id}>\n**Tag:** ${moderatorTag}`, inline: true },
                { name: '🕐 Date et heure', value: timestamp, inline: true },
                { name: '📝 Raison', value: reason || 'Aucune raison spécifiée', inline: false }
            )
            .setTimestamp();

        if (user.avatarURL()) {
            embed.setThumbnail(user.avatarURL());
        }

        setServerFooter(embed, guild);
        return embed;
    }

    static createRoleRemovedEmbed(user, role, moderator, reason, guild = null) {
        const userTag = user.tag || user.username || `User#${user.discriminator || '0000'}`;
        const moderatorTag = moderator.tag || moderator.username || `User#${moderator.discriminator || '0000'}`;
        const timestamp = new Date().toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Paris'
        });

        const embed = new EmbedBuilder()
            .setTitle('✅ Rôle retiré')
            .setColor(EMBED_COLORS.SUCCESS)
            .addFields(
                { name: '👤 Utilisateur', value: `<@${user.id}>\n**Tag:** ${userTag}\n**ID:** ${user.id}`, inline: true },
                { name: '🎭 Rôle', value: `<@&${role.id}>\n**Nom:** ${role.name}\n**ID:** ${role.id}`, inline: true },
                { name: '🛡️ Modérateur', value: `<@${moderator.id}>\n**Tag:** ${moderatorTag}`, inline: true },
                { name: '🕐 Date et heure', value: timestamp, inline: true },
                { name: '📝 Raison', value: reason || 'Aucune raison spécifiée', inline: false }
            )
            .setTimestamp();

        if (user.avatarURL()) {
            embed.setThumbnail(user.avatarURL());
        }

        setServerFooter(embed, guild);
        return embed;
    }
}

module.exports = ModerationEmbedFactory;