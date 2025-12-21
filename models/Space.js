const mongoose = require('mongoose');

const SpaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  // The Join Code (Random 6 chars)
  joinCode: { type: String, required: true, unique: true },
  // Link to the User who owns it
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // List of admins (users with permissions to manage space)
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // List of Members (starts with just the owner)
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // List of editors (users who can create/edit subjects and materials)
  editors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Space', SpaceSchema);