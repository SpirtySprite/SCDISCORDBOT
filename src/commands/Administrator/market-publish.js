const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

const STATE_PATH = path.join(__dirname, '../../data/market-state.json');
const BASE_PRICES_PATH = path.join(__dirname, '../../data/base-prices.json');
const TRANSLATIONS_PATH = path.join(__dirname, '../../data/item-translations.json');

const readJson = (p) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
const translate = (n, t) => t[n] || n;

function getPaymentEmoji(type) {
    const map = {
        'GOLD_NUGGET': ':gold_nugget:',
        'IRON_NUGGET': ':iron_nugget:',
        'IRON_INGOT': ':Iron_Ingot:',
        'DIAMOND': ':diamond:',
        'EMERALD': ':emerald:'
    };
    return map[type] || type;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('market-publish')
        .setDescription('Publier la rotation (Patch Notes)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });

        try {
            const state = readJson(STATE_PATH);
            const basePrices = readJson(BASE_PRICES_PATH);
            const translations = readJson(TRANSLATIONS_PATH);

            if (!state.lastUpdated) {
                await interaction.editReply('❌ Aucune donnée de marché trouvée. Faites une rotation d\'abord.');
                return;
            }

            let message = `# 📅 Rotation du ${state.lastUpdated}\n\n`;

            if (state.buffed?.length) {
                message += '\n## 🟢 Buffs (Active)\n';
                message += state.buffed.map(t => {
                    const name = translate(t.item, translations);
                    const base = basePrices[t.item] || { basePrice: '?', paymentType: '?' };
                    const emoji = getPaymentEmoji(t.type);

                    const qtyStr = t.quantity > 1 ? `${t.quantity}x ` : '';
                    return `> **${qtyStr}${name}** : ${base.basePrice} ➔ **${t.price}** ${emoji}`;
                }).join('\n') + '\n\n';
            }

            if (state.reset?.length) {
                message += '## 🟡 Reset (Retour à la base)\n';
                message += state.reset.map(t => {
                    const item = t.item || t;
                    const name = translate(item, translations);
                    const base = basePrices[item] || { basePrice: '?', paymentType: '?' };
                    const emoji = getPaymentEmoji(base.paymentType);

                    const prevPrice = t.price || '?';
                    const prevQty = t.quantity || 1;
                    const currQty = base.quantity || 1;

                    let display = '';
                    if (prevQty !== currQty) {
                        display = `> **${prevQty}x ➔ ${currQty}x ${name}** : ${prevPrice} ➔ ${base.basePrice} ${emoji}`;
                    } else {
                        const qtyStr = currQty > 1 ? `${currQty}x ` : '';
                        display = `> **${qtyStr}${name}** : ${prevPrice} ➔ ${base.basePrice} ${emoji}`;
                    }
                    return display;
                }).join('\n');
            }

            await interaction.editReply({ content: message });
            logger.success(`Market patch notes published by ${interaction.user.tag}`);

        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Erreur: ${error.message}`);
        }
    }
};