require('dotenv').config();

module.exports = {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:4000/api/auth/discord/callback',
    scopes: ['identify', 'guilds'],
    encryptionKey: process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || 'default-encryption-key-change-in-production',
    guildId: process.env.DISCORD_GUILD_ID || null
};