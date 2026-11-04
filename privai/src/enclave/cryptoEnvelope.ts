import crypto from 'crypto';
import { EncryptedPayloadEnvelope } from '../types';
import { AttestationService } from './attestation';

/**
 * End-to-End Cryptographic Envelope using X25519 ECDH + HKDF-SHA256 + AES-256-GCM.
 * This guarantees that even the Locra API Gateway sees ONLY random ciphertext.
 */
export class CryptoEnvelope {
  /**
   * CLIENT-SIDE: Seals a plaintext payload into an encrypted envelope destined ONLY for the enclave.
   */
  public static seal(plaintextObject: any, enclavePublicKeyPem: string): EncryptedPayloadEnvelope {
    // 1. Generate an ephemeral client X25519 keypair
    const clientEphemeral = crypto.generateKeyPairSync('x25519');

    // 2. Import the Enclave's public key
    const enclavePubKey = crypto.createPublicKey(enclavePublicKeyPem);

    // 3. Perform Diffie-Hellman Key Agreement (ECDH)
    const sharedSecret = crypto.diffieHellman({
      privateKey: clientEphemeral.privateKey,
      publicKey: enclavePubKey
    });

    // 4. Derive AES-256 Key using HKDF (RFC 5869)
    const salt = Buffer.from('LOCRA_PRIVAI_OPENPCC_SALT_V1');
    const info = Buffer.from('ENCLAVE_PAYLOAD_ENCRYPTION');
    const symmetricKey = crypto.hkdfSync('sha256', sharedSecret, salt, info, 32);

    // 5. Encrypt with AES-256-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(symmetricKey), iv);

    const serialized = JSON.stringify(plaintextObject);
    let ciphertext = cipher.update(serialized, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    // Export client public key to send with envelope
    const ephemeralClientPublicKey = clientEphemeral.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();

    return {
      ephemeralClientPublicKey,
      nonce: iv.toString('base64'),
      authTag,
      ciphertext,
      targetEnclaveMeasurement: AttestationService.getExpectedMeasurement()
    };
  }

  /**
   * ENCLAVE-SIDE: Opens the envelope inside the hardware-protected RAM of the TEE.
   */
  public static open(envelope: EncryptedPayloadEnvelope): any {
    // 1. Verify target enclave measurement matches
    const currentMeasurement = AttestationService.getExpectedMeasurement();
    if (envelope.targetEnclaveMeasurement && envelope.targetEnclaveMeasurement !== currentMeasurement) {
      throw new Error('Cryptographic Attestation Mismatch: Payload was encrypted for a different enclave bytecode!');
    }

    // 2. Import Client's ephemeral public key
    const clientPubKey = crypto.createPublicKey(envelope.ephemeralClientPublicKey);

    // 3. Compute shared secret using Enclave's private key
    const enclavePrivKey = AttestationService.getEnclavePrivateKey();
    const sharedSecret = crypto.diffieHellman({
      privateKey: enclavePrivKey,
      publicKey: clientPubKey
    });

    // 4. Derive the exact same AES-256 Key using HKDF
    const salt = Buffer.from('LOCRA_PRIVAI_OPENPCC_SALT_V1');
    const info = Buffer.from('ENCLAVE_PAYLOAD_ENCRYPTION');
    const symmetricKey = crypto.hkdfSync('sha256', sharedSecret, salt, info, 32);

    // 5. Decrypt using AES-256-GCM with Auth Tag Verification
    const iv = Buffer.from(envelope.nonce, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(symmetricKey), iv);
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));

    let decrypted = decipher.update(envelope.ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }
}

