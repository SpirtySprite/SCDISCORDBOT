const axios = require('axios');
const crypto = require('crypto');
const { query } = require('../../../src/database/connection');
const logger = require('../../../src/utils/logger');
const oauthConfig = require('../config/oauth');

class OAuthService {

    encrypt(text) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(oauthConfig.encryptionKey, 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }


    decrypt(encryptedText) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(oauthConfig.encryptionKey, 'salt', 32);
            const parts = encryptedText.split(':');
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            logger.error('Failed to decrypt token:', error);
            return null;
        }
    }


    async exchangeCodeForTokens(code) {
        try {
            const params = new URLSearchParams({
                client_id: oauthConfig.clientId,
                client_secret: oauthConfig.clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: oauthConfig.redirectUri
            });

            const response = await axios.post('https://discord.com/api/oauth2/token', params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in,
                tokenType: response.data.token_type
            };
        } catch (error) {
            logger.error('Failed to exchange code for tokens:', error.response?.data || error.message);
            throw new Error('Failed to exchange authorization code');
        }
    }


    async refreshAccessToken(refreshToken) {
        try {
            const params = new URLSearchParams({
                client_id: oauthConfig.clientId,
                client_secret: oauthConfig.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            });

            const response = await axios.post('https://discord.com/api/oauth2/token', params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token || refreshToken,
                expiresIn: response.data.expires_in,
                tokenType: response.data.token_type
            };
        } catch (error) {
            logger.error('Failed to refresh access token:', error.response?.data || error.message);
            throw new Error('Failed to refresh access token');
        }
    }


    async getUserInfo(accessToken) {
        try {
            const response = await axios.get('https://discord.com/api/users/@me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return {
                id: response.data.id,
                username: response.data.username,
                discriminator: response.data.discriminator,
                avatar: response.data.avatar,
                email: response.data.email
            };
        } catch (error) {
            logger.error('Failed to get user info:', error.response?.data || error.message);
            throw new Error('Failed to get user information');
        }
    }


    async getUserGuilds(accessToken) {
        try {
            const response = await axios.get('https://discord.com/api/users/@me/guilds', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return response.data.map(guild => ({
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                owner: guild.owner,
                permissions: guild.permissions
            }));
        } catch (error) {
            logger.error('Failed to get user guilds:', error.response?.data || error.message);
            throw new Error('Failed to get user guilds');
        }
    }


    hasManageServerPermission(permissions) {

        const MANAGE_GUILD = BigInt(0x20);
        const perms = BigInt(permissions);
        return (perms & MANAGE_GUILD) === MANAGE_GUILD;
    }


    async saveUser(userInfo, tokens) {
        try {
            const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
            const encryptedAccessToken = this.encrypt(tokens.accessToken);
            const encryptedRefreshToken = this.encrypt(tokens.refreshToken);


            const existing = await query(
                'SELECT id FROM discord_users WHERE discord_id = ?',
                [userInfo.id]
            );

            if (existing.length > 0) {

                await query(
                    `UPDATE discord_users
                     SET username = ?, discriminator = ?, avatar = ?,
                         access_token = ?, refresh_token = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE discord_id = ?`,
                    [
                        userInfo.username,
                        userInfo.discriminator,
                        userInfo.avatar,
                        encryptedAccessToken,
                        encryptedRefreshToken,
                        expiresAt,
                        userInfo.id
                    ]
                );
                return existing[0].id;
            } else {

                const result = await query(
                    `INSERT INTO discord_users
                     (discord_id, username, discriminator, avatar, access_token, refresh_token, expires_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userInfo.id,
                        userInfo.username,
                        userInfo.discriminator,
                        userInfo.avatar,
                        encryptedAccessToken,
                        encryptedRefreshToken,
                        expiresAt
                    ]
                );
                return result.insertId;
            }
        } catch (error) {
            logger.error('Failed to save user:', error);
            throw error;
        }
    }


    async getUserByDiscordId(discordId) {
        try {
            const rows = await query(
                'SELECT * FROM discord_users WHERE discord_id = ? LIMIT 1',
                [discordId]
            );

            if (rows.length === 0) {
                return null;
            }

            const user = rows[0];
            return {
                id: user.id,
                discordId: user.discord_id,
                username: user.username,
                discriminator: user.discriminator,
                avatar: user.avatar,
                accessToken: user.access_token ? this.decrypt(user.access_token) : null,
                refreshToken: user.refresh_token ? this.decrypt(user.refresh_token) : null,
                expiresAt: user.expires_at
            };
        } catch (error) {
            logger.error('Failed to get user by Discord ID:', error);
            throw error;
        }
    }


    async getValidAccessToken(discordId) {
        try {
            const user = await this.getUserByDiscordId(discordId);
            if (!user) {
                throw new Error('User not found');
            }


            const now = new Date();
            const expiresAt = new Date(user.expiresAt);
            const fiveMinutes = 5 * 60 * 1000;

            if (expiresAt.getTime() - now.getTime() < fiveMinutes) {

                logger.info(`Refreshing access token for user ${discordId}`);
                const newTokens = await this.refreshAccessToken(user.refreshToken);
                await this.saveUser(
                    { id: user.discordId, username: user.username, discriminator: user.discriminator, avatar: user.avatar },
                    newTokens
                );
                return newTokens.accessToken;
            }

            return user.accessToken;
        } catch (error) {
            logger.error('Failed to get valid access token:', error);
            throw error;
        }
    }


    async checkBotInGuild(guildId) {
        try {

            const { getBotApiUrl } = require('../utils/bot-api-url');
            let botApiUrl;
            try {
                botApiUrl = getBotApiUrl();
            } catch (error) {
                logger.warn('[OAUTH SERVICE] Failed to get bot API URL, using default:', error.message);
                botApiUrl = 'http://localhost:45049';
            }
            try {
                const response = await axios.get(`${botApiUrl}/guilds/${guildId}/check`, {
                    timeout: 2000
                });
                return response.data.botPresent || false;
            } catch (botApiError) {

                return null;
            }
        } catch (error) {
            logger.debug('Failed to check bot in guild via bot API:', error.message);
            return null;
        }
    }
}

module.exports = new OAuthService();