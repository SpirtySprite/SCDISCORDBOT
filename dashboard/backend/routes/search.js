const express = require('express');
const router = express.Router();
const SearchService = require('../services/search.service');
const { isAuthenticated, checkServerAccess } = require('../middleware/auth');

router.get('/', isAuthenticated, checkServerAccess, (req, res) => {
    try {
        const query = req.query.q;
        const results = SearchService.search(query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;