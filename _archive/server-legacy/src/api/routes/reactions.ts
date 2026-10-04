import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';

export default async function reactionRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Add reaction
  fastify.post('/:messageId/reactions', async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const { emoji } = request.body as { emoji: string };
    
    if (!emoji) return reply.code(400).send({ error: 'Emoji is verplicht' });

    try {
      const reaction = await prisma.messageReaction.create({
        data: {
          messageId,
          userId: request.user!.id,
          emoji
        }
      });
      return reaction;
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Already reacted with this emoji, ignore
        return reply.code(200).send({ success: true, message: 'Already reacted' });
      }
      return reply.code(500).send({ error: 'Fout bij toevoegen reactie' });
    }
  });

  // Remove reaction
  fastify.delete('/:messageId/reactions', async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const { emoji } = request.body as { emoji: string };

    try {
      await prisma.messageReaction.deleteMany({
        where: {
          messageId,
          userId: request.user!.id,
          emoji
        }
      });
      return { success: true };
    } catch (err) {
      return reply.code(500).send({ error: 'Fout bij verwijderen reactie' });
    }
  });
}
