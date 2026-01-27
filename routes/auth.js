const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const User = require('../models/User');



router.post('/login', async (req, res) => {
    const { token } = req.body;

    try {
        
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { uid, email, name, picture } = decodedToken;

        
        let user = await User.findOneAndUpdate(
            { uid: uid }, 
            {
                email,
                name,
                picture,
                
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
