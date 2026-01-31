const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');
const logger = require('../../utils/logger');
const config = require('../../config');


try {
    const opusscript = require('opusscript');

    logger.debug('Opusscript decoder available for voice');
} catch (error) {
    logger.warn('Opusscript not available, audio may not work properly');
}


try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic) {
        process.env.FFMPEG_PATH = ffmpegStatic;
        logger.debug('FFmpeg path configured from ffmpeg-static');
    }
} catch (error) {
    logger.warn('ffmpeg-static not available, FFmpeg must be installed system-wide');
}


const activeConnections = new Map();
const activePlayers = new Map();


const SOUNDS_DIR = path.join(__dirname, '../../assets/sounds');



const AVAILABLE_SOUNDS = [




];


function loadAvailableSounds() {
    const sounds = [];
    try {
        if (fs.existsSync(SOUNDS_DIR)) {
            const files = fs.readdirSync(SOUNDS_DIR);
            const soundboardConfig = config.soundboard || {};
            const allowedFormats = soundboardConfig.allowedFormats || ['mp3', 'ogg', 'wav'];
            const maxFileSize = soundboardConfig.maxFileSize || 10485760;
            const audioExtensions = allowedFormats.map(fmt => `.${fmt.toLowerCase()}`);

            files.forEach(file => {
                const ext = path.extname(file).toLowerCase();
                if (audioExtensions.includes(ext)) {
                    const filePath = path.join(SOUNDS_DIR, file);
                    try {
                        const stats = fs.statSync(filePath);
                        if (stats.size <= maxFileSize) {
                            const name = path.basename(file, ext);
                            sounds.push({
                                name: name,
                                file: file,
                                description: `Sound: ${name}`
                            });
                        } else {
                            logger.warn(`Sound file ${file} exceeds max size (${stats.size} > ${maxFileSize}), skipping`);
                        }
                    } catch (statError) {
                        logger.warn(`Could not check size of ${file}:`, statError);
                    }
                }
            });
        }
    } catch (error) {
        logger.error('Error loading sounds directory', error);
    }
    return sounds.length > 0 ? sounds : AVAILABLE_SOUNDS;
}

function buildCommand() {
    const command = new SlashCommandBuilder()
        .setName('soundboard')
        .setDescription('Play a sound in a voice channel')
        .addStringOption(option =>
            option
                .setName('sound')
                .setDescription('The sound to play')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option
                .setName('times')
                .setDescription('How many times to play the sound (default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10)
        )
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Voice channel to join (optional, uses your current channel)')
                .setRequired(false)
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


    if (activeConnections.has(guildId)) {
        const connection = activeConnections.get(guildId);
        if (connection.state.status !== VoiceConnectionStatus.Destroyed &&
            connection.state.status !== VoiceConnectionStatus.Disconnected) {
            return connection;
        }

        try {
            connection.destroy();
        } catch (error) {

        }
        activeConnections.delete(guildId);
        activePlayers.delete(guildId);
    }

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
    });

    activeConnections.set(guildId, connection);


    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
    } catch (error) {
        connection.destroy();
        activeConnections.delete(guildId);
        throw new Error('Failed to connect to voice channel');
    }


    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]).catch(() => {
                connection.destroy();
                activeConnections.delete(guildId);
                activePlayers.delete(guildId);
            });
        } catch (error) {
            connection.destroy();
            activeConnections.delete(guildId);
            activePlayers.delete(guildId);
        }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
        activeConnections.delete(guildId);
        activePlayers.delete(guildId);
    });

    return connection;
}

function playSound(connection, soundFile) {
    return new Promise((resolve, reject) => {
        const soundPath = path.join(SOUNDS_DIR, soundFile);

        if (!fs.existsSync(soundPath)) {
            reject(new Error(`Sound file not found: ${soundFile}`));
            return;
        }


        const guildId = connection.joinConfig.guildId;
        let player = activePlayers.get(guildId);

        if (!player) {
            player = createAudioPlayer();
            activePlayers.set(guildId, player);


            connection.subscribe(player);


            player.on('error', (error) => {
                logger.error('Audio player error', error);
                reject(error);
            });
        }


        const resource = createAudioResource(soundPath, {
            inputType: 'arbitrary',
            inlineVolume: true
        });


        const onIdle = () => {
            player.off(AudioPlayerStatus.Idle, onIdle);
            resolve();
        };


        if (player.state.status === AudioPlayerStatus.Playing) {
            player.once(AudioPlayerStatus.Idle, () => {

                player.on(AudioPlayerStatus.Idle, onIdle);
                player.play(resource);
            });
        } else {

            player.on(AudioPlayerStatus.Idle, onIdle);
            player.play(resource);
        }
    });
}

async function playSoundMultipleTimes(connection, soundFile, times, allowSpam = false) {
    for (let i = 0; i < times; i++) {

        if (allowSpam) {
            playSound(connection, soundFile).catch(error => {
                logger.error('Error playing sound:', error);
            });
        } else {
            await playSound(connection, soundFile);

            if (i < times - 1) {
                const soundboardConfig = config.soundboard || {};
                const playDelay = soundboardConfig.playDelay || 200;
                await new Promise(resolve => setTimeout(resolve, playDelay));
            }
        }
    }
}

module.exports = {
    get data() {
        return buildCommand();
    },
    async execute(interaction) {
            try {
            const soundName = interaction.options.getString('sound', true);
            const times = interaction.options.getInteger('times') || 1;
            const channelOption = interaction.options.getChannel('channel');


            const availableSounds = loadAvailableSounds();
            const sound = availableSounds.find(s => s.name.toLowerCase() === soundName.toLowerCase());

            if (!sound) {
                return interaction.reply({
                    content: `❌ Sound "${soundName}" not found. Use autocomplete to see available sounds.`,
                    ephemeral: true
                });
            }


            let voiceChannel;
            try {
                voiceChannel = await getVoiceChannel(interaction, channelOption);
            } catch (error) {
                return interaction.reply({
                    content: `❌ ${error.message}`,
                    ephemeral: true
                });
            }


            const soundboardConfig = config.soundboard || {};
            if (soundboardConfig.enabled === false) {
                return interaction.reply({
                    content: '❌ Soundboard is currently disabled.',
                    ephemeral: true
                });
            }


            const maxConcurrentPlays = soundboardConfig.maxConcurrentPlays || 3;
            const currentPlays = Array.from(activePlayers.values()).filter(p =>
                p.state.status === AudioPlayerStatus.Playing
            ).length;

            if (currentPlays >= maxConcurrentPlays) {
                return interaction.reply({
                    content: `❌ Maximum concurrent plays (${maxConcurrentPlays}) reached. Please wait for a sound to finish.`,
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
                await interaction.deferReply({ ephemeral: true });
            }

            try {
                const connection = await joinChannel(voiceChannel);


                playSoundMultipleTimes(connection, sound.file, times).catch(error => {
                    logger.error('Error during sound playback', error);
                });

                const embed = new EmbedBuilder()
                    .setTitle('🔊 Soundboard')
                    .setDescription(
                        times === 1
                            ? `Playing **${sound.name}** in <#${voiceChannel.id}>`
                            : `Playing **${sound.name}** ${times} times in <#${voiceChannel.id}>`
                    )
                    .setColor(0x5865F2)
                    .setTimestamp();

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
                logger.success(`Soundboard: ${interaction.user.tag} played "${sound.name}" in ${voiceChannel.name}`);

            } catch (error) {
                logger.error('Error playing sound', error);
                const errorMessage = `❌ Failed to play sound: ${error.message}`;
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: errorMessage });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            }

        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            await handleError(interaction, error, 'soundboard');
        }
    },
    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused();
            const availableSounds = loadAvailableSounds();

            const filtered = availableSounds
                .filter(sound =>
                    sound.name.toLowerCase().includes(focusedValue.toLowerCase()) ||
                    sound.description.toLowerCase().includes(focusedValue.toLowerCase())
                )
                .slice(0, 25)
                .map(sound => ({
                    name: sound.description || sound.name,
                    value: sound.name
                }));

            await interaction.respond(filtered);
        } catch (error) {
            logger.error('Error in soundboard autocomplete', error);
            await interaction.respond([]);
        }
    }
};