const Jimp = require('jimp');
const https = require('https');
const http = require('http');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

class WelcomeImageService {
    constructor() {
        this.cacheDir = path.join(__dirname, '../../temp');
        this.ensureCacheDir();
    }

    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    async downloadImage(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download image: ${response.statusCode}`));
                    return;
                }

                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve(buffer);
                });
            }).on('error', reject);
        });
    }

    async generateWelcomeImage(member, config = {}) {
        try {
            const {
                width = 1200,
                height = 320,
                backgroundColor = '#0f0f0f',
                bannerColor = '#1a1a1a',
                textColor = '#ffffff',
                avatarSize = 160,
                titleText = `Bienvenue ${member.user.username}!`,
                subtitleText = `Tu es le ${member.guild.memberCount}ème membre`,
                titleFontSize = 128,
                subtitleFontSize = 64,
                thirdLineText = 'Serenity Craft : 1.17 - 1.21.10'
            } = config;


            const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const avatarBuffer = await this.downloadImage(avatarUrl);
            const avatar = await Jimp.read(avatarBuffer);


            const image = new Jimp(width, height, backgroundColor);



            const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
            const fontSubtitle = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
            const fontThirdLine = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);



            const bannerHeight = height - 40;
            const bannerY = 20;
            const bannerWidth = width - 40;
            const bannerX = 20;



            for (let y = bannerY; y < bannerY + bannerHeight; y++) {
                for (let x = bannerX; x < bannerX + bannerWidth; x++) {
                    image.setPixelColor(this.hexToInt(bannerColor), x, y);
                }
            }



            avatar.resize(avatarSize, avatarSize);
            const roundedAvatar = await this.makeRounded(avatar, 12);



            const avatarX = bannerX + 35;
            const avatarY = bannerY + (bannerHeight - avatarSize) / 2;


            image.composite(roundedAvatar, avatarX, avatarY);



            const textAreaStartX = avatarX + avatarSize + 25;
            const textAreaWidth = (bannerX + bannerWidth) - textAreaStartX - 35;



            const titleHeight = 110;
            const subtitleHeight = 70;
            const thirdLineHeight = 40;
            const totalTextHeight = titleHeight + subtitleHeight + thirdLineHeight + 15;
            const textStartY = bannerY + (bannerHeight - totalTextHeight) / 2;



            const titleY = textStartY;
            image.print(
                fontTitle,
                textAreaStartX,
                titleY,
                {
                    text: 'Bienvenue',
                    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                    alignmentY: Jimp.VERTICAL_ALIGN_TOP
                },
                textAreaWidth,
                titleHeight
            );



            const subtitleY = titleY + titleHeight + 6;
            const subtitleTextFinal = subtitleText || 'sur le serveur Discord';
            image.print(
                fontSubtitle,
                textAreaStartX,
                subtitleY,
                {
                    text: subtitleTextFinal,
                    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                    alignmentY: Jimp.VERTICAL_ALIGN_TOP
                },
                textAreaWidth,
                subtitleHeight
            );



            const thirdLineY = subtitleY + subtitleHeight + 6;
            const thirdLineTextFinal = thirdLineText || `${member.guild.name}`;
            image.print(
                fontThirdLine,
                textAreaStartX,
                thirdLineY,
                {
                    text: thirdLineTextFinal,
                    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                    alignmentY: Jimp.VERTICAL_ALIGN_TOP
                },
                textAreaWidth,
                thirdLineHeight
            );


            const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
            return buffer;
        } catch (error) {
            logger.error('Failed to generate welcome image', error);
            throw error;
        }
    }

    hexToInt(hex) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return Jimp.rgbaToInt(r, g, b, 255);
    }

    async makeRounded(image, radius = 20) {
        const size = Math.min(image.bitmap.width, image.bitmap.height);
        image.resize(size, size);


        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                let shouldBeTransparent = false;


                if (x < radius && y < radius) {
                    const dx = radius - x;
                    const dy = radius - y;
                    if (Math.sqrt(dx * dx + dy * dy) > radius) {
                        shouldBeTransparent = true;
                    }
                }

                else if (x > size - radius && y < radius) {
                    const dx = x - (size - radius);
                    const dy = radius - y;
                    if (Math.sqrt(dx * dx + dy * dy) > radius) {
                        shouldBeTransparent = true;
                    }
                }

                else if (x < radius && y > size - radius) {
                    const dx = radius - x;
                    const dy = y - (size - radius);
                    if (Math.sqrt(dx * dx + dy * dy) > radius) {
                        shouldBeTransparent = true;
                    }
                }

                else if (x > size - radius && y > size - radius) {
                    const dx = x - (size - radius);
                    const dy = y - (size - radius);
                    if (Math.sqrt(dx * dx + dy * dy) > radius) {
                        shouldBeTransparent = true;
                    }
                }

                if (shouldBeTransparent) {
                    const idx = (y * size + x) * 4;
                    image.bitmap.data[idx + 3] = 0;
                }
            }
        }

        return image;
    }

    async makeCircular(image) {
        const size = Math.min(image.bitmap.width, image.bitmap.height);
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2 - 2;


        image.resize(size, size);


        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const distance = Math.sqrt(
                    Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
                );
                if (distance > radius) {

                    const idx = (y * size + x) * 4;
                    image.bitmap.data[idx + 3] = 0;
                }
            }
        }

        return image;
    }
}

module.exports = new WelcomeImageService();