const express = require('express');
const router = express.Router();
const { getLocraConnection, getRowMatchConnection } = require('../config/database');
const LocraEduLicenseSchema = require('../models/locra/LocraEduLicense');
const PrivAiSubscriptionSchema = require('../models/locra/PrivAiSubscription');
const PrivAiApiKeySchema = require('../models/locra/PrivAiApiKey');
const BillingInvoiceSchema = require('../models/locra/BillingInvoice');
const UserSchema = require('../models/rowmatch/User');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');

function getModels() {
  const locraConn = getLocraConnection();
  const rowMatchConn = getRowMatchConnection();

  const LocraEduLicense = locraConn.models.LocraEduLicense || locraConn.model('LocraEduLicense', LocraEduLicenseSchema);
  const PrivAiSubscription = locraConn.models.PrivAiSubscription || locraConn.model('PrivAiSubscription', PrivAiSubscriptionSchema);
  const PrivAiApiKey = locraConn.models.PrivAiApiKey || locraConn.model('PrivAiApiKey', PrivAiApiKeySchema);
  const BillingInvoice = locraConn.models.BillingInvoice || locraConn.model('BillingInvoice', BillingInvoiceSchema);
  const User = rowMatchConn.models.User || rowMatchConn.model('User', UserSchema);

  return { LocraEduLicense, PrivAiSubscription, PrivAiApiKey, BillingInvoice, User };
}

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * GET /api/admin/overview
 * Platform-wide metrics for Locra & PrivAI
 */
router.get('/overview', async (req, res) => {
  try {
    const { LocraEduLicense, PrivAiSubscription, PrivAiApiKey, BillingInvoice, User } = getModels();

    const [
      totalUsers,
      totalLicenses,
      activeLicenses,
      totalPrivAiSubs,
      activePrivAiSubs,
      totalApiKeys,
      invoices
    ] = await Promise.all([
      User.countDocuments(),
      LocraEduLicense.countDocuments(),
      LocraEduLicense.countDocuments({ status: 'active' }),
      PrivAiSubscription.countDocuments(),
      PrivAiSubscription.countDocuments({ status: 'active' }),
      PrivAiApiKey.countDocuments({ status: 'active' }),
      BillingInvoice.find().lean()
    ]);

    // Aggregate tokens and revenue
    const subs = await PrivAiSubscription.find().lean();
    let totalTokensUsed = 0;
    let totalOverageTokens = 0;
    subs.forEach(s => {
      totalTokensUsed += (s.monthlyTokensUsed || 0);
      totalOverageTokens += (s.overageTokensUsed || 0);
    });

    let totalRevenueEur = 0;
    invoices.forEach(inv => {
      if (inv.status === 'paid') {
        totalRevenueEur += (inv.amountEur || 0);
      }
    });

    return res.json({
      success: true,
      stats: {
        totalUsers,
        licenses: {
          total: totalLicenses,
          active: activeLicenses
        },
        privAi: {
          totalSubscriptions: totalPrivAiSubs,
          activeSubscriptions: activePrivAiSubs,
          activeKeys: totalApiKeys,
          totalTokensUsed,
          totalOverageTokens
        },
        billing: {
          totalInvoices: invoices.length,
          totalRevenueEur: Number(totalRevenueEur.toFixed(2))
        }
      }
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    return res.status(500).json({ success: false, error: 'Kon admin overview niet laden.' });
  }
});

/**
 * GET /api/admin/licenses
 * List all Locra-EDU licenses
 */
router.get('/licenses', async (req, res) => {
  try {
    const { LocraEduLicense } = getModels();
    const licenses = await LocraEduLicense.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      licenses
    });
  } catch (error) {
    console.error('Admin licenses error:', error);
    return res.status(500).json({ success: false, error: 'Kon licenties niet ophalen.' });
  }
});

/**
 * PATCH /api/admin/licenses/:id
 * Update license status, tier, or limits
 */
router.patch('/licenses/:id', async (req, res) => {
  try {
    const { LocraEduLicense } = getModels();
    const { status, tier, maxStudents, branding } = req.body;

    const license = await LocraEduLicense.findById(req.params.id);
    if (!license) {
      return res.status(404).json({ success: false, error: 'Licentie niet gevonden.' });
    }

    if (status) license.status = status;
    if (tier) license.tier = tier;
    if (maxStudents !== undefined) license.maxStudents = Number(maxStudents);
    if (branding) {
      license.branding = {
        ...license.branding,
        ...branding
      };
    }

    await license.save();

    return res.json({
      success: true,
      message: 'Licentie succesvol bijgewerkt.',
      license
    });
  } catch (error) {
    console.error('Admin license patch error:', error);
    return res.status(500).json({ success: false, error: 'Kon licentie niet bijwerken.' });
  }
});

/**
 * GET /api/admin/privai-subscriptions
 * List all PrivAI subscriptions
 */
router.get('/privai-subscriptions', async (req, res) => {
  try {
    const { PrivAiSubscription } = getModels();
    const subscriptions = await PrivAiSubscription.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      subscriptions
    });
  } catch (error) {
    console.error('Admin PrivAI subscriptions error:', error);
    return res.status(500).json({ success: false, error: 'Kon PrivAI abonnementen niet ophalen.' });
  }
});

/**
 * PATCH /api/admin/privai-subscriptions/:id
 * Update PrivAI subscription parameters
 */
router.patch('/privai-subscriptions/:id', async (req, res) => {
  try {
    const { PrivAiSubscription } = getModels();
    const { status, allowOverage, monthlyTokenLimit } = req.body;

    const sub = await PrivAiSubscription.findById(req.params.id);
    if (!sub) {
      return res.status(404).json({ success: false, error: 'Abonnement niet gevonden.' });
    }

    if (status) sub.status = status;
    if (allowOverage !== undefined) sub.allowOverage = Boolean(allowOverage);
    if (monthlyTokenLimit !== undefined) sub.monthlyTokenLimit = Number(monthlyTokenLimit);

    await sub.save();

    return res.json({
      success: true,
      message: 'PrivAI abonnement bijgewerkt.',
      subscription: sub
    });
  } catch (error) {
    console.error('Admin PrivAI patch error:', error);
    return res.status(500).json({ success: false, error: 'Kon abonnement niet bijwerken.' });
  }
});

/**
 * GET /api/admin/invoices
 * List all invoices
 */
router.get('/invoices', async (req, res) => {
  try {
    const { BillingInvoice } = getModels();
    const invoices = await BillingInvoice.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      invoices
    });
  } catch (error) {
    console.error('Admin invoices error:', error);
    return res.status(500).json({ success: false, error: 'Kon facturen niet ophalen.' });
  }
});

module.exports = router;

