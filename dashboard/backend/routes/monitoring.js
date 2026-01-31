const express = require('express');
const router = express.Router();
const logger = require('../../../src/utils/logger');
const MonitoringService = require('../services/monitoring.service');
const RatingsService = require('../services/ratings.service');
const PatchNotesService = require('../services/patch-notes.service');
const DiscordMessagesService = require('../services/discord-messages.service');
const { isAuthenticated, isAdmin, checkServerAccess } = require('../middleware/auth');
const cacheMiddleware = require('../middleware/cache');


router.get('/giveaways', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const giveaways = await MonitoringService.getActiveGiveaways();
        res.json(giveaways);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch giveaways' });
    }
});


router.get('/tickets', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const tickets = await MonitoringService.getOpenTickets();
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});


router.get('/ratings', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const ratings = await RatingsService.getCategoryRatings();
        res.json(ratings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch category ratings' });
    }
});


router.get('/tickets/:channelId/messages', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const { channelId } = req.params;
        const limit = parseInt(req.query.limit) || 100;

        console.log(`[MONITORING] Fetching messages for channel ${channelId}, limit: ${limit}`);

        const messages = await DiscordMessagesService.getChannelMessages(channelId, limit);
        res.json(messages);
    } catch (error) {
        console.error(`[MONITORING] Error fetching messages for channel ${req.params.channelId}:`, error);

        if (error.message && error.message.includes('not initialized')) {
            return res.status(503).json({ error: 'Discord client not available. Bot must be running.' });
        }

        if (error.message && error.message.includes('not available')) {
            return res.status(503).json({ error: 'Bot API server not available. Ensure bot is running.' });
        }

        if (error.message && error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }

        if (error.message && error.message.includes('Permission denied') || error.message.includes('permission')) {
            return res.status(403).json({ error: error.message });
        }

        res.status(500).json({
            error: error.message || 'Failed to fetch messages',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});



router.get('/market', isAuthenticated, checkServerAccess, (req, res, next) => {

    next();
}, async (req, res) => {
    try {

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        const marketState = await MonitoringService.getMarketState();
        res.json(marketState);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch market state' });
    }
});

router.get('/market/previous', isAuthenticated, checkServerAccess, async (req, res) => {
    try {

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        const previousState = await MonitoringService.getPreviousMarketState();
        if (!previousState) {
            return res.json(null);
        }
        res.json(previousState);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch previous market state' });
    }
});

router.post('/market/rotate', isAuthenticated, checkServerAccess, isAdmin, async (req, res) => {
    try {
        const marketRotationLogic = require('../../../src/utils/market-rotation-logic');
        const result = await marketRotationLogic.performMarketRotation();


        cacheMiddleware.invalidate(/GET:.*\/monitoring\/market/);

        res.json({
            success: true,
            state: result.newState,
            changesCount: result.modifiedCount
        });
    } catch (error) {
        logger.error('[MONITORING] Failed to rotate market:', error);
        res.status(500).json({ error: error.message || 'Failed to rotate market' });
    }
});

router.post('/market/revert', isAuthenticated, checkServerAccess, isAdmin, async (req, res) => {
    try {
        const marketRotationLogic = require('../../../src/utils/market-rotation-logic');
        const revertedState = await marketRotationLogic.revertMarketState();
        res.json({
            success: true,
            state: revertedState
        });
    } catch (error) {
        logger.error('[MONITORING] Failed to revert market:', error);
        res.status(500).json({ error: error.message || 'Failed to revert market state' });
    }
});


router.get('/translations', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const translationsPath = path.join(__dirname, '../../../src/data/item-translations.json');

        if (!fs.existsSync(translationsPath)) {
            return res.json({});
        }

        const fileContents = fs.readFileSync(translationsPath, 'utf8');
        res.json(JSON.parse(fileContents));
    } catch (error) {
        res.json({});
    }
});


router.get('/base-prices', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const basePricesPath = path.join(__dirname, '../../../src/data/base-prices.json');

        if (!fs.existsSync(basePricesPath)) {
            return res.json({});
        }

        const fileContents = fs.readFileSync(basePricesPath, 'utf8');
        res.json(JSON.parse(fileContents));
    } catch (error) {
        res.json({});
    }
});


router.get('/patch-notes', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const notes = await PatchNotesService.getAll();
        res.json(notes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch patch notes' });
    }
});


router.get('/patch-notes/:id', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const note = await PatchNotesService.getById(req.params.id);
        res.json(note);
    } catch (error) {
        res.status(404).json({ error: 'Patch note not found' });
    }
});


router.post('/patch-notes', isAuthenticated, checkServerAccess, isAdmin, async (req, res) => {
    try {
        const { version, content } = req.body;
        if (!version || !content) {
            return res.status(400).json({ error: 'Version and content are required' });
        }
        const note = await PatchNotesService.create({
            version,
            content,
            createdBy: req.session.user.username || 'admin'
        });
        res.status(201).json(note);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create patch note' });
    }
});


router.put('/patch-notes/:id', isAuthenticated, checkServerAccess, isAdmin, async (req, res) => {
    try {
        const { version, content } = req.body;
        if (!version || !content) {
            return res.status(400).json({ error: 'Version and content are required' });
        }
        const note = await PatchNotesService.update(req.params.id, { version, content });
        res.json(note);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update patch note' });
    }
});


router.delete('/patch-notes/:id', isAuthenticated, checkServerAccess, isAdmin, async (req, res) => {
    try {
        await PatchNotesService.delete(req.params.id);
        res.json({ message: 'Patch note deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete patch note' });
    }
});


router.get('/market-config', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, '../../../src/data/config.yml');

        if (!fs.existsSync(configPath)) {
            return res.status(404).json({ error: 'Config file not found' });
        }

        const fileContents = fs.readFileSync(configPath, 'utf8');
        res.json({ content: fileContents });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read config file' });
    }
});


router.put('/market-config', isAuthenticated, checkServerAccess, isAdmin, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, '../../../src/data/config.yml');
        const { content } = req.body;

        if (!content || typeof content !== 'string') {
            return res.status(400).json({ error: 'Content is required and must be a string' });
        }


        fs.writeFileSync(configPath, content, 'utf8');
        res.json({ message: 'Config file updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update config file' });
    }
});


router.get('/market-config/download', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, '../../../src/data/config.yml');

        if (!fs.existsSync(configPath)) {
            return res.status(404).json({ error: 'Config file not found' });
        }

        res.setHeader('Content-Type', 'application/x-yaml');
        res.setHeader('Content-Disposition', 'attachment; filename="config.yml"');

        const fileContents = fs.readFileSync(configPath, 'utf8');
        res.send(fileContents);
    } catch (error) {
        res.status(500).json({ error: 'Failed to download config file' });
    }
});


router.post('/tickets/:channelId/send', isAuthenticated, checkServerAccess, isAdmin, async (req, res) => {
    try {
        const { channelId } = req.params;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Message content is required' });
        }

        const http = require('http');
        const { getBotApiUrl } = require('../utils/bot-api-url');
        let botApiUrl;
        try {
            botApiUrl = getBotApiUrl();
        } catch (error) {
            logger.error('[MONITORING] Failed to get bot API URL:', error);
            return res.status(500).json({ error: 'Bot API URL not configured correctly' });
        }
        const url = `${botApiUrl}/channels/${channelId}/send`;

        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({ content: content.trim() });

            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(url, options, (response) => {
                let data = '';
                response.on('data', (chunk) => { data += chunk; });
                response.on('end', () => {
                    if (response.statusCode === 200 || response.statusCode === 201) {
                        try {
                            resolve(res.json(JSON.parse(data)));
                        } catch {
                            resolve(res.json({ message: 'Message sent successfully' }));
                        }
                    } else {
                        try {
                            const error = JSON.parse(data);
                            reject(res.status(response.statusCode).json({ error: error.error || 'Failed to send message' }));
                        } catch {
                            reject(res.status(response.statusCode).json({ error: 'Failed to send message' }));
                        }
                    }
                });
            });

            req.on('error', (error) => {
                if (error.code === 'ECONNREFUSED') {
                    reject(res.status(503).json({ error: 'Bot API server not available. Ensure bot is running.' }));
                } else {
                    reject(res.status(500).json({ error: 'Failed to send message' }));
                }
            });

            req.setTimeout(10000, () => {
                req.destroy();
                reject(res.status(504).json({ error: 'Request timeout' }));
            });

            req.write(postData);
            req.end();
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;