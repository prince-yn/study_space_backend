const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true }, 
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  spaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Space', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  images: [{
    placeholder: String, 
    url: String, 
    position: Number 
  }],
  
  sourceFiles: [{
    originalName: String,
    fileType: String, 
    size: Number,
    url: String 
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Material', MaterialSchema);
