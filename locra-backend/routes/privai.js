const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getModels } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/privai/tiers
 * Publieke lijst van de 5 officiële PrivAI abonnementsvormen inclusief overage-tarieven
 */
router.get('/tiers', (_req, res) => {
  const { PrivAiSubscription } = getModels();
  const tiers = PrivAiSubscription ? PrivAiSubscription.getAllTierConfigs() : {};
  return res.json({ tiers });
});

/**
 * GET /api/privai/subscriptions
 * Haal alle PrivAI abonnementen en verbruiksmeters van de ingelogde gebruiker op
 */
router.get('/subscriptions', requireAuth, async (req, res) => {
  try {
    const { PrivAiSubscription } = getModels();
    const subscriptions = await PrivAiSubscription.find({ ownerUserId: req.user._id });

    // Verrijk met actuele overage berekening
    const enriched = subscriptions.map(sub => {
      const remainingIncludedTokens = Math.max(0, sub.monthlyTokenQuota - sub.usedTokens);
      const isOverQuota = sub.usedTokens >= sub.monthlyTokenQuota;
      const estimatedOverageCostEur = sub.overageTokensUsed > 0
        ? (sub.overageTokensUsed / 1_000_000) * sub.overageTokenPrice
        : 0;

      return {
        ...sub.toObject(),
        remainingIncludedTokens,
        isOverQuota,
        estimatedOverageCostEur: Math.round(estimatedOverageCostEur * 100) / 100
      };
    });

    return res.json({ subscriptions: enriched });
  } catch (err) {
    return res.status(500).json({ error: 'Fout bij ophalen PrivAI abonnementen.' });
  }
});

/**
 * POST /api/privai/subscriptions
 * Sluit een PrivAI abonnement af (keuze uit de 5 tiers)
 */
router.post('/subscriptions', requireAuth, async (req, res) => {
  try {
    const { tier, allowOverage } = req.body;
    const { PrivAiSubscription, BillingInvoice } = getModels();

    const selectedTier = tier || 'dev';
    const tierConfig = PrivAiSubscription.getTierConfig(selectedTier);

    const subscription = await PrivAiSubscription.create({
      ownerUserId: req.user._id,
      tier: selectedTier,
      monthlyTokenQuota: tierConfig.monthlyTokens,
      usedTokens: 0,
      overageTokensUsed: 0,
      overageTokenPrice: tierConfig.overagePricePerMillionEur,
      allowOverage: allowOverage !== undefined ? Boolean(allowOverage) : tierConfig.allowOverageDefault,
      status: 'active'
    });

    // Factuur aanmaken indien betaald
    if (tierConfig.basePriceEur > 0 && BillingInvoice) {
      await BillingInvoice.create({
        invoiceNumber: BillingInvoice.generateInvoiceNumber(),
        userId: req.user._id,
        type: 'privai-subscription',
        title: `PrivAI™ Maandabonnement (${tierConfig.name}) — ${tierConfig.monthlyTokens.toLocaleString()} tokens`,
        amountEur: tierConfig.basePriceEur,
        status: 'pending'
      });
    }

    return res.status(201).json({
      success: true,
      message: `PrivAI abonnement (${tierConfig.name}) succesvol geactiveerd!`,
      subscription
    });
  } catch (err) {
    console.error('PrivAI subscription creation error:', err);
    return res.status(500).json({ error: 'Fout bij aanmaken PrivAI abonnement.' });
  }
});

/**
 * PATCH /api/privai/subscriptions/:id/overage-settings
 * Stel budgetcontrole / overage in (wel of niet doorgaan boven maandquotum)
 */
router.patch('/subscriptions/:id/overage-settings', requireAuth, async (req, res) => {
  try {
    const { PrivAiSubscription } = getModels();
    const subscription = await PrivAiSubscription.findOne({ _id: req.params.id, ownerUserId: req.user._id });

    if (!subscription) {
      return res.status(404).json({ error: 'Abonnement niet gevonden.' });
    }

    const { allowOverage } = req.body;
    if (allowOverage !== undefined) {
      if (subscription.tier === 'trial' && allowOverage === true) {
        return res.status(400).json({
          error: 'Overage is niet mogelijk op een gratis proefaccount. Upgrade naar Developer of School Core.'
        });
      }
      subscription.allowOverage = Boolean(allowOverage);
      await subscription.save();
    }

    return res.json({
      success: true,
      message: `Overage-instelling bijgewerkt naar: ${subscription.allowOverage ? 'Toegestaan (automatische overage tegen vast tarief)' : 'Harde budget-stop'}`,
      allowOverage: subscription.allowOverage,
      overageTokenPrice: subscription.overageTokenPrice
    });
  } catch (err) {
    return res.status(500).json({ error: 'Fout bij bijwerken overage instellingen.' });
  }
});

/**
 * GET /api/privai/keys
 * Haal alle API-sleutels van de gebruiker op (geheime hash wordt nooit geretourneerd)
 */
router.get('/keys', requireAuth, async (req, res) => {
  try {
    const { PrivAiApiKey } = getModels();
    const keys = await PrivAiApiKey.find({ ownerUserId: req.user._id }).select('-keyHash').populate('subscriptionId', 'tier monthlyTokenQuota usedTokens');
    return res.json({ keys });
  } catch (err) {
    return res.status(500).json({ error: 'Fout bij ophalen API sleutels.' });
  }
});

/**
 * POST /api/privai/keys
 * Genereer een nieuwe cryptografische API-sleutel (privai_live_...)
 */
router.post('/keys', requireAuth, async (req, res) => {
  try {
    const { label, subscriptionId } = req.body;
    const { PrivAiApiKey, PrivAiSubscription } = getModels();

    // 1. Zoek bijbehorend actief abonnement
    let sub = null;
    if (subscriptionId) {
      sub = await PrivAiSubscription.findOne({ _id: subscriptionId, ownerUserId: req.user._id, status: 'active' });
    } else {
      sub = await PrivAiSubscription.findOne({ ownerUserId: req.user._id, status: 'active' }).sort({ createdAt: -1 });
    }

    if (!sub) {
      return res.status(400).json({
        error: 'Geen actief PrivAI abonnement gevonden. Activeer eerst een abonnement of gratis trial.'
      });
    }

    // 2. Check maximum aantal sleutels volgens tier config
    const tierConfig = PrivAiSubscription.getTierConfig(sub.tier);
    const existingCount = await PrivAiApiKey.countDocuments({ subscriptionId: sub._id, active: true });
    if (existingCount >= tierConfig.maxKeys) {
      return res.status(403).json({
        error: `Maximum aantal actieve API keys bereikt voor dit plan (${existingCount}/${tierConfig.maxKeys}). Deactiveer een oude sleutel of upgrade je plan.`
      });
    }

    // 3. Genereer cryptografische sleutel
    const { rawKey, keyPrefix, keyHash } = PrivAiApiKey.generateKey();

    const apiKeyRecord = await PrivAiApiKey.create({
      keyPrefix,
      keyHash,
      label: label ? label.trim() : 'Locra PrivAI Key',
      subscriptionId: sub._id,
      ownerUserId: req.user._id,
      active: true,
      totalTokensUsed: 0
    });

    // 4. Stuur rawKey EENMALIG terug naar de client
    return res.status(201).json({
      success: true,
      message: 'API Key succesvol gegenereerd! Sla deze sleutel nu veilig op; hij kan hierna niet meer getoond worden.',
      key: {
        id: apiKeyRecord._id,
        rawKey, // EENMALIG ZICHTBAAR
        keyPrefix: apiKeyRecord.keyPrefix,
        label: apiKeyRecord.label,
        subscriptionTier: sub.tier,
        createdAt: apiKeyRecord.createdAt
      }
    });
  } catch (err) {
    console.error('API key generation error:', err);
    return res.status(500).json({ error: 'Fout bij genereren API sleutel.' });
  }
});

/**
 * DELETE /api/privai/keys/:id
 * Trek een API sleutel in
 */
router.delete('/keys/:id', requireAuth, async (req, res) => {
  try {
    const { PrivAiApiKey } = getModels();
    const apiKey = await PrivAiApiKey.findOne({ _id: req.params.id, ownerUserId: req.user._id });

    if (!apiKey) {
      return res.status(404).json({ error: 'API sleutel niet gevonden.' });
    }

    apiKey.active = false;
    await apiKey.save();

    return res.json({ success: true, message: 'API sleutel ingetrokken.' });
  } catch (err) {
    return res.status(500).json({ error: 'Fout bij intrekken API sleutel.' });
  }
});

/**
 * POST /api/privai/internal/verify-key
 * INTERN ENCLAVE VERIFICATIE-ENDPOINT
 * Aangeroepen door de PrivAI Gateway in Amsterdam Science Park.
 * Controleert de hash van de sleutel, valideert tokenquota of berekent overage.
 */
router.post('/internal/verify-key', async (req, res) => {
  try {
    const { rawApiKey, tokensToConsume } = req.body;
    if (!rawApiKey) {
      return res.status(400).json({ valid: false, error: 'rawApiKey is required' });
    }

    const { PrivAiApiKey, PrivAiSubscription } = getModels();
    const keyHash = crypto.createHash('sha256').update(rawApiKey.trim()).digest('hex');

    const apiKey = await PrivAiApiKey.findOne({ keyHash, active: true }).populate('subscriptionId');
    if (!apiKey) {
      return res.status(401).json({ valid: false, error: 'Ongeldige of inactieve PrivAI API sleutel.' });
    }

    const sub = apiKey.subscriptionId;
    if (!sub || sub.status !== 'active') {
      return res.status(403).json({ valid: false, error: 'Abonnement gekoppeld aan deze sleutel is niet actief.' });
    }

    const tokens = parseInt(tokensToConsume) || 0;
    const isOverQuota = sub.usedTokens >= sub.monthlyTokenQuota;

    // Check of overage is toegestaan als het quotum bereikt is
    if (isOverQuota && !sub.allowOverage) {
      return res.status(429).json({
        valid: false,
        error: 'Maandquotum bereikt en budget-overage is uitgeschakeld voor dit account. Verhoog je limiet in het dashboard.',
        quotaExceeded: true
      });
    }

    // Verbruik tokens registreren
    if (tokens > 0) {
      apiKey.totalTokensUsed += tokens;
      apiKey.lastUsedAt = new Date();
      await apiKey.save();

      if (isOverQuota) {
        sub.overageTokensUsed += tokens;
      } else {
        const remaining = sub.monthlyTokenQuota - sub.usedTokens;
        if (tokens > remaining) {
          sub.usedTokens = sub.monthlyTokenQuota;
          sub.overageTokensUsed += (tokens - remaining);
        } else {
          sub.usedTokens += tokens;
        }
      }
      await sub.save();
    }

    return res.json({
      valid: true,
      ownerUserId: apiKey.ownerUserId,
      tier: sub.tier,
      monthlyQuota: sub.monthlyTokenQuota,
      usedTokens: sub.usedTokens,
      overageTokensUsed: sub.overageTokensUsed,
      isOverQuota: sub.usedTokens >= sub.monthlyTokenQuota,
      allowOverage: sub.allowOverage
    });
  } catch (err) {
    console.error('Internal verify-key error:', err);
    return res.status(500).json({ valid: false, error: 'Fout bij interne sleutelverificatie.' });
  }
});

/**
 * POST /api/privai/core/connect
 * Hybride verificatie & koppeling voor Locra Core schoolservers
 * Accepteert een API-key (privai_live_...) OF een Pjotters JWT token
 */
router.post('/core/connect', async (req, res) => {
  try {
    const { apiKey: rawKey, token } = req.body;
    const { PrivAiApiKey, PrivAiSubscription, User } = getModels();

    // 1. Directe API Key koppeling
    if (rawKey && typeof rawKey === 'string' && rawKey.startsWith('privai_live_')) {
      const keyHash = crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
      const apiKeyDoc = await PrivAiApiKey.findOne({ keyHash, active: true }).populate('subscriptionId');

      if (!apiKeyDoc) {
        return res.status(401).json({
          success: false,
          error: 'Ongeldige of ingetrokken PrivAI API-sleutel.'
        });
      }

      const sub = apiKeyDoc.subscriptionId;
      if (!sub || sub.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Het PrivAI abonnement behorend bij deze sleutel is inactief of verlopen.'
        });
      }

      let organizationName = 'School Organisatie';
      if (User) {
        const owner = await User.findById(apiKeyDoc.ownerUserId);
        if (owner) {
          organizationName = owner.company || owner.schoolName || owner.name || owner.email;
        }
      }

      const tierConfig = PrivAiSubscription.getTierConfig(sub.tier);

      return res.json({
        success: true,
        connected: true,
        organization: organizationName,
        tier: sub.tier,
        tierName: tierConfig.name,
        monthlyTokenQuota: sub.monthlyTokenQuota,
        usedTokens: sub.usedTokens,
        overageTokensUsed: sub.overageTokensUsed,
        overageTokenPrice: sub.overageTokenPrice,
        allowOverage: sub.allowOverage,
        keyPrefix: apiKeyDoc.keyPrefix,
        gatewayUrl: process.env.PRIVAI_GATEWAY_URL || 'https://api.privai.locra.nl/v1',
        teeLocation: 'Equinix AM4, Science Park, Amsterdam (NL)',
        zeroLoggingGuaranteed: true
      });
    }

    // 2. JWT SSO koppeling
    const authHeader = req.headers.authorization;
    const bearerToken = token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null);

    if (bearerToken) {
      const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';
      const jwt = require('jsonwebtoken');
      let decoded;
      try {
        decoded = jwt.verify(bearerToken, jwtSecret);
      } catch (e) {
        return res.status(401).json({ success: false, error: 'Ongeldige of verlopen Pjotters sessie.' });
      }

      const userId = decoded.user?.id || decoded.id || decoded._id;
      const sub = await PrivAiSubscription.findOne({ ownerUserId: userId, status: 'active' });

      if (!sub) {
        return res.status(404).json({
          success: false,
          error: 'Geen actief PrivAI abonnement gevonden voor dit account. Vraag eerst een bundel aan via de website.'
        });
      }

      let apiKeyDoc = await PrivAiApiKey.findOne({ subscriptionId: sub._id, active: true });
      if (!apiKeyDoc) {
        // Genereer automatisch een standaard key voor Locra Core
        const { rawKey: newRawKey, keyPrefix, keyHash } = PrivAiApiKey.generateKey();
        apiKeyDoc = await PrivAiApiKey.create({
          keyPrefix,
          keyHash,
          label: 'Locra Core Schoolserver',
          subscriptionId: sub._id,
          ownerUserId: userId,
          active: true
        });
        apiKeyDoc._rawKey = newRawKey;
      }

      let organizationName = decoded.user?.name || decoded.email || 'School Organisatie';
      if (User) {
        const owner = await User.findById(userId);
        if (owner) {
          organizationName = owner.company || owner.schoolName || owner.name || owner.email;
        }
      }

      const tierConfig = PrivAiSubscription.getTierConfig(sub.tier);

      return res.json({
        success: true,
        connected: true,
        organization: organizationName,
        tier: sub.tier,
        tierName: tierConfig.name,
        monthlyTokenQuota: sub.monthlyTokenQuota,
        usedTokens: sub.usedTokens,
        overageTokensUsed: sub.overageTokensUsed,
        overageTokenPrice: sub.overageTokenPrice,
        allowOverage: sub.allowOverage,
        keyPrefix: apiKeyDoc.keyPrefix,
        rawKey: apiKeyDoc._rawKey || undefined,
        gatewayUrl: process.env.PRIVAI_GATEWAY_URL || 'https://api.privai.locra.nl/v1',
        teeLocation: 'Equinix AM4, Science Park, Amsterdam (NL)',
        zeroLoggingGuaranteed: true
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Geen API-sleutel of authenticatietoken opgegeven.'
    });
  } catch (err) {
    console.error('Core connect error:', err);
    return res.status(500).json({ success: false, error: 'Fout bij koppelen van Locra Core.' });
  }
});

/**
 * PATCH /api/privai/subscriptions/settings
 * Instellingen aanpassen (bijv. allowOverage of budgetlimiet)
 */
router.patch('/subscriptions/settings', requireAuth, async (req, res) => {
  try {
    const { allowOverage } = req.body;
    const { PrivAiSubscription } = getModels();

    const sub = await PrivAiSubscription.findOne({ ownerUserId: req.user._id, status: 'active' });
    if (!sub) {
      return res.status(404).json({ success: false, error: 'Geen actief abonnement gevonden.' });
    }

    if (allowOverage !== undefined) {
      sub.allowOverage = Boolean(allowOverage);
    }
    await sub.save();

    return res.json({
      success: true,
      message: 'Instellingen succesvol bijgewerkt.',
      subscription: sub
    });
  } catch (err) {
    console.error('Subscription settings patch error:', err);
    return res.status(500).json({ success: false, error: 'Kon instellingen niet bijwerken.' });
  }
});

module.exports = router;

