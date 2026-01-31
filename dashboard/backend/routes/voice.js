const express = require('express');
const router = express.Router();
const axios = require('axios');
const { isAuthenticated, checkServerAccess } = require('../middleware/auth');
const logger = require('../../../src/utils/logger');
const { getBotApiUrl } = require('../utils/bot-api-url');


router.get('/channels', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const guildId = require('../config/oauth').guildId;
        if (!guildId) {
            return res.status(500).json({ error: 'Server not configured' });
        }

        const botApiUrl = getBotApiUrl();
        const response = await axios.get(`${botApiUrl}/guilds/${guildId}/voice-channels`, {
            timeout: 5000
        });

        res.json(response.data);
    } catch (error) {
        logger.error('Failed to get voice channels:', error);
        res.status(500).json({ error: 'Failed to get voice channels', details: error.message });
    }
});


router.get('/sounds', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const botApiUrl = getBotApiUrl();
        const response = await axios.get(`${botApiUrl}/soundboard/sounds`, {
            timeout: 5000
        });

        res.json(response.data);
    } catch (error) {
        logger.error('Failed to get sounds:', error);
        res.status(500).json({ error: 'Failed to get sounds', details: error.message });
    }
});


router.post('/play', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const { channelId, soundName, times } = req.body;
        const guildId = require('../config/oauth').guildId;

        if (!channelId || !soundName) {
            return res.status(400).json({ error: 'Missing required parameters: channelId, soundName' });
        }

        const botApiUrl = getBotApiUrl();
        const response = await axios.post(`${botApiUrl}/soundboard/play`, {
            guildId,
            channelId,
            soundName,
            times: times || 1
        }, {
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error('Failed to play sound:', error);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || error.message;
        res.status(status).json({ error: 'Failed to play sound', details: message });
    }
});


router.post('/recording/start', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const { channelId, soundName } = req.body;
        const guildId = require('../config/oauth').guildId;

        if (!channelId) {
            return res.status(400).json({ error: 'Missing required parameter: channelId' });
        }

        const botApiUrl = getBotApiUrl();
        const response = await axios.post(`${botApiUrl}/recording/start`, {
            guildId,
            channelId,
            soundName
        }, {
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error('Failed to start recording:', error);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || error.message;
        res.status(status).json({ error: 'Failed to start recording', details: message });
    }
});


router.post('/recording/stop', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const guildId = require('../config/oauth').guildId;
        const botApiUrl = getBotApiUrl();
        const response = await axios.post(`${botApiUrl}/recording/stop`, {
            guildId
        }, {
            timeout: 30000
        });

        res.json(response.data);
    } catch (error) {
        logger.error('Failed to stop recording:', error);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || error.message;
        res.status(status).json({ error: 'Failed to stop recording', details: message });
    }
});


router.get('/recording/status', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const guildId = require('../config/oauth').guildId;
        const botApiUrl = getBotApiUrl();
        const response = await axios.get(`${botApiUrl}/recording/status/${guildId}`, {
            timeout: 5000
        });

        res.json(response.data);
    } catch (error) {
        logger.error('Failed to get recording status:', error);
        res.status(500).json({ error: 'Failed to get recording status', details: error.message });
    }
});


router.post('/live-audio/start', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const { channelId } = req.body;
        const guildId = require('../config/oauth').guildId;

        if (!channelId) {
            return res.status(400).json({ error: 'Missing required parameter: channelId' });
        }

        const botApiUrl = getBotApiUrl();
        const response = await axios.post(`${botApiUrl}/live-audio/start`, {
            guildId,
            channelId
        }, {
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error('Failed to start live audio:', error);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || error.message;
        res.status(status).json({ error: 'Failed to start live audio', details: message });
    }
});


router.post('/live-audio/stop', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const guildId = require('../config/oauth').guildId;
        const botApiUrl = getBotApiUrl();
        const response = await axios.post(`${botApiUrl}/live-audio/stop`, {
            guildId
        }, {
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error('Failed to stop live audio:', error);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || error.message;
        res.status(status).json({ error: 'Failed to stop live audio', details: message });
    }
});


router.get('/live-audio/status', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const guildId = require('../config/oauth').guildId;
        const botApiUrl = getBotApiUrl();
        const response = await axios.get(`${botApiUrl}/live-audio/status/${guildId}`, {
            timeout: 5000
        });

        res.json(response.data);
    } catch (error) {
        logger.error('Failed to get live audio status:', error);
        res.status(500).json({ error: 'Failed to get live audio status', details: error.message });
    }
});


router.get('/live-audio/stream', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const guildId = require('../config/oauth').guildId;
        const botApiUrl = getBotApiUrl();


        const response = await axios.get(`${botApiUrl}/live-audio/stream/${guildId}`, {
            responseType: 'stream',
            timeout: 0
        });


        res.setHeader('Content-Type', 'audio/pcm');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');


        response.data.pipe(res);


        req.on('close', () => {
            try {
                response.data.destroy();
            } catch (error) {

            }
        });
    } catch (error) {
        logger.error('Failed to get live audio stream:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to get live audio stream', details: error.message });
        }
    }
});

module.exports = router;