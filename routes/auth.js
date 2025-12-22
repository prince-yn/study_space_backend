const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const User = require('../models/User');

// Login/Register Endpoint
// Flutter will send the Token here. We verify it.
router.post('/login', async (req, res) => {
    const { token } = req.body;

    try {
        // A. Verify token
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { uid, email, name, picture } = decodedToken;

        // B. UPSERT (Update if exists, Insert if new)
        let user = await User.findOneAndUpdate(
            { uid: uid }, // Find by UID
            {
                email,
                name,
                picture,
                // We update these in case the user changed their Google photo/name
            },
            { new: true, upsert: true }
        );

        res.json({
            status: 'success',
            user: user
        });
    } catch (error) {
        res.status(401).json({ status: 'error', message: 'Invalid Token' });
    }
});

module.exports = router;
