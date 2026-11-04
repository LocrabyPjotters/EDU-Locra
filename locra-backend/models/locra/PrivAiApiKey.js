const mongoose = require('mongoose');
const crypto = require('crypto');

const PrivAiApiKeySchema = new mongoose.Schema({
  keyPrefix: {
    type: String,
    required: true,
    index: true
  },
  keyHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  label: {
    type: String,
    required: true,
    trim: true,
    default: 'Default API Key'
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PrivAiSubscription',
    required: true,
    index: true
  },
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  active: {
    type: Boolean,
    default: true
  },
  totalTokensUsed: {
    type: Number,
    default: 0
  },
  lastUsedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Generator voor een cryptografisch willekeurige live API-sleutel
PrivAiApiKeySchema.statics.generateKey = function() {
  const randomHex = crypto.randomBytes(16).toString('hex');
  const rawKey = `privai_live_${randomHex}`;
  const keyPrefix = `privai_live_${randomHex.substring(0, 6)}...`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  return {
    rawKey,
    keyPrefix,
    keyHash
  };
};

PrivAiApiKeySchema.statics.generateApiKey = PrivAiApiKeySchema.statics.generateKey;

module.exports = PrivAiApiKeySchema;
