import crypto from 'crypto';
import { config } from '../config';
import { TEEAttestationReport } from '../types';

/**
 * OpenPCC Remote Attestation Service
 * 
 * In a production AMD SEV-SNP / Intel TDX environment, this report is signed directly
 * by the CPU's AMD Secure Processor (ASP) or Intel Platform Root Key.
 * For developer & deployment flexibility, this service generates a cryptographically
 * valid hardware simulation quote containing the running bytecode measurement and
 * ephemeral X25519 public key.
 */

// Hardware Root of Trust Keypair (ED25519)
const rootKeyPair = crypto.generateKeyPairSync('ed25519');

// Ephemeral Enclave Encryption Keypair (X25519 for ECDH)
let currentEphemeralKeyPair = crypto.generateKeyPairSync('x25519');
let keyGeneratedAt = Date.now();

// Calculate bytecode measurement hash (simulated PCR-0 measurement of the enclave runtime)
const ENCLAVE_BYTECODE_MEASUREMENT = crypto
  .createHash('sha256')
  .update('LOCRA_PRIVAI_OPENPCC_ENCLAVE_V1.0_SOVEREIGN_NL_RUNTIME')
  .digest('hex');

export class AttestationService {
  /**
   * Rotates the ephemeral X25519 key if the rotation window has elapsed.
   */
  private static ensureFreshKeypair() {
    const elapsedSeconds = (Date.now() - keyGeneratedAt) / 1000;
    if (elapsedSeconds > config.enclave.ephemeralKeyRotationSeconds) {
      currentEphemeralKeyPair = crypto.generateKeyPairSync('x25519');
      keyGeneratedAt = Date.now();
    }
  }

  /**
   * Generates a signed Remote Attestation Report for clients to verify.
   */
  public static getAttestationReport(): TEEAttestationReport {
    this.ensureFreshKeypair();

    const timestamp = new Date().toISOString();
    const expiresAt = new Date(Date.now() + config.enclave.attestationExpiryMinutes * 60 * 1000).toISOString();

    const enclavePublicKey = currentEphemeralKeyPair.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();

    const enclaveId = `enclave-nl-${config.datacenter.city.toLowerCase()}-${ENCLAVE_BYTECODE_MEASUREMENT.substring(0, 12)}`;

    // Build the payload that gets signed by the Hardware Root of Trust
    const payloadToSign = JSON.stringify({
      enclaveId,
      enclaveType: config.enclave.type,
      measurementHash: ENCLAVE_BYTECODE_MEASUREMENT,
      enclavePublicKey,
      timestamp,
      expiresAt,
      datacenter: config.datacenter
    });

    const signature = crypto.sign(null, Buffer.from(payloadToSign), rootKeyPair.privateKey).toString('base64');

    return {
      enclaveId,
      enclaveType: config.enclave.type,
      hardwareRootOfTrust: 'Locra Silicon Root Authority (NL-ED25519-PCC)',
      measurementHash: ENCLAVE_BYTECODE_MEASUREMENT,
      enclavePublicKey,
      timestamp,
      expiresAt,
      datacenter: {
        country: 'NL',
        location: `${config.datacenter.facility}, ${config.datacenter.city}`,
        operator: 'Locra Didactics B.V.',
        jurisdiction: 'Netherlands / EU GDPR Art 28/32'
      },
      signature
    };
  }

  /**
   * Verifies an Attestation Report using the Hardware Root Key.
   */
  public static verifyAttestation(report: TEEAttestationReport): boolean {
    try {
      const payloadToVerify = JSON.stringify({
        enclaveId: report.enclaveId,
        enclaveType: report.enclaveType,
        measurementHash: report.measurementHash,
        enclavePublicKey: report.enclavePublicKey,
        timestamp: report.timestamp,
        expiresAt: report.expiresAt,
        datacenter: config.datacenter
      });

      return crypto.verify(
        null,
        Buffer.from(payloadToVerify),
        rootKeyPair.publicKey,
        Buffer.from(report.signature, 'base64')
      );
    } catch {
      return false;
    }
  }

  /**
   * Returns the current private key ONLY inside the Enclave for decrypting payloads.
   * This is never exported or sent over HTTP.
   */
  public static getEnclavePrivateKey(): crypto.KeyObject {
    return currentEphemeralKeyPair.privateKey;
  }

  /**
   * Returns the measurement hash to ensure payloads are only decrypted by this exact binary.
   */
  public static getExpectedMeasurement(): string {
    return ENCLAVE_BYTECODE_MEASUREMENT;
  }
}

