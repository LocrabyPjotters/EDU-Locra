import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SALT_ROUNDS = 12; // Verhoogd naar 12 voor robuuste enterprise bescherming
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'locra-secure-platform-salt-key-education-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: object, expiresInSeconds: number = 86400 * 3): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is niet geconfigureerd');
  return jwt.sign(payload, secret, { expiresIn: expiresInSeconds });
}

export function verifyToken(token: string): any {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is niet geconfigureerd');
  return jwt.verify(token, secret);
}

/**
 * Versleutelt een tekst (zoals chatberichten of API-sleutels) met AES-256-GCM.
 */
export function encryptMessage(text: string): string {
  if (!text) return text;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Formaat: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Ontsleutelt een met AES-256-GCM versleutelde tekst.
 */
export function decryptMessage(encryptedStr: string): string {
  if (!encryptedStr) return encryptedStr;
  try {
    const key = getEncryptionKey();
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) return encryptedStr; // Niet versleuteld of ander formaat
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    return "Decryptie mislukt (bericht is onleesbaar)";
  }
}

/**
 * Encryptie van Cloud API keys at-rest.
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey || apiKey.startsWith('enc_aes256_')) return apiKey;
  const encrypted = encryptMessage(apiKey);
  return `enc_aes256_${encrypted}`;
}

/**
 * Decryptie van Cloud API keys.
 */
export function decryptApiKey(storedKey?: string | null): string | undefined {
  if (!storedKey) return undefined;
  if (storedKey.startsWith('enc_aes256_')) {
    const rawEncrypted = storedKey.replace('enc_aes256_', '');
    const decrypted = decryptMessage(rawEncrypted);
    return decrypted.startsWith('Decryptie mislukt') ? undefined : decrypted;
  }
  return storedKey; // Legacy plain text key
}
