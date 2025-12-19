const express = require('express');
const router = express.Router();
const verifyToken = require('../auth_middleware');
const Space = require('../models/Space');
const { generateJoinCode } = require('../utils/helpers');

// Create a new space
router.post('/create', verifyToken, async (req, res) => {
    const { name, description } = req.body;

    try {
        const newSpace = new Space({
            name,
            description,
            joinCode: generateJoinCode(),
            owner: req.user._id,
            members: [req.user._id],
            admins: [] // Owner has all permissions by default
        });

        await newSpace.save();

        console.log(`Space Created: ${name} (Code: ${newSpace.joinCode})`);

        res.json({ status: 'success', space: newSpace });
    } catch (error) {
        console.error("Create Space Error:", error);
        res.status(500).json({ status: 'error', message: 'Could not create space' });
    }
});

// Get User's Spaces
router.get('/my-spaces', verifyToken, async (req, res) => {
    try {
        const spaces = await Space.find({ members: req.user._id })
            .sort({ createdAt: -1 })
            .populate('owner', 'name email')
            .populate('admins', 'name email');

        res.json({ status: 'success', spaces });
    } catch (error) {
        console.error("Fetch Spaces Error:", error);
        res.status(500).json({ status: 'error', message: 'Could not fetch spaces' });
    }
});

// Join space with code
router.post('/join', verifyToken, async (req, res) => {
    const { joinCode } = req.body;

    try {
        const space = await Space.findOne({ joinCode });

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Invalid join code' });
        }

        // Check if already a member
        if (space.members.includes(req.user._id)) {
            return res.status(400).json({ status: 'error', message: 'Already a member of this space' });
        }

        // Add user to members
        space.members.push(req.user._id);
        await space.save();

        res.json({ status: 'success', space, message: 'Successfully joined space' });
    } catch (error) {
        console.error("Join Space Error:", error);
        res.status(500).json({ status: 'error', message: 'Could not join space' });
    }
});

// Make user admin (owner or existing admin only)
router.post('/:spaceId/make-admin', verifyToken, async (req, res) => {
    const { userId } = req.body;
    const { spaceId } = req.params;

    try {
        const space = await Space.findById(spaceId);

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        // Check if requester is owner or admin
        const isOwner = space.owner.toString() === req.user._id.toString();
        const isAdmin = space.admins.some(admin => admin.toString() === req.user._id.toString());

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ status: 'error', message: 'Permission denied' });
        }

        // Check if target user is a member
        if (!space.members.some(member => member.toString() === userId)) {
            return res.status(400).json({ status: 'error', message: 'User is not a member of this space' });
        }

        // Check if already admin
        if (space.admins.some(admin => admin.toString() === userId)) {
            return res.status(400).json({ status: 'error', message: 'User is already an admin' });
        }

        // Add to admins
        space.admins.push(userId);
        await space.save();

        res.json({ status: 'success', message: 'User promoted to admin', space });
    } catch (error) {
        console.error("Make Admin Error:", error);
        res.status(500).json({ status: 'error', message: 'Could not make user admin' });
    }
});

// Remove admin (owner only)
router.post('/:spaceId/remove-admin', verifyToken, async (req, res) => {
    const { userId } = req.body;
    const { spaceId } = req.params;

    try {
        const space = await Space.findById(spaceId);

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        // Only owner can remove admins
        if (space.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ status: 'error', message: 'Only owner can remove admins' });
        }

        // Remove from admins
        space.admins = space.admins.filter(admin => admin.toString() !== userId);
        await space.save();

        res.json({ status: 'success', message: 'Admin removed', space });
    } catch (error) {
        console.error("Remove Admin Error:", error);
        res.status(500).json({ status: 'error', message: 'Could not remove admin' });
    }
});

// Delete space (owner only)
router.delete('/:spaceId', verifyToken, async (req, res) => {
    const { spaceId } = req.params;

    try {
        const space = await Space.findById(spaceId);

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        // Only owner can delete
        if (space.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ status: 'error', message: 'Only owner can delete space' });
        }

        await Space.findByIdAndDelete(spaceId);

        res.json({ status: 'success', message: 'Space deleted successfully' });
    } catch (error) {
        console.error("Delete Space Error:", error);
        res.status(500).json({ status: 'error', message: 'Could not delete space' });
    }
});

// Leave space
router.post('/:spaceId/leave', verifyToken, async (req, res) => {
    const { spaceId } = req.params;

    try {
        const space = await Space.findById(spaceId);

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        // Owner cannot leave
        if (space.owner.toString() === req.user._id.toString()) {
            return res.status(400).json({ status: 'error', message: 'Owner cannot leave space. Delete it instead.' });
        }

        // Remove from members and admins
        space.members = space.members.filter(member => member.toString() !== req.user._id.toString());
        space.admins = space.admins.filter(admin => admin.toString() !== req.user._id.toString());
        await space.save();

        res.json({ status: 'success', message: 'Left space successfully' });
    } catch (error) {
        console.error("Leave Space Error:", error);
        res.status(500).json({ status: 'error', message: 'Could not leave space' });
    }
});

module.exports = router;
