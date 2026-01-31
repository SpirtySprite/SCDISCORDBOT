const express = require('express');
const router = express.Router();
const transcriptService = require('../services/transcript.service');
const { isAuthenticated } = require('../middleware/auth');


router.get('/:id', async (req, res) => {
    try {
        const transcript = await transcriptService.getTranscript(req.params.id);
        if (!transcript) {
            return res.status(404).json({ error: 'Transcript not found' });
        }
        res.json(transcript);
    } catch (error) {
        console.error('Error fetching transcript:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post('/', async (req, res) => {
    try {
        const ticketId = await transcriptService.createTranscript(req.body);
        res.json({ success: true, ticketId });
    } catch (error) {
        console.error('Error creating transcript:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;