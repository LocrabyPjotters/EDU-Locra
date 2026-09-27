import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

export default async function templateRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // List all templates for the org
  fastify.get('/', async (request, reply) => {
    const templates = await prisma.promptTemplate.findMany({
      where: { orgId: request.user!.orgId, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });
    return templates;
  });

  // Create a new template (admin only)
  fastify.post('/', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { name, description, prompt, category, icon } = request.body as any;
    if (!name || !prompt) return reply.status(400).send({ error: 'Name and prompt required' });

    const template = await prisma.promptTemplate.create({
      data: {
        orgId: request.user!.orgId,
        name,
        description,
        prompt,
        category: category || 'Algemeen',
        icon: icon || '💡'
      }
    });
    return template;
  });

  // Update a template
  fastify.put('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, description, prompt, category, icon, isActive, sortOrder } = request.body as any;

    const template = await prisma.promptTemplate.update({
      where: { id },
      data: { name, description, prompt, category, icon, isActive, sortOrder }
    });
    return template;
  });

  // Delete a template
  fastify.delete('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.promptTemplate.delete({ where: { id } });
    return { success: true };
  });
}
