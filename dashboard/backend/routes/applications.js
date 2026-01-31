const express = require('express');
const router = express.Router();
const ApplicationRepository = require('../../../src/database/repositories/application.repository');
const { isAuthenticated, isAdmin, checkServerAccess, getCurrentGuild, requireGuild } = require('../middleware/auth');
const logger = require('../../../src/utils/logger');
const config = require('../../../src/config');


const QUESTIONS = {
    S1: [
        { id: 's1_q1', text: 'Revenir sur tes défauts et qualités.' },
        { id: 's1_q2', text: 'Si tu devais travailler seul ou en équipe, serais-tu capable de gérer les deux cas ?' },
        { id: 's1_q3', text: 'Pour revenir à ton expérience en modération, quel poste occupais-tu concrètement ?' },
        { id: 's1_q4', text: 'Connais-tu le fonctionnement des tickets Discord ?' },
        { id: 's1_q5', text: 'Comment gères-tu une situation où tu ne connais pas la réponse ?' },
        { id: 's1_q6', text: 'Un joueur te demande si une sanction pour \'provocation légère\' doit être un warn ou un mute, mais tu ne connais pas encore cette partie du règlement. Comment réagis-tu ?' }
    ],
    S2: [
        { id: 's2_q1', text: 'Tu vois une personne sur Discord avec une PP inappropriée : que fais-tu ?' },
        { id: 's2_q2', text: 'Un joueur vient se plaindre qu\'une autre personne l\'a insulté en MP : que fais-tu ?' },
        { id: 's2_q3', text: 'Un joueur viens se plaindre que TU as fait un abus de permissions : que fais-tu ?' },
        { id: 's2_q4', text: 'Après avoir discuté avec le joueur, il estime toujours que ce que tu as fait est un abus de perm : que fais-tu ?' },
        { id: 's2_q5', text: 'Un joueur vient spam dans le chat : que fais-tu ?' },
        { id: 's2_q6', text: 'Un joueur vient menacer de DDoS le serveur : que fais-tu ?' },
        { id: 's2_q7', text: 'Une personne vient te reporter un joueur pour menace grave : que fais-tu ?' },
        { id: 's2_q8', text: 'Une personne vient te dire qu\'un staff a abusé de perms : que fais-tu ?' },
        { id: 's2_q9', text: 'Tu surprends un ami à toi enfreindre le règlement : que fais-tu ?' }
    ],
    S3: [
        { id: 's3_q1', text: 'Pourquoi veux-tu rejoindre notre équipe ?' },
        { id: 's3_q2', text: 'Quels sont tes points forts et tes points faibles ?' },
        { id: 's3_q3', text: 'Quel serait ton niveau de disponibilité par semaine ?' },
        { id: 's3_q4', text: 'Où te vois-tu dans l\'équipe dans 3 à 6 mois ?' },
        { id: 's3_q5', text: 'Es-tu à l\'aise avec les logs, preuves (screens, vidéos, IDs) ?' }
    ]
};


router.get('/questions', isAuthenticated, checkServerAccess, (req, res) => {
    res.json(QUESTIONS);
});


router.get('/', isAuthenticated, checkServerAccess, requireGuild, async (req, res) => {
    try {
        const guildId = getCurrentGuild(req);
        if (!guildId) {
            return res.status(400).json({ error: 'Guild ID is required' });
        }
        const status = req.query.status || null;
        const applications = await ApplicationRepository.findAll(guildId, status);
        res.json(applications);
    } catch (error) {
        logger.error('Failed to fetch applications', error);
        res.status(500).json({ error: 'Failed to fetch applications', details: error.message });
    }
});


router.get('/:id', isAuthenticated, checkServerAccess, async (req, res) => {
    try {
        const application = await ApplicationRepository.findById(req.params.id);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.json(application);
    } catch (error) {
        logger.error('Failed to fetch application', error);
        res.status(500).json({ error: 'Failed to fetch application' });
    }
});


router.post('/', isAuthenticated, checkServerAccess, requireGuild, isAdmin, async (req, res) => {
    try {
        const { userId, userTag, userAvatar, answers } = req.body;

        if (!userId || !userTag || !answers) {
            return res.status(400).json({ error: 'userId, userTag, and answers are required' });
        }

        const guildId = getCurrentGuild(req);
        if (!guildId) {
            return res.status(400).json({ error: 'Guild ID is required' });
        }
        const createdBy = req.session.user?.username || req.session.user?.tag || 'admin';

        const id = await ApplicationRepository.create({
            userId,
            userTag,
            userAvatar,
            guildId,
            answers,
            createdBy
        });

        const application = await ApplicationRepository.findById(id);
        res.status(201).json(application);
    } catch (error) {
        logger.error('Failed to create application', error);
        res.status(500).json({ error: 'Failed to create application' });
    }
});


router.patch('/:id', isAuthenticated, checkServerAccess, isAdmin, async (req, res) => {
    try {
        const { answers, status, notes } = req.body;
        const updateData = {};

        if (answers !== undefined) updateData.answers = answers;
        if (status !== undefined) {
            updateData.status = status;
            if (status !== 'pending') {
                updateData.reviewedBy = req.session.user?.username || req.session.user?.tag || 'admin';
                updateData.reviewedAt = new Date();
            }
        }
        if (notes !== undefined) updateData.notes = notes;

        const application = await ApplicationRepository.update(req.params.id, updateData);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.json(application);
    } catch (error) {
        logger.error('Failed to update application', error);
        res.status(500).json({ error: 'Failed to update application' });
    }
});


router.delete('/:id', isAuthenticated, checkServerAccess, isAdmin, async (req, res) => {
    try {
        const deleted = await ApplicationRepository.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.json({ message: 'Application deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete application', error);
        res.status(500).json({ error: 'Failed to delete application' });
    }
});

module.exports = router;