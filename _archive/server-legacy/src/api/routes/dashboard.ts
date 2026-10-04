import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', requireRole('admin'));

  fastify.get('/stats', async (request, reply) => {
    const orgId = request.user!.orgId;
    
    const [userCount, modelCount, kbCount, conversationCount] = await Promise.all([
      prisma.user.count({ where: { orgId } }),
      prisma.installedModel.count({ where: { orgId } }),
      prisma.knowledgeBase.count({ where: { orgId } }),
      prisma.conversation.count()
    ]);

    const settings = await prisma.orgSettings.findUnique({
      where: { orgId }
    });

    return {
      users: userCount,
      models: modelCount,
      knowledgeBases: kbCount,
      conversations: conversationCount,
      e2eEnabled: settings?.enableE2EEncryption ?? false,
      kennisnetEnabled: settings?.enableKennisnet ?? false
    };
  });
}
