const admin = require('firebase-admin');
const User = require('./models/User');

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Get "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Find the user in OUR database to get their Mongo _id
    const user = await User.findOne({ uid: decodedToken.uid });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found in DB' });
    }

    // Attach the user to the request object so routes can use it
    req.user = user; 
    next(); // Pass control to the next function
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = verifyToken;