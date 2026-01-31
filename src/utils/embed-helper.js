const setServerFooter = (embed, guild) => {
    if (!guild) return embed;

    const serverIcon = guild.iconURL({ dynamic: true, size: 32 });
    const serverName = guild.name;

    if (serverIcon) {
        embed.setFooter({
            iconURL: serverIcon,
            text: `🔹 ${serverName}`
        });
    } else {
        embed.setFooter({
            text: `🔹 ${serverName}`
        });
    }

    return embed;
};

module.exports = {
    setServerFooter
};