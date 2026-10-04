import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Get audit logs for org
  fastify.get('/', { preHandler: requireRole('admin') }, async (request, reply) => {
    const logs = await prisma.auditLog.findMany({
      where: { orgId: request.user!.orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { displayName: true, username: true } }
      }
    });
    return logs;
  });
}
