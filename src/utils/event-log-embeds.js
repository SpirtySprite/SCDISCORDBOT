const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('./constants');

const formatTimestamp = (date) => {
    return new Date(date).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/Paris'
    });
};

const formatUser = (user) => {
    if (!user) return 'Inconnu';
    return `<@${user.id}> (${user.tag})`;
};

const getCommonFooter = (guild, text = '') => {
    return {
        text: `${guild ? guild.name : 'Serenity Craft'} • ${text}`,
        iconURL: guild ? guild.iconURL() : undefined
    };
};

class EventLogEmbedFactory {
    static createMessageDeleteEmbed(message, executor = null) {
        const description = `Un message envoyé par ${message.author ? `<@${message.author.id}>` : 'un utilisateur inconnu'} a été supprimé dans ${message.channel ? `<#${message.channel.id}>` : 'un salon inconnu'}.`;

        const embed = new EmbedBuilder()
            .setAuthor({
                name: message.author ? `${message.author.tag} (${message.author.id})` : 'Utilisateur Inconnu',
                iconURL: message.author ? message.author.displayAvatarURL() : undefined
            })
            .setTitle('🗑️ Message Supprimé')
            .setDescription(description)
            .setColor(0xFF4444)
            .setThumbnail(message.author ? message.author.displayAvatarURL() : undefined)
            .addFields(
                {
                    name: '📍 Localisation',
                    value: `**Canal:** ${message.channel ? `<#${message.channel.id}>` : 'Inconnu'}\n**ID:** ${message.channel?.id || 'N/A'}`,
                    inline: true
                },
                {
                    name: '👤 Auteur',
                    value: `**Mention:** ${message.author ? `<@${message.author.id}>` : 'Inconnu'}\n**ID:** ${message.author?.id || 'N/A'}`,
                    inline: true
                }
            );

        if (executor) {
            embed.addFields({
                name: '🛡️ Exécuté par',
                value: `**Modérateur:** <@${executor.id}>\n**ID:** ${executor.id}`,
                inline: false
            });
        }

        if (message.content && message.content.length > 0) {
            const content = message.content.length > 1024
                ? message.content.substring(0, 1021) + '...'
                : message.content;
            embed.addFields({
                name: '📝 Contenu du Message',
                value: `>>> ${content}`,
                inline: false
            });
        }

        if (message.attachments.size > 0) {
            const attachmentList = Array.from(message.attachments.values())
                .map(att => `• [${att.name}](${att.url})`)
                .join('\n');
            embed.addFields({
                name: '📎 Pièces Jointes',
                value: attachmentList.length > 1024 ? attachmentList.substring(0, 1021) + '...' : attachmentList,
                inline: false
            });
        }

        embed.setTimestamp();
        embed.setFooter(getCommonFooter(message.guild, `ID: ${message.id}`));
        return embed;
    }

    static createMessageEditEmbed(oldMessage, newMessage) {
        const description = `Un message de ${newMessage.author ? `<@${newMessage.author.id}>` : 'Inconnu'} a été modifié dans ${newMessage.channel ? `<#${newMessage.channel.id}>` : 'Inconnu'}.`;

        const embed = new EmbedBuilder()
            .setAuthor({
                name: newMessage.author ? `${newMessage.author.tag} (${newMessage.author.id})` : 'Utilisateur Inconnu',
                iconURL: newMessage.author ? newMessage.author.displayAvatarURL() : undefined
            })
            .setTitle('✏️ Message Modifié')
            .setDescription(description)
            .setColor(0xFFA500)
            .addFields(
                {
                    name: '📍 Informations',
                    value: `**Canal:** ${newMessage.channel ? `<#${newMessage.channel.id}>` : 'Inconnu'}\n**Lien:** [Accéder au message](${newMessage.url})`,
                    inline: true
                }
            );

        if (oldMessage.content !== newMessage.content) {
            const oldContent = oldMessage.content || '*Aucun contenu*';
            const newContent = newMessage.content || '*Aucun contenu*';

            embed.addFields(
                {
                    name: '📜 Avant',
                    value: `>>> ${oldContent.length > 1024 ? oldContent.substring(0, 1021) + '...' : oldContent}`,
                    inline: false
                },
                {
                    name: '📝 Après',
                    value: `>>> ${newContent.length > 1024 ? newContent.substring(0, 1021) + '...' : newContent}`,
                    inline: false
                }
            );
        }

        embed.setTimestamp();
        embed.setFooter(getCommonFooter(newMessage.guild, `ID: ${newMessage.id}`));
        return embed;
    }

    static createMemberJoinEmbed(member) {
        const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
        const description = `<@${member.user.id}> a rejoint le serveur.`;

        return new EmbedBuilder()
            .setAuthor({ name: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() })
            .setTitle('📥 Nouveau Membre')
            .setDescription(description)
            .setColor(0x00FF00)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                {
                    name: '👤 Profil',
                    value: `**Mention:** <@${member.user.id}>\n**Tag:** ${member.user.tag}\n**ID:** ${member.id}`,
                    inline: true
                },
                {
                    name: '📅 Ancienneté du compte',
                    value: `**Créé le:** ${formatTimestamp(member.user.createdAt)}\n**Âge:** ${accountAge} jours`,
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter(getCommonFooter(member.guild, `Membre #${member.guild.memberCount}`));
    }

    static createMemberLeaveEmbed(member) {
        const description = `<@${member.user.id}> a quitté le serveur.`;

        return new EmbedBuilder()
            .setAuthor({ name: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() })
            .setTitle('📤 Départ d\'un Membre')
            .setDescription(description)
            .setColor(0xFF4444)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                {
                    name: '👤 Profil',
                    value: `**Mention:** <@${member.user.id}>\n**Tag:** ${member.user.tag}\n**ID:** ${member.id}`,
                    inline: true
                },
                {
                    name: '📅 Arrivée sur le serveur',
                    value: `**A rejoint:** ${member.joinedAt ? formatTimestamp(member.joinedAt) : 'Inconnu'}`,
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter(getCommonFooter(member.guild, `Membre #${member.guild.memberCount}`));
    }

    static createRoleAddEmbed(member, role, executor = null) {
        const description = `Le rôle **${role.name}** a été ajouté à <@${member.user.id}>.`;

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() })
            .setTitle('➕ Rôle Ajouté')
            .setDescription(description)
            .setColor(0x00FF00)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                {
                    name: '👤 Utilisateur Cible',
                    value: `**Mention:** <@${member.user.id}>\n**ID:** ${member.id}`,
                    inline: true
                },
                {
                    name: '🎭 Rôle',
                    value: `**Nom:** ${role.name}\n**ID:** ${role.id}`,
                    inline: true
                }
            );

        if (executor) {
            embed.addFields({
                name: '🛡️ Ajouté par',
                value: `**Modérateur:** <@${executor.id}>\n**ID:** ${executor.id}`,
                inline: false
            });
        }

        embed.setTimestamp();
        embed.setFooter(getCommonFooter(member.guild));
        return embed;
    }

    static createRoleRemoveEmbed(member, role, executor = null) {
        const description = `Le rôle **${role.name}** a été retiré à <@${member.user.id}>.`;

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() })
            .setTitle('➖ Rôle Retiré')
            .setDescription(description)
            .setColor(0xFF4444)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                {
                    name: '👤 Utilisateur Cible',
                    value: `**Mention:** <@${member.user.id}>\n**ID:** ${member.id}`,
                    inline: true
                },
                {
                    name: '🎭 Rôle',
                    value: `**Nom:** ${role.name}\n**ID:** ${role.id}`,
                    inline: true
                }
            );

        if (executor) {
            embed.addFields({
                name: '🛡️ Retiré par',
                value: `**Modérateur:** <@${executor.id}>\n**ID:** ${executor.id}`,
                inline: false
            });
        }

        embed.setTimestamp();
        embed.setFooter(getCommonFooter(member.guild));
        return embed;
    }

    static createNicknameChangeEmbed(oldMember, newMember, executor = null) {
        const description = `<@${newMember.user.id}> a changé de pseudo.`;

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${newMember.user.tag} (${newMember.user.id})`, iconURL: newMember.user.displayAvatarURL() })
            .setTitle('🏷️ Changement de Pseudo')
            .setDescription(description)
            .setColor(0xFFA500)
            .setThumbnail(newMember.user.displayAvatarURL())
            .addFields(
                {
                    name: '👤 Utilisateur',
                    value: `**Mention:** <@${newMember.user.id}>\n**ID:** ${newMember.id}`,
                    inline: false
                },
                {
                    name: '📝 Ancien Pseudo',
                    value: `\`${oldMember.nickname || oldMember.user.username}\``,
                    inline: true
                },
                {
                    name: '📝 Nouveau Pseudo',
                    value: `\`${newMember.nickname || newMember.user.username}\``,
                    inline: true
                }
            );

        if (executor) {
            embed.addFields({
                name: '🛡️ Modifié par',
                value: `<@${executor.id}>`,
                inline: true
            });
        }

        embed.setTimestamp();
        embed.setFooter(getCommonFooter(newMember.guild));
        return embed;
    }

    static createVoiceJoinEmbed(member, channel) {
        return new EmbedBuilder()
            .setAuthor({ name: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() })
            .setTitle('🔊 Connexion Vocale')
            .setDescription(`<@${member.user.id}> a rejoint le salon vocal <#${channel.id}>.`)
            .setColor(0x00FF00)
            .addFields(
                {
                    name: '👤 Utilisateur',
                    value: `**Tag:** ${member.user.tag}\n**ID:** ${member.id}`,
                    inline: true
                },
                {
                    name: '📺 Canal',
                    value: `**Nom:** ${channel.name}\n**ID:** ${channel.id}`,
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter(getCommonFooter(member.guild));
    }

    static createVoiceLeaveEmbed(member, channel) {
        return new EmbedBuilder()
            .setAuthor({ name: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() })
            .setTitle('🔇 Déconnexion Vocale')
            .setDescription(`<@${member.user.id}> a quitté le salon vocal ${channel ? `<#${channel.id}>` : 'Inconnu'}.`)
            .setColor(0xFF4444)
            .addFields(
                {
                    name: '👤 Utilisateur',
                    value: `**Tag:** ${member.user.tag}\n**ID:** ${member.id}`,
                    inline: true
                },
                {
                    name: '📺 Canal',
                    value: channel ? `**Nom:** ${channel.name}\n**ID:** ${channel.id}` : 'Inconnu',
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter(getCommonFooter(member.guild));
    }

    static createVoiceMoveEmbed(member, oldChannel, newChannel) {
        return new EmbedBuilder()
            .setAuthor({ name: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() })
            .setTitle('🔄 Déplacement Vocal')
            .setDescription(`<@${member.user.id}> a changé de salon vocal.`)
            .setColor(0x0099FF)
            .addFields(
                {
                    name: '👤 Utilisateur',
                    value: `<@${member.id}>`,
                    inline: false
                },
                {
                    name: '⬅️ De',
                    value: oldChannel ? `<#${oldChannel.id}>` : 'Inconnu',
                    inline: true
                },
                {
                    name: '➡️ Vers',
                    value: newChannel ? `<#${newChannel.id}>` : 'Inconnu',
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter(getCommonFooter(member.guild));
    }

    static createChannelCreateEmbed(channel, executor = null) {
        const embed = new EmbedBuilder()
            .setTitle('📺 Canal Créé')
            .setDescription(`Un nouveau canal a été créé : <#${channel.id}>.`)
            .setColor(0x00FF00)
            .addFields(
                {
                    name: '📁 Informations',
                    value: `**Nom:** ${channel.name}\n**Type:** ${channel.type}\n**ID:** ${channel.id}\n**Catégorie:** ${channel.parent ? channel.parent.name : 'Aucune'}`,
                    inline: false
                }
            );

        if (executor) {
            embed.setAuthor({ name: `${executor.tag} (${executor.id})`, iconURL: executor.displayAvatarURL() });
            embed.addFields({
                name: '🛡️ Créé par',
                value: `<@${executor.id}>`,
                inline: true
            });
        }

        embed.setTimestamp();
        embed.setFooter(getCommonFooter(channel.guild));
        return embed;
    }

    static createChannelDeleteEmbed(channel, executor = null) {
        const embed = new EmbedBuilder()
            .setTitle('🗑️ Canal Supprimé')
            .setDescription(`Le canal **${channel.name}** a été supprimé.`)
            .setColor(0xFF4444)
            .addFields(
                {
                    name: '📁 Informations',
                    value: `**Nom:** ${channel.name}\n**ID:** ${channel.id}\n**Type:** ${channel.type}`,
                    inline: false
                }
            );

        if (executor) {
            embed.setAuthor({ name: `${executor.tag} (${executor.id})`, iconURL: executor.displayAvatarURL() });
            embed.addFields({
                name: '🛡️ Supprimé par',
                value: `<@${executor.id}>`,
                inline: true
            });
        }

        embed.setTimestamp();
        embed.setFooter(getCommonFooter(channel.guild));
        return embed;
    }

    static createChannelUpdateEmbed(oldChannel, newChannel, changes, executor = null) {
        const embed = new EmbedBuilder()
            .setTitle('🛠️ Canal Modifié')
            .setDescription(`Le canal <#${newChannel.id}> a été mis à jour.`)
            .setColor(0xFFA500)
            .addFields(
                {
                    name: '📍 Canal',
                    value: `**Mention:** <#${newChannel.id}>\n**ID:** ${newChannel.id}`,
                    inline: false
                }
            );

        if (executor) {
            embed.setAuthor({ name: `${executor.tag} (${executor.id})`, iconURL: executor.displayAvatarURL() });
            embed.addFields({
                name: '🛡️ Modifié par',
                value: `<@${executor.id}>`,
                inline: true
            });
        }

        if (changes.length > 0) {
            const changeText = changes.map(c => `• **${c.type}**: \`${c.old}\` ➔ \`${c.new}\``).join('\n');
            embed.addFields({
                name: '📝 Détails des changements',
                value: changeText.length > 1024 ? changeText.substring(0, 1021) + '...' : changeText,
                inline: false
            });
        }

        embed.setTimestamp();
        embed.setFooter(getCommonFooter(newChannel.guild));
        return embed;
    }

    static createBanAddEmbed(user, executor = null, reason = null) {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `${user.tag} (${user.id})`, iconURL: user.displayAvatarURL() })
            .setTitle('🚫 Membre Banni')
            .setDescription(`<@${user.id}> a été banni du serveur.`)
            .setColor(0xFF0000)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                {
                    name: '👤 Utilisateur',
                    value: `**Tag:** ${user.tag}\n**ID:** ${user.id}`,
                    inline: true
                }
            );

        if (executor) {
            embed.addFields({
                name: '🛡️ Banni par',
                value: `**Modérateur:** <@${executor.id}>\n**ID:** ${executor.id}`,
                inline: true
            });
        }

        embed.addFields({
            name: '📝 Raison',
            value: reason ? `>>> ${reason}` : '>>> *Aucune raison fournie*',
            inline: false
        });

        embed.setTimestamp();
        embed.setFooter(getCommonFooter(null, `ID: ${user.id}`));
        return embed;
    }

    static createBanRemoveEmbed(user, executor = null) {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `${user.tag} (${user.id})`, iconURL: user.displayAvatarURL() })
            .setTitle('✅ Membre Débanni')
            .setDescription(`<@${user.id}> a été débanni.`)
            .setColor(0x00FF00)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                {
                    name: '👤 Utilisateur',
                    value: `**Tag:** ${user.tag}\n**ID:** ${user.id}`,
                    inline: true
                }
            );

        if (executor) {
            embed.addFields({
                name: '🛡️ Débanni par',
                value: `<@${executor.id}>`,
                inline: true
            });
        }

        embed.setTimestamp();
        embed.setFooter({ text: `ID: ${user.id}` });
        return embed;
    }

    static createRoleCreateEmbed(role, executor = null) {
        const embed = new EmbedBuilder()
            .setTitle('🆕 Rôle Créé')
            .setDescription(`Le rôle **${role.name}** a été créé.`)
            .setColor(0x00FF00)
            .addFields(
                {
                    name: '🎭 Informations Rôle',
                    value: `**Nom:** ${role.name}\n**ID:** ${role.id}\n**Couleur:** ${role.hexColor}\n**Affiché séparément:** ${role.hoist ? 'Oui' : 'Non'}`,
                    inline: false
                }
            );

        if (executor) {
            embed.setAuthor({ name: `${executor.tag} (${executor.id})`, iconURL: executor.displayAvatarURL() });
            embed.addFields({
                name: '🛡️ Créé par',
                value: `<@${executor.id}>`,
                inline: true
            });
        }

        embed.setTimestamp();
        embed.setFooter(getCommonFooter(role.guild));
        return embed;
    }

    static createRoleDeleteEmbed(role, executor = null) {
        const embed = new EmbedBuilder()
            .setTitle('🗑️ Rôle Supprimé')
            .setDescription(`Le rôle **${role.name}** a été supprimé.`)
            .setColor(0xFF4444)
            .addFields(
                {
                    name: '🎭 Rôle',
                    value: `**Nom:** ${role.name}\n**ID:** ${role.id}`,
                    inline: false
                }
            );

        if (executor) {
            embed.setAuthor({ name: `${executor.tag} (${executor.id})`, iconURL: executor.displayAvatarURL() });
            embed.addFields({
                name: '🛡️ Supprimé par',
                value: `<@${executor.id}>`,
                inline: true
            });
        }

        embed.setTimestamp();
        embed.setFooter(getCommonFooter(role.guild));
        return embed;
    }

    static createRoleUpdateEmbed(oldRole, newRole, changes, executor = null) {
        const embed = new EmbedBuilder()
            .setTitle('🛠️ Rôle Modifié')
            .setDescription(`Le rôle <@&${newRole.id}> a été mis à jour.`)
            .setColor(0xFFA500)
            .addFields(
                {
                    name: '🎭 Rôle',
                    value: `**Mention:** <@&${newRole.id}>\n**ID:** ${newRole.id}`,
                    inline: false
                }
            );

        if (executor) {
            embed.setAuthor({ name: `${executor.tag} (${executor.id})`, iconURL: executor.displayAvatarURL() });
            embed.addFields({
                name: '🛡️ Modifié par',
                value: `<@${executor.id}>`,
                inline: true
            });
        }

        if (changes.length > 0) {
            const changeText = changes.map(c => `• **${c.type}**: \`${c.old}\` ➔ \`${c.new}\``).join('\n');
            embed.addFields({
                name: '📝 Détails des changements',
                value: changeText.length > 1024 ? changeText.substring(0, 1021) + '...' : changeText,
                inline: false
            });
        }

        embed.setTimestamp();
        embed.setFooter(getCommonFooter(newRole.guild));
        return embed;
    }
}

module.exports = EventLogEmbedFactory;