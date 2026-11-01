import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { stylometryService } from '../../services/stylometryService';

export default async function plagiarismRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // ── 1. POST /api/plagiarism/scan — Voer een Plagiaat & Schrijf-DNA scan uit ──
  fastify.post('/scan', async (request, reply) => {
    const user = request.user!;
    const body = request.body as {
      text: string;
      documentTitle?: string;
      studentId?: string;
      assignmentId?: string;
    };

    if (!body.text || body.text.trim().length < 50) {
      return reply.status(400).send({ error: 'Tekst is te kort voor een betrouwbare stilometrische analyse (minimaal 50 tekens).' });
    }

    // Docenten mogen voor willekeurige leerlingen scannen; leerlingen scannen voor zichzelf
    const targetStudentId = (['teacher', 'admin', 'superadmin'].includes(user.role) && body.studentId)
      ? body.studentId
      : user.id;

    try {
      const result = await stylometryService.scanSubmission(
        targetStudentId,
        user.orgId,
        body.text,
        body.documentTitle || 'Geüploade Tekst',
        body.assignmentId
      );
      return result;
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Scannen mislukt' });
    }
  });

  // ── 2. GET /api/plagiarism/student/:userId — Haal historisch schrijf-DNA op ──
  fastify.get('/student/:userId', async (request, reply) => {
    const user = request.user!;
    const { userId } = request.params as { userId: string };

    if (user.id !== userId && !['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang tot schrijfprofiel van deze leerling.' });
    }

    const profile = await prisma.studentWritingProfile.findUnique({
      where: { userId }
    });

    const recentScans = await prisma.plagiarismScanResult.findMany({
      where: { studentId: userId, orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return {
      profile,
      recentScans: recentScans.map((s: any) => ({
        ...s,
        flaggedReasons: (() => {
          try { return JSON.parse(s.flaggedReasons); } catch { return []; }
        })()
      }))
    };
  });
};
