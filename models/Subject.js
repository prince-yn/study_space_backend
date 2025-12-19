const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  spaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Space', required: true },
  name: { type: String, required: true },
  // Optional: You could add an icon or color for the subject later
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subject', SubjectSchema);