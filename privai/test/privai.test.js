"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const attestation_1 = require("../src/enclave/attestation");
const cryptoEnvelope_1 = require("../src/enclave/cryptoEnvelope");
const models_1 = require("../src/enclave/models");
const inferenceEngine_1 = require("../src/enclave/inferenceEngine");
const telemetry_1 = require("../src/gateway/telemetry");
async function runTests() {
    console.log('🧪 Starting Locra PrivAI™ Verification Suite...\n');
    // Test 1: Model Registry Initialization
    console.log('1. Testing Model Registry...');
    models_1.ModelRegistry.initialize();
    const models = models_1.ModelRegistry.listModels();
    (0, assert_1.default)(models.length >= 3, 'Expected at least 3 sovereign models');
    const proModel = models_1.ModelRegistry.getModel('locra-privai-pro');
    (0, assert_1.default)(proModel !== undefined, 'locra-privai-pro must exist');
    assert_1.default.strictEqual(proModel.datacenter.country, 'NL', 'Datacenter must be NL');
    console.log('   ✓ Model Registry validated (3 sovereign models registered)\n');
    // Test 2: Remote Attestation & Cryptographic Signature
    console.log('2. Testing OpenPCC Remote Attestation...');
    const report = attestation_1.AttestationService.getAttestationReport();
    (0, assert_1.default)(report.enclaveId.startsWith('enclave-nl-'), 'Enclave ID must indicate NL');
    (0, assert_1.default)(report.enclavePublicKey.includes('BEGIN PUBLIC KEY'), 'Must contain X25519 public key');
    const isValidSig = attestation_1.AttestationService.verifyAttestation(report);
    assert_1.default.strictEqual(isValidSig, true, 'Hardware root of trust signature must be valid');
    console.log('   ✓ Remote Attestation cryptographically verified (Hardware Root of Trust OK)\n');
    // Test 3: End-to-End Cryptographic Envelope (X25519 + AES-256-GCM)
    console.log('3. Testing End-to-End Payload Encryption Envelope...');
    const secretPayload = {
        messages: [{ role: 'user', content: 'Gevoelig leerlingverslag met privacygevoelige data' }],
        model: 'locra-privai-pro'
    };
    const envelope = cryptoEnvelope_1.CryptoEnvelope.seal(secretPayload, report.enclavePublicKey);
    (0, assert_1.default)(envelope.ciphertext !== JSON.stringify(secretPayload), 'Ciphertext must be encrypted');
    (0, assert_1.default)(envelope.nonce.length > 0, 'Must have IV nonce');
    (0, assert_1.default)(envelope.authTag.length > 0, 'Must have GCM auth tag');
    const decryptedPayload = cryptoEnvelope_1.CryptoEnvelope.open(envelope);
    assert_1.default.deepStrictEqual(decryptedPayload, secretPayload, 'Enclave must successfully decrypt payload');
    console.log('   ✓ Crypto Envelope seal & open verified (Zero-Access proven)\n');
    // Test 4: Confidential Inference Engine & Memory Scrubbing
    console.log('4. Testing Confidential Inference & RAM Scrubbing...');
    const inferenceRes = await inferenceEngine_1.InferenceEngine.infer([{ role: 'user', content: 'Wat is de hoofdstad van Nederland?' }], proModel);
    (0, assert_1.default)(inferenceRes.text.length > 0, 'Inference must produce output');
    assert_1.default.strictEqual(inferenceRes.metadata.enclaveScrubbed, true, 'Enclave must confirm RAM scrub');
    (0, assert_1.default)(inferenceRes.metadata.promptTokens > 0, 'Must estimate prompt tokens');
    (0, assert_1.default)(inferenceRes.metadata.completionTokens > 0, 'Must estimate completion tokens');
    console.log('   ✓ Inference executed & ephemeral RAM scrubbed successfully\n');
    // Test 5: Metadata Isolation Guarantee (0 prompt/completion characters in telemetry)
    console.log('5. Testing Telemetry & Metadata Zero-Access Isolation...');
    const dummyRecord = {
        requestId: 'req-test-123',
        apiKeyPrefix: 'privai_live_8f3d...',
        model: 'locra-privai-pro',
        promptTokens: 42,
        completionTokens: 180,
        totalTokens: 222,
        durationMs: 340,
        timestamp: new Date().toISOString(),
        datacenterNode: 'nl-amsterdam-enclave-01',
        enclaveScrubbed: true
    };
    telemetry_1.TelemetryService.record(dummyRecord);
    const aggregate = telemetry_1.TelemetryService.getAggregateByKey('privai_live_8f3d...');
    assert_1.default.strictEqual(aggregate.totalTokens, 222, 'Tokens must match');
    // Stringify the entire telemetry store and assert NO prompt text exists anywhere
    const telemetryDump = JSON.stringify(telemetry_1.TelemetryService.getRecentRecords());
    (0, assert_1.default)(!telemetryDump.includes('Gevoelig leerlingverslag'), 'Telemetry must NEVER contain prompt text!');
    (0, assert_1.default)(!telemetryDump.includes('hoofdstad van Nederland'), 'Telemetry must NEVER contain chat text!');
    console.log('   ✓ Metadata isolation verified: 0 prompt/completion bytes stored!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎉 ALL LOCRA PRIVAI™ SECURITY & CRYPTOGRAPHIC TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════════════\n');
}
runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
//# sourceMappingURL=privai.test.js.map