const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    EndBehaviorType
} = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { Transform } = require('stream');
const logger = require('../../utils/logger');


let opusscript = null;
try {
    opusscript = require('opusscript');
} catch (error) {
    logger.warn('opusscript not available, Opus decoding may not work');
}


let ffmpegPath = 'ffmpeg';
try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic) {
        ffmpegPath = ffmpegStatic;
        process.env.FFMPEG_PATH = ffmpegStatic;
        logger.debug('FFmpeg path configured from ffmpeg-static');
    }
} catch (error) {
    logger.warn('ffmpeg-static not available, FFmpeg must be installed system-wide');
}


const activeConnections = new Map();
const recordingState = new Map();


const SOUNDS_DIR = path.join(__dirname, '../../assets/sounds');


if (!fs.existsSync(SOUNDS_DIR)) {
    fs.mkdirSync(SOUNDS_DIR, { recursive: true });
}

function buildCommand() {
    const command = new SlashCommandBuilder()
        .setName('record')
        .setDescription('Record audio from a voice channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

    command.addSubcommand(subcommand =>
        subcommand
            .setName('start')
            .setDescription('Start recording audio from a voice channel')
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('Voice channel to record from (optional, uses your current channel)')
                    .setRequired(false)
            )
            .addStringOption(option =>
                option
                    .setName('name')
                    .setDescription('Name for the recorded sound (optional, defaults to timestamp)')
                    .setRequired(false)
            )
    );

    command.addSubcommand(subcommand =>
        subcommand
            .setName('stop')
            .setDescription('Stop recording and save the sound to the soundboard')
    );

    return command;
}

async function getVoiceChannel(interaction, channelInput = null) {

    if (channelInput) {
        const channel = channelInput;
        if (channel && channel.isVoiceBased()) {
            return channel;
        }
        throw new Error('Invalid voice channel specified');
    }


    const { CacheHelpers } = require('../../utils/discord-cache');
    const member = await CacheHelpers.getMember(interaction.guild, interaction.user.id, 2 * 60 * 1000);
    if (member.voice.channel) {
        return member.voice.channel;
    }

    throw new Error('You must be in a voice channel or specify one!');
}

async function joinChannel(voiceChannel) {
    const guildId = voiceChannel.guild.id;
    const targetChannelId = voiceChannel.id;


    if (activeConnections.has(guildId)) {
        const connection = activeConnections.get(guildId);
        const currentChannelId = connection.joinConfig?.channelId;


        if (connection.state.status !== VoiceConnectionStatus.Destroyed &&
            connection.state.status !== VoiceConnectionStatus.Disconnected &&
            currentChannelId === targetChannelId) {
            logger.info(`Reusing existing connection to channel ${targetChannelId}`);
            return connection;
        }


        logger.info(`[RECORD] Existing connection is in different channel (${currentChannelId} vs ${targetChannelId}) or dead, destroying and reconnecting`);
        try {
            connection.destroy();
        } catch (error) {
            logger.error(`[RECORD] Error destroying old connection:`, error);
        }
        activeConnections.delete(guildId);
    }

    logger.info(`[RECORD] Creating new connection to channel ${targetChannelId} in guild ${guildId}`);

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
    });

    activeConnections.set(guildId, connection);


    try {
        logger.info(`[RECORD] Waiting for voice connection to be ready...`);
        await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
        logger.info(`[RECORD] Voice connection is ready! Status: ${connection.state.status}`);
    } catch (error) {
        logger.error(`[RECORD] Failed to connect to voice channel:`, error);
        connection.destroy();
        activeConnections.delete(guildId);
        throw new Error(`Failed to connect to voice channel: ${error.message}`);
    }


    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]).catch(() => {
                connection.destroy();
                activeConnections.delete(guildId);

                if (recordingState.has(guildId)) {
                    stopRecording(guildId, false);
                }
            });
        } catch (error) {
            connection.destroy();
            activeConnections.delete(guildId);
            if (recordingState.has(guildId)) {
                stopRecording(guildId, false);
            }
        }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
        activeConnections.delete(guildId);
        if (recordingState.has(guildId)) {
            stopRecording(guildId, false);
        }
    });

    return connection;
}

async function stopRecording(guildId, saveFile = true) {
    const state = recordingState.get(guildId);
    if (!state) return null;

    const { connection, streams, startTime, tempPcmFile, pcmWriteStream, tempDir, finalPath, speakingHandler } = state;


    if (speakingHandler && connection.receiver) {
        connection.receiver.speaking.off('start', speakingHandler);
    }


    streams.forEach(stream => {
        try {
            stream.destroy();
        } catch (error) {

        }
    });


    return new Promise((resolve) => {
        if (pcmWriteStream && pcmWriteStream.writable) {
            pcmWriteStream.end(() => {

                setTimeout(() => {
                    recordingState.delete(guildId);

                    if (!saveFile) {

                        if (fs.existsSync(tempPcmFile)) {
                            try {
                                fs.unlinkSync(tempPcmFile);
                            } catch (error) {

                            }
                        }
                        resolve(null);
                    } else {
                        resolve({ startTime, tempPcmFile, tempDir, finalPath });
                    }
                }, 1000);
            });
        } else {
            recordingState.delete(guildId);
            if (!saveFile) {
                resolve(null);
            } else {
                resolve({ startTime, tempPcmFile, tempDir, finalPath });
            }
        }
    });
}

async function processRecording(tempPcmFile, tempDir, finalPath) {
    return new Promise((resolve, reject) => {

        if (!fs.existsSync(tempPcmFile)) {
            reject(new Error('No audio file was recorded'));
            return;
        }

        const stats = fs.statSync(tempPcmFile);
        if (stats.size < 100) {
            reject(new Error('No audio was recorded (file too small)'));
            return;
        }



        const ffmpegArgs = [
            '-y',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            '-i', tempPcmFile,
            '-f', 'mp3',
            '-b:a', '192k',
            finalPath
        ];

        const ffmpeg = spawn(ffmpegPath, ffmpegArgs);

        let errorOutput = '';
        ffmpeg.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        ffmpeg.on('close', (code) => {

            try {
                if (fs.existsSync(tempPcmFile)) {
                    fs.unlinkSync(tempPcmFile);
                }
            } catch (error) {

            }


            try {
                if (fs.existsSync(tempDir)) {
                    const files = fs.readdirSync(tempDir);
                    if (files.length === 0) {
                        fs.rmdirSync(tempDir);
                    }
                }
            } catch (error) {

            }

            if (code === 0) {
                resolve(finalPath);
            } else {
                reject(new Error(`FFmpeg exited with code ${code}: ${errorOutput}`));
            }
        });

        ffmpeg.on('error', (error) => {
            reject(new Error(`FFmpeg error: ${error.message}`));
        });
    });
}

async function startRecording(connection, guildId, soundName = null) {

    const timestamp = Date.now();
    const sanitizedName = soundName
        ? soundName.toLowerCase().replace(/[^a-z0-9_-]/g, '').substring(0, 30)
        : `recording-${timestamp}`;

    const tempDir = path.join(SOUNDS_DIR, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const finalPath = path.join(SOUNDS_DIR, `${sanitizedName}.mp3`);
    const tempPcmFile = path.join(tempDir, `${sanitizedName}-${timestamp}.pcm`);



    const pcmWriteStream = fs.createWriteStream(tempPcmFile);


    const userStreams = new Map();


    const guild = connection.receiver.connection?.guild ||
                  (connection.joinConfig?.guildId ?
                   connection.receiver.connection?.client?.guilds?.cache?.get(connection.joinConfig.guildId) : null);

    const voiceChannel = guild?.channels?.cache?.get(connection.joinConfig.channelId);


    const state = {
        connection,
        receiver: connection.receiver,
        streams: [],
        startTime: Date.now(),
        finalPath: finalPath,
        tempPcmFile: tempPcmFile,
        pcmWriteStream: pcmWriteStream,
        userStreams: userStreams,
        tempDir: tempDir,
        voiceChannel: voiceChannel
    };

    recordingState.set(guildId, state);


    const speakingHandler = (userId) => {

        if (userId === connection.joinConfig.group) return;


        if (!recordingState.has(guildId)) return;


        if (userStreams.has(userId)) return;

        try {


            const stream = connection.receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.Manual
                }
            });

            state.streams.push(stream);
            userStreams.set(userId, stream);


            stream.pipe(pcmWriteStream, { end: false });

            stream.on('error', (error) => {
                logger.error(`Error in audio stream for user ${userId}:`, error);
                userStreams.delete(userId);
            });

            logger.debug(`Subscribed to audio stream for user ${userId}`);
        } catch (error) {
            logger.error(`Failed to subscribe to user ${userId}:`, error);
        }
    };


    connection.receiver.speaking.on('start', speakingHandler);
    state.speakingHandler = speakingHandler;

    logger.info(`Started recording in guild ${guildId}, saving PCM to ${tempPcmFile}`);

    logger.info(`Started recording in guild ${guildId}, saving to ${tempDir}`);
    return { finalPath, sanitizedName };
}


module.exports = {
    get data() {
        return buildCommand();
    },

    recordingState: recordingState,
    startRecording: startRecording,
    stopRecording: stopRecording,
    processRecording: processRecording,
    joinChannel: joinChannel,
    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;

            if (subcommand === 'start') {

                if (recordingState.has(guildId)) {
                    return interaction.reply({
                        content: '❌ Already recording! Use `/record stop` to stop the current recording.',
                        ephemeral: true
                    });
                }

                const channelOption = interaction.options.getChannel('channel');
                const soundName = interaction.options.getString('name');


                let voiceChannel;
                try {
                    voiceChannel = await getVoiceChannel(interaction, channelOption);
                } catch (error) {
                    return interaction.reply({
                        content: `❌ ${error.message}`,
                        ephemeral: true
                    });
                }


                const { CacheHelpers } = require('../../utils/discord-cache');
                const botMember = await CacheHelpers.getMember(interaction.guild, interaction.client.user.id, 2 * 60 * 1000);
                if (!voiceChannel.permissionsFor(botMember).has(['Connect', 'Speak'])) {
                    return interaction.reply({
                        content: '❌ I don\'t have permission to connect or speak in that voice channel!',
                        ephemeral: true
                    });
                }

                if (!interaction.deferred && !interaction.replied) {
                    try {
                        await interaction.deferReply({ ephemeral: true });
                    } catch (error) {

                        if (error.name !== 'InteractionAlreadyReplied' && error.code !== 'InteractionAlreadyReplied') {
                            throw error;
                        }
                    }
                }

                try {
                    const connection = await joinChannel(voiceChannel);
                    const { finalPath, sanitizedName } = await startRecording(connection, guildId, soundName);

                    const embed = new EmbedBuilder()
                        .setTitle('🔴 Recording Started')
                        .setDescription(`Recording audio from <#${voiceChannel.id}>\n\nUse \`/record stop\` to stop recording and save the sound.`)
                        .setColor(0xED4245)
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    logger.info(`Recording started in ${voiceChannel.name} by ${interaction.user.tag}`);

                } catch (error) {
                    logger.error('Error starting recording', error);
                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply({
                            content: `❌ Failed to start recording: ${error.message}`
                        });
                    } else {
                        await interaction.reply({
                            content: `❌ Failed to start recording: ${error.message}`,
                            ephemeral: true
                        });
                    }
                }

            } else if (subcommand === 'stop') {
                const state = recordingState.get(guildId);
                if (!state) {
                    return interaction.reply({
                        content: '❌ No active recording found! Use `/record start` to begin recording.',
                        ephemeral: true
                    });
                }

                if (!interaction.deferred && !interaction.replied) {
                    try {
                        await interaction.deferReply({ ephemeral: true });
                    } catch (error) {

                        if (error.name !== 'InteractionAlreadyReplied' && error.code !== 'InteractionAlreadyReplied') {
                            throw error;
                        }
                    }
                }

                try {
                    const recordingData = await stopRecording(guildId, true);
                    if (!recordingData) {
                        return interaction.editReply({
                            content: '❌ No active recording found!'
                        });
                    }

                    const { startTime, tempPcmFile, tempDir, finalPath } = recordingData;
                    const duration = Math.round((Date.now() - startTime) / 1000);


                    await processRecording(tempPcmFile, tempDir, finalPath);


                    const soundName = path.basename(finalPath, '.mp3');


                    const connection = activeConnections.get(guildId);
                    if (connection) {
                        connection.destroy();
                        activeConnections.delete(guildId);
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('✅ Recording Stopped')
                        .setDescription(`Recording saved as **${soundName}**!\n\nDuration: ${duration} seconds\n\nYou can now play it using \`/soundboard sound:${soundName}\``)
                        .setColor(0x57F287)
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    logger.info(`Recording stopped and saved as ${soundName} by ${interaction.user.tag}`);

                } catch (error) {
                    logger.error('Error stopping recording', error);
                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply({
                            content: `❌ Failed to process recording: ${error.message}`
                        });
                    } else {
                        await interaction.reply({
                            content: `❌ Failed to process recording: ${error.message}`,
                            ephemeral: true
                        });
                    }
                }
            }

        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            await handleError(interaction, error, 'record');
        }
    }
};