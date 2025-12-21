const express = require('express');
const router = express.Router();
const verifyToken = require('../auth_middleware');
const Subject = require('../models/Subject');
const Space = require('../models/Space');
const Material = require('../models/Material');

// Helper function to check if user can edit
const canUserEdit = (space, userId) => {
    const userIdStr = userId.toString();
    const isOwner = space.owner.toString() === userIdStr;
    const isAdmin = space.admins.some(admin => admin.toString() === userIdStr);
    const isEditor = space.editors && space.editors.some(editor => editor.toString() === userIdStr);
    return isOwner || isAdmin || isEditor;
};

// Create a Subject
router.post('/create', verifyToken, async (req, res) => {
    const { spaceId, name } = req.body;
    try {
        // Check if user has edit permission
        const space = await Space.findById(spaceId);
        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        if (!canUserEdit(space, req.user._id)) {
            return res.status(403).json({ status: 'error', message: 'You do not have permission to create subjects in this space' });
        }

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

// Update Subject name (owner/admin/editor only)
router.put('/:subjectId', verifyToken, async (req, res) => {
    const { subjectId } = req.params;
    const { name } = req.body;

    try {
        const subject = await Subject.findById(subjectId);
        if (!subject) {
            return res.status(404).json({ status: 'error', message: 'Subject not found' });
        }

        const space = await Space.findById(subject.spaceId);
        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        if (!canUserEdit(space, req.user._id)) {
            return res.status(403).json({ status: 'error', message: 'You do not have permission to update this subject' });
        }

        subject.name = name;
        await subject.save();

        res.json({ status: 'success', subject, message: 'Subject renamed successfully' });
    } catch (error) {
        console.error("Update Subject Error:", error);
        res.status(500).json({ status: 'error', message: 'Failed to update subject' });
    }
});

// Delete a Subject (owner/admin/editor only)
router.delete('/:subjectId', verifyToken, async (req, res) => {
    const { subjectId } = req.params;

    try {
        const subject = await Subject.findById(subjectId);
        if (!subject) {
            return res.status(404).json({ status: 'error', message: 'Subject not found' });
        }

        const space = await Space.findById(subject.spaceId);
        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        if (!canUserEdit(space, req.user._id)) {
            return res.status(403).json({ status: 'error', message: 'You do not have permission to delete this subject' });
        }

        // Delete all materials in this subject
        await Material.deleteMany({ subjectId: subjectId });
        
        // Delete the subject
        await Subject.findByIdAndDelete(subjectId);

        res.json({ status: 'success', message: 'Subject and its materials deleted successfully' });
    } catch (error) {
        console.error("Delete Subject Error:", error);
        res.status(500).json({ status: 'error', message: 'Failed to delete subject' });
    }
});

module.exports = router;
