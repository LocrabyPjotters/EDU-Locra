"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.encryptMessage = encryptMessage;
exports.decryptMessage = decryptMessage;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const SALT_ROUNDS = 10;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
async function hashPassword(password) {
    return bcryptjs_1.default.hash(password, SALT_ROUNDS);
}
async function verifyPassword(password, hash) {
    return bcryptjs_1.default.compare(password, hash);
}
function generateToken(payload, expiresInSeconds = 604800) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET is not defined');
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn: expiresInSeconds });
}
function verifyToken(token) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET is not defined');
    return jsonwebtoken_1.default.verify(token, secret);
}
function encryptMessage(text) {
    const secret = process.env.JWT_SECRET || 'fallback-secret-for-encryption-locra';
    const key = crypto_1.default.createHash('sha256').update(secret).digest(); // 32 bytes for aes-256
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}
function decryptMessage(encryptedStr) {
    try {
        const secret = process.env.JWT_SECRET || 'fallback-secret-for-encryption-locra';
        const key = crypto_1.default.createHash('sha256').update(secret).digest();
        const parts = encryptedStr.split(':');
        if (parts.length !== 3)
            return "Bericht is onleesbaar (corrupte encryptie)";
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];
        const decipher = crypto_1.default.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (err) {
        return "Decryptie mislukt (bericht is onleesbaar)";
    }
}
