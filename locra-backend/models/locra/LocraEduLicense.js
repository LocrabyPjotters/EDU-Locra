const mongoose = require('mongoose');

const LocraEduLicenseSchema = new mongoose.Schema({
  key: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  schoolName: {
    type: String,
    required: true,
    trim: true
  },
  contactName: {
    type: String,
    required: true,
    trim: true
  },
  contactEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  contactPhone: {
    type: String,
    default: ''
  },
  tier: {
    type: String,
    enum: ['edu-free', 'edu-basic', 'edu-plus', 'edu-premium', 'enterprise'],
    default: 'edu-plus'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'expired', 'suspended'],
    default: 'active'
  },
  studentLimit: {
    type: Number,
    default: 0 // 0 = onbeperkt per vestiging (vanaf EDU-Plus)
  },
  serverUrl: {
    type: String,
    default: ''
  },
  branding: {
    logoUrl: { type: String, default: '' },
    primaryColor: { type: String, default: '#7c5cfc' },
    schoolDomain: { type: String, default: '' },
    customFooterText: { type: String, default: '' }
  },
  features: {
    withoutWatermark: { type: Boolean, default: true },
    somtodayIntegration: { type: Boolean, default: true },
    magisterIntegration: { type: Boolean, default: true },
    codeMatchEnabled: { type: Boolean, default: false },
    studentCare113: { type: Boolean, default: true },
    zeroTelemetry: { type: Boolean, default: true }
  },
  activatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 jaar
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Generator voor unieke LOCRA-XXXX-XXXX-XXXX licentiesleutel
LocraEduLicenseSchema.statics.generateLicenseKey = function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `LOCRA-${seg()}-${seg()}-${seg()}`;
};

module.exports = LocraEduLicenseSchema;

