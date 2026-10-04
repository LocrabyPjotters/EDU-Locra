import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', requireRole('admin'));

  fastify.get('/stats', async (request, reply) => {
    const orgId = request.user!.orgId;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOf7DaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      userCount,
      modelCount,
      kbCount,
      conversationCount,
      classCount,
      messageCount,
      creditsAgg,
      todayMessages,
      weekMessages,
      recentActivity,
      topUsers,
      installedModels,
    ] = await Promise.all([
      prisma.user.count({ where: { orgId } }),
      prisma.installedModel.count({ where: { orgId } }),
      prisma.knowledgeBase.count({ where: { orgId } }),
      prisma.conversation.count({ where: { orgId } }),
      prisma.class.count({ where: { orgId } }),
      prisma.message.count({ where: { conversation: { orgId } } }),
      prisma.user.aggregate({ where: { orgId }, _sum: { creditsUsed: true } }),
      prisma.message.count({
        where: { conversation: { orgId }, createdAt: { gte: startOfToday } }
      }),
      prisma.message.count({
        where: { conversation: { orgId }, createdAt: { gte: startOf7DaysAgo } }
      }),
      prisma.auditLog.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { displayName: true, username: true } } }
      }),
      prisma.user.findMany({
        where: { orgId, role: { not: 'superadmin' } },
        orderBy: { creditsUsed: 'desc' },
        take: 5,
        select: { id: true, displayName: true, username: true, creditsUsed: true, role: true }
      }),
      prisma.installedModel.findMany({
        where: { orgId },
        select: { id: true, displayName: true, ollamaName: true, isActive: true, routingTier: true }
      })
    ]);

    // Daily message chart — last 7 days
    const dailyData: { date: string; messages: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const count = await prisma.message.count({
        where: { conversation: { orgId }, createdAt: { gte: dayStart, lt: dayEnd } }
      });
      dailyData.push({
        date: dayStart.toLocaleDateString('nl-NL', { weekday: 'short' }),
        messages: count
      });
    }

    const settings = await prisma.orgSettings.findUnique({ where: { orgId } });

    // Check Ollama connection
    let ollamaStatus = 'unknown';
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const ollamaRes = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      ollamaStatus = ollamaRes.ok ? 'online' : 'offline';
    } catch {
      ollamaStatus = 'offline';
    }

    return {
      users: userCount,
      models: modelCount,
      knowledgeBases: kbCount,
      conversations: conversationCount,
      classes: classCount,
      messages: messageCount,
      totalCreditsUsed: creditsAgg._sum.creditsUsed || 0,
      todayMessages,
      weekMessages,
      apiCost: settings?.currentApiCost || 0,
      e2eEnabled: settings?.enableE2EEncryption ?? false,
      kennisnetEnabled: settings?.enableKennisnet ?? false,
      webSearchEnabled: settings?.enableWebSearch ?? false,
      creditsEnabled: settings?.enableCredits ?? false,
      recentActivity: recentActivity.map(a => ({
        id: a.id,
        action: a.action,
        details: a.details,
        createdAt: a.createdAt,
        userName: a.user?.displayName || a.user?.username || 'Systeem'
      })),
      topUsers,
      dailyData,
      installedModels,
      ollamaStatus,
      licenseTier: settings?.licenseTier || 'free',
    };
  });
}
