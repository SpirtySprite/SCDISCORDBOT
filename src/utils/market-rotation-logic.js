const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const crypto = require('crypto');
const logger = require('./logger');
const marketStateManager = require('./market-state-manager');

const CONFIG_PATH = path.join(__dirname, '../data/config.yml');
const BASE_PRICES_PATH = path.join(__dirname, '../data/base-prices.json');
const DYNAMIC_MARKET_NAME = "§eMarché Dynamique";

const readJson = (p) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
const readYaml = (p) => fs.existsSync(p) ? yaml.load(fs.readFileSync(p, 'utf8')) : {};

async function performMarketRotation() {
    logger.info('Starting simplified market rotation...');

    const config = readYaml(CONFIG_PATH);
    const basePrices = readJson(BASE_PRICES_PATH);
    const state = marketStateManager.loadState();

    if (!config.pnjs) throw new Error('No PNJs found in config.yml');

    const allItems = new Set();
    const IGNORED_PNJS = [DYNAMIC_MARKET_NAME, "§eL’Arboriste"];

    Object.entries(config.pnjs).forEach(([name, data]) => {
        if (IGNORED_PNJS.includes(name) || !Array.isArray(data.trades)) return;
        data.trades.forEach(t => {
            const item = Object.keys(t || {})[0];
            if (item) allItems.add(item);
        });
    });

    const currentBuffedNames = new Set(state.buffed.map(b => typeof b === 'object' ? b.item : b));
    const eligible = [...allItems].filter(i =>
        !currentBuffedNames.has(i) &&
        i !== 'GOLDEN_APPLE' && i !== 'ENCHANTED_GOLDEN_APPLE' &&
        i !== 'ENDER_PEARL' && i !== 'CAKE' &&
        basePrices[i]
    );

    if (eligible.length < 8) logger.warn(`Only ${eligible.length} eligible items found.`);

    const newBuffedTrades = [];
    while (newBuffedTrades.length < 8 && eligible.length > 0) {
        const idx = crypto.randomInt(0, eligible.length);
        const item = eligible[idx];
        eligible.splice(idx, 1);

        const base = basePrices[item];
        let quantity = base.quantity || 1;

        let targetValue = base.basePrice * 1.3;
        let price = Math.round(targetValue);


        if (price === base.basePrice && base.basePrice <= 2) {
            const doubleQuantity = quantity * 2;
            if (doubleQuantity > 64) {
                logger.info(`Skipping ${item} because buffed quantity ${doubleQuantity} > 64`);
                continue;
            }
            quantity = doubleQuantity;
            price = 3;
        } else if (price < 5) {

            quantity = Math.max(quantity, 16);
            price = Math.round((base.basePrice / (base.quantity || 1)) * quantity * 1.3);
        }

        price = Math.max(1, price);

        newBuffedTrades.push({
            item,
            quantity,
            price,
            type: base.paymentType || 'GOLD_NUGGET'
        });
    }

    updateConfigTrades(config, newBuffedTrades);

    const newState = {
        lastUpdated: new Date().toISOString().split('T')[0],
        buffed: newBuffedTrades,
        nerfed: [],
        reset: state.buffed
    };

    marketStateManager.saveState(newState);
    logger.success('Rotation complete.');

    return { newState, modifiedCount: newBuffedTrades.length };
}

function updateConfigTrades(configObj, trades) {
    let content = fs.readFileSync(CONFIG_PATH, 'utf8');

    const startMarker = `"${DYNAMIC_MARKET_NAME}":`;
    const startIdx = content.indexOf(startMarker);
    if (startIdx === -1) throw new Error(`Market section ${startMarker} not found.`);

    const tradeMarker = 'trades:';
    const tradeIdx = content.indexOf(tradeMarker, startIdx);
    if (tradeIdx === -1) throw new Error('trades: section not found.');

    const insertionPoint = content.indexOf('\n', tradeIdx) + 1;

    const indent = '      ';
    const itemIndent = '          ';
    const priceIndent = '              ';

    let newBlock = '';
    trades.forEach(t => {
        newBlock += `${indent}- ${t.item}:\n`;
        newBlock += `${itemIndent}- ${t.quantity}\n`;
        newBlock += `${itemIndent}- ${t.type}:\n`;
        newBlock += `${priceIndent}${t.price}\n`;
    });

    let endIdx = content.length;
    const lines = content.substring(insertionPoint).split('\n');
    let currentOffset = 0;

    for (const line of lines) {
        if (line.trim() && !line.startsWith(indent) && !line.startsWith('        ')) {
            endIdx = insertionPoint + currentOffset;
            break;
        }
        currentOffset += line.length + 1;
    }

    const newContent = content.substring(0, insertionPoint) + newBlock + content.substring(endIdx);
    fs.writeFileSync(CONFIG_PATH, newContent, 'utf8');
}

module.exports = { performMarketRotation };