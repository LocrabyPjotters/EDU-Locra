"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const index_1 = require("../../index");
const crypto_1 = require("../../utils/crypto");
async function authRoutes(fastify) {
    fastify.post('/login', async (request, reply) => {
        const { username, password } = request.body;
        if (!username || !password) {
            return reply.status(400).send({ error: 'Username and password required' });
        }
        const user = await index_1.prisma.user.findFirst({
            where: { username }
        });
        if (!user || !user.passwordHash) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        if (!user.isActive) {
            return reply.status(403).send({ error: 'Account is disabled' });
        }
        const isValid = await (0, crypto_1.verifyPassword)(password, user.passwordHash);
        if (!isValid) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const token = (0, crypto_1.generateToken)({
            id: user.id,
            orgId: user.orgId,
            role: user.role
        });
        // Log the action
        await index_1.prisma.auditLog.create({
            data: {
                orgId: user.orgId,
                userId: user.id,
                action: 'user.login',
                ipAddress: request.ip
            }
        });
        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                displayName: user.displayName
            }
        };
    });
    fastify.post('/forgot-password', async (request, reply) => {
        const { email } = request.body;
        if (!email)
            return reply.status(400).send({ error: 'Email required' });
        const user = await index_1.prisma.user.findFirst({
            where: { email, isActive: true },
            include: { org: true }
        });
        if (!user) {
            // Return 200 even if not found for security reasons
            return reply.send({ success: true });
        }
        const { randomBytes } = await Promise.resolve().then(() => __importStar(require('crypto')));
        const resetToken = randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
        await index_1.prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpiry }
        });
        const resetLink = `http://${request.headers.host}/reset-password?token=${resetToken}`;
        try {
            const { sendEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/mailer')));
            await sendEmail(user.orgId, user.email, 'Wachtwoord Herstellen - Locra', `<p>Beste ${user.displayName},</p><p>Je hebt een wachtwoord herstel aangevraagd. Klik op de volgende link om een nieuw wachtwoord in te stellen:</p><p><a href="${resetLink}">Wachtwoord herstellen</a></p><p>Deze link is 1 uur geldig.</p>`);
        }
        catch (e) {
            console.error('Email failed:', e);
            // Even if email fails, for security we don't expose it to user (maybe could return 500 but standard is 200)
        }
        return reply.send({ success: true });
    });
    fastify.post('/reset-password', async (request, reply) => {
        const { token, newPassword } = request.body;
        if (!token || !newPassword)
            return reply.status(400).send({ error: 'Token and new password required' });
        const user = await index_1.prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: { gt: new Date() }
            }
        });
        if (!user) {
            return reply.status(400).send({ error: 'Ongeldig of verlopen token' });
        }
        const { hashPassword } = await Promise.resolve().then(() => __importStar(require('../../utils/crypto')));
        const passwordHash = await hashPassword(newPassword);
        await index_1.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                resetToken: null,
                resetTokenExpiry: null
            }
        });
        return reply.send({ success: true });
    });
}
