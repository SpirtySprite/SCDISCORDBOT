const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { setServerFooter } = require('../../utils/embed-helper');

const MINECRAFT_ITEMS_PATH = path.join(__dirname, '../../data/minecraft-items.json');
const CUSTOM_ITEMS_PATH = path.join(__dirname, '../../data/custom-items.json');
const TRANSLATIONS_PATH = path.join(__dirname, '../../data/item-translations.json');


function loadMinecraftItems() {
    try {
        if (!fs.existsSync(MINECRAFT_ITEMS_PATH)) {
            logger.warn('minecraft-items.json not found, using empty list');
            return [];
        }
        const fileContents = fs.readFileSync(MINECRAFT_ITEMS_PATH, 'utf8');
        const data = JSON.parse(fileContents);
        return data.items || [];
    } catch (error) {
        logger.error('Failed to load minecraft-items.json', error);
        return [];
    }
}


function loadCustomItems() {
    try {
        if (!fs.existsSync(CUSTOM_ITEMS_PATH)) {
            return [];
        }
        const fileContents = fs.readFileSync(CUSTOM_ITEMS_PATH, 'utf8');
        const data = JSON.parse(fileContents);
        return data.custom_items || [];
    } catch (error) {
        logger.error('Failed to load custom-items.json', error);
        return [];
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


function saveCustomItems(customItems) {
    try {
        const data = { custom_items: customItems };
        fs.writeFileSync(CUSTOM_ITEMS_PATH, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        logger.error('Failed to save custom-items.json', error);
        throw error;
    }
}


function getAllItems() {
    const minecraftItems = loadMinecraftItems();
    const customItems = loadCustomItems();
    const translations = loadTranslations();


    const allItems = [];


    minecraftItems.forEach(item => {
        allItems.push({
            id: item.id,
            name_en: item.name_en,
            name_fr: item.name_fr || translations[item.id] || item.name_en,
            image: item.image || null
        });
    });


    customItems.forEach(item => {
        allItems.push({
            id: item.id,
            name_en: item.name_en || item.id,
            name_fr: item.name_fr || item.name_en || item.id,
            isCustom: true,
            image: item.image || null
        });
    });

    return allItems;
}

function getItemImageUrl(item) {

    if (item.image && item.image.trim() !== '') {
        return item.image;
    }





    const itemIdLower = item.id.toLowerCase();
    const minecraftVersion = '1.20.4';


    return `https://assets.mcasset.cloud/${minecraftVersion}/assets/minecraft/textures/item/${itemIdLower}.png`;




}


function buildCommand() {
    const command = new SlashCommandBuilder()
        .setName('vente')
        .setDescription('Créer une annonce de vente')
        .addStringOption(option =>
            option
                .setName('item')
                .setDescription('L\'objet à vendre')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option
                .setName('quantité')
                .setDescription('Quantité')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(9999)
        )
        .addIntegerOption(option =>
            option
                .setName('prix')
                .setDescription('(prix en serens)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(999999)
        );

    return command;
}

module.exports = {
    get data() {
        return buildCommand();
    },
    async execute(interaction) {
        try {
            const itemId = interaction.options.getString('item', true);
            const quantity = interaction.options.getInteger('quantité', true);
            const price = interaction.options.getInteger('prix', true);


            const allItems = getAllItems();
            const item = allItems.find(i => i.id === itemId);

            if (!item) {
                throw new Error('Objet introuvable');
            }

            const itemName = item.name_fr || item.name_en || itemId;


            const itemImageUrl = getItemImageUrl(item);

            const embed = new EmbedBuilder()
                .setTitle('💼 Annonce de vente')
                .setDescription(`**${itemName}**`)
                .addFields(
                    { name: 'Quantité', value: quantity.toString(), inline: true },
                    { name: 'Prix', value: `${price} serens`, inline: true },
                    { name: 'Prix unitaire', value: `${Math.round(price / quantity)} serens`, inline: true },
                    { name: 'Vendeur', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setColor(0x57F287)
                .setTimestamp()
                .setFooter({ text: `Vendu par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });


            if (itemImageUrl) {
                logger.debug(`Setting thumbnail for ${itemId}: ${itemImageUrl}`);
                embed.setThumbnail(itemImageUrl);
            } else {
                logger.debug(`No image URL found for ${itemId}, skipping thumbnail`);
            }

            setServerFooter(embed, interaction.guild);


            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    embeds: [embed],
                    content: null
                });
            } else {
                await interaction.reply({
                    embeds: [embed]
                });
            }

            logger.success(`Vente created by ${interaction.user.tag}: ${itemName} x${quantity} for ${price} serens`);

        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            await handleError(interaction, error, 'vente');
        }
    },
    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused();
            const allItems = getAllItems();
            const searchTerm = focusedValue.toLowerCase();


            const filtered = allItems
                .filter(item => {
                    const nameEn = (item.name_en || '').toLowerCase();
                    const nameFr = (item.name_fr || '').toLowerCase();
                    const itemId = (item.id || '').toLowerCase();

                    return nameEn.includes(searchTerm) ||
                           nameFr.includes(searchTerm) ||
                           itemId.includes(searchTerm);
                })
                .slice(0, 25)
                .map(item => {
                    const displayName = item.name_fr ?
                        `${item.name_fr} (${item.name_en || item.id})` :
                        (item.name_en || item.id);
                    const label = item.isCustom ? `[Custom] ${displayName}` : displayName;

                    return {
                        name: label.substring(0, 100),
                        value: item.id
                    };
                });

            await interaction.respond(filtered);
        } catch (error) {
            logger.error('Error in vente autocomplete', error);
            await interaction.respond([]);
        }
    }
};