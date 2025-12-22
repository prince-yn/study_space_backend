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
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
    files: 20 // Max 20 files
  }
});

module.exports = upload;
