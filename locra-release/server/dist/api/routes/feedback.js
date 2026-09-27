"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = feedbackRoutes;
const index_1 = require("../../index");
const auth_1 = require("../../middleware/auth");
async function feedbackRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.requireAuth);
    // Submit feedback on a message
    fastify.post('/', async (request, reply) => {
        const { messageId, rating, reason } = request.body;
        if (!messageId || !rating)
            return reply.status(400).send({ error: 'messageId and rating required' });
        // Prevent duplicate feedback
        const existing = await index_1.prisma.feedback.findFirst({
            where: { messageId, userId: request.user.id }
        });
        if (existing) {
            // Update existing
            const updated = await index_1.prisma.feedback.update({
                where: { id: existing.id },
                data: { rating, reason }
            });
            return updated;
        }
        const fb = await index_1.prisma.feedback.create({
            data: {
                messageId,
                userId: request.user.id,
                rating,
                reason
            }
        });
        return fb;
    });
    // Get feedback for a message
    fastify.get('/:messageId', async (request, reply) => {
        const { messageId } = request.params;
        const fb = await index_1.prisma.feedback.findFirst({
            where: { messageId, userId: request.user.id }
        });
        return fb || { rating: null };
    });
}
