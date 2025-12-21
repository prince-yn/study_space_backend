const multer = require('multer');
const CloudinaryStorage = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');


const storage = process.env.USE_CLOUDINARY === 'true' 
  ? new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'study_space',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'webp'],
        resource_type: 'auto'
      }
    })
  : multer.memoryStorage(); // Use memory storage if Cloudinary not configured

// Configure multer for file uploads
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = upload;
