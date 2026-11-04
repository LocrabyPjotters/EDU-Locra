const mongoose = require('mongoose');

const BillingInvoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['edu-license', 'privai-subscription', 'privai-overage', 'privai-topup'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  amountEur: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'canceled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['ideal', 'bank_transfer', 'creditcard', 'mollie', 'stripe'],
    default: 'ideal'
  },
  molliePaymentId: {
    type: String,
    default: ''
  },
  paidAt: {
    type: Date,
    default: null
  },
  dueDate: {
    type: Date,
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

BillingInvoiceSchema.statics.generateInvoiceNumber = function() {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `LOCRA-${year}-${randomNum}`;
};

module.exports = BillingInvoiceSchema;

