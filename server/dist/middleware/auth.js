"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const crypto_1 = require("../utils/crypto");
async function requireAuth(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Unauthorized: Missing or invalid token format' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = (0, crypto_1.verifyToken)(token);
        request.user = decoded;
    }
    catch (err) {
        return reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
    }
}
