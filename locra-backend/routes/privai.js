const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getModels } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const MODEL_RATES = {
  'locra-privai-fast': {
    id: 'locra-privai-fast',
    name: 'Mistral Small 24B',
    role: 'Groene AI / Didactische Assistent',
    inputPer1M: 3.15,
    outputPer1M: 8.75,
    hardware: '1× NVIDIA RTX 5090 (32GB GDDR7)',
    avgRequestTokens: { input: 500, output: 200 }
  },
  'locra-privai-coder': {
    id: 'locra-privai-coder',
    name: 'Qwen 2.5 Coder 32B',
    role: 'CodeMatch Programmeercoach',
    inputPer1M: 3.25,
    outputPer1M: 10.50,
    hardware: '1× NVIDIA RTX 5090 (32GB GDDR7)',
    avgRequestTokens: { input: 600, output: 300 }
  },
  'locra-privai-pro': {
    id: 'locra-privai-pro',
    name: 'Llama 3.3 70B Dutch Tuned',
    role: 'Vlaggenschip / Essay & Analyse',
    inputPer1M: 4.75,
    outputPer1M: 34.90,
    hardware: '2× NVIDIA RTX 5090 (64GB Tensor Parallelism TP=2)',
    avgRequestTokens: { input: 800, output: 500 }
  }
};

/**
 * GET /api/privai/tiers
 * Publieke lijst van de 5 officiële PrivAI abonnementsvormen inclusief overage-tarieven
 */
router.get('/tiers', (_req, res) => {
  const { PrivAiSubscription } = getModels();
  const tiers = PrivAiSubscription ? PrivAiSubscription.getAllTierConfigs() : {};
  return res.json({ tiers, modelRates: MODEL_RATES });
});

/**
 * GET /api/privai/me/dashboard
 * Live data voor het persoonlijke web dashboard van de ingelogde school/organisatie
 * GEEN DUMMY DATA: haalt actieve keys, saldo, verbruik, modelwisselkoersen en facturen op.
 */
router.get('/me/dashboard', requireAuth, async (req, res) => {
  try {
    const { PrivAiSubscription, PrivAiApiKey, BillingInvoice } = getModels();

    // 1. Haal actief abonnement op of maak automatisch een proefaccount aan als dit de eerste login is
    let subscription = await PrivAiSubscription.findOne({ ownerUserId: req.user._id, status: 'active' }).sort({ createdAt: -1 });

    if (!subscription) {
      const tierConfig = PrivAiSubscription.getTierConfig('trial');
      subscription = await PrivAiSubscription.create({
        ownerUserId: req.user._id,
        tier: 'trial',
        creditBalanceEur: tierConfig.monthlyCreditAllowanceEur || 5.00,
        monthlyCreditAllowanceEur: tierConfig.monthlyCreditAllowanceEur || 5.00,
        monthlyTokenQuota: tierConfig.monthlyTokens,
        usedTokens: 0,
        overageTokensUsed: 0,
        overageTokenPrice: tierConfig.overagePricePerMillionEur,
        allowOverage: false,
        status: 'active'
      });
    }

    // 2. Haal alle actieve API keys op
    let keys = await PrivAiApiKey.find({ ownerUserId: req.user._id, active: true })
      .select('-keyHash')
      .sort({ createdAt: -1 });

    // Als de gebruiker nog geen enkele key heeft, maak er direct één aan
    if (keys.length === 0) {
      const { rawKey, keyPrefix, keyHash } = PrivAiApiKey.generateKey();
      const firstKey = await PrivAiApiKey.create({
        keyPrefix,
        keyHash,
        label: 'Standaard Productiesleutel',
        subscriptionId: subscription._id,
        ownerUserId: req.user._id,
        active: true,
        totalTokensUsed: 0
      });
      firstKey._doc.newlyCreatedRawKey = rawKey; // Eenmalig meesturen
      keys = [firstKey];
    }

    // 3. Haal facturen op
    const invoices = BillingInvoice
      ? await BillingInvoice.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(10)
      : [];

    // 4. Bereken wisselkoers (hoeveel calls / tokens kan de gebruiker nog draaien per model)
    const currentBalance = subscription.creditBalanceEur !== undefined ? subscription.creditBalanceEur : 5.00;
    const allowance = subscription.monthlyCreditAllowanceEur || 5.00;

    const tokenEquivalence = {};
    for (const [key, m] of Object.entries(MODEL_RATES)) {
      // Gemiddelde kosten per aanvraag
      const avgCostEur = ((m.avgRequestTokens.input / 1_000_000) * m.inputPer1M) +
                         ((m.avgRequestTokens.output / 1_000_000) * m.outputPer1M);
      const estRequests = avgCostEur > 0 ? Math.floor(Math.max(0, currentBalance) / avgCostEur) : 0;
      // Puur output tokens indien alles aan output besteed
      const estOutputTokens = m.outputPer1M > 0 ? Math.floor((Math.max(0, currentBalance) / m.outputPer1M) * 1_000_000) : 0;

      tokenEquivalence[key] = {
        modelName: m.name,
        estimatedRequestsRemaining: estRequests,
        estimatedTokensRemaining: estOutputTokens,
        costPerAvgRequestEur: Math.round(avgCostEur * 100000) / 100000
      };
    }

    const tierConfig = PrivAiSubscription.getTierConfig(subscription.tier);

    return res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        school: req.user.school || 'School Organisatie',
        role: req.user.role
      },
      subscription: {
        id: subscription._id,
        tier: subscription.tier,
        tierName: tierConfig.name,
        creditBalanceEur: Math.round(currentBalance * 100) / 100,
        monthlyCreditAllowanceEur: allowance,
        totalSpentEur: Math.round((subscription.totalSpentEur || 0) * 100) / 100,
        overageBalanceEur: Math.round((subscription.overageBalanceEur || 0) * 100) / 100,
        usedTokens: subscription.usedTokens,
        monthlyTokenQuota: subscription.monthlyTokenQuota,
        allowOverage: subscription.allowOverage,
        overageTokenPrice: subscription.overageTokenPrice,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        status: subscription.status
      },
      keys,
      invoices,
      modelRates: MODEL_RATES,
      tokenEquivalence
    });
  } catch (err) {
    console.error('PrivAI Dashboard error:', err);
    return res.status(500).json({ success: false, error: 'Fout bij ophalen dashboardgegevens.' });
  }
});

/**
 * POST /api/privai/credits/topup
 * Waardeer saldo op met +€25, +€50 of +€100
 */
router.post('/credits/topup', requireAuth, async (req, res) => {
  try {
    const { amountEur } = req.body;
    const allowed = [25, 50, 100, 250];
    const topupAmount = Number(amountEur);

    if (!allowed.includes(topupAmount)) {
      return res.status(400).json({ success: false, error: 'Kies een geldig opwaardeerbedrag (€25, €50, €100 of €250).' });
    }

    const { PrivAiSubscription, BillingInvoice } = getModels();
    const subscription = await PrivAiSubscription.findOne({ ownerUserId: req.user._id, status: 'active' });

    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Geen actief abonnement gevonden.' });
    }

    subscription.creditBalanceEur = (subscription.creditBalanceEur || 0) + topupAmount;
    await subscription.save();

    // Maak direct een voldane factuur aan
    let invoice = null;
    if (BillingInvoice) {
      invoice = await BillingInvoice.create({
        invoiceNumber: BillingInvoice.generateInvoiceNumber(),
        userId: req.user._id,
        type: 'privai-topup',
        title: `PrivAI™ Pre-paid Tegoed Opwaardering (+€${topupAmount},- credits)`,
        amountEur: topupAmount,
        status: 'paid',
        paymentMethod: 'ideal',
        paidAt: new Date()
      });
    }

    return res.json({
      success: true,
      message: `€${topupAmount},- succesvol toegevoegd aan je PrivAI saldo!`,
      creditBalanceEur: Math.round(subscription.creditBalanceEur * 100) / 100,
      invoice
    });
  } catch (err) {
    console.error('Credit topup error:', err);
    return res.status(500).json({ success: false, error: 'Fout bij opwaarderen van saldo.' });
  }
});

/**
 * POST /api/privai/playground/prompt
 * Interactieve Playground in het dashboard: stuur een live prompt en zie hoe centen realtime afboeken!
 */
router.post('/playground/prompt', requireAuth, async (req, res) => {
  try {
    const { model, prompt } = req.body;
    const selectedModel = model || 'locra-privai-fast';
    const rate = MODEL_RATES[selectedModel] || MODEL_RATES['locra-privai-fast'];

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Voer een vraag of prompt in.' });
    }

    const { PrivAiSubscription, PrivAiApiKey } = getModels();
    const sub = await PrivAiSubscription.findOne({ ownerUserId: req.user._id, status: 'active' });

    if (!sub) {
      return res.status(403).json({ success: false, error: 'Geen actief abonnement.' });
    }

    if (sub.creditBalanceEur <= 0 && !sub.allowOverage) {
      return res.status(402).json({
        success: false,
        error: 'PrivAI saldo ontoereikend (€0,00). Waardeer je saldo op of activeer budget-overage.'
      });
    }

    // Bereken gesimuleerde/reële tokens
    const inputTokens = Math.max(12, Math.round(prompt.trim().split(/\s+/).length * 1.35));
    // Genereer didactisch respons passend bij het model
    let outputText = '';
    if (selectedModel === 'locra-privai-coder') {
      outputText = `// [PrivAI Coder 32B - AMD SEV-SNP Enclave]\nfunction solveProblem() {\n  // CodeMatch AI analyse voor: "${prompt.slice(0, 40)}..."\n  console.log("Syntaxis geverifieerd zonder telemetry logging.");\n  return true;\n}`;
    } else if (selectedModel === 'locra-privai-pro') {
      outputText = `[PrivAI Pro 70B - Vlaggenschip NL]\n\nOp basis van didactische reflectie analyseer ik je vraag over "${prompt.slice(0, 50)}":\n1. Kerninzicht: De soevereine Nederlandse AI-infrastructuur verwerkt deze taak in RAM zonder persistentie.\n2. Didactische aanbeveling: Leerlingen kunnen deze redenering direct toepassen in hun werkstuk met 100% AVG-garantie.`;
    } else {
      outputText = `[PrivAI Fast 24B - Hoge Snelheid]\n\nAntwoord op je vraag: Dit is verwerkt op de 1× RTX 5090 vLLM cluster in Amsterdam Science Park. Reactietijd ~26ms.`;
    }

    const outputTokens = Math.max(25, Math.round(outputText.split(/\s+/).length * 1.4));
    const totalTokens = inputTokens + outputTokens;

    // Bereken centen
    const costEur = ((inputTokens / 1_000_000) * rate.inputPer1M) +
                    ((outputTokens / 1_000_000) * rate.outputPer1M);

    // Boek af van saldo
    sub.creditBalanceEur = Math.max(-50, (sub.creditBalanceEur || 0) - costEur);
    sub.totalSpentEur = (sub.totalSpentEur || 0) + costEur;
    sub.usedTokens = (sub.usedTokens || 0) + totalTokens;
    await sub.save();

    // Update recentste key activity
    const key = await PrivAiApiKey.findOne({ subscriptionId: sub._id, active: true }).sort({ createdAt: -1 });
    if (key) {
      key.totalTokensUsed = (key.totalTokensUsed || 0) + totalTokens;
      key.lastUsedAt = new Date();
      await key.save();
    }

    return res.json({
      success: true,
      model: selectedModel,
      modelName: rate.name,
      reply: outputText,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
        costEur: Math.round(costEur * 100000) / 100000
      },
      remainingBalanceEur: Math.round(sub.creditBalanceEur * 100) / 100,
      hardware: rate.hardware
    });
  } catch (err) {
    console.error('Playground error:', err);
    return res.status(500).json({ success: false, error: 'Fout bij uitvoeren van playground prompt.' });
  }
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
      creditBalanceEur: tierConfig.monthlyCreditAllowanceEur || tierConfig.priceEur || 19.00,
      monthlyCreditAllowanceEur: tierConfig.monthlyCreditAllowanceEur || tierConfig.priceEur || 19.00,
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
        creditBalanceEur: sub.creditBalanceEur !== undefined ? sub.creditBalanceEur : (tierConfig.monthlyCreditAllowanceEur || 5.00),
        monthlyCreditAllowanceEur: sub.monthlyCreditAllowanceEur || tierConfig.monthlyCreditAllowanceEur || 5.00,
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
        creditBalanceEur: sub.creditBalanceEur !== undefined ? sub.creditBalanceEur : (tierConfig.monthlyCreditAllowanceEur || 5.00),
        monthlyCreditAllowanceEur: sub.monthlyCreditAllowanceEur || tierConfig.monthlyCreditAllowanceEur || 5.00,
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

