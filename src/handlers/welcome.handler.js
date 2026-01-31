const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const welcomeImageService = require('../services/welcome-image.service');

class WelcomeHandler {
    constructor(client) {
        this.client = client;
    }

    async handleMemberJoin(member) {
        try {

            if (!config.features.welcomeMessages) {
                return;
            }


            const welcomeChannelId = config.features.welcomeChannelId;
            if (!welcomeChannelId) {
                logger.warn('Welcome messages enabled but no channel configured');
                return;
            }

            const channel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
            if (!channel) {
                logger.warn(`Welcome channel ${welcomeChannelId} not found`);
                return;
            }


            const welcomeSettings = config.features.welcomeSettings || {};
            const sendImage = welcomeSettings.sendImage !== false;


            let message = welcomeSettings.message || `Bienvenue ${member.user} sur ${member.guild.name}! 🎉`;
            message = message.replace(/{user}/g, member.user.toString())
                            .replace(/{username}/g, member.user.username)
                            .replace(/{server}/g, member.guild.name)
                            .replace(/{memberCount}/g, member.guild.memberCount.toString());

            if (sendImage) {
                try {

                    let subtitleText = welcomeSettings.imageSubtitle || 'sur le serveur Discord';
                    subtitleText = subtitleText.replace(/{memberCount}/g, member.guild.memberCount.toString())
                                               .replace(/{server}/g, member.guild.name);

                    let thirdLineText = welcomeSettings.thirdLineText || member.guild.name;
                    thirdLineText = thirdLineText.replace(/{server}/g, member.guild.name)
                                                 .replace(/{memberCount}/g, member.guild.memberCount.toString());


                    const imageBuffer = await welcomeImageService.generateWelcomeImage(member, {
                        width: welcomeSettings.imageWidth || 1200,
                        height: welcomeSettings.imageHeight || 320,
                        backgroundColor: welcomeSettings.imageBackgroundColor || '#0f0f0f',
                        bannerColor: welcomeSettings.bannerColor || '#1a1a1a',
                        textColor: welcomeSettings.imageTextColor || '#ffffff',
                        avatarSize: welcomeSettings.imageAvatarSize || 160,
                        subtitleText: subtitleText,
                        thirdLineText: thirdLineText,
                    });


                    const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });


                    const embed = new EmbedBuilder()
                        .setColor(0x2f3136)
                        .setDescription(message)
                        .setImage('attachment://welcome.png')
                        .setTimestamp();


                    await channel.send({
                        embeds: [embed],
                        files: [attachment]
                    });

                    logger.info(`Welcome image sent for ${member.user.tag}`);
                } catch (error) {
                    logger.error('Failed to generate/send welcome image, sending text only', error);

                    await channel.send(message);
                }
            } else {

                await channel.send(message);
            }
        } catch (error) {
            logger.error('Error handling welcome message', error);
        }
    }
}

module.exports = WelcomeHandler;