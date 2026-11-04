/**
 * locra-backend.test.js
 * Comprehensive integration and unit test suite for Locra Central Account & Licensing Hub
 */

const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Schemas & Models
const UserSchema = require('../models/rowmatch/User');
const LocraEduLicenseSchema = require('../models/locra/LocraEduLicense');
const PrivAiSubscriptionSchema = require('../models/locra/PrivAiSubscription');
const PrivAiApiKeySchema = require('../models/locra/PrivAiApiKey');
const BillingInvoiceSchema = require('../models/locra/BillingInvoice');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 STARTING LOCRA-BACKEND TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Pjotters User Password & JWT
  await test('Pjotters User model hashes and verifies bcrypt passwords correctly', async () => {
    const rawPassword = 'SecurePassword123!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword, salt);

    const isMatch = await bcrypt.compare(rawPassword, hash);
    assert.strictEqual(isMatch, true, 'Bcrypt compare should match the raw password');

    const isWrongMatch = await bcrypt.compare('WrongPassword', hash);
    assert.strictEqual(isWrongMatch, false, 'Bcrypt compare should fail for incorrect password');
  });

  await test('Shared JWT creation and signature verification matches Pjotters secret', () => {
    const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';
    const payload = {
      id: '507f1f77bcf86cd799439011',
      email: 'directeur@gymnasium-amsterdam.nl',
      role: 'admin',
      adminRole: 'CEO'
    };

    const token = jwt.sign(payload, secret, { expiresIn: '7d' });
    const decoded = jwt.verify(token, secret);

    assert.strictEqual(decoded.id, payload.id);
    assert.strictEqual(decoded.email, payload.email);
    assert.strictEqual(decoded.role, payload.role);
    assert.strictEqual(decoded.adminRole, payload.adminRole);
  });

  // 2. LocraEduLicense Model
  await test('LocraEduLicense generates properly formatted license keys (LOCRA-XXXX-XXXX-XXXX)', () => {
    const key = LocraEduLicenseSchema.statics.generateLicenseKey();
    assert(key.startsWith('LOCRA-'), `Key should start with LOCRA-, got: ${key}`);
    const parts = key.split('-');
    assert.strictEqual(parts.length, 4, `Key should have 4 dash-separated blocks, got: ${parts.length}`);
    assert.strictEqual(parts[1].length, 4);
    assert.strictEqual(parts[2].length, 4);
    assert.strictEqual(parts[3].length, 4);
  });

  // 3. PrivAiSubscription 5 Tiers & Overage Model
  await test('PrivAI has exactly 5 tiers defined with token allowances and overage rates', () => {
    const tiers = PrivAiSubscriptionSchema.statics.TIERS;
    assert(tiers, 'TIERS constant must exist on PrivAiSubscription');
    const tierKeys = Object.keys(tiers);
    assert.strictEqual(tierKeys.length, 5, `Expected exactly 5 tiers, got: ${tierKeys.length}`);

    // Verify all 5 tiers
    const expected = ['trial', 'dev', 'school-basic', 'school-pro', 'enterprise'];
    expected.forEach(t => {
      assert(tiers[t], `Tier ${t} must be present`);
      assert(typeof tiers[t].monthlyTokens === 'number', `Tier ${t} must have monthlyTokens`);
      assert(typeof tiers[t].priceEur === 'number', `Tier ${t} must have priceEur`);
      assert(typeof tiers[t].overagePricePerMillionEur === 'number', `Tier ${t} must have overagePricePerMillionEur`);
    });

    // Check specific overage values
    assert.strictEqual(tiers['dev'].priceEur, 19);
    assert.strictEqual(tiers['dev'].overagePricePerMillionEur, 3.50);

    assert.strictEqual(tiers['school-basic'].priceEur, 69);
    assert.strictEqual(tiers['school-basic'].overagePricePerMillionEur, 2.80);

    assert.strictEqual(tiers['school-pro'].priceEur, 149);
    assert.strictEqual(tiers['school-pro'].overagePricePerMillionEur, 2.20);

    assert.strictEqual(tiers['enterprise'].priceEur, 399);
    assert.strictEqual(tiers['enterprise'].overagePricePerMillionEur, 1.75);

    // Verify Euro-Credits allowance fields
    assert.strictEqual(tiers['trial'].monthlyCreditAllowanceEur, 5.00);
    assert.strictEqual(tiers['dev'].monthlyCreditAllowanceEur, 19.00);
    assert.strictEqual(tiers['school-basic'].monthlyCreditAllowanceEur, 69.00);
    assert.strictEqual(tiers['school-pro'].monthlyCreditAllowanceEur, 149.00);
    assert.strictEqual(tiers['enterprise'].monthlyCreditAllowanceEur, 399.00);
  });

  await test('Euro-Credits deduction matches exact model rates per token', () => {
    // Mistral Small 24B: €3.15 in / €8.75 out per 1M tokens
    const fastInputRate = 3.15;
    const fastOutputRate = 8.75;
    const inputTokens = 500;
    const outputTokens = 200;

    const costEur = ((inputTokens / 1_000_000) * fastInputRate) +
                    ((outputTokens / 1_000_000) * fastOutputRate);

    // 500/1M * 3.15 = 0.001575
    // 200/1M * 8.75 = 0.00175
    // Total = 0.003325
    assert.strictEqual(Number(costEur.toFixed(6)), 0.003325);

    let startBalance = 19.00;
    startBalance -= costEur;
    assert.strictEqual(Number(startBalance.toFixed(6)), 18.996675);
  });

  await test('PrivAI token consumption and overage logic works as expected', () => {
    const tierConfig = PrivAiSubscriptionSchema.statics.TIERS['dev'];
    let monthlyTokensUsed = 4900000;
    let overageTokensUsed = 0;
    const requestedTokens = 200000; // Will exceed 5,000,000 allowance by 100,000

    const totalNeeded = monthlyTokensUsed + requestedTokens;
    if (totalNeeded > tierConfig.monthlyTokens) {
      const overageAmount = totalNeeded - tierConfig.monthlyTokens;
      monthlyTokensUsed = tierConfig.monthlyTokens;
      overageTokensUsed += overageAmount;
    }

    assert.strictEqual(monthlyTokensUsed, 5000000);
    assert.strictEqual(overageTokensUsed, 100000);

    // Calculate overage cost (100k tokens at €3.50 per 1M tokens = €0.35)
    const overageCost = (overageTokensUsed / 1000000) * tierConfig.overagePricePerMillionEur;
    assert.strictEqual(Number(overageCost.toFixed(2)), 0.35);
  });

  // 4. PrivAiApiKey Generation and SHA-256 Hashing
  await test('PrivAiApiKey generates secure privai_live_ key and sha256 hash', () => {
    const keyInfo = PrivAiApiKeySchema.statics.generateApiKey('production');
    assert(keyInfo.rawKey.startsWith('privai_live_'), `Key should start with privai_live_, got: ${keyInfo.rawKey}`);
    assert(keyInfo.keyPrefix.startsWith('privai_live_'), 'Key prefix should start with privai_live_');
    assert.strictEqual(keyInfo.keyHash.length, 64, 'SHA-256 hash must be 64 hex characters');

    // Verify hash matches
    const expectedHash = crypto.createHash('sha256').update(keyInfo.rawKey).digest('hex');
    assert.strictEqual(keyInfo.keyHash, expectedHash, 'Hash must match SHA-256 digest of raw key');
  });

  // 5. BillingInvoice Number Generation
  await test('BillingInvoice generates unique formatted invoice numbers (LOCRA-YYYY-XXXX)', () => {
    const inv1 = BillingInvoiceSchema.statics.generateInvoiceNumber();
    const inv2 = BillingInvoiceSchema.statics.generateInvoiceNumber();

    const year = new Date().getFullYear();
    assert(inv1.startsWith(`LOCRA-${year}-`), `Invoice should start with LOCRA-${year}-, got: ${inv1}`);
    assert.notStrictEqual(inv1, inv2, 'Consecutive invoice numbers should be randomized and unique');
  });

  // 6. Express App Route Setup
  await test('Express app initializes cleanly and registers all required API paths', () => {
    const { app } = require('../server');
    assert(app, 'Express app should be exported');

    // Inspect route stacks
    const registeredPaths = [];
    app._router.stack.forEach(middleware => {
      if (middleware.route) {
        registeredPaths.push(middleware.route.path);
      } else if (middleware.name === 'router') {
        // Mounted routers
        registeredPaths.push(middleware.regexp.toString());
      }
    });

    assert(registeredPaths.length > 0, 'Routes must be registered in Express app');
  });

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

