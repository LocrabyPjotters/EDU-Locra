"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = reactionRoutes;
const index_1 = require("../../index");
const auth_1 = require("../../middleware/auth");
async function reactionRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.requireAuth);
    // Add reaction
    fastify.post('/:messageId/reactions', async (request, reply) => {
        const { messageId } = request.params;
        const { emoji } = request.body;
        if (!emoji)
            return reply.code(400).send({ error: 'Emoji is verplicht' });
        try {
            const reaction = await index_1.prisma.messageReaction.create({
                data: {
                    messageId,
                    userId: request.user.id,
                    emoji
                }
            });
            return reaction;
        }
        catch (err) {
            if (err.code === 'P2002') {
                // Already reacted with this emoji, ignore
                return reply.code(200).send({ success: true, message: 'Already reacted' });
            }
            return reply.code(500).send({ error: 'Fout bij toevoegen reactie' });
        }
    });
    // Remove reaction
    fastify.delete('/:messageId/reactions', async (request, reply) => {
        const { messageId } = request.params;
        const { emoji } = request.body;
        try {
            await index_1.prisma.messageReaction.deleteMany({
                where: {
                    messageId,
                    userId: request.user.id,
                    emoji
                }
            });
            return { success: true };
        }
        catch (err) {
            return reply.code(500).send({ error: 'Fout bij verwijderen reactie' });
        }
    });
}
