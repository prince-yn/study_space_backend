const express = require('express');
const router = express.Router();
const verifyToken = require('../auth_middleware');
const Space = require('../models/Space');
const { generateJoinCode } = require('../utils/helpers');


router.post('/create', verifyToken, async (req, res) => {
    const { name, description } = req.body;

    try {
        const newSpace = new Space({
            name,
            description,
            joinCode: generateJoinCode(),
            owner: req.user._id,
            members: [req.user._id],
            admins: [] 
        });

        await newSpace.save();

        res.json({ status: 'success', space: newSpace });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Could not create space' });
    }
});


router.get('/my-spaces', verifyToken, async (req, res) => {
    try {
        const spaces = await Space.find({ members: req.user._id })
            .sort({ createdAt: -1 })
            .populate('owner', 'name email')
            .populate('admins', 'name email');

        res.json({ status: 'success', spaces });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Could not fetch spaces' });
    }
});


router.put('/:spaceId', verifyToken, async (req, res) => {
    const { spaceId } = req.params;
    const { name, description } = req.body;

    try {
        const space = await Space.findById(spaceId);

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        
        if (space.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ status: 'error', message: 'Only owner can update space details' });
        }

        if (name) space.name = name;
        if (description !== undefined) space.description = description;
        
        await space.save();

        res.json({ status: 'success', space, message: 'Space updated successfully' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Could not update space' });
    }
});


router.post('/join', verifyToken, async (req, res) => {
    const { joinCode } = req.body;

    try {
        const space = await Space.findOne({ joinCode });

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Invalid join code' });
        }

        
        if (space.members.includes(req.user._id)) {
            return res.status(400).json({ status: 'error', message: 'Already a member of this space' });
        }

        
        space.members.push(req.user._id);
        await space.save();

        res.json({ status: 'success', space, message: 'Successfully joined space' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Could not join space' });
    }
});


router.post('/:spaceId/make-admin', verifyToken, async (req, res) => {
    const { userId, memberId } = req.body;
    const targetUserId = userId || memberId; 
    const { spaceId } = req.params;

    try {
        const space = await Space.findById(spaceId);

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        
        const isOwner = space.owner.toString() === req.user._id.toString();
        const isAdmin = space.admins.some(admin => admin.toString() === req.user._id.toString());

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ status: 'error', message: 'Permission denied' });
        }

        
        if (!space.members.some(member => member.toString() === targetUserId)) {
            return res.status(400).json({ status: 'error', message: 'User is not a member of this space' });
        }

        
        if (space.admins.some(admin => admin.toString() === targetUserId)) {
            return res.status(400).json({ status: 'error', message: 'User is already an admin' });
        }

        
        space.admins.push(targetUserId);
        await space.save();

        res.json({ status: 'success', message: 'User promoted to admin', space });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Could not make user admin' });
    }
});


router.post('/:spaceId/remove-admin', verifyToken, async (req, res) => {
    const { userId, adminId } = req.body;
    const targetUserId = userId || adminId; 
    const { spaceId } = req.params;

    try {
        const space = await Space.findById(spaceId);

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        
        if (space.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ status: 'error', message: 'Only owner can remove admins' });
        }

        
        space.admins = space.admins.filter(admin => admin.toString() !== targetUserId);
        await space.save();

        res.json({ status: 'success', message: 'Admin removed', space });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Could not remove admin' });
    }
});


router.delete('/:spaceId', verifyToken, async (req, res) => {
    const { spaceId } = req.params;

    try {
        const space = await Space.findById(spaceId);

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        
        if (space.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ status: 'error', message: 'Only owner can delete space' });
        }

        
        const Material = require('../models/Material');
        await Material.deleteMany({ spaceId: spaceId });

        
        const Subject = require('../models/Subject');
        await Subject.deleteMany({ spaceId: spaceId });

        
        await Space.findByIdAndDelete(spaceId);

        res.json({ status: 'success', message: 'Space deleted successfully' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Could not delete space' });
    }
});


router.post('/:spaceId/leave', verifyToken, async (req, res) => {
    const { spaceId } = req.params;

    try {
        const space = await Space.findById(spaceId);

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        
        if (space.owner.toString() === req.user._id.toString()) {
            return res.status(400).json({ status: 'error', message: 'Owner cannot leave space. Delete it instead.' });
        }

        
        space.members = space.members.filter(member => member.toString() !== req.user._id.toString());
        space.admins = space.admins.filter(admin => admin.toString() !== req.user._id.toString());
        space.editors = space.editors.filter(editor => editor.toString() !== req.user._id.toString());
        await space.save();

        res.json({ status: 'success', message: 'Left space successfully' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Could not leave space' });
    }
});


router.get('/:spaceId/members', verifyToken, async (req, res) => {
    const { spaceId } = req.params;

    try {
        const space = await Space.findById(spaceId)
            .populate('members', 'name email picture uid')
            .populate('owner', 'name email picture uid')
            .populate('admins', 'name email picture uid')
            .populate('editors', 'name email picture uid');

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        
        if (!space.members.some(member => member._id.toString() === req.user._id.toString())) {
            return res.status(403).json({ status: 'error', message: 'Not a member of this space' });
        }

        
        const membersWithRoles = space.members.map(member => {
            const isOwner = space.owner._id.toString() === member._id.toString();
            const isAdmin = space.admins.some(admin => admin._id.toString() === member._id.toString());
            const isEditor = space.editors.some(editor => editor._id.toString() === member._id.toString());
            
            return {
                _id: member._id,
                name: member.name,
                email: member.email,
                picture: member.picture,
                uid: member.uid,
                isOwner,
                isAdmin,
                isEditor,
                canEdit: isOwner || isAdmin || isEditor 
            };
        });

        res.json({ 
            status: 'success', 
            members: membersWithRoles,
            currentUserIsOwner: space.owner._id.toString() === req.user._id.toString()
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Could not fetch members' });
    }
});


router.post('/:spaceId/toggle-editor', verifyToken, async (req, res) => {
    const { userId } = req.body;
    const { spaceId } = req.params;

    try {
        const space = await Space.findById(spaceId);

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        
        if (space.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ status: 'error', message: 'Only owner can manage editor permissions' });
        }

        
        if (userId === space.owner.toString()) {
            return res.status(400).json({ status: 'error', message: 'Cannot change owner permissions' });
        }

        
        if (!space.members.some(member => member.toString() === userId)) {
            return res.status(400).json({ status: 'error', message: 'User is not a member of this space' });
        }

        
        if (!space.editors) {
            space.editors = [];
        }

        
        const isEditor = space.editors.some(editor => editor.toString() === userId);
        if (isEditor) {
            space.editors = space.editors.filter(editor => editor.toString() !== userId);
        } else {
            space.editors.push(userId);
        }
        await space.save();

        res.json({ 
            status: 'success', 
            message: isEditor ? 'Editor permission removed' : 'Editor permission granted',
            isEditor: !isEditor
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Could not update editor permission' });
    }
});


router.post('/:spaceId/remove-member', verifyToken, async (req, res) => {
    const { userId } = req.body;
    const { spaceId } = req.params;

    try {
        const space = await Space.findById(spaceId);

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        
        if (space.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ status: 'error', message: 'Only owner can remove members' });
        }

        
        if (userId === space.owner.toString()) {
            return res.status(400).json({ status: 'error', message: 'Cannot remove owner from space' });
        }

        
        space.members = space.members.filter(member => member.toString() !== userId);
        space.admins = space.admins.filter(admin => admin.toString() !== userId);
        space.editors = space.editors.filter(editor => editor.toString() !== userId);
        await space.save();

        res.json({ status: 'success', message: 'Member removed successfully' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Could not remove member' });
    }
});


router.get('/:spaceId/can-edit', verifyToken, async (req, res) => {
    const { spaceId } = req.params;

    try {
        const space = await Space.findById(spaceId);

        if (!space) {
            return res.status(404).json({ status: 'error', message: 'Space not found' });
        }

        const userId = req.user._id.toString();
        const isOwner = space.owner.toString() === userId;
        const isAdmin = space.admins.some(admin => admin.toString() === userId);
        const isEditor = space.editors && space.editors.some(editor => editor.toString() === userId);
        const canEdit = isOwner || isAdmin || isEditor;

        res.json({ 
            status: 'success', 
            canEdit,
            isOwner,
            isAdmin,
            isEditor
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Could not check permissions' });
    }
});

module.exports = router;
