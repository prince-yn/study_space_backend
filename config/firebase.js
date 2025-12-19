const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
