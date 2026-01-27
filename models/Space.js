const mongoose = require('mongoose');

const SpaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  
  joinCode: { type: String, required: true, unique: true },
  
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  editors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Space', SpaceSchema);