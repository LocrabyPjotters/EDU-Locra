import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { aiQueueService } from '../../services/aiQueueService';
import { offPeakAnalyzer } from '../../services/offPeakAnalyzer';
import { AiQueueTaskType } from '../../services/aiTaskTriager';

export default async function aiQueueRoutes(fastify: FastifyInstance) {
  // ── 1. Compleet overzicht van Korte Chat-wachtrij + Daluren-wachtrij + Echte 7x24 Analyse ──
  fastify.get('/overview', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Alleen docenten en beheerders hebben toegang tot de AI Wachtrij-service.' });
    }

    const overview = await aiQueueService.getDualQueueOverview(user.orgId, user.id, user.role);
    return reply.send(overview);
  });

  // ── 2. Forceer herberekening van de 7x24 daluren-analyse op basis van meest recente gebruiksdata ──
  fastify.post('/analyze-refresh', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang.' });
    }

    const report = await offPeakAnalyzer.analyzeOrgPattern(user.orgId, true);
    return reply.send({ success: true, offPeakAnalysis: report });
  });

  // ── 3. Snelle AI-triage preview vóór het definitief inplannen ──
  fastify.post('/tasks/triage-preview', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang.' });
    }

    const body = req.body || {};
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    if (!title && !description) {
      return reply.status(400).send({ error: 'Geef een titel of korte taakomschrijving op.' });
    }

    const preview = await aiQueueService.previewTriage({
      orgId: user.orgId,
      userId: user.id,
      taskType: (body.taskType || 'custom_ai') as AiQueueTaskType,
      title: title || description.slice(0, 60),
      description,
      userPriority: body.userPriority !== undefined && body.userPriority !== null && body.userPriority !== ''
        ? Number(body.userPriority)
        : null,
      deadlineAt: body.deadlineAt || null,
      schedulePreference: body.schedulePreference || 'smart_offpeak',
      triageMetadata: body.triageMetadata
    });

    return reply.send({ success: true, preview });
  });

  // ── 4. Nieuwe achtergrondtaak aanmelden in de centrale AI-wachtrij ──
  fastify.post('/tasks', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Alleen docenten en beheerders kunnen achtergrondtaken inplannen.' });
    }

    const body = req.body || {};
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    if (!title && !description) {
      return reply.status(400).send({ error: 'Geef op wat de taak is (titel of omschrijving).' });
    }

    const validTypes: AiQueueTaskType[] = ['live_generate', 'live_review', 'slimcheck_grade', 'custom_ai'];
    const taskType: AiQueueTaskType = validTypes.includes(body.taskType) ? body.taskType : 'custom_ai';

    const task = await aiQueueService.enqueueTask({
      orgId: user.orgId,
      userId: user.id,
      taskType,
      sourceRefId: body.sourceRefId || undefined,
      title: title || description.slice(0, 80),
      description: description || title,
      payload: body.payload,
      userPriority: body.userPriority !== undefined && body.userPriority !== null && body.userPriority !== ''
        ? Number(body.userPriority)
        : null,
      deadlineAt: body.deadlineAt || null,
      schedulePreference: body.schedulePreference || 'smart_offpeak',
      triageMetadata: body.triageMetadata
    });

    return reply.status(201).send({ success: true, task });
  });

  // ── 5. Prioriteit (1-10 / Auto) of deadline van taak aanpassen & direct herplannen ──
  fastify.patch('/tasks/:id', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const { id } = req.params as { id: string };

    const existing = await prisma.aiQueueTask.findUnique({ where: { id } });
    if (!existing || existing.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Taak niet gevonden.' });
    }
    if (existing.userId !== user.id && !['admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen rechten om deze taak te wijzigen.' });
    }

    const body = req.body || {};
    try {
      const updated = await aiQueueService.updateTaskScheduling(id, {
        userPriority: body.userPriority !== undefined
          ? (body.userPriority === null || body.userPriority === '' ? null : Number(body.userPriority))
          : undefined,
        deadlineAt: body.deadlineAt !== undefined ? body.deadlineAt : undefined,
        schedulePreference: body.schedulePreference
      });
      return reply.send({ success: true, task: updated });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // ── 6. Geplande taak handmatig direct starten ──
  fastify.post('/tasks/:id/run-now', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const { id } = req.params as { id: string };

    const existing = await prisma.aiQueueTask.findUnique({ where: { id } });
    if (!existing || existing.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Taak niet gevonden.' });
    }
    if (existing.userId !== user.id && !['admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang.' });
    }

    const task = await aiQueueService.runTaskNow(id);
    return reply.send({ success: true, task });
  });

  // ── 7. Taak annuleren of uit lijst verwijderen ──
  fastify.delete('/tasks/:id', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const { id } = req.params as { id: string };

    const existing = await prisma.aiQueueTask.findUnique({ where: { id } });
    if (!existing || existing.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Taak niet gevonden.' });
    }
    if (existing.userId !== user.id && !['admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang.' });
    }

    if (['queued', 'scheduled', 'running'].includes(existing.status)) {
      await aiQueueService.cancelTask(id);
    } else {
      await prisma.aiQueueTask.delete({ where: { id } });
    }

    return reply.send({ success: true });
  });
}
