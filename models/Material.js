const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true }, // Markdown with LaTeX
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  spaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Space', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Embedded images from Google Image Search
  images: [{
    placeholder: String, // The placeholder text from Gemini
    url: String, // The image URL from Google Image Search
    position: Number // Position in content where image should appear
  }],
  // Original files metadata
  sourceFiles: [{
    originalName: String,
    fileType: String, // 'image', 'pdf', 'audio', 'text'
    size: Number,
    url: String // Cloudinary URL if using cloud storage
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Material', MaterialSchema);
