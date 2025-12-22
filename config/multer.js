const multer = require('multer');

// Use memory storage for all files
// We'll handle Cloudinary uploads manually in routes for better control
const storage = multer.memoryStorage();

// Configure multer for file uploads
const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
    files: 20 // Max 20 files
  },
  fileFilter: (req, file, cb) => {
    console.log(`[Multer] Receiving: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
  }
});

module.exports = upload;
