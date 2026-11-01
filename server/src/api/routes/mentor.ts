import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { mentorService } from '../../services/mentorService';

export default async function mentorRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Blokkeer studenten en gasten van mentor routes
  fastify.addHook('preHandler', async (request, reply) => {
    if (['student', 'guest'].includes(request.user!.role)) {
      return reply.status(403).send({ error: 'Geen toegang tot het mentor dashboard.' });
    }
  });

  // ── 1. GET /api/mentor/classes — Haal mentorklassen op ──
  fastify.get('/classes', async (request) => {
    const user = request.user!;
    const isAdmin = ['admin', 'superadmin'].includes(user.role);
    const classes = await mentorService.getMentorClasses(user.id, user.orgId, isAdmin);
    return { classes };
  });

  // ── 2. GET /api/mentor/classes/:classId/overview — Klas-welzijn en leerlingoverzicht ──
  fastify.get('/classes/:classId/overview', async (request, reply) => {
    const user = request.user!;
    const { classId } = request.params as { classId: string };
    const isAdmin = ['admin', 'superadmin'].includes(user.role);

    // Controleer autorisatie indien docent
    if (!isAdmin) {
      const isAssignedMentor = await prisma.teacherClass.findFirst({
        where: {
          classId,
          teacherId: user.id,
          isMentor: true
        }
      });
      if (!isAssignedMentor) {
        return reply.status(403).send({ error: 'Je bent geen geregistreerd mentor van deze klas.' });
      }
    }

    try {
      const overview = await mentorService.getMentorClassOverview(classId, user.orgId);
      return overview;
    } catch (err: any) {
      return reply.status(404).send({ error: err.message || 'Klasoverzicht niet gevonden' });
    }
  });

  // ── 3. GET /api/mentor/care-guide/:flagId — Haal vertrouwelijke gespreksleidraad op ──
  fastify.get('/care-guide/:flagId', async (request, reply) => {
    const user = request.user!;
    const { flagId } = request.params as { flagId: string };
    const isAdmin = ['admin', 'superadmin', 'confidant'].includes(user.role);

    // Verifieer strikte autorisatie: alleen admin, vertrouwenspersoon of eigen mentor mag leidraad zien
    const flag = await prisma.studentCareFlag.findUnique({
      where: { id: flagId },
      include: {
        user: {
          include: {
            studentClasses: true
          }
        }
      }
    });

    if (!flag || flag.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Zorgsignaal niet gevonden' });
    }

    if (!isAdmin) {
      const studentClassIds = flag.user.studentClasses.map((sc: any) => sc.classId);
      const isMentorOfStudent = await prisma.teacherClass.findFirst({
        where: {
          teacherId: user.id,
          classId: { in: studentClassIds },
          isMentor: true
        }
      });
      if (!isMentorOfStudent) {
        return reply.status(403).send({ error: 'Geen toegang: je bent geen mentor van deze leerling.' });
      }
    }

    try {
      const guide = await mentorService.generateOrGetConversationGuide(flagId, user.orgId);
      return { guide };
    } catch (err: any) {
      return reply.status(404).send({ error: err.message || 'Gespreksleidraad niet gevonden' });
    }
  });

  // ── 4. POST /api/mentor/classes/:classId/toggle-mentor — Wijs docent toe als mentor ──
  fastify.post('/classes/:classId/toggle-mentor', async (request, reply) => {
    const user = request.user!;
    const { classId } = request.params as { classId: string };
    const body = request.body as { teacherId?: string; isMentor: boolean };

    // Alleen admin of de docent zelf mag dit wijzigen
    const targetTeacherId = body.teacherId || user.id;
    if (user.role !== 'admin' && user.role !== 'superadmin' && targetTeacherId !== user.id) {
      return reply.status(403).send({ error: 'Onvoldoende rechten om mentorschap voor anderen in te stellen.' });
    }

    const result = await mentorService.toggleTeacherMentor(classId, targetTeacherId, Boolean(body.isMentor), user.orgId);
    return { success: true, relation: result };
  });

  // ── 5. GET /api/mentor/bullying-incidents — Klasveiligheid en recente incidenten ──
  fastify.get('/bullying-incidents', async (request) => {
    const user = request.user!;
    const query = request.query as { classId?: string };

    const where: any = { orgId: user.orgId };
    if (query.classId) where.classId = query.classId;

    const incidents = await prisma.bullyingIncident.findMany({
      where,
      include: {
        sender: { select: { id: true, displayName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return { incidents };
  });
};
