const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'organizer', 'admin', 'club_admin', 'wedstrijdcommissie', 'school_admin'], default: 'user' },
  adminRole: { type: String, enum: ['none', 'ceo', 'manager', 'support', 'viewer'], default: 'none' },
  phoneNumber: { type: String, default: '' },
  school: { type: String, default: '' }
}, { timestamps: true });

module.exports = UserSchema;

