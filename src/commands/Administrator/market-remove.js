const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../../utils/logger');
const { setServerFooter } = require('../../utils/embed-helper');

const CONFIG_PATH = path.join(__dirname, '../../data/config.yml');
const BASE_PRICES_PATH = path.join(__dirname, '../../data/base-prices.json');
const TRANSLATIONS_PATH = path.join(__dirname, '../../data/item-translations.json');

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            throw new Error('config.yml not found');
        }
        const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
        return yaml.load(fileContents);
    } catch (error) {
        logger.error('Failed to load config.yml', error);
        throw new Error(`Failed to load config: ${error.message}`);
    }
}

function loadBasePrices() {
    try {
        if (!fs.existsSync(BASE_PRICES_PATH)) {
            throw new Error('base-prices.json not found');
        }
        const fileContents = fs.readFileSync(BASE_PRICES_PATH, 'utf8');
        return JSON.parse(fileContents);
    } catch (error) {
        logger.error('Failed to load base-prices.json', error);
        throw new Error(`Failed to load base prices: ${error.message}`);
    }
}

function loadTranslations() {
    try {
        if (!fs.existsSync(TRANSLATIONS_PATH)) {
            return {};
        }
        const fileContents = fs.readFileSync(TRANSLATIONS_PATH, 'utf8');
        return JSON.parse(fileContents);
    } catch (error) {
        logger.error('Failed to load item-translations.json', error);
        return {};
    }
}

function getAllItems(config) {
    const items = new Set();

    if (!config.pnjs) {
        return items;
    }

    for (const [merchantName, merchantData] of Object.entries(config.pnjs)) {
        if (!merchantData.trades || !Array.isArray(merchantData.trades)) {
            continue;
        }

        merchantData.trades.forEach((trade) => {
            if (typeof trade !== 'object' || !trade) {
                return;
            }

            const itemName = Object.keys(trade)[0];
            if (itemName) {
                items.add(itemName);
            }
        });
    }

    return items;
}

function removeItemFromConfig(config, itemName) {
    let removedCount = 0;

    if (!config.pnjs) {
        return removedCount;
    }

    for (const [merchantName, merchantData] of Object.entries(config.pnjs)) {
        if (!merchantData.trades || !Array.isArray(merchantData.trades)) {
            continue;
        }

        const originalLength = merchantData.trades.length;
        merchantData.trades = merchantData.trades.filter((trade) => {
            if (typeof trade !== 'object' || !trade) {
                return true;
            }
            const tradeItemName = Object.keys(trade)[0];
            return tradeItemName !== itemName;
        });

        const newLength = merchantData.trades.length;
        if (newLength < originalLength) {
            removedCount += (originalLength - newLength);
        }
    }

    return removedCount;
}

function removeItemFromBasePrices(basePrices, itemName) {
    if (basePrices[itemName]) {
        delete basePrices[itemName];
        return true;
    }
    return false;
}

function saveConfig(config) {
    try {
        const yamlString = yaml.dump(config, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            sortKeys: false
        });
        fs.writeFileSync(CONFIG_PATH, yamlString, 'utf8');
        return true;
    } catch (error) {
        logger.error('Failed to save config.yml', error);
        throw error;
    }
}

function saveBasePrices(basePrices) {
    try {
        fs.writeFileSync(BASE_PRICES_PATH, JSON.stringify(basePrices, null, 2), 'utf8');
        return true;
    } catch (error) {
        logger.error('Failed to save base-prices.json', error);
        throw error;
    }
}

function buildCommand() {
    const command = new SlashCommandBuilder()
        .setName('market-remove')
        .setDescription('Supprimer un objet du marché (config.yml et base-prices.json)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('item')
                .setDescription('L\'objet à supprimer')
                .setRequired(true)
                .setAutocomplete(true)
        );

    return command;
}

module.exports = {
    get data() {
        return buildCommand();
    },
    async execute(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: false });
            }

            const itemName = interaction.options.getString('item', true);
            const translations = loadTranslations();
            const translatedName = translations[itemName] || itemName;

            const config = loadConfig();
            const basePrices = loadBasePrices();

            const removedFromConfig = removeItemFromConfig(config, itemName);

            const removedFromBasePrices = removeItemFromBasePrices(basePrices, itemName);

            if (removedFromConfig > 0) {
                saveConfig(config);
            }

            if (removedFromBasePrices) {
                saveBasePrices(basePrices);
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Objet supprimé')
                .setDescription(`L'objet **${translatedName}** (\`${itemName}\`) a été supprimé avec succès.`)
                .addFields(
                    { name: 'Config.yml', value: removedFromConfig > 0 ? `✅ ${removedFromConfig} occurrence(s) supprimée(s)` : '❌ Non trouvé', inline: true },
                    { name: 'Base-prices.json', value: removedFromBasePrices ? '✅ Supprimé' : '❌ Non trouvé', inline: true }
                )
                .setColor(0x57F287)
                .setTimestamp();

            setServerFooter(embed, interaction.guild);

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    embeds: [embed]
                });
            } else {
                await interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            logger.success(`Market item ${itemName} removed by ${interaction.user.tag}`);

        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            await handleError(interaction, error, 'market-remove');
        }
    },
    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused();
            const config = loadConfig();
            const allItems = Array.from(getAllItems(config)).sort();
            const translations = loadTranslations();

            const filtered = allItems
                .filter(itemName => {
                    const translatedName = translations[itemName] || itemName;
                    const searchTerm = focusedValue.toLowerCase();
                    return itemName.toLowerCase().includes(searchTerm) ||
                        translatedName.toLowerCase().includes(searchTerm);
                })
                .slice(0, 25)
                .map(itemName => {
                    const translatedName = translations[itemName] || itemName;
                    return {
                        name: `${translatedName} (${itemName})`.substring(0, 100),
                        value: itemName
                    };
                });

            await interaction.respond(filtered);
        } catch (error) {
            logger.error('Error in market-remove autocomplete', error);
            await interaction.respond([]);
        }
    }
};