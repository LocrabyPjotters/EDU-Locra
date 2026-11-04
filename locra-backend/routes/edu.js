const express = require('express');
const router = express.Router();
const { getModels } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const EDU_TIERS = {
  'edu-free': { name: 'EDU Free', priceEur: 0, watermark: true, somtoday: false, codeMatch: false },
  'edu-basic': { name: 'EDU Basic', priceEur: 50, watermark: true, somtoday: false, codeMatch: false },
  'edu-plus': { name: 'EDU Plus (Standaard VO/MBO)', priceEur: 100, watermark: false, somtoday: true, codeMatch: false },
  'edu-premium': { name: 'EDU Premium', priceEur: 250, watermark: false, somtoday: true, codeMatch: true },
  'enterprise': { name: 'Enterprise', priceEur: 0, watermark: false, somtoday: true, codeMatch: true }
};

/**
 * GET /api/edu/tiers
 * Publieke lijst van de 5 Locra-EDU licentievormen
 */
router.get('/tiers', (_req, res) => {
  return res.json({ tiers: EDU_TIERS });
});

/**
 * GET /api/edu/licenses/:key/validate
 * PUBLIEK VALIDATIE-ENDPOINT voor Locra Core schoolservers
 * Wordt aangeroepen wanneer een school een LOCRA-XXXX sleutel invult in het admin dashboard.
 */
router.get('/licenses/:key/validate', async (req, res) => {
  try {
    const rawKey = (req.params.key || '').trim().toUpperCase();
    const { LocraEduLicense } = getModels();

    if (!rawKey) {
      return res.status(400).json({ valid: false, error: 'Licentiesleutel ontbreekt.' });
    }

    const license = await LocraEduLicense.findOne({ key: rawKey });
    if (!license) {
      return res.status(404).json({
        valid: false,
        error: 'Ongeldige licentiesleutel. Neem contact op met support@locra.nl.'
      });
    }

    // Controleer vervaldatum
    const isExpired = license.expiresAt && new Date() > new Date(license.expiresAt);
    if (isExpired || license.status !== 'active') {
      return res.status(403).json({
        valid: false,
        status: license.status,
        isExpired,
        error: 'Deze schoollicentie is verlopen of gedeactiveerd.'
      });
    }

    // Stuur actieve licentiestatus en ontgrendelde functies terug naar de schoolserver
    return res.json({
      valid: true,
      key: license.key,
      tier: license.tier,
      tierName: EDU_TIERS[license.tier]?.name || license.tier,
      schoolName: license.schoolName,
      studentLimit: license.studentLimit,
      branding: license.branding,
      features: {
        withoutWatermark: license.tier !== 'edu-free' && license.tier !== 'edu-basic',
        somtodayIntegration: license.tier === 'edu-plus' || license.tier === 'edu-premium' || license.tier === 'enterprise',
        codeMatchEnabled: license.tier === 'edu-premium' || license.tier === 'enterprise',
        studentCare113: true,
        zeroTelemetry: license.tier !== 'edu-free' && license.tier !== 'edu-basic'
      },
      expiresAt: license.expiresAt,
      verifiedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('License validation error:', err);
    return res.status(500).json({ valid: false, error: 'Fout bij valideren licentie.' });
  }
});

/**
 * GET /api/edu/licenses
 * Haal alle schoollicenties van de ingelogde gebruiker op
 */
router.get('/licenses', requireAuth, async (req, res) => {
  try {
    const { LocraEduLicense } = getModels();
    const licenses = await LocraEduLicense.find({ ownerUserId: req.user._id });
    return res.json({ licenses });
  } catch (err) {
    return res.status(500).json({ error: 'Fout bij ophalen licenties.' });
  }
});

/**
 * POST /api/edu/licenses
 * Maak een nieuwe Locra-EDU licentie aan
 */
router.post('/licenses', requireAuth, async (req, res) => {
  try {
    const { schoolName, contactName, contactEmail, contactPhone, tier, serverUrl } = req.body;
    const { LocraEduLicense, BillingInvoice } = getModels();

    if (!schoolName || !contactEmail) {
      return res.status(400).json({ error: 'Schoolnaam en contact e-mailadres zijn verplicht.' });
    }

    const selectedTier = tier || 'edu-plus';
    const key = LocraEduLicense.generateLicenseKey();

    const license = await LocraEduLicense.create({
      key,
      ownerUserId: req.user._id,
      schoolName: schoolName.trim(),
      contactName: contactName ? contactName.trim() : req.user.name,
      contactEmail: contactEmail.toLowerCase().trim(),
      contactPhone: contactPhone || '',
      tier: selectedTier,
      serverUrl: serverUrl || '',
      status: 'active',
      features: {
        withoutWatermark: selectedTier !== 'edu-free' && selectedTier !== 'edu-basic',
        somtodayIntegration: selectedTier === 'edu-plus' || selectedTier === 'edu-premium' || selectedTier === 'enterprise',
        codeMatchEnabled: selectedTier === 'edu-premium' || selectedTier === 'enterprise',
        studentCare113: true,
        zeroTelemetry: selectedTier !== 'edu-free' && selectedTier !== 'edu-basic'
      }
    });

    // Maak optioneel direct factuur aan als het een betaalde tier is
    const price = EDU_TIERS[selectedTier]?.priceEur || 0;
    if (price > 0 && BillingInvoice) {
      await BillingInvoice.create({
        invoiceNumber: BillingInvoice.generateInvoiceNumber(),
        userId: req.user._id,
        type: 'edu-license',
        title: `Locra-EDU Jaarlicentie (${EDU_TIERS[selectedTier].name}) — ${schoolName}`,
        amountEur: price,
        status: 'pending'
      });
    }

    return res.status(201).json({
      success: true,
      message: `Licentie voor ${schoolName} succesvol aangemaakt!`,
      license
    });
  } catch (err) {
    console.error('License creation error:', err);
    return res.status(500).json({ error: 'Fout bij aanmaken licentie.' });
  }
});

/**
 * PATCH /api/edu/licenses/:id/branding
 * Pas schoolbranding aan (eigen schoollogo, hoofdkleur, domein)
 */
router.patch('/licenses/:id/branding', requireAuth, async (req, res) => {
  try {
    const { LocraEduLicense } = getModels();
    const license = await LocraEduLicense.findOne({ _id: req.params.id, ownerUserId: req.user._id });

    if (!license) {
      return res.status(404).json({ error: 'Licentie niet gevonden.' });
    }

    if (license.tier === 'edu-free' || license.tier === 'edu-basic') {
      return res.status(403).json({
        error: 'Custom branding en het verwijderen van watermerken is beschikbaar vanaf EDU-Plus. Upgrade je licentie.'
      });
    }

    const { logoUrl, primaryColor, schoolDomain, customFooterText } = req.body;
    if (logoUrl !== undefined) license.branding.logoUrl = logoUrl;
    if (primaryColor !== undefined) license.branding.primaryColor = primaryColor;
    if (schoolDomain !== undefined) license.branding.schoolDomain = schoolDomain;
    if (customFooterText !== undefined) license.branding.customFooterText = customFooterText;

    await license.save();

    return res.json({
      success: true,
      message: 'Schoolbranding succesvol bijgewerkt.',
      branding: license.branding
    });
  } catch (err) {
    return res.status(500).json({ error: 'Fout bij updaten branding.' });
  }
});

module.exports = router;

