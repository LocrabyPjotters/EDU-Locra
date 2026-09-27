import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';

export default async function feedbackRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Submit feedback on a message
  fastify.post('/', async (request, reply) => {
    const { messageId, rating, reason } = request.body as any;
    if (!messageId || !rating) return reply.status(400).send({ error: 'messageId and rating required' });

    // Prevent duplicate feedback
    const existing = await prisma.feedback.findFirst({
      where: { messageId, userId: request.user!.id }
    });

    if (existing) {
      // Update existing
      const updated = await prisma.feedback.update({
        where: { id: existing.id },
        data: { rating, reason }
      });
      return updated;
    }

    const fb = await prisma.feedback.create({
      data: {
        messageId,
        userId: request.user!.id,
        rating,
        reason
      }
    });
    return fb;
  });

  // Get feedback for a message
  fastify.get('/:messageId', async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const fb = await prisma.feedback.findFirst({
      where: { messageId, userId: request.user!.id }
    });
    return fb || { rating: null };
  });
}
