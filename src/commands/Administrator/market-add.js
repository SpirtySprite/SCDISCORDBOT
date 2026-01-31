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


const PAYMENT_TYPES = [
    { name: 'Gold Nugget', value: 'GOLD_NUGGET' },
    { name: 'Iron Nugget', value: 'IRON_NUGGET' },
    { name: 'Iron Ingot', value: 'IRON_INGOT' },
    { name: 'Gold Ingot', value: 'GOLD_INGOT' },
    { name: 'Diamond', value: 'DIAMOND' },
    { name: 'Emerald', value: 'EMERALD' }
];


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


function getMerchants(config) {
    if (!config.pnjs) {
        return [];
    }
    return Object.keys(config.pnjs);
}


function getAllExistingItems(basePrices) {
    return Object.keys(basePrices).sort();
}


function addItemToConfig(config, merchantName, itemName, quantity, paymentType, price) {
    if (!config.pnjs) {
        config.pnjs = {};
    }

    if (!config.pnjs[merchantName]) {
        throw new Error(`Merchant "${merchantName}" not found in config.yml`);
    }

    if (!config.pnjs[merchantName].trades) {
        config.pnjs[merchantName].trades = [];
    }


    const trade = {
        [itemName]: [
            parseInt(quantity),
            {
                [paymentType]: parseInt(price)
            }
        ]
    };

    config.pnjs[merchantName].trades.push(trade);
}


function addItemToBasePrices(basePrices, itemName, paymentType, price) {
    basePrices[itemName] = {
        paymentType: paymentType,
        basePrice: parseInt(price)
    };
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
        .setName('market-add')
        .setDescription('Ajouter un objet au marché (config.yml et base-prices.json)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

    try {
        const config = loadConfig();
        const merchants = getMerchants(config);


        if (merchants.length > 0) {
            const merchantChoices = merchants.slice(0, 25).map(merchantName => ({
                name: merchantName.replace(/§[0-9a-fk-or]/gi, '').substring(0, 100),
                value: merchantName
            }));

            command.addStringOption(option =>
                option
                    .setName('merchant')
                    .setDescription('Le marchand auquel ajouter l\'objet')
                    .setRequired(true)
                    .addChoices(...merchantChoices)
            );
        } else {
            command.addStringOption(option =>
                option
                    .setName('merchant')
                    .setDescription('Nom du marchand (ex: §eMarchand de Laines)')
                    .setRequired(true)
            );
        }


        command.addStringOption(option =>
            option
                .setName('item')
                .setDescription('Nom de l\'objet au format Minecraft exact (ex: STRING, DIAMOND_BLOCK)')
                .setRequired(true)
        );


        command.addIntegerOption(option =>
            option
                .setName('quantity')
                .setDescription('Quantité de l\'objet (pour config.yml)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(64)
        );


        command.addIntegerOption(option =>
            option
                .setName('price')
                .setDescription('Prix de l\'objet (pour config.yml et base-prices.json)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(9999)
        );


        command.addStringOption(option =>
            option
                .setName('payment_type')
                .setDescription('Type de paiement')
                .setRequired(true)
                .addChoices(...PAYMENT_TYPES)
        );

    } catch (error) {
        logger.warn('Failed to load data for market-add command options', error);

        command.addStringOption(option =>
            option
                .setName('merchant')
                .setDescription('Nom du marchand')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('item')
                .setDescription('Nom de l\'objet au format Minecraft exact (ex: STRING, DIAMOND_BLOCK)')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('quantity')
                .setDescription('Quantité de l\'objet')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(9999)
        )
        .addIntegerOption(option =>
            option
                .setName('price')
                .setDescription('Prix de l\'objet')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(9999)
        )
        .addStringOption(option =>
            option
                .setName('payment_type')
                .setDescription('Type de paiement')
                .setRequired(true)
                .addChoices(...PAYMENT_TYPES)
        );
    }

    return command;
}

module.exports = {
    get data() {
        return buildCommand();
    },
    async execute(interaction) {
        try {

            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }

            const merchantName = interaction.options.getString('merchant', true);
            const itemName = interaction.options.getString('item', true).toUpperCase();
            const quantity = interaction.options.getInteger('quantity', true);
            const price = interaction.options.getInteger('price', true);
            const paymentType = interaction.options.getString('payment_type', true).toUpperCase();


            const validPaymentTypes = PAYMENT_TYPES.map(p => p.value);
            if (!validPaymentTypes.includes(paymentType)) {
                throw new Error(`Type de paiement invalide. Types disponibles: ${validPaymentTypes.join(', ')}`);
            }


            const config = loadConfig();
            const basePrices = loadBasePrices();


            if (basePrices[itemName]) {
                throw new Error(`L'objet ${itemName} existe déjà dans base-prices.json`);
            }


            addItemToConfig(config, merchantName, itemName, quantity, paymentType, price);


            addItemToBasePrices(basePrices, itemName, paymentType, price);


            saveConfig(config);
            saveBasePrices(basePrices);

            const translations = loadTranslations();
            const translatedName = translations[itemName] || itemName;


            const embed = new EmbedBuilder()
                .setTitle('✅ Objet ajouté')
                .setDescription(`L'objet **${translatedName}** (\`${itemName}\`) a été ajouté avec succès.`)
                .addFields(
                    { name: 'Marchand', value: merchantName, inline: true },
                    { name: 'Quantité', value: quantity.toString(), inline: true },
                    { name: 'Prix', value: price.toString(), inline: true },
                    { name: 'Type de paiement', value: paymentType, inline: true },
                    { name: 'Config.yml', value: '✅ Ajouté', inline: true },
                    { name: 'Base-prices.json', value: '✅ Ajouté', inline: true }
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

            logger.success(`Market item ${itemName} added by ${interaction.user.tag} to ${merchantName}`);

        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            await handleError(interaction, error, 'market-add');
        }
    }
};