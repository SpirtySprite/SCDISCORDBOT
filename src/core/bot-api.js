const express = require('express');
const cors = require('cors');
const fs = require('fs');
const logger = require('../utils/logger');
const { CacheHelpers } = require('../utils/discord-cache');
const { EndBehaviorType } = require('@discordjs/voice');

class BotAPI {
    constructor(client) {
        this.client = client;
        this.app = express();
        this.minecraftApp = express();
        this.server = null;
        this.minecraftServer = null;
        const config = require('../config');
        const botApiConfig = config.performance?.botApi || {};
        const minecraftConfig = config.minecraft || {};

        this.port = process.env.BOT_API_PORT || botApiConfig.port || 45049;
        this.minecraftPort = minecraftConfig.port || 48324;

        this.maxRequestSize = botApiConfig.maxRequestSize || 10485760;
        this.requestTimeout = botApiConfig.requestTimeout || 30000;
        this.enableCors = botApiConfig.enableCors !== false;

        this.setupMiddleware();
        this.setupRoutes();
        this.setupMinecraftRoutes();

    }

    setupMiddleware() {
        if (this.enableCors) {
            this.app.use(cors());
            this.minecraftApp.use(cors());
        }

        this.app.use(express.json({ limit: this.maxRequestSize }));
        this.app.use(express.urlencoded({ extended: true, limit: this.maxRequestSize }));


        this.minecraftApp.use(express.json({ limit: this.maxRequestSize }));
        this.minecraftApp.use(express.urlencoded({ extended: true, limit: this.maxRequestSize }));
    }

    setupRoutes() {

        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                ready: this.client?.isReady() || false
            });
        });


        this.app.get('/channels/:channelId/messages', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({
                        error: 'Bot client not ready'
                    });
                }

                const { channelId } = req.params;
                const limit = Math.min(parseInt(req.query.limit) || 100, 100);

                let channel;
                try {
                    channel = await CacheHelpers.getChannel(this.client, channelId, 10 * 60 * 1000);
                } catch (fetchError) {
                    if (fetchError.code === 10003) {
                        return res.status(404).json({ error: 'Channel not found' });
                    }
                    throw fetchError;
                }

                if (!channel) {
                    return res.status(404).json({ error: 'Channel not found' });
                }


                if (!channel.isTextBased()) {
                    return res.status(400).json({ error: 'Channel is not a text channel' });
                }


                if (!channel.permissionsFor(this.client.user)?.has(['ViewChannel', 'ReadMessageHistory'])) {
                    return res.status(403).json({ error: 'Bot does not have permission to read messages in this channel' });
                }

                let messages;
                try {
                    messages = await channel.messages.fetch({ limit });
                } catch (fetchError) {
                    logger.error('[BOT API] Error fetching messages:', fetchError);
                    if (fetchError.code === 50001 || fetchError.code === 50013) {
                        return res.status(403).json({ error: 'Bot does not have permission to read messages' });
                    }
                    throw fetchError;
                }

                const sortedMessages = Array.from(messages.values())
                    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

                const formatted = sortedMessages.map(msg => {
                    try {
                        return {
                            id: msg.id,
                            content: msg.content || '',
                            author: {
                                id: msg.author.id,
                                username: msg.author.username,
                                discriminator: msg.author.discriminator || '0',
                                tag: msg.author.tag || `${msg.author.username}#${msg.author.discriminator || '0'}`,
                                avatar: msg.author.displayAvatarURL({ dynamic: true }) || null
                            },
                            timestamp: msg.createdTimestamp,
                            createdAt: msg.createdAt.toISOString(),
                            attachments: msg.attachments.map(att => ({
                                id: att.id,
                                name: att.name,
                                url: att.url,
                                size: att.size,
                                contentType: att.contentType
                            })),
                            embeds: msg.embeds.map(embed => ({
                                title: embed.title,
                                description: embed.description,
                                color: embed.color,
                                fields: embed.fields || [],
                                footer: embed.footer,
                                timestamp: embed.timestamp
                            }))
                        };
                    } catch (formatError) {
                        logger.warn('[BOT API] Error formatting message:', formatError);
                        return null;
                    }
                }).filter(msg => msg !== null);

                res.json(formatted);
            } catch (error) {
                logger.error('[BOT API] Failed to fetch messages:', error);
                const errorMessage = error.message || 'Failed to fetch messages';
                const statusCode = error.code === 10003 ? 404 :
                    (error.code === 50001 || error.code === 50013) ? 403 : 500;
                res.status(statusCode).json({ error: errorMessage });
            }
        });


        this.app.get('/channels/:channelId', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({
                        error: 'Bot client not ready'
                    });
                }

                const { channelId } = req.params;
                const channel = await CacheHelpers.getChannel(this.client, channelId, 10 * 60 * 1000);

                if (!channel) {
                    return res.status(404).json({ error: 'Channel not found' });
                }

                res.json({
                    id: channel.id,
                    name: channel.name,
                    type: channel.type,
                    guildId: channel.guild?.id,
                    parentId: channel.parentId
                });
            } catch (error) {
                logger.error('[BOT API] Failed to fetch channel:', error);
                res.status(500).json({ error: 'Failed to fetch channel' });
            }
        });


        this.app.post('/channels/:channelId/send', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({
                        error: 'Bot client not ready'
                    });
                }

                const { channelId } = req.params;
                const { content } = req.body;

                if (!content || !content.trim()) {
                    return res.status(400).json({ error: 'Message content is required' });
                }

                const channel = await CacheHelpers.getChannel(this.client, channelId, 10 * 60 * 1000);
                if (!channel) {
                    return res.status(404).json({ error: 'Channel not found' });
                }

                if (!channel.isTextBased()) {
                    return res.status(400).json({ error: 'Channel is not a text channel' });
                }

                const message = await channel.send(content.trim());

                res.json({
                    id: message.id,
                    content: message.content,
                    createdAt: message.createdAt.toISOString()
                });
            } catch (error) {
                logger.error('[BOT API] Failed to send message:', error);
                res.status(500).json({ error: 'Failed to send message' });
            }
        });


        this.app.get('/guilds/:guildId/check', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({
                        error: 'Bot client not ready'
                    });
                }

                const { guildId } = req.params;

                let guild = this.client.guilds.cache.get(guildId);
                if (!guild) {
                    guild = await this.client.guilds.fetch(guildId).catch(() => null);
                }

                res.json({
                    botPresent: guild !== null,
                    guildId: guildId
                });
            } catch (error) {
                logger.error('[BOT API] Failed to check guild:', error);
                res.json({ botPresent: false, guildId: req.params.guildId });
            }
        });


        this.app.get('/guilds/:guildId/info', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({
                        error: 'Bot client not ready'
                    });
                }

                const { guildId } = req.params;

                let guild = this.client.guilds.cache.get(guildId);
                if (!guild) {
                    guild = await this.client.guilds.fetch(guildId).catch(() => null);
                }

                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found or bot not in guild' });
                }

                res.json({
                    id: guild.id,
                    name: guild.name,
                    icon: guild.iconURL({ dynamic: true }),
                    memberCount: guild.memberCount,
                    ownerId: guild.ownerId
                });
            } catch (error) {
                logger.error('[BOT API] Failed to get guild info:', error);
                res.status(500).json({ error: 'Failed to get guild info' });
            }
        });


        this.app.get('/guilds', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({
                        error: 'Bot client not ready'
                    });
                }

                const guilds = Array.from(this.client.guilds.cache.values()).map(guild => ({
                    id: guild.id,
                    name: guild.name,
                    icon: guild.iconURL({ dynamic: true }),
                    memberCount: guild.memberCount,
                    ownerId: guild.ownerId
                }));

                res.json(guilds);
            } catch (error) {
                logger.error('[BOT API] Failed to list guilds:', error);
                res.status(500).json({ error: 'Failed to list guilds' });
            }
        });


        this.app.post('/logs/filters', (req, res) => {
            try {
                const { filters } = req.body;
                if (filters && typeof filters === 'object') {

                    const logger = require('../utils/logger');
                    if (logger.setFilters) {
                        logger.setFilters(filters);
                    }


                    try {
                        const logCapture = require('../utils/log-capture');
                        if (logCapture.setFilters) {
                            logCapture.setFilters(filters);
                        }
                    } catch (error) {

                    }

                    res.json({ success: true, filters });
                } else {
                    res.status(400).json({ error: 'Invalid filters object' });
                }
            } catch (error) {
                logger.error('[BOT API] Failed to update log filters:', error);
                res.status(500).json({ error: 'Failed to update log filters' });
            }
        });

        this.app.get('/guilds/:guildId/roles', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    logger.warn('[BOT API] Roles request but client not ready');
                    return res.status(503).json({
                        error: 'Bot client not ready'
                    });
                }

                const { guildId } = req.params;
                logger.debug(`[BOT API] Fetching roles for guild: ${guildId}`);


                let guild = this.client.guilds.cache.get(guildId);

                if (!guild) {

                    logger.debug(`[BOT API] Guild ${guildId} not in cache, fetching from Discord...`);
                    try {
                        guild = await this.client.guilds.fetch(guildId, { cache: true });
                        logger.debug(`[BOT API] Successfully fetched guild: ${guild.name}`);
                    } catch (fetchError) {
                        logger.error(`[BOT API] Failed to fetch guild ${guildId}:`, fetchError.message);


                        const botGuilds = Array.from(this.client.guilds.cache.values()).map(g => ({
                            id: g.id,
                            name: g.name
                        }));

                        logger.warn(`[BOT API] Bot is in ${botGuilds.length} guild(s):`, botGuilds.map(g => `${g.name} (${g.id})`).join(', '));

                        return res.status(404).json({
                            error: 'Guild not found or bot not in guild',
                            requestedGuildId: guildId,
                            botGuildCount: botGuilds.length,
                            botGuilds: botGuilds,
                            hint: `Verify the bot is in guild ${guildId} and that DISCORD_GUILD_ID is correct`
                        });
                    }
                } else {
                    logger.debug(`[BOT API] Guild found in cache: ${guild.name}`);
                }

                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }

                logger.debug(`[BOT API] Fetching roles for guild: ${guild.name} (${guild.id})`);


                if (guild.roles.cache.size === 0) {
                    await guild.roles.fetch();
                }

                const allRoles = Array.from(guild.roles.cache.values());
                const filteredRoles = allRoles
                    .filter(role => {

                        const isEveryone = role.id === guild.id;
                        const isManaged = role.managed;
                        return !isEveryone && !isManaged;
                    })
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                        id: role.id,
                        name: role.name,
                        color: role.color,
                        position: role.position,
                        mentionable: role.mentionable,
                        hoist: role.hoist
                    }));

                logger.debug(`[BOT API] Returning ${filteredRoles.length} roles (filtered from ${allRoles.length} total)`);
                res.json(filteredRoles);
            } catch (error) {
                logger.error('[BOT API] Failed to get guild roles:', error);
                res.status(500).json({ error: 'Failed to get guild roles', details: error.message });
            }
        });


        this.app.get('/guilds/:guildId/voice-channels', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({
                        error: 'Bot client not ready'
                    });
                }

                const { guildId } = req.params;
                let guild = this.client.guilds.cache.get(guildId);
                if (!guild) {
                    guild = await this.client.guilds.fetch(guildId).catch(() => null);
                }

                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }


                await guild.channels.fetch();

                const voiceChannels = guild.channels.cache
                    .filter(channel => channel.isVoiceBased())
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name,
                        type: channel.type,
                        userLimit: channel.userLimit,
                        bitrate: channel.bitrate,
                        members: channel.members?.size || 0
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name));

                res.json(voiceChannels);
            } catch (error) {
                logger.error('[BOT API] Failed to get voice channels:', error);
                res.status(500).json({ error: 'Failed to get voice channels', details: error.message });
            }
        });


        this.app.get('/soundboard/sounds', async (req, res) => {
            try {
                const soundboard = require('../commands/Moderation/soundboard');
                const fs = require('fs');
                const path = require('path');

                const SOUNDS_DIR = path.join(__dirname, '../assets/sounds');
                const sounds = [];

                if (fs.existsSync(SOUNDS_DIR)) {
                    const files = fs.readdirSync(SOUNDS_DIR);
                    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];

                    files.forEach(file => {
                        const ext = path.extname(file).toLowerCase();
                        if (audioExtensions.includes(ext)) {
                            const name = path.basename(file, ext);
                            sounds.push({
                                name: name,
                                file: file,
                                description: `Sound: ${name}`
                            });
                        }
                    });
                }

                res.json(sounds);
            } catch (error) {
                logger.error('[BOT API] Failed to get sounds:', error);
                res.status(500).json({ error: 'Failed to get sounds', details: error.message });
            }
        });


        this.app.post('/soundboard/play', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({
                        error: 'Bot client not ready'
                    });
                }

                const { guildId, channelId, soundName, times } = req.body;

                if (!guildId || !channelId || !soundName) {
                    return res.status(400).json({ error: 'Missing required parameters: guildId, channelId, soundName' });
                }

                const guild = this.client.guilds.cache.get(guildId);
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }

                const voiceChannel = guild.channels.cache.get(channelId);
                if (!voiceChannel || !voiceChannel.isVoiceBased()) {
                    return res.status(404).json({ error: 'Voice channel not found' });
                }


                const soundboard = require('../commands/Moderation/soundboard');
                const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
                const path = require('path');
                const fs = require('fs');

                const SOUNDS_DIR = path.join(__dirname, '../assets/sounds');
                const soundFile = path.join(SOUNDS_DIR, soundName);


                const extensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
                let actualSoundFile = null;
                for (const ext of extensions) {
                    const testPath = soundFile + ext;
                    if (fs.existsSync(testPath)) {
                        actualSoundFile = path.basename(testPath);
                        break;
                    }
                }

                if (!actualSoundFile) {
                    return res.status(404).json({ error: 'Sound file not found' });
                }


                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guildId,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                    selfDeaf: false,
                    selfMute: false
                });

                await entersState(connection, VoiceConnectionStatus.Ready, 5_000);

                const player = createAudioPlayer();
                connection.subscribe(player);

                const playCount = times || 1;
                const allowSpam = req.body.allowSpam !== false;


                if (allowSpam && playCount > 1) {
                    for (let i = 0; i < playCount; i++) {
                        const resource = createAudioResource(path.join(SOUNDS_DIR, actualSoundFile), {
                            inputType: 'arbitrary',
                            inlineVolume: true
                        });
                        player.play(resource);
                    }
                } else {

                    let played = 0;
                    const playSound = () => {
                        return new Promise((resolve) => {
                            const resource = createAudioResource(path.join(SOUNDS_DIR, actualSoundFile), {
                                inputType: 'arbitrary',
                                inlineVolume: true
                            });

                            player.once(AudioPlayerStatus.Idle, () => {
                                played++;
                                if (played < playCount) {
                                    setTimeout(() => playSound().then(resolve), 200);
                                } else {
                                    resolve();
                                }
                            });

                            player.play(resource);
                        });
                    };

                    playSound().catch(error => {
                        logger.error('[BOT API] Error playing sound:', error);
                    });
                }

                res.json({ success: true, message: `Playing ${actualSoundFile} ${playCount} time(s) in ${voiceChannel.name}` });
            } catch (error) {
                logger.error('[BOT API] Failed to play sound:', error);
                res.status(500).json({ error: 'Failed to play sound', details: error.message });
            }
        });


        this.app.post('/recording/start', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({
                        error: 'Bot client not ready'
                    });
                }

                const { guildId, channelId, soundName } = req.body;

                if (!guildId || !channelId) {
                    return res.status(400).json({ error: 'Missing required parameters: guildId, channelId' });
                }

                const recordModule = require('../commands/Moderation/record');
                const guild = this.client.guilds.cache.get(guildId);
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }

                const voiceChannel = guild.channels.cache.get(channelId);
                if (!voiceChannel || !voiceChannel.isVoiceBased()) {
                    return res.status(404).json({ error: 'Voice channel not found' });
                }


                if (recordModule.recordingState && recordModule.recordingState.has(guildId)) {
                    return res.status(400).json({ error: 'Already recording in this guild' });
                }


                const connection = await recordModule.joinChannel(voiceChannel);
                await recordModule.startRecording(connection, guildId, soundName);

                res.json({ success: true, message: `Recording started in ${voiceChannel.name}` });
            } catch (error) {
                logger.error('[BOT API] Failed to start recording:', error);
                res.status(500).json({ error: 'Failed to start recording', details: error.message });
            }
        });


        this.app.post('/recording/stop', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({
                        error: 'Bot client not ready'
                    });
                }

                const { guildId } = req.body;

                if (!guildId) {
                    return res.status(400).json({ error: 'Missing required parameter: guildId' });
                }

                const recordModule = require('../commands/Moderation/record');

                const recordingData = await recordModule.stopRecording(guildId, true);
                if (!recordingData) {
                    return res.status(404).json({ error: 'No active recording found' });
                }


                if (!recordingData.tempPcmFile || !fs.existsSync(recordingData.tempPcmFile)) {
                    return res.status(400).json({
                        error: 'No audio was recorded. Make sure someone was speaking in the voice channel.'
                    });
                }


                try {
                    await recordModule.processRecording(recordingData.tempPcmFile, recordingData.tempDir, recordingData.finalPath);
                } catch (processError) {
                    logger.error('[BOT API] Failed to process recording:', processError);

                    return res.status(500).json({
                        error: 'Failed to process recording',
                        details: processError.message
                    });
                }

                const soundName = require('path').basename(recordingData.finalPath, '.mp3');

                res.json({
                    success: true,
                    message: `Recording stopped and saved as ${soundName}`,
                    soundName: soundName
                });
            } catch (error) {
                logger.error('[BOT API] Failed to stop recording:', error);
                res.status(500).json({ error: 'Failed to stop recording', details: error.message });
            }
        });


        this.app.get('/recording/status/:guildId', async (req, res) => {
            try {
                const { guildId } = req.params;
                const recordModule = require('../commands/Moderation/record');

                const isRecording = recordModule.recordingState && recordModule.recordingState.has(guildId);
                const state = isRecording ? recordModule.recordingState.get(guildId) : null;

                res.json({
                    isRecording: isRecording,
                    startTime: state?.startTime || null,
                    duration: state ? Math.round((Date.now() - state.startTime) / 1000) : 0
                });
            } catch (error) {
                logger.error('[BOT API] Failed to get recording status:', error);
                res.status(500).json({ error: 'Failed to get recording status', details: error.message });
            }
        });


        const liveStreams = new Map();

        this.app.post('/live-audio/start', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({
                        error: 'Bot client not ready'
                    });
                }

                const { guildId, channelId } = req.body;

                if (!guildId || !channelId) {
                    return res.status(400).json({ error: 'Missing required parameters: guildId, channelId' });
                }

                const recordModule = require('../commands/Moderation/record');
                const guild = this.client.guilds.cache.get(guildId);
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }

                const voiceChannel = guild.channels.cache.get(channelId);
                if (!voiceChannel || !voiceChannel.isVoiceBased()) {
                    return res.status(404).json({ error: 'Voice channel not found' });
                }


                if (liveStreams.has(guildId)) {
                    return res.status(400).json({ error: 'Already streaming from this guild' });
                }


                logger.info(`[BOT API] Joining voice channel ${voiceChannel.name} (${voiceChannel.id}) for live streaming`);
                const connection = await recordModule.joinChannel(voiceChannel);
                logger.info(`[BOT API] Successfully joined voice channel, connection status: ${connection.state.status}, channel ID: ${connection.joinConfig?.channelId}`);


                const botMember = guild.members.cache.get(this.client.user.id);
                if (botMember && botMember.voice.channel) {
                    logger.info(`[BOT API] Bot is in voice channel: ${botMember.voice.channel.name} (${botMember.voice.channel.id})`);
                    if (botMember.voice.channel.id !== voiceChannel.id) {
                        logger.warn(`[BOT API] WARNING: Bot is in different channel than requested! Expected ${voiceChannel.id}, but in ${botMember.voice.channel.id}`);
                    }
                } else {
                    logger.warn(`[BOT API] WARNING: Bot member not found or not in voice channel!`);
                }


                const streamState = {
                    connection,
                    streams: [],
                    clients: new Set(),
                    userStreams: new Map()
                };

                liveStreams.set(guildId, streamState);


                const speakingHandler = (userId) => {

                    if (userId === connection.joinConfig.group || userId === this.client.user.id) return;
                    if (!liveStreams.has(guildId)) return;
                    if (streamState.userStreams.has(userId)) return;

                    try {
                        logger.debug(`[BOT API] User ${userId} started speaking, subscribing to stream`);
                        const stream = connection.receiver.subscribe(userId, {
                            end: {
                                behavior: EndBehaviorType.Manual
                            }
                        });

                        streamState.streams.push(stream);
                        streamState.userStreams.set(userId, stream);


                        let chunkCount = 0;
                        stream.on('data', (chunk) => {
                            chunkCount++;
                            if (chunkCount % 100 === 0) {
                                logger.debug(`[BOT API] Streaming audio chunk ${chunkCount} (${chunk.length} bytes) for user ${userId}`);
                            }

                            streamState.clients.forEach(client => {
                                if (client && !client.destroyed) {
                                    try {
                                        client.write(chunk);
                                    } catch (error) {

                                        logger.debug(`[BOT API] Client disconnected from live stream: ${error.message}`);
                                        streamState.clients.delete(client);
                                    }
                                }
                            });
                        });

                        stream.on('error', (error) => {
                            logger.error(`[BOT API] Error in live audio stream for user ${userId}:`, error);
                            streamState.userStreams.delete(userId);
                        });
                    } catch (error) {
                        logger.error(`[BOT API] Error handling speaking for user ${userId}:`, error);
                    }
                };

                connection.receiver.speaking.on('start', speakingHandler);

                res.json({ success: true, message: `Live streaming started from ${voiceChannel.name} (${voiceChannel.id})` });
            } catch (error) {
                logger.error('[BOT API] Failed to start live streaming:', error);
                res.status(500).json({ error: 'Failed to start live streaming', details: error.message });
            }
        });



        this.app.get('/live-audio/stream/:guildId', (req, res) => {
            try {
                const { guildId } = req.params;
                const streamState = liveStreams.get(guildId);

                if (!streamState) {
                    logger.warn(`[BOT API] No live stream active for guild ${guildId}`);
                    return res.status(404).json({ error: 'No live stream active for this guild' });
                }

                logger.info(`[BOT API] New client connecting to live audio stream for guild ${guildId}`);


                res.setHeader('Content-Type', 'audio/pcm');
                res.setHeader('Transfer-Encoding', 'chunked');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');


                streamState.clients.add(res);
                logger.info(`[BOT API] Client added to stream.Total clients: ${streamState.clients.size} `);


                req.on('close', () => {
                    logger.info(`[BOT API] Client disconnected from live audio stream`);
                    streamState.clients.delete(res);
                    if (streamState.clients.size === 0 && liveStreams.has(guildId)) {

                        logger.info(`[BOT API] No more clients, scheduling cleanup in 5 seconds`);
                        setTimeout(() => {
                            if (liveStreams.has(guildId) && liveStreams.get(guildId).clients.size === 0) {
                                logger.info(`[BOT API] Cleaning up live audio stream for guild ${guildId}`);
                                const state = liveStreams.get(guildId);
                                if (state.speakingHandler && state.connection.receiver) {
                                    state.connection.receiver.speaking.off('start', state.speakingHandler);
                                }
                                state.streams.forEach(stream => stream.destroy());
                                state.connection.destroy();
                                liveStreams.delete(guildId);
                            }
                        }, 5000);
                    }
                });
            } catch (error) {
                logger.error('[BOT API] Failed to setup live audio stream:', error);
                res.status(500).json({ error: 'Failed to setup stream', details: error.message });
            }
        });


        this.app.post('/live-audio/stop', async (req, res) => {
            try {
                const { guildId } = req.body;

                if (!guildId) {
                    return res.status(400).json({ error: 'Missing required parameter: guildId' });
                }

                const streamState = liveStreams.get(guildId);
                if (!streamState) {
                    return res.status(404).json({ error: 'No live stream active for this guild' });
                }


                streamState.clients.forEach(client => {
                    try {
                        if (!client.destroyed) {
                            client.end();
                        }
                    } catch (error) {

                    }
                });


                if (streamState.speakingHandler && streamState.connection.receiver) {
                    streamState.connection.receiver.speaking.off('start', streamState.speakingHandler);
                }


                streamState.streams.forEach(stream => {
                    try {
                        stream.destroy();
                    } catch (error) {

                    }
                });


                try {
                    streamState.connection.destroy();
                } catch (error) {

                }

                liveStreams.delete(guildId);

                res.json({ success: true, message: 'Live audio streaming stopped' });
            } catch (error) {
                logger.error('[BOT API] Failed to stop live audio:', error);
                res.status(500).json({ error: 'Failed to stop live audio', details: error.message });
            }
        });


        this.app.get('/live-audio/status/:guildId', (req, res) => {
            try {
                const { guildId } = req.params;
                const streamState = liveStreams.get(guildId);

                res.json({
                    isStreaming: streamState !== undefined,
                    clientCount: streamState ? streamState.clients.size : 0
                });
            } catch (error) {
                logger.error('[BOT API] Failed to get live audio status:', error);
                res.status(500).json({ error: 'Failed to get live audio status', details: error.message });
            }
        });


        this.app.post('/tournaments/:tournamentId/matches/:matchId/notify', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({ error: 'Bot client not ready' });
                }

                const { tournamentId, matchId } = req.params;
                const tournamentService = require('../services/pvp-tournament.service');
                const PvpTournamentEmbedFactory = require('../utils/pvp-tournament-embeds');

                const tournament = await tournamentService.getTournament(parseInt(tournamentId, 10));
                if (!tournament) {
                    return res.status(404).json({ error: 'Tournament not found' });
                }

                const match = await tournamentService.getMatch(parseInt(matchId, 10));
                if (!match || match.tournament_id !== tournament.id) {
                    return res.status(404).json({ error: 'Match not found' });
                }

                if (!match.player1_id || !match.player2_id) {
                    return res.status(400).json({ error: 'Match does not have both players' });
                }

                const channel = await this.client.channels.fetch(tournament.channel_id).catch(() => null);
                if (!channel) {
                    return res.status(404).json({ error: 'Channel not found' });
                }

                const guild = channel.guild;
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }

                const embed = PvpTournamentEmbedFactory.createMatchNotificationEmbed(
                    match,
                    match.player1_id,
                    match.player2_id,
                    tournament,
                    guild
                );

                const message = await channel.send({
                    content: `< @${match.player1_id}> < @${match.player2_id}> `,
                    embeds: [embed]
                });

                await tournamentService.setMatchMessageId(match.id, message.id);
                await tournamentService.startMatch(match.id);

                res.json({ success: true, messageId: message.id });
            } catch (error) {
                logger.error('[BOT API] Failed to notify match:', error);
                res.status(500).json({ error: 'Failed to notify match', details: error.message });
            }
        });

        this.app.post('/tournaments/:tournamentId/matches/:matchId/complete', async (req, res) => {
            try {
                if (!this.client || !this.client.isReady()) {
                    return res.status(503).json({ error: 'Bot client not ready' });
                }

                const { tournamentId, matchId } = req.params;
                const { winnerId } = req.body;

                if (!winnerId) {
                    return res.status(400).json({ error: 'winnerId is required' });
                }

                const tournamentService = require('../services/pvp-tournament.service');
                const PvpTournamentEmbedFactory = require('../utils/pvp-tournament-embeds');

                const tournament = await tournamentService.getTournament(parseInt(tournamentId, 10));
                if (!tournament) {
                    return res.status(404).json({ error: 'Tournament not found' });
                }

                const match = await tournamentService.getMatch(parseInt(matchId, 10));
                if (!match || match.tournament_id !== tournament.id) {
                    return res.status(404).json({ error: 'Match not found' });
                }


                if (match.winner_id !== winnerId) {
                    logger.warn(`[BOT API] Match ${matchId} winner mismatch: expected ${winnerId}, got ${match.winner_id} `);
                }


                const channel = await this.client.channels.fetch(tournament.channel_id).catch(() => null);
                if (channel) {
                    try {
                        const guild = channel.guild;

                        const updatedMatch = await tournamentService.getMatch(parseInt(matchId, 10));
                        const embed = PvpTournamentEmbedFactory.createMatchResultEmbed(
                            updatedMatch,
                            winnerId,
                            tournament,
                            guild
                        );
                        await channel.send({ embeds: [embed] });
                        logger.info(`[BOT API] Sent match result message for match ${matchId}`);
                    } catch (error) {
                        logger.error('[BOT API] Failed to send match result:', error);

                    }
                } else {
                    logger.warn(`[BOT API] Channel ${tournament.channel_id} not found for tournament ${tournamentId}`);
                }

                res.json({ success: true });
            } catch (error) {
                logger.error('[BOT API] Failed to complete match:', error);
                res.status(500).json({ error: 'Failed to complete match', details: error.message });
            }
        });
    }



    setupMinecraftRoutes() {



        const validateMinecraftAuth = (req, res, next) => {



            const config = require('../config');
            if (!config.minecraft.enabled) {
                return res.status(503).json({ error: 'Minecraft API is disabled' });
            }

            const apiKey = req.headers.authorization;
            const configuredKey = config.minecraft.apiKey;

            if (!configuredKey) {
                logger.warn('[BOT API] Minecraft API key not configured, rejecting request');
                return res.status(500).json({ error: 'Server configuration error' });
            }

            if (apiKey !== configuredKey) {
                logger.warn(`[BOT API] Invalid API key attempt from ${req.ip}`);
                return res.status(401).json({ error: 'Unauthorized' });
            }

            next();
        };

        this.minecraftApp.post('/minecraft/event', validateMinecraftAuth, async (req, res) => {


            try {
                const { type, ...data } = req.body;

                if (!type) {
                    return res.status(400).json({ error: 'Missing event type' });
                }

                logger.info(`[MINECRAFT API] Received event: ${type}`, data);

                if (this.client) {
                    this.client.emit('minecraftEvent', type, data);
                }


                if (type === 'command') {
                    const minecraftRepo = require('../database/repositories/minecraftapi');
                    try {
                        await minecraftRepo.logCommand(data);
                        logger.debug(`[MINECRAFT API] Saved command event for user ${data.username}`);
                    } catch (dbError) {
                        logger.error('[MINECRAFT API] Failed to save command event:', dbError);
                    }
                }

                res.json({ success: true, message: 'Event received' });
            } catch (error) {
                logger.error('[MINECRAFT API] Failed to process event:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });






    }


    start() {
        const startBotApi = new Promise((resolve, reject) => {

            this.server = this.app.listen(this.port, '0.0.0.0', () => {
                logger.success(`Bot API server running on port ${this.port} (accessible on all interfaces)`);
                resolve();
            });

            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    logger.warn(`Port ${this.port} already in use, Bot API server not started`);
                    logger.warn(`Another process may be using port ${this.port}. Check with: netstat -ano | findstr :${this.port} (Windows) or lsof -i :${this.port} (Linux)`);
                    resolve();
                } else {
                    logger.error(`[BOT API] Failed to start server on port ${this.port}:`, error);
                    reject(error);
                }
            });
        });

        const startMinecraftApi = new Promise((resolve, reject) => {
            this.minecraftServer = this.minecraftApp.listen(this.minecraftPort, '0.0.0.0', () => {
                logger.success(`Minecraft API server running on port ${this.minecraftPort} (accessible on all interfaces)`);
                resolve();
            });

            this.minecraftServer.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    logger.warn(`Port ${this.minecraftPort} already in use, Minecraft API server not started`);
                    logger.warn(`Another process may be using port ${this.minecraftPort}.`);
                    resolve();
                } else {
                    logger.error(`[MINECRAFT API] Failed to start server on port ${this.minecraftPort}:`, error);
                    reject(error);
                }
            });
        });

        return Promise.all([startBotApi, startMinecraftApi]);
    }

    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        if (this.minecraftServer) {
            this.minecraftServer.close();
            this.minecraftServer = null;
        }
    }
}

module.exports = BotAPI;