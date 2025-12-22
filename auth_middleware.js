const admin = require('firebase-admin');
const User = require('./models/User');

const verifyToken = async (req, res, next) => {
  console.log(`🔐 verifyToken middleware hit for ${req.method} ${req.path}`);
  
  const token = req.headers.authorization?.split(' ')[1]; // Get "Bearer <token>"

  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Find the user in OUR database to get their Mongo _id
    const user = await User.findOne({ uid: decodedToken.uid });
    
    if (!user) {
      console.log('❌ User not found in DB');
      return res.status(404).json({ message: 'User not found in DB' });
    }

    console.log(`✅ Token verified for user: ${user.email}`);
    // Attach the user to the request object so routes can use it
    req.user = user; 
    next(); // Pass control to the next function
  } catch (error) {
    console.log('❌ Invalid token:', error.message);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = verifyToken;