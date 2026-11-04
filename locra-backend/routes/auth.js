const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getModels } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';

/**
 * POST /api/auth/login
 * Log in met bestaand Pjotters / RowMatch account
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mailadres en wachtwoord zijn verplicht.' });
    }

    const { User, LocraEduLicense, PrivAiSubscription } = getModels();

    // 1. Zoek gebruiker in de centrale Pjotters/RowMatch database
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Geen Pjotters account gevonden met dit e-mailadres.' });
    }

    // 2. Controleer wachtwoord via bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Onjuist wachtwoord.' });
    }

    // 3. Haal gekoppelde Locra licenties en PrivAI abonnementen op
    const [eduLicenses, privAiSubscriptions] = await Promise.all([
      LocraEduLicense ? LocraEduLicense.find({ ownerUserId: user._id, status: 'active' }) : [],
      PrivAiSubscription ? PrivAiSubscription.find({ ownerUserId: user._id, status: 'active' }) : []
    ]);

    // 4. Genereer JWT token (identiek aan Pjotters/RowMatch formaat)
    const payload = {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        adminRole: user.adminRole
      }
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      success: true,
      token,
      user: payload.user,
      subscriptions: {
        eduLicensesCount: eduLicenses.length,
        eduLicenses,
        privAiSubscriptionsCount: privAiSubscriptions.length,
        privAiSubscriptions
      }
    });
  } catch (err) {
    console.error('Login error in Locra Backend:', err);
    return res.status(500).json({ error: 'Serverfout tijdens inloggen.' });
  }
});

/**
 * POST /api/auth/register
 * Maak een nieuw Pjotters / Locra account aan
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, schoolName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Naam, e-mail en wachtwoord zijn verplicht.' });
    }

    const { User, PrivAiSubscription } = getModels();

    // Check of gebruiker al bestaat in Pjotters database
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ error: 'Er bestaat al een Pjotters / Locra account met dit e-mailadres. Log in.' });
    }

    // Hash wachtwoord
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Sla op in de rowmatch collectie
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      school: schoolName ? schoolName.trim() : '',
      role: 'school_admin'
    });

    // Ken automatisch een gratis PrivAI Trial toe met €5,00 tegoed & 1M tokens
    let trialSubscription = null;
    if (PrivAiSubscription) {
      const tierConfig = PrivAiSubscription.getTierConfig('trial');
      trialSubscription = await PrivAiSubscription.create({
        ownerUserId: user._id,
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

    // Genereer token
    const payload = {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

    return res.status(201).json({
      success: true,
      token,
      user: payload.user,
      trialSubscription
    });
  } catch (err) {
    console.error('Register error in Locra Backend:', err);
    return res.status(500).json({ error: 'Fout bij aanmaken account.' });
  }
});

/**
 * GET /api/auth/me
 * Haal actueel gebruikersprofiel + alle abonnementen op
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { LocraEduLicense, PrivAiSubscription, PrivAiApiKey } = getModels();

    const [eduLicenses, privAiSubscriptions, privAiKeys] = await Promise.all([
      LocraEduLicense ? LocraEduLicense.find({ ownerUserId: req.user._id }) : [],
      PrivAiSubscription ? PrivAiSubscription.find({ ownerUserId: req.user._id }) : [],
      PrivAiApiKey ? PrivAiApiKey.find({ ownerUserId: req.user._id, active: true }).select('-keyHash') : []
    ]);

    return res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        adminRole: req.user.adminRole,
        school: req.user.school
      },
      eduLicenses,
      privAiSubscriptions,
      privAiKeys
    });
  } catch (err) {
    return res.status(500).json({ error: 'Fout bij ophalen gebruikersprofiel.' });
  }
});

module.exports = router;

