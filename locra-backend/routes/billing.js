const express = require('express');
const router = express.Router();
const { getLocraConnection } = require('../config/database');
const BillingInvoiceSchema = require('../models/locra/BillingInvoice');
const LocraEduLicenseSchema = require('../models/locra/LocraEduLicense');
const PrivAiSubscriptionSchema = require('../models/locra/PrivAiSubscription');
const { authMiddleware } = require('../middleware/auth');

function getModels() {
  const conn = getLocraConnection();
  const BillingInvoice = conn.models.BillingInvoice || conn.model('BillingInvoice', BillingInvoiceSchema);
  const LocraEduLicense = conn.models.LocraEduLicense || conn.model('LocraEduLicense', LocraEduLicenseSchema);
  const PrivAiSubscription = conn.models.PrivAiSubscription || conn.model('PrivAiSubscription', PrivAiSubscriptionSchema);
  return { BillingInvoice, LocraEduLicense, PrivAiSubscription };
}

/**
 * GET /api/billing/invoices
 * Get all invoices for the authenticated user
 */
router.get('/invoices', authMiddleware, async (req, res) => {
  try {
    const { BillingInvoice } = getModels();
    const invoices = await BillingInvoice.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      invoices
    });
  } catch (error) {
    console.error('Billing invoices error:', error);
    return res.status(500).json({ success: false, error: 'Kon facturen niet ophalen.' });
  }
});

/**
 * GET /api/billing/invoices/:invoiceNumber
 * Get single invoice detail
 */
router.get('/invoices/:invoiceNumber', authMiddleware, async (req, res) => {
  try {
    const { BillingInvoice } = getModels();
    const invoice = await BillingInvoice.findOne({
      invoiceNumber: req.params.invoiceNumber,
      userId: req.user._id
    }).lean();

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Factuur niet gevonden.' });
    }

    return res.json({
      success: true,
      invoice
    });
  } catch (error) {
    console.error('Invoice detail error:', error);
    return res.status(500).json({ success: false, error: 'Kon factuur niet ophalen.' });
  }
});

/**
 * POST /api/billing/checkout
 * Create an invoice / checkout session
 */
router.post('/checkout', authMiddleware, async (req, res) => {
  try {
    const { type, title, amountEur, paymentMethod = 'ideal', metadata = {} } = req.body;

    if (!type || !title || amountEur === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Type, title en amountEur zijn verplicht.'
      });
    }

    const { BillingInvoice } = getModels();
    const invoiceNumber = BillingInvoice.generateInvoiceNumber();

    const invoice = new BillingInvoice({
      invoiceNumber,
      userId: req.user._id,
      type,
      title,
      amountEur: Number(amountEur),
      paymentMethod,
      status: 'pending',
      notes: metadata.notes || ''
    });

    await invoice.save();

    // In a real environment with Mollie or Stripe, we create the checkout redirect URL here
    const checkoutUrl = `/billing/pay?invoice=${invoiceNumber}`;

    return res.status(201).json({
      success: true,
      message: 'Factuur aangemaakt.',
      invoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        amountEur: invoice.amountEur,
        status: invoice.status,
        dueDate: invoice.dueDate,
        checkoutUrl
      }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ success: false, error: 'Checkout mislukt.' });
  }
});

/**
 * POST /api/billing/webhook
 * Simulate or process payment completion (e.g. from Mollie or iDEAL)
 */
router.post('/webhook', async (req, res) => {
  try {
    const { invoiceNumber, status = 'paid', molliePaymentId } = req.body;

    if (!invoiceNumber) {
      return res.status(400).json({ success: false, error: 'invoiceNumber is verplicht.' });
    }

    const { BillingInvoice } = getModels();
    const invoice = await BillingInvoice.findOne({ invoiceNumber });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Factuur niet gevonden.' });
    }

    invoice.status = status;
    if (status === 'paid') {
      invoice.paidAt = new Date();
    }
    if (molliePaymentId) {
      invoice.molliePaymentId = molliePaymentId;
    }
    await invoice.save();

    return res.json({
      success: true,
      message: `Factuur ${invoiceNumber} status bijgewerkt naar ${status}.`,
      invoice
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ success: false, error: 'Webhook verwerking mislukt.' });
  }
});

module.exports = router;

