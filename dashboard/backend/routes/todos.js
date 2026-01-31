const express = require('express');
const router = express.Router();
const TodoRepository = require('../../../src/database/repositories/todo.repository');
const { isAuthenticated, isAdmin, checkServerAccess } = require('../middleware/auth');


router.get('/', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const todos = await TodoRepository.findAll();
        res.json(todos);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch todos' });
    }
});


router.post('/', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const { title, description, category, color } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        const id = await TodoRepository.create({
            title,
            description,
            category,
            color,
            createdBy: req.session.user.username || 'admin'
        });
        const todo = await TodoRepository.findById(id);
        res.status(201).json(todo);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create todo' });
    }
});


router.patch('/:id/toggle', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const todo = await TodoRepository.toggleStatus(req.params.id);
        if (!todo) {
            return res.status(404).json({ error: 'Todo not found' });
        }
        res.json(todo);
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle status' });
    }
});


router.put('/:id', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const { title, description, category, color, status } = req.body;
        const todo = await TodoRepository.update(req.params.id, {
            title, description, category, color, status
        });
        if (!todo) {
            return res.status(404).json({ error: 'Todo not found' });
        }
        res.json(todo);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update todo' });
    }
});


router.delete('/:id', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        await TodoRepository.delete(req.params.id);
        res.json({ message: 'Todo deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete todo' });
    }
});

module.exports = router;