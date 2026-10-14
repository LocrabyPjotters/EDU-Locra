import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';

export default async function federationRoutes(fastify: FastifyInstance) {
  // Public endpoint for other Locra nodes to access
  // Authenticated via Authorization: Bearer <API_KEY>
  fastify.get('/materials', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
    }

    const apiKey = authHeader.substring(7);

    // Verify if this API key belongs to a registered LocraNode in any org
    const locraNode = await prisma.locraNode.findFirst({
      where: { apiKey, isActive: true },
      include: { org: true }
    });

    if (!locraNode) {
      return reply.status(403).send({ error: 'Unauthorized federation node' });
    }

    // Node is authorized. Fetch public materials from the organization this node belongs to.
    const materials = await prisma.assignment.findMany({
      where: { 
        orgId: locraNode.orgId,
        isActive: true,
        groupId: null,
        classId: null
      },
      select: {
        id: true,
        title: true,
        description: true,
        subject: true,
        teacher: { select: { displayName: true } },
        updatedAt: true
      },
      take: 50
    });

    return { success: true, source: locraNode.org.name, materials };
  });
}
