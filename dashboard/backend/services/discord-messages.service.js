const logger = require('../../../src/utils/logger');
const http = require('http');
const { getBotApiUrl } = require('../utils/bot-api-url');


class DiscordMessagesService {
    constructor() {
        try {
            this.botApiUrl = getBotApiUrl();
        } catch (error) {
            logger.error('[DISCORD MESSAGES] Failed to initialize bot API URL:', error);
            this.botApiUrl = 'http://localhost:45049';
        }
    }

    async getChannelMessages(channelId, limit = 100) {
        try {

            try {
                this.botApiUrl = getBotApiUrl();
            } catch (error) {
                logger.warn('[DISCORD MESSAGES] Failed to refresh bot API URL, using cached value:', error.message);
            }

            const url = `${this.botApiUrl}/channels/${channelId}/messages?limit=${limit}`;
            logger.info(`[DISCORD MESSAGES] Fetching messages from: ${url}`);

            return new Promise((resolve, reject) => {
                const req = http.get(url, (res) => {
                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                const messages = JSON.parse(data);
                                resolve(messages);
                            } catch (error) {
                                logger.error(`[DISCORD MESSAGES] Failed to parse response for channel ${channelId}:`, error);
                                reject(new Error('Failed to parse response'));
                            }
                        } else if (res.statusCode === 503) {
                            reject(new Error('Discord client not available. Bot must be running.'));
                        } else if (res.statusCode === 404) {
                            reject(new Error('Channel not found'));
                        } else if (res.statusCode === 403) {
                            try {
                                const error = JSON.parse(data);
                                reject(new Error(error.error || 'Permission denied'));
                            } catch {
                                reject(new Error('Permission denied'));
                            }
                        } else {
                            try {
                                const error = JSON.parse(data);
                                logger.error(`[DISCORD MESSAGES] API error for channel ${channelId}:`, error);
                                reject(new Error(error.error || `Failed to fetch messages (${res.statusCode})`));
                            } catch {
                                logger.error(`[DISCORD MESSAGES] Unknown error for channel ${channelId}, status: ${res.statusCode}`);
                                reject(new Error(`Failed to fetch messages (${res.statusCode})`));
                            }
                        }
                    });
                });

                req.on('error', (error) => {
                    logger.error(`[DISCORD MESSAGES] Request error for channel ${channelId}:`, error);
                    if (error.code === 'ECONNREFUSED') {
                        reject(new Error('Bot API server not available. Ensure bot is running.'));
                    } else {
                        reject(error);
                    }
                });

                req.setTimeout(10000, () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });
            });
        } catch (error) {
            logger.error(`[DISCORD MESSAGES] Failed to fetch messages from channel ${channelId}:`, error);
            throw error;
        }
    }
}

module.exports = new DiscordMessagesService();