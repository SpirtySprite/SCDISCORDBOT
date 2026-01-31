const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const marketRotationLogic = require('../../utils/market-rotation-logic');
const { EMBED_COLORS } = require('../../utils/constants');

const BASE_PRICES_PATH = path.join(__dirname, '../../data/base-prices.json');
const TRANSLATIONS_PATH = path.join(__dirname, '../../data/item-translations.json');
const CONFIG_PATH = path.join(__dirname, '../../data/config.yml');

const loadJson = (p) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
const translate = (n, t) => t[n] || n;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('market-rotate')
        .setDescription('Rotation du marché (Buff -> Reset) et mise à jour config')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

        try {
            const { newState } = await marketRotationLogic.performMarketRotation();

            const basePrices = loadJson(BASE_PRICES_PATH);
            const translations = loadJson(TRANSLATIONS_PATH);

            const embed = new EmbedBuilder()
                .setTitle('🔄 Market Rotation')
                .setColor(EMBED_COLORS.SUCCESS)
                .setTimestamp()
                .setFooter({ text: `Update: ${newState.lastUpdated}` });

            if (newState.buffed?.length) {
                const list = newState.buffed.map(t => {
                    const name = translate(t.item, translations);
                    const base = basePrices[t.item] || { basePrice: '?', paymentType: '?' };
                    const qtyStr = t.quantity > 1 ? `${t.quantity}x ` : '';
                    return `• **${qtyStr}${name}**: ${base.basePrice} ➔ **${t.price}** ${t.type}`;
                }).join('\n');
                embed.addFields({ name: '🟢 Buffed (Active)', value: list });
            }

            if (newState.reset?.length) {
                const list = newState.reset.map(t => {
                    const item = t.item || t;
                    const name = translate(item, translations);
                    const base = basePrices[item] || { basePrice: '?', paymentType: '?', quantity: 1 };

                    const prevPrice = t.price || '?';
                    const prevQty = t.quantity || 1;
                    const currQty = base.quantity || 1;

                    const qtyChange = prevQty !== currQty ? `${prevQty}x ➔ ${currQty}x ` : (currQty > 1 ? `${currQty}x ` : '');

                    return `• **${qtyChange}${name}**: ${prevPrice} ➔ ${base.basePrice} ${base.paymentType}`;
                }).join('\n');
                embed.addFields({ name: '🟡 Reset (Back to Base)', value: list });
            }

            const files = [];
            if (fs.existsSync(CONFIG_PATH)) {
                files.push(new AttachmentBuilder(CONFIG_PATH, { name: 'config.yml' }));
            }

            await interaction.editReply({ embeds: [embed] });

            await interaction.user.send({
                content: 'Backup of new config configuration:',
                files
            }).catch(() => { });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `❌ Error: ${error.message}` });
        }
    }
};