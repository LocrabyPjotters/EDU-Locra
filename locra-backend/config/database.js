const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const UserSchema = require('../models/rowmatch/User');
const LocraEduLicenseSchema = require('../models/locra/LocraEduLicense');
const PrivAiSubscriptionSchema = require('../models/locra/PrivAiSubscription');
const PrivAiApiKeySchema = require('../models/locra/PrivAiApiKey');
const BillingInvoiceSchema = require('../models/locra/BillingInvoice');

const connections = {
  rowmatch: null,
  locra: null
};

const models = {
  User: null,
  LocraEduLicense: null,
  PrivAiSubscription: null,
  PrivAiApiKey: null,
  BillingInvoice: null
};

const connectDatabases = async () => {
  const baseUri = process.env.MONGO_BASE_URI || 'mongodb://localhost:27017';
  const rowmatchUri = process.env.MONGO_ROWMATCH_URI || `${baseUri}/rowmatch`;
  const locraUri = process.env.MONGO_LOCRA_URI || `${baseUri}/locra`;

  console.log('🔌 [Locra Backend] Verbinden met MongoDB databases...');
  console.log(`   ▸ RowMatch Auth DB: ${rowmatchUri}`);
  console.log(`   ▸ Locra License DB:  ${locraUri}`);

  try {
    // 1. Verbind met RowMatch DB (Users & Pjotters accounts)
    connections.rowmatch = mongoose.createConnection(rowmatchUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });

    await new Promise((resolve, reject) => {
      connections.rowmatch.on('connected', resolve);
      connections.rowmatch.on('error', (err) => {
        console.warn('⚠️ [RowMatch DB] Waarschuwing bij verbinden:', err.message);
        resolve(); // Niet crashen in test/offline modus
      });
    });

    models.User = connections.rowmatch.models.User || connections.rowmatch.model('User', UserSchema);
    console.log('   ✓ RowMatch Users model geregistreerd');

    // 2. Verbind met dedicated Locra DB (EDU Licenties, PrivAI bundels, API Keys, Facturen)
    connections.locra = mongoose.createConnection(locraUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });

    await new Promise((resolve, reject) => {
      connections.locra.on('connected', resolve);
      connections.locra.on('error', (err) => {
        console.warn('⚠️ [Locra DB] Waarschuwing bij verbinden:', err.message);
        resolve();
      });
    });

    models.LocraEduLicense = connections.locra.models.LocraEduLicense || connections.locra.model('LocraEduLicense', LocraEduLicenseSchema);
    models.PrivAiSubscription = connections.locra.models.PrivAiSubscription || connections.locra.model('PrivAiSubscription', PrivAiSubscriptionSchema);
    models.PrivAiApiKey = connections.locra.models.PrivAiApiKey || connections.locra.model('PrivAiApiKey', PrivAiApiKeySchema);
    models.BillingInvoice = connections.locra.models.BillingInvoice || connections.locra.model('BillingInvoice', BillingInvoiceSchema);
    console.log('   ✓ Locra EDU, PrivAI & Billing models geregistreerd');

    return { connections, models };
  } catch (err) {
    console.error('❌ Fout bij verbinden met databases:', err);
    throw err;
  }
};

const getModels = () => models;
const getConnections = () => connections;

module.exports = {
  connectDatabases,
  getModels,
  getConnections
};

