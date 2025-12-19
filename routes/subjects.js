const express = require('express');
const router = express.Router();
const verifyToken = require('../auth_middleware');
const Subject = require('../models/Subject');

// Create a Subject
router.post('/create', verifyToken, async (req, res) => {
    const { spaceId, name } = req.body;
    try {
        const newSubject = new Subject({ spaceId, name });
        await newSubject.save();
        res.json({ status: 'success', subject: newSubject });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to create subject' });
    }
});

// Get Subjects for a specific Space
router.get('/:spaceId', verifyToken, async (req, res) => {
    try {
        const subjects = await Subject.find({ spaceId: req.params.spaceId });
        res.json({ status: 'success', subjects });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch subjects' });
    }
});

module.exports = router;
