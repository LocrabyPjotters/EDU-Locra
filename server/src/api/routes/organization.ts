import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

export default async function organizationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Get current organization info and customization
  fastify.get('/customization', async (request, reply) => {
    const org = await prisma.organization.findUnique({
      where: { id: request.user!.orgId },
      select: {
        id: true,
        name: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        systemPrompt: true,
        behaviorPrompt: true,
        aiName: true,
        welcomePageHtml: true,
        footerText: true,
        faviconUrl: true,
        logoUrl: true,
        orgSettings: {
          select: {
            enableWebSearch: true,
            enableAttachments: true,
            enablePlugins: true
          }
        }
      }
    });
    
    if (!org) return reply.status(404).send({ error: 'Organization not found' });
    return org;
  });

  // Admin only: Update customization
  fastify.put('/customization', { preHandler: requireRole('admin') }, async (request, reply) => {
    const data = request.body as any;
    
    try {
      const updated = await prisma.organization.update({
        where: { id: request.user!.orgId },
        data: {
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
          accentColor: data.accentColor,
          systemPrompt: data.systemPrompt,
          behaviorPrompt: data.behaviorPrompt,
          aiName: data.aiName !== undefined ? data.aiName : undefined,
          welcomePageHtml: data.welcomePageHtml,
          footerText: data.footerText,
          faviconUrl: data.faviconUrl,
          logoUrl: data.logoUrl
        }
      });
      return { success: true, org: updated };
    } catch (e: any) {
      return reply.status(400).send({ error: 'Failed to update customization' });
    }
  });
}
