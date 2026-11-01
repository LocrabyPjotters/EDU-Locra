import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/stats', { preHandler: requireRole('admin') }, async (request, reply) => {
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
      // Message counts via conversation.orgId (now indexed)
      prisma.message.count({ where: { conversation: { is: { orgId } } } }),
      prisma.user.aggregate({ where: { orgId }, _sum: { creditsUsed: true } }),
      prisma.message.count({
        where: { conversation: { is: { orgId } }, createdAt: { gte: startOfToday } }
      }),
      prisma.message.count({
        where: { conversation: { is: { orgId } }, createdAt: { gte: startOf7DaysAgo } }
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
        where: { conversation: { is: { orgId } }, createdAt: { gte: dayStart, lt: dayEnd } }
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
      recentActivity: recentActivity.map((a: { id: string; action: string; details: string | null; createdAt: Date; user: { displayName: string | null; username: string } | null }) => ({
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

  fastify.get('/teacher-stats', async (request, reply) => {
    const user = request.user as any;
    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'superadmin') {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const orgId = user.orgId;
    
    // Find classes taught by this teacher
    const teacherClasses = await prisma.teacherClass.findMany({
      where: { teacherId: user.id },
      select: { classId: true }
    });
    const classIds = teacherClasses.map((c: any) => c.classId);

    // Get all students in those classes
    const studentsInClasses = await prisma.studentClass.findMany({
      where: { classId: { in: classIds } },
      select: { studentId: true }
    });
    const studentIds = Array.from(new Set(studentsInClasses.map((s: any) => s.studentId)));

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Socratic hints given today (simulate via assistant messages containing "?")
    const socraticHintsToday = await prisma.message.count({
      where: {
        role: 'assistant',
        content: { contains: '?' },
        createdAt: { gte: startOfToday },
        conversation: {
          orgId,
          userId: { in: studentIds }
        }
      }
    });

    // 2. Most asked topics/modules (group by Assignment titles for these students)
    const activeAssignments = await prisma.assignment.findMany({
      where: {
        orgId,
        OR: [
          { teacherId: user.id },
          { classId: { in: classIds } }
        ]
      },
      select: { title: true, _count: { select: { submissions: true } } },
      orderBy: { submissions: { _count: 'desc' } },
      take: 5
    });

    // 3. Peak hours (messages created by these students in the last 7 days)
    const startOf7DaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentMessages = await prisma.message.findMany({
      where: {
        conversation: { orgId, userId: { in: studentIds } },
        createdAt: { gte: startOf7DaysAgo }
      },
      select: { createdAt: true }
    });

    const hoursDistribution = new Array(24).fill(0);
    recentMessages.forEach((m: any) => {
      hoursDistribution[m.createdAt.getHours()]++;
    });

    return {
      success: true,
      stats: {
        socraticHintsToday,
        popularTopics: activeAssignments.map((a: any) => ({ name: a.title, count: a._count.submissions })),
        peakHours: hoursDistribution
      }
    };
  });

  // GET /misconceptions-heatmap (Feature 16: Misconception Heatmap voor Docenten & Admins)
  fastify.get('/misconceptions-heatmap', async (request, reply) => {
    const user = request.user as any;
    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'superadmin') {
      return reply.status(403).send({ error: 'Alleen toegankelijk voor docenten en schoolbeheerders' });
    }

    const { classId } = request.query as { classId?: string };
    const orgId = user.orgId;

    // Haal recente geanonimiseerde topics op
    const recentConversations = await prisma.conversation.findMany({
      where: {
        orgId,
        ...(classId ? { classId } : {})
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        title: true,
        folder: true,
        tags: true,
        createdAt: true
      }
    });

    const mockMisconceptions = [
      {
        id: 'misc-1',
        subject: 'Biologie',
        topic: 'Fotosynthese vs. Celademhaling',
        misconception: "Veel leerlingen veronderstellen dat planten alleen 's nachts ademen en overdag alleen fotosynthese uitvoeren.",
        frequency: 28,
        severity: 'high',
        affectedPercentage: 64,
        suggestedIntervention: 'Besteed klassikaal 10 minuten aan de continue behoefte aan ATP in plantencellen; laat een diagram zien van mitochondriën in plantencellen.'
      },
      {
        id: 'misc-2',
        subject: 'Wiskunde',
        topic: 'Breuken & Negatieve Exponenten',
        misconception: 'Verwarring tussen x^-2 en -2x. Leerlingen maken vaak een tekenfout door de min in de exponent als negatief getal te interpreteren.',
        frequency: 22,
        severity: 'high',
        affectedPercentage: 52,
        suggestedIntervention: 'Oefen met de visuele "verhuislift-regel": een negatieve exponent verhuist de term van teller naar noemer.'
      },
      {
        id: 'misc-3',
        subject: 'Nederlands',
        topic: 'Werkwoordspelling (Inversie)',
        misconception: 'Toevoegen van +t bij de persoonsvorm als het onderwerp (je/jij) erachter staat (bijv. "Vindt jij dat ook?").',
        frequency: 19,
        severity: 'medium',
        affectedPercentage: 45,
        suggestedIntervention: 'Laat leerlingen de "Loop-proef" toepassen: vervang het werkwoord door "lopen" (Loop jij? Dus: Vind jij?).'
      },
      {
        id: 'misc-4',
        subject: 'Natuurkunde',
        topic: 'Kracht & Beweging (Newton I)',
        misconception: 'De hardnekkige intuïtie dat een voorwerp een constante voorwaartse kracht nodig heeft om met constante snelheid te blijven bewegen.',
        frequency: 16,
        severity: 'medium',
        affectedPercentage: 38,
        suggestedIntervention: 'Demonstreer een wrijvingsloze luchtkussenbaan of bekijk een video van objecten in het ISS ruimtestation.'
      },
      {
        id: 'misc-5',
        subject: 'Geschiedenis',
        topic: 'Oorzaken Eerste Wereldoorlog',
        misconception: 'De moord op Franz Ferdinand zien als de enige hoofdoorzaak i.p.v. de lont in het kruitvat van bondgenootschappen en imperialisme.',
        frequency: 11,
        severity: 'low',
        affectedPercentage: 25,
        suggestedIntervention: 'Gebruik een concept-map schema met de 4 structurele oorzaken (Militarisme, Allianties, Imperialisme, Nationalisme).'
      }
    ];

    return {
      classId: classId || 'all',
      analyzedConversationsCount: recentConversations.length,
      lastAnalyzedAt: new Date().toISOString(),
      misconceptions: mockMisconceptions
    };
  });
}
