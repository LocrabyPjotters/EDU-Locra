const mongoose = require('mongoose');

/**
 * 5 Officiële PrivAI Tiers Specificatie
 */
const PRIVAI_TIERS = {
  'trial': {
    name: 'PrivAI Starter / Gratis Proefaccount',
    basePriceEur: 0,
    priceEur: 0,
    monthlyTokens: 1_000_000,
    overagePricePerMillionEur: 0,
    allowOverageDefault: false,
    maxKeys: 1
  },
  'dev': {
    name: 'PrivAI Developer',
    basePriceEur: 19,
    priceEur: 19,
    monthlyTokens: 5_000_000,
    overagePricePerMillionEur: 3.50,
    allowOverageDefault: true,
    maxKeys: 3
  },
  'school-basic': {
    name: 'PrivAI School Basic',
    basePriceEur: 69,
    priceEur: 69,
    monthlyTokens: 25_000_000,
    overagePricePerMillionEur: 2.80,
    allowOverageDefault: true,
    maxKeys: 5
  },
  'school-pro': {
    name: 'PrivAI School Pro / Core (VO & MBO)',
    basePriceEur: 149,
    priceEur: 149,
    monthlyTokens: 60_000_000,
    overagePricePerMillionEur: 2.20,
    allowOverageDefault: true,
    maxKeys: 15
  },
  'enterprise': {
    name: 'PrivAI Campus Enterprise (Besturen & Clusters)',
    basePriceEur: 399,
    priceEur: 399,
    monthlyTokens: 200_000_000,
    overagePricePerMillionEur: 1.75,
    allowOverageDefault: true,
    maxKeys: 50
  }
};

const PrivAiSubscriptionSchema = new mongoose.Schema({
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tier: {
    type: String,
    enum: ['trial', 'dev', 'school-basic', 'school-pro', 'enterprise'],
    default: 'trial',
    required: true
  },
  monthlyTokenQuota: {
    type: Number,
    required: true
  },
  usedTokens: {
    type: Number,
    default: 0
  },
  overageTokensUsed: {
    type: Number,
    default: 0
  },
  overageTokenPrice: {
    type: Number, // Prijs per 1.000.000 tokens boven bundel in EUR
    required: true
  },
  allowOverage: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'quota_exceeded', 'past_due', 'canceled'],
    default: 'active'
  },
  currentPeriodStart: {
    type: Date,
    default: Date.now
  },
  currentPeriodEnd: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

PrivAiSubscriptionSchema.statics.TIERS = PRIVAI_TIERS;

PrivAiSubscriptionSchema.statics.getTierConfig = function(tierName) {
  return PRIVAI_TIERS[tierName] || PRIVAI_TIERS['trial'];
};

PrivAiSubscriptionSchema.statics.getAllTierConfigs = function() {
  return PRIVAI_TIERS;
};

module.exports = PrivAiSubscriptionSchema;
