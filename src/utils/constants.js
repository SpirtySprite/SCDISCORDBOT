const TIME_UNITS = {
    SECOND: 1000,
    MINUTE: 60000,
    HOUR: 3600000,
    DAY: 86400000
};

const DURATION_REGEX = /(\d+)([smhd])/gi;

const EMBED_COLORS = {
    SUCCESS: 0x00FF00,
    ERROR: 0xFF0000,
    PRIMARY: 0x5865F2,
    WARNING: 0xFFA500
};

const GIVEAWAY_STATUS = {
    ACTIVE: 'active',
    ENDED: 'ended'
};

const MOD_ACTION = {
    BAN: 'ban',
    KICK: 'kick',
    MUTE: 'mute',
    TIMEOUT: 'timeout',
    WARN: 'warn',
    UNBAN: 'unban',
    UNMUTE: 'unmute',
    UNTIMEOUT: 'untimeout',
    PURGE: 'purge',
    MOVE: 'move'
};

const MOD_ACTION_COLORS = {
    ban: 0xFF0000,
    kick: 0xFF6600,
    mute: 0xFFD700,
    timeout: 0xFFA500,
    warn: 0x0099FF,
    unban: 0x00FF00,
    unmute: 0x00FF00,
    untimeout: 0x00FF00,
    purge: 0x5865F2,
    move: 0x0099FF
};

module.exports = {
    TIME_UNITS,
    DURATION_REGEX,
    EMBED_COLORS,
    GIVEAWAY_STATUS,
    MOD_ACTION,
    MOD_ACTION_COLORS
};