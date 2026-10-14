import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { slimCheckService, RedactRect } from '../../services/slimCheckService';
import { slimCheckQueue, SlimCheckScheduleMode } from '../../services/slimCheckQueue';
import { createAuditLog } from '../../services/auditService';

// In-memory progress tracker for live SSE / status polling
const activePipelines = new Map<string, { step: string; percent: number; message: string }>();

export default async function slimCheckRoutes(fastify: FastifyInstance) {
  // Base auth for all routes
  fastify.addHook('preHandler', requireAuth);

  // ── SESSIONS (Docent) ─────────────────────────────────────────────────────────

  // List all sessions for teacher/admin
  fastify.get('/sessions', async (request, reply) => {
    const user = request.user as any;
    const isTeacherOrAdmin = ['teacher', 'admin', 'superadmin'].includes(user.role);
    if (!isTeacherOrAdmin) return reply.status(403).send({ error: 'Geen toegang' });

    const sessions = await prisma.slimCheckSession.findMany({
      where: {
        orgId: user.orgId,
        ...(user.role === 'teacher' ? { teacherId: user.id } : {})
      },
      include: {
        class: { select: { id: true, name: true } },
        assignment: { select: { id: true, title: true } },
        _count: {
          select: { scans: true, questions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return sessions;
  });

  // Get teacher model configuration & restrictions
  fastify.get('/model-config', async (request, reply) => {
    const user = request.user as any;
    const orgSettings = await prisma.orgSettings.findUnique({
      where: { orgId: user.orgId }
    });

    let allowedModels: string[] = [];
    let allowedVisionModels: string[] = [];

    try {
      if (orgSettings?.teacherAllowedModels) {
        allowedModels = JSON.parse(orgSettings.teacherAllowedModels);
      }
    } catch {}

    try {
      if (orgSettings?.teacherAllowedVisionModels) {
        allowedVisionModels = JSON.parse(orgSettings.teacherAllowedVisionModels);
      }
    } catch {}

    return {
      teacherModelRestriction: orgSettings?.teacherModelRestriction ?? false,
      allowedModels,
      allowedVisionModels,
      defaultVisionModel: orgSettings?.slimCheckDefaultVisionModel || 'minicpm-v:8b',
      defaultGradingModel: orgSettings?.slimCheckDefaultGradingModel || 'llama3.1:8b'
    };
  });

  // Create new session
  fastify.post('/sessions', async (request, reply) => {
    const user = request.user as any;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const {
      title,
      subject,
      classId,
      assignmentId,
      isMultimodal,
      visionModelId,
      gradingModelId,
      retainScans,
      retainFeedback,
      retainGrade,
      returnGrade,
      returnFeedback,
      returnScan
    } = request.body as any;

    if (!title || !title.trim()) {
      return reply.status(400).send({ error: 'Titel is verplicht' });
    }

    const session = await prisma.slimCheckSession.create({
      data: {
        orgId: user.orgId,
        teacherId: user.id,
        title: title.trim(),
        subject: subject || null,
        classId: classId || null,
        assignmentId: assignmentId || null,
        isMultimodal: Boolean(isMultimodal),
        visionModelId: visionModelId || null,
        gradingModelId: gradingModelId || null,
        retainScans: retainScans !== undefined ? retainScans : 30,
        retainFeedback: retainFeedback !== undefined ? retainFeedback : 365,
        retainGrade: retainGrade !== undefined ? retainGrade : null,
        returnGrade: returnGrade !== undefined ? returnGrade : true,
        returnFeedback: returnFeedback !== undefined ? returnFeedback : false,
        returnScan: returnScan !== undefined ? returnScan : false,
        status: 'draft'
      }
    });

    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'slimcheck.create_session',
      category: 'data',
      severity: 'info',
      details: { sessionId: session.id, title: session.title }
    });

    return session;
  });

  // Get session details
  fastify.get('/sessions/:id', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const session = await prisma.slimCheckSession.findUnique({
      where: { id },
      include: {
        class: { select: { id: true, name: true } },
        assignment: { select: { id: true, title: true } },
        questions: { orderBy: { number: 'asc' } },
        scans: {
          include: {
            student: { select: { id: true, displayName: true, username: true } },
            responses: {
              include: { question: true },
              orderBy: { question: { number: 'asc' } }
            }
          },
          orderBy: { anonIndex: 'asc' }
        }
      }
    });

    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    const queueData = await slimCheckQueue.getQueueOverview(id);
    const pipelineProgress = activePipelines.get(id) || queueData.liveProgress;

    return {
      ...session,
      queueInfo: queueData.sessionInfo,
      isOffPeak: queueData.isOffPeak,
      trafficLevel: queueData.trafficLevel,
      nextOffPeakDate: queueData.nextOffPeakDate,
      nextWeekendOffPeakDate: queueData.nextWeekendOffPeakDate,
      liveProgress: pipelineProgress || null
    };
  });

  // Update session
  fastify.patch('/sessions/:id', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const session = await prisma.slimCheckSession.findUnique({ where: { id } });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    const updated = await prisma.slimCheckSession.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.subject !== undefined ? { subject: body.subject } : {}),
        ...(body.classId !== undefined ? { classId: body.classId } : {}),
        ...(body.assignmentId !== undefined ? { assignmentId: body.assignmentId } : {}),
        ...(body.isMultimodal !== undefined ? { isMultimodal: Boolean(body.isMultimodal) } : {}),
        ...(body.visionModelId !== undefined ? { visionModelId: body.visionModelId } : {}),
        ...(body.gradingModelId !== undefined ? { gradingModelId: body.gradingModelId } : {}),
        ...(body.returnGrade !== undefined ? { returnGrade: Boolean(body.returnGrade) } : {}),
        ...(body.returnFeedback !== undefined ? { returnFeedback: Boolean(body.returnFeedback) } : {}),
        ...(body.returnScan !== undefined ? { returnScan: Boolean(body.returnScan) } : {}),
        ...(body.returnModelAnswer !== undefined ? { returnModelAnswer: Boolean(body.returnModelAnswer) } : {}),
        ...(body.retainScans !== undefined ? { retainScans: body.retainScans } : {}),
        ...(body.retainFeedback !== undefined ? { retainFeedback: body.retainFeedback } : {}),
        ...(body.retainGrade !== undefined ? { retainGrade: body.retainGrade } : {}),
        ...(body.status !== undefined ? { status: body.status } : {})
      }
    });

    return updated;
  });

  // Delete session
  fastify.delete('/sessions/:id', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const session = await prisma.slimCheckSession.findUnique({ where: { id } });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    // Delete session files
    const sessionDir = slimCheckService.getSessionDir(id);
    if (fs.existsSync(sessionDir)) {
      try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    }

    await prisma.slimCheckSession.delete({ where: { id } });

    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'slimcheck.delete_session',
      category: 'data',
      severity: 'info',
      details: { sessionId: id, title: session.title }
    });

    return { success: true };
  });

  // ── VRAGEN / CORRECTIEMODEL ──────────────────────────────────────────────────

  // Save / replace questions for session
  fastify.post('/sessions/:id/questions', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };
    const { questions } = request.body as {
      questions: Array<{
        number: number;
        promptText?: string;
        maxPoints: number;
        modelAnswer: string;
        notes?: string;
      }>;
    };

    const session = await prisma.slimCheckSession.findUnique({ where: { id } });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return reply.status(400).send({ error: 'Minimaal één vraag vereist' });
    }

    // Delete existing questions
    await prisma.slimCheckQuestion.deleteMany({ where: { sessionId: id } });

    // Insert new questions
    let totalMax = 0;
    for (const q of questions) {
      const maxPts = parseFloat(String(q.maxPoints)) || 1;
      totalMax += maxPts;
      await prisma.slimCheckQuestion.create({
        data: {
          sessionId: id,
          number: q.number,
          promptText: q.promptText || null,
          maxPoints: maxPts,
          modelAnswer: q.modelAnswer || '',
          notes: q.notes || null
        }
      });
    }

    // Update totalMaxScore on session
    await prisma.slimCheckSession.update({
      where: { id },
      data: { totalMaxScore: Math.round(totalMax) }
    });

    return { success: true, count: questions.length, totalMaxScore: totalMax };
  });

  // Add an additional single question to session
  fastify.post('/sessions/:id/questions/add', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };
    const { promptText, modelAnswer, maxPoints, notes } = request.body as any;

    const session = await prisma.slimCheckSession.findUnique({
      where: { id },
      include: { questions: { orderBy: { number: 'desc' } } }
    });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    const nextNumber = (session.questions[0]?.number || 0) + 1;
    const maxPts = parseFloat(maxPoints) || 1;

    const newQuestion = await prisma.slimCheckQuestion.create({
      data: {
        sessionId: id,
        number: nextNumber,
        promptText: promptText || null,
        modelAnswer: modelAnswer || 'Correct modelantwoord',
        maxPoints: maxPts,
        notes: notes || null
      }
    });

    const newTotal = (session.totalMaxScore || 0) + maxPts;
    await prisma.slimCheckSession.update({
      where: { id },
      data: { totalMaxScore: Math.round(newTotal) }
    });

    return newQuestion;
  });

  // Delete a question from session
  fastify.delete('/questions/:id', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const question = await prisma.slimCheckQuestion.findUnique({
      where: { id },
      include: { session: true }
    });
    if (!question || question.session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Vraag niet gevonden' });
    }

    await prisma.slimCheckQuestion.delete({ where: { id } });

    const remaining = await prisma.slimCheckQuestion.findMany({ where: { sessionId: question.sessionId } });
    const newTotal = remaining.reduce((sum, q) => sum + q.maxPoints, 0);
    await prisma.slimCheckSession.update({
      where: { id: question.sessionId },
      data: { totalMaxScore: Math.round(newTotal) }
    });

    return { success: true };
  });

  // Upload Assignment / Opgaven PDF ("wat de leerling ziet")
  fastify.post('/sessions/:id/assignment', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const session = await prisma.slimCheckSession.findUnique({ where: { id } });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Geen PDF bestand geüpload' });
    }

    const buffer = await data.toBuffer();
    try {
      const result = await slimCheckService.parseAssignmentPdf(id, buffer, data.filename);
      return result;
    } catch (err: any) {
      return reply.status(500).send({ error: 'Fout bij analyseren opdrachten PDF: ' + err.message });
    }
  });

  // Upload Correctiemodel / Antwoordmodel PDF
  fastify.post('/sessions/:id/rubric', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const session = await prisma.slimCheckSession.findUnique({ where: { id } });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Geen PDF bestand geüpload' });
    }

    const buffer = await data.toBuffer();
    try {
      const result = await slimCheckService.parseRubricPdf(id, buffer, data.filename);
      return result;
    } catch (err: any) {
      return reply.status(500).send({ error: 'Fout bij analyseren correctiemodel PDF: ' + err.message });
    }
  });

  // ── PDF UPLOAD & REDACTIE ─────────────────────────────────────────────────────

  // Upload PDF scan(s)
  fastify.post('/sessions/:id/scans', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const session = await prisma.slimCheckSession.findUnique({ where: { id } });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Geen bestand geüpload' });
    }

    const sessionDir = slimCheckService.getSessionDir(id);
    const pdfPath = path.join(sessionDir, 'original.pdf');

    const fileBuffer = await data.toBuffer();
    fs.writeFileSync(pdfPath, fileBuffer);

    // Convert PDF to images per page
    try {
      const pageImages = await slimCheckService.convertPdfToImages(pdfPath, id);

      await prisma.slimCheckSession.update({
        where: { id },
        data: {
          originalPdfPath: `uploads/slimcheck/${id}/original.pdf`,
          originalPdfName: data.filename,
          pageCount: pageImages.length,
          status: 'redacting'
        }
      });

      return {
        success: true,
        pageCount: pageImages.length,
        previewUrl: `/api/slimcheck/sessions/${id}/preview-page`
      };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Fout bij verwerken PDF: ' + err.message });
    }
  });

  // Get preview of page 1 for canvas redaction tool
  fastify.get('/sessions/:id/preview-page', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };
    const { page } = request.query as { page?: string };

    const session = await prisma.slimCheckSession.findUnique({ where: { id } });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    const pageNum = parseInt(page || '1', 10);
    const pagesDir = slimCheckService.getPagesDir(id);
    const pageFile = path.join(pagesDir, `page_${String(pageNum).padStart(3, '0')}.png`);

    if (!fs.existsSync(pageFile)) {
      return reply.status(404).send({ error: 'Pagina-afbeelding niet gevonden' });
    }

    const stream = fs.createReadStream(pageFile);
    return reply.header('Content-Type', 'image/png').send(stream);
  });

  // Apply permanent pixel redaction
  fastify.post('/sessions/:id/redact', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const rect = body.rect || body;
    const layoutZone = body.layoutZone || undefined;

    const session = await prisma.slimCheckSession.findUnique({ where: { id } });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    if (!rect || typeof rect.x !== 'number') {
      return reply.status(400).send({ error: 'Ongeldige redactie-coördinaten' });
    }

    try {
      await slimCheckService.applyRedactionToAllScans(id, rect, layoutZone);

      await createAuditLog(prisma, {
        orgId: user.orgId,
        userId: user.id,
        action: 'slimcheck.redact',
        category: 'data',
        severity: 'info',
        details: { sessionId: id, rect, layoutZone }
      });

      return { success: true, message: 'Naamgebied permanent gewist en layout-zone opgeslagen.' };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Redactie mislukt: ' + err.message });
    }
  });

  // ── LEERLING MAPPING ──────────────────────────────────────────────────────────

  // Download mapping template pre-filled with class members
  fastify.get('/sessions/:id/mapping/template', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const session = await prisma.slimCheckSession.findUnique({
      where: { id },
      include: { class: true }
    });

    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    if (!session.classId) {
      return reply.status(400).send({ error: 'Koppel eerst een klas aan deze sessie om een template te genereren' });
    }

    try {
      const excelBuffer = await slimCheckService.generateMappingTemplate(session.classId, user.orgId);
      const safeClassName = (session.class?.name || 'klas').replace(/[^a-zA-Z0-9_-]/g, '_');

      return reply
        .header('Content-Disposition', `attachment; filename="SlimCheck_Mapping_${safeClassName}.xlsx"`)
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .send(excelBuffer);
    } catch (err: any) {
      return reply.status(500).send({ error: 'Template generatie mislukt: ' + err.message });
    }
  });

  // Upload student mapping (Excel or CSV)
  fastify.post('/sessions/:id/mapping', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const session = await prisma.slimCheckSession.findUnique({ where: { id } });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'Geen bestand geüpload' });

    const buffer = await data.toBuffer();
    const isCsv = data.filename.endsWith('.csv') || data.mimetype.includes('csv');

    try {
      const mappingRows = await slimCheckService.parseMappingFile(buffer, isCsv);

      // Clean existing scans for session
      await prisma.slimCheckScan.deleteMany({ where: { sessionId: id } });

      let anonCounter = 0;
      for (const row of mappingRows) {
        // Resolve studentId if student exists in org
        let resolvedStudentId: string | null = null;
        if (row.locraId) {
          const student = await prisma.user.findFirst({
            where: {
              id: row.locraId,
              orgId: user.orgId
            }
          });
          if (student) resolvedStudentId = student.id;
        }

        await prisma.slimCheckScan.create({
          data: {
            sessionId: id,
            studentId: resolvedStudentId,
            anonIndex: anonCounter++,
            startPage: row.startPage,
            endPage: row.endPage,
            status: 'pending'
          }
        });
      }

      await prisma.slimCheckSession.update({
        where: { id },
        data: { status: 'uploading' }
      });

      return {
        success: true,
        scansCount: mappingRows.length,
        message: `${mappingRows.length} leerlingen gekoppeld via mapping.`
      };
    } catch (err: any) {
      return reply.status(400).send({ error: 'Fout bij inlezen van mapping: ' + err.message });
    }
  });

  // ── AI PIPELINE EXECUTION ────────────────────────────────────────────────────

  // Start processing pipeline (supports re-grading all or a single scan, with off-hours queue)
  fastify.post('/sessions/:id/process', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };
    const body = ((request.body as any) || (request.query as any) || {});
    const { scanId, mode = 'immediate' } = body;

    const session = await prisma.slimCheckSession.findUnique({
      where: { id },
      include: { questions: true, scans: true }
    });

    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    if (session.questions.length === 0) {
      return reply.status(400).send({ error: 'Voer eerst een correctiemodel in met vragen' });
    }

    if (session.scans.length === 0) {
      return reply.status(400).send({ error: 'Upload eerst een leerling-mapping' });
    }

    // Single student scan re-grade
    if (scanId) {
      activePipelines.set(id, {
        step: 'start',
        percent: 5,
        message: 'AI Nakijken gestart voor geselecteerde leerling...'
      });

      slimCheckService.runGradingPipeline(id, (progress) => {
        activePipelines.set(id, progress);
        slimCheckQueue.setProgress(id, progress);
      }, scanId).then(() => {
        activePipelines.set(id, { step: 'done', percent: 100, message: 'Nakijken voltooid!' });
      }).catch(err => {
        activePipelines.set(id, { step: 'error', percent: 0, message: 'Fout: ' + err.message });
      });

      return { success: true, message: 'Her-nakijken van leerling gestart.', status: 'processing' };
    }

    // Full session enqueue or scheduling
    const validModes: SlimCheckScheduleMode[] = ['immediate', 'offpeak_24h', 'offpeak_7d'];
    const chosenMode = validModes.includes(mode) ? (mode as SlimCheckScheduleMode) : 'immediate';

    const queueResult = await slimCheckQueue.enqueueSession(id, chosenMode, (progress) => {
      activePipelines.set(id, progress);
    });

    return {
      success: true,
      status: queueResult.status,
      scheduledFor: queueResult.scheduledFor,
      queuePosition: queueResult.queuePosition,
      message: queueResult.message
    };
  });

  // Get detailed queue and off-hours status for session
  fastify.get('/sessions/:id/queue', async (request, reply) => {
    const { id } = request.params as { id: string };
    const overview = await slimCheckQueue.getQueueOverview(id);
    return overview;
  });

  // Cancel off-hours schedule or queue position
  fastify.post('/sessions/:id/cancel-schedule', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = await slimCheckQueue.cancelSchedule(id);
    return {
      success,
      message: success ? 'Inplanning geannuleerd. Sessie teruggezet naar concept.' : 'Kon inplanning niet annuleren.'
    };
  });

  // Global queue status endpoint
  fastify.get('/queue-status', async (request, reply) => {
    const overview = await slimCheckQueue.getQueueOverview();
    return overview;
  });

  // ── ANALYTICS ─────────────────────────────────────────────────────────

  // Get analytics for a specific session
  fastify.get('/sessions/:id/analytics', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const session = await prisma.slimCheckSession.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { number: 'asc' } },
        scans: {
          include: {
            student: { select: { id: true, displayName: true, username: true } },
            responses: {
              include: { question: true }
            }
          }
        },
        class: { select: { id: true, name: true } }
      }
    });

    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    const questions = session.questions;
    const scans = session.scans.filter(s => s.responses.length > 0);

    // ── Per-student scores ──
    const studentScores = scans.map(scan => {
      const totalAi = scan.responses.reduce((sum, r) => sum + (r.finalPoints ?? r.aiPoints ?? 0), 0);
      const totalMax = scan.responses.reduce((sum, r) => sum + (r.question?.maxPoints ?? 0), 0);
      const percentage = totalMax > 0 ? Math.round((totalAi / totalMax) * 100) : 0;
      return {
        scanId: scan.id,
        studentId: scan.studentId,
        studentName: scan.student?.displayName || `Leerling ${scan.anonIndex + 1}`,
        totalPoints: Math.round(totalAi * 10) / 10,
        maxPoints: totalMax,
        percentage,
        questionScores: scan.responses.map(r => ({
          questionNumber: r.question?.number ?? 0,
          aiPoints: r.aiPoints ?? 0,
          finalPoints: r.finalPoints ?? r.aiPoints ?? 0,
          maxPoints: r.question?.maxPoints ?? 0,
          needsReview: r.needsReview
        }))
      };
    });

    // ── Global stats ──
    const percentages = studentScores.map(s => s.percentage);
    const avgPercentage = percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
    const minPercentage = percentages.length > 0 ? Math.min(...percentages) : 0;
    const maxPercentage = percentages.length > 0 ? Math.max(...percentages) : 0;
    const medianPercentage = percentages.length > 0
      ? (() => { const sorted = [...percentages].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2); })()
      : 0;

    // ── Score distribution (histogram buckets) ──
    const distribution = [
      { label: '0-20%', min: 0, max: 20, count: 0 },
      { label: '20-40%', min: 20, max: 40, count: 0 },
      { label: '40-60%', min: 40, max: 60, count: 0 },
      { label: '60-80%', min: 60, max: 80, count: 0 },
      { label: '80-100%', min: 80, max: 101, count: 0 }
    ];
    for (const pct of percentages) {
      const bucket = distribution.find(d => pct >= d.min && pct < d.max);
      if (bucket) bucket.count++;
    }

    // ── Per-question difficulty ──
    const questionStats = questions.map(q => {
      const responses = scans.flatMap(s => s.responses.filter(r => r.questionId === q.id));
      const points = responses.map(r => r.finalPoints ?? r.aiPoints ?? 0);
      const avg = points.length > 0 ? points.reduce((a, b) => a + b, 0) / points.length : 0;
      const avgPct = q.maxPoints > 0 ? Math.round((avg / q.maxPoints) * 100) : 0;
      const fullScoreCount = points.filter(p => p >= q.maxPoints).length;
      const zeroScoreCount = points.filter(p => p === 0).length;
      const needsReviewCount = responses.filter(r => r.needsReview).length;

      return {
        questionId: q.id,
        number: q.number,
        promptText: q.promptText || `Vraag ${q.number}`,
        maxPoints: q.maxPoints,
        avgPoints: Math.round(avg * 10) / 10,
        avgPercentage: avgPct,
        fullScoreCount,
        zeroScoreCount,
        needsReviewCount,
        totalResponses: responses.length,
        difficulty: avgPct >= 80 ? 'easy' : avgPct >= 50 ? 'medium' : 'hard'
      };
    });

    // Sort by difficulty (hardest first)
    const hardestQuestions = [...questionStats].sort((a, b) => a.avgPercentage - b.avgPercentage);

    // ── Pass/fail rate (≥55% is voldoende) ──
    const passCount = percentages.filter(p => p >= 55).length;
    const failCount = percentages.filter(p => p < 55).length;
    const passRate = percentages.length > 0 ? Math.round((passCount / percentages.length) * 100) : 0;

    // ── AI confidence stats ──
    const allResponses = scans.flatMap(s => s.responses);
    const confidences = allResponses.map(r => r.confidence).filter(c => c !== null && c !== undefined) as number[];
    const avgConfidence = confidences.length > 0 ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) : null;
    const reviewCount = allResponses.filter(r => r.needsReview).length;

    return {
      sessionId: id,
      title: session.title,
      subject: session.subject,
      className: session.class?.name,
      totalStudents: scans.length,
      totalQuestions: questions.length,
      totalMaxScore: session.totalMaxScore || questions.reduce((s, q) => s + q.maxPoints, 0),
      summary: {
        avgPercentage,
        minPercentage,
        maxPercentage,
        medianPercentage,
        passCount,
        failCount,
        passRate,
        avgConfidence,
        reviewCount
      },
      distribution,
      questionStats,
      hardestQuestions: hardestQuestions.slice(0, 5),
      studentScores: studentScores.sort((a, b) => b.percentage - a.percentage)
    };
  });

  // Cross-session analytics overview (all sessions for this teacher)
  fastify.get('/analytics/overview', async (request, reply) => {
    const user = request.user as any;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const sessions = await prisma.slimCheckSession.findMany({
      where: {
        orgId: user.orgId,
        ...(user.role === 'teacher' ? { teacherId: user.id } : {}),
        status: { in: ['review', 'done'] }
      },
      include: {
        class: { select: { id: true, name: true } },
        questions: true,
        scans: {
          include: {
            responses: { include: { question: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const sessionSummaries = sessions.map(session => {
      const scans = session.scans.filter(s => s.responses.length > 0);
      const percentages = scans.map(scan => {
        const total = scan.responses.reduce((sum, r) => sum + (r.finalPoints ?? r.aiPoints ?? 0), 0);
        const max = scan.responses.reduce((sum, r) => sum + (r.question?.maxPoints ?? 0), 0);
        return max > 0 ? Math.round((total / max) * 100) : 0;
      });
      const avg = percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
      const passCount = percentages.filter(p => p >= 55).length;

      return {
        id: session.id,
        title: session.title,
        subject: session.subject,
        className: session.class?.name,
        createdAt: session.createdAt,
        studentCount: scans.length,
        questionCount: session.questions.length,
        avgPercentage: avg,
        passRate: percentages.length > 0 ? Math.round((passCount / percentages.length) * 100) : 0,
        status: session.status,
        isPublished: session.isPublished
      };
    });

    // Totals
    const totalSessions = sessions.length;
    const totalStudentsGraded = sessions.reduce((sum, s) => sum + s.scans.filter(sc => sc.responses.length > 0).length, 0);
    const totalQuestionsGraded = sessions.reduce((sum, s) => sum + s.scans.reduce((ss, sc) => ss + sc.responses.length, 0), 0);
    const overallAvg = sessionSummaries.length > 0 ? Math.round(sessionSummaries.reduce((s, ss) => s + ss.avgPercentage, 0) / sessionSummaries.length) : 0;

    return {
      totalSessions,
      totalStudentsGraded,
      totalQuestionsGraded,
      overallAverage: overallAvg,
      sessions: sessionSummaries
    };
  });

  // Status & SSE live stream
  fastify.get('/sessions/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const acceptsSse = request.headers.accept?.includes('text/event-stream');

    if (!acceptsSse) {
      const queueData = await slimCheckQueue.getQueueOverview(id);
      const progress = activePipelines.get(id) || queueData.liveProgress;
      const session = await prisma.slimCheckSession.findUnique({
        where: { id },
        select: { status: true, scheduledMode: true, scheduledFor: true, queuedAt: true }
      });
      return {
        status: session?.status || 'draft',
        progress,
        queueInfo: queueData.sessionInfo,
        isOffPeak: queueData.isOffPeak,
        trafficLevel: queueData.trafficLevel,
        nextOffPeakDate: queueData.nextOffPeakDate,
        nextWeekendOffPeakDate: queueData.nextWeekendOffPeakDate
      };
    }

    // SSE Mode
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders?.();

    const interval = setInterval(async () => {
      const queueData = await slimCheckQueue.getQueueOverview(id);
      const progress = activePipelines.get(id) || queueData.liveProgress;
      const session = await prisma.slimCheckSession.findUnique({
        where: { id },
        select: { status: true, scheduledMode: true, scheduledFor: true }
      });

      const payload = {
        status: session?.status || 'draft',
        progress: progress || { step: 'idle', percent: 0, message: 'Wachten...' },
        queueInfo: queueData.sessionInfo
      };

      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);

      if (payload.status === 'review' || payload.status === 'done' || progress?.step === 'error') {
        clearInterval(interval);
        reply.raw.end();
      }
    }, 1500);

    request.raw.on('close', () => {
      clearInterval(interval);
    });
  });

  // ── INLINE REVIEW & BEWERKEN ─────────────────────────────────────────────────

  // Edit response points / feedback inline
  // Update an individual question (e.g. adjust model answer, prompt or notes at any time)
  fastify.patch('/questions/:id', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };
    const { promptText, modelAnswer, notes, maxPoints } = request.body as any;

    const question = await prisma.slimCheckQuestion.findUnique({
      where: { id },
      include: { session: true }
    });

    if (!question || question.session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Vraag niet gevonden' });
    }

    const updated = await prisma.slimCheckQuestion.update({
      where: { id },
      data: {
        ...(promptText !== undefined ? { promptText } : {}),
        ...(modelAnswer !== undefined ? { modelAnswer } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(maxPoints !== undefined ? { maxPoints: parseFloat(maxPoints) } : {})
      }
    });

    return updated;
  });

  fastify.patch('/responses/:id', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };
    const { finalPoints, teacherNote, aiFeedback, needsReview } = request.body as any;

    const response = await prisma.slimCheckResponse.findUnique({
      where: { id },
      include: { scan: { include: { session: { include: { questions: true } } } } }
    });

    if (!response || response.scan.session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Antwoord niet gevonden' });
    }

    const updated = await prisma.slimCheckResponse.update({
      where: { id },
      data: {
        ...(finalPoints !== undefined ? { finalPoints: parseFloat(finalPoints) } : {}),
        ...(teacherNote !== undefined ? { teacherNote } : {}),
        ...(aiFeedback !== undefined ? { aiFeedback } : {}),
        // If teacher provides finalPoints without explicitly passing needsReview, resolve needsReview to false
        ...(needsReview !== undefined
          ? { needsReview: Boolean(needsReview) }
          : (finalPoints !== undefined ? { needsReview: false } : {}))
      }
    });

    // If session is already published and linked to assignment, synchronize the updated grade
    const session = response.scan.session;
    if (session.isPublished && session.assignmentId && response.scan.studentId) {
      const allScanResponses = await prisma.slimCheckResponse.findMany({
        where: { scanId: response.scanId },
        include: { question: true },
        orderBy: { question: { number: 'asc' } }
      });
      const totalEarned = allScanResponses.reduce((sum, r) => sum + (r.finalPoints ?? r.aiPoints ?? 0), 0);
      const totalMax = session.totalMaxScore || session.questions.reduce((sum, q) => sum + q.maxPoints, 0);
      const calculatedGrade = totalMax > 0
        ? Math.max(1.0, Math.min(10.0, parseFloat(((totalEarned / totalMax) * 9 + 1).toFixed(1))))
        : 0;
      const feedbackLines = allScanResponses
        .map((r, i) => `Vraag ${i + 1}: ${r.finalPoints ?? r.aiPoints} pt — ${r.teacherNote || r.aiFeedback || ''}`)
        .join('\n');

      const existingSub = await prisma.assignmentSubmission.findFirst({
        where: {
          assignmentId: session.assignmentId,
          studentId: response.scan.studentId
        }
      });
      if (existingSub) {
        await prisma.assignmentSubmission.update({
          where: { id: existingSub.id },
          data: {
            grade: session.returnGrade ? String(calculatedGrade) : existingSub.grade,
            teacherNotes: session.returnFeedback ? feedbackLines : existingSub.teacherNotes,
            aiGradeReport: feedbackLines
          }
        });
      }
    }

    return updated;
  });

  // ── PUBLICEREN & EXPORT ──────────────────────────────────────────────────────

  // Publish session to students & sync to assignments
  fastify.post('/sessions/:id/publish', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const session = await prisma.slimCheckSession.findUnique({ where: { id } });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    await slimCheckService.publishSession(id);

    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'slimcheck.publish',
      category: 'data',
      severity: 'info',
      details: { sessionId: id, title: session.title }
    });

    return { success: true, message: 'Resultaten succesvol gepubliceerd!' };
  });

  // Export PDF Report
  fastify.get('/sessions/:id/export/pdf', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const session = await prisma.slimCheckSession.findUnique({ where: { id } });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    try {
      const pdfBuffer = await slimCheckService.generatePdfReport(id);
      const safeTitle = (session.title || 'rapport').replace(/[^a-zA-Z0-9_-]/g, '_');

      return reply
        .header('Content-Disposition', `attachment; filename="SlimCheck_${safeTitle}.pdf"`)
        .header('Content-Type', 'application/pdf')
        .send(pdfBuffer);
    } catch (err: any) {
      return reply.status(500).send({ error: 'Fout bij genereren PDF: ' + err.message });
    }
  });

  // Export CSV for Magister / SOMtoday
  fastify.get('/sessions/:id/export/csv', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const session = await prisma.slimCheckSession.findUnique({ where: { id } });
    if (!session || session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Sessie niet gevonden' });
    }

    try {
      const csvData = await slimCheckService.generateCsvExport(id);
      const safeTitle = (session.title || 'rapport').replace(/[^a-zA-Z0-9_-]/g, '_');

      return reply
        .header('Content-Disposition', `attachment; filename="SlimCheck_${safeTitle}.csv"`)
        .header('Content-Type', 'text/csv; charset=utf-8')
        .send(csvData);
    } catch (err: any) {
      return reply.status(500).send({ error: 'Fout bij exporteren CSV: ' + err.message });
    }
  });

  // View cropped answer image
  fastify.get('/responses/:id/crop', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const resp = await prisma.slimCheckResponse.findUnique({
      where: { id },
      include: { scan: { include: { session: true } } }
    });

    if (!resp || resp.scan.session.orgId !== user.orgId || !resp.cropImagePath) {
      return reply.status(404).send({ error: 'Afbeelding niet gevonden' });
    }

    // Security check for student role
    if (user.role === 'student') {
      if (resp.scan.studentId !== user.id || !resp.scan.session.isPublished || (!resp.scan.session.returnFeedback && !resp.scan.session.returnScan)) {
        return reply.status(403).send({ error: 'Geen toegang tot deze uitsnede' });
      }
    }

    const filePath = path.join(process.cwd(), resp.cropImagePath);
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'Afbeeldingsbestand ontbreekt' });
    }

    const stream = fs.createReadStream(filePath);
    return reply.header('Content-Type', 'image/jpeg').send(stream);
  });

  // ── ADMIN ENDPOINTS ──────────────────────────────────────────────────────────

  // Manual retention cleanup trigger (admin only)
  fastify.post('/admin/cleanup', async (request, reply) => {
    const user = request.user as any;
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return reply.status(403).send({ error: 'Alleen voor beheerders' });
    }

    const result = await slimCheckService.runRetentionCleanup();

    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'slimcheck.retention_cleanup',
      category: 'data',
      severity: 'info',
      details: result
    });

    return { success: true, ...result };
  });

  // ── STUDENT PORTAAL ENDPOINTS ────────────────────────────────────────────────

  // Get student's formative SlimCheck results
  fastify.get('/student/results', async (request, reply) => {
    const user = request.user as any;
    if (user.role !== 'student') {
      return reply.status(403).send({ error: 'Alleen voor leerlingen' });
    }

    const scans = await prisma.slimCheckScan.findMany({
      where: {
        studentId: user.id,
        session: {
          isPublished: true,
          orgId: user.orgId
        }
      },
      include: {
        session: {
          select: {
            id: true,
            title: true,
            subject: true,
            totalMaxScore: true,
            returnGrade: true,
            returnFeedback: true,
            returnScan: true,
            returnModelAnswer: true,
            publishedAt: true
          }
        },
        responses: {
          include: {
            question: { select: { number: true, maxPoints: true, promptText: true, modelAnswer: true } }
          },
          orderBy: { question: { number: 'asc' } }
        }
      },
      orderBy: { session: { publishedAt: 'desc' } }
    });

    // Mask according to teacher's return toggles
    const results = scans.map(scan => {
      const session = scan.session;
      const totalEarned = scan.responses.reduce((sum, r) => sum + (r.finalPoints ?? r.aiPoints ?? 0), 0);
      const totalMax = session.totalMaxScore || scan.responses.reduce((sum, r) => sum + r.question.maxPoints, 0);

      const calculatedGrade = totalMax > 0
        ? Math.max(1.0, Math.min(10.0, parseFloat(((totalEarned / totalMax) * 9 + 1).toFixed(1))))
        : null;

      return {
        sessionId: session.id,
        scanId: scan.id,
        title: session.title,
        subject: session.subject,
        publishedAt: session.publishedAt,
        returnGrade: session.returnGrade,
        returnFeedback: session.returnFeedback,
        returnScan: session.returnScan,
        returnModelAnswer: session.returnModelAnswer,
        startPage: scan.startPage,
        endPage: scan.endPage,
        grade: session.returnGrade ? calculatedGrade : null,
        totalPoints: session.returnGrade ? totalEarned : null,
        totalMaxPoints: session.returnGrade ? totalMax : null,
        responses: session.returnFeedback ? scan.responses.map(r => ({
          id: r.id,
          questionNumber: r.question.number,
          maxPoints: r.question.maxPoints,
          promptText: r.question.promptText || null,
          modelAnswer: session.returnModelAnswer ? r.question.modelAnswer : null,
          points: (r.needsReview && r.finalPoints === null) ? null : (r.finalPoints ?? r.aiPoints),
          aiFeedback: r.aiFeedback || null,
          teacherNote: r.teacherNote || null,
          feedback: r.teacherNote || r.aiFeedback,
          hasCrop: !!r.cropImagePath,
          needsReview: r.needsReview
        })) : [],
        hasScan: session.returnScan
      };
    });

    return results;
  });

  // Get student's scanned page image (if returnScan is enabled)
  fastify.get('/student/scans/:scanId/pages/:pageNumber', async (request, reply) => {
    const user = request.user as any;
    const { scanId, pageNumber } = request.params as { scanId: string; pageNumber: string };

    const scan = await prisma.slimCheckScan.findUnique({
      where: { id: scanId },
      include: { session: true }
    });

    if (!scan || scan.session.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Scan niet gevonden' });
    }

    if (user.role === 'student') {
      if (scan.studentId !== user.id || !scan.session.isPublished || !scan.session.returnScan) {
        return reply.status(403).send({ error: 'Geen toegang tot deze scan' });
      }
    }

    const pageNum = parseInt(pageNumber, 10);
    if (isNaN(pageNum) || pageNum < scan.startPage || pageNum > scan.endPage) {
      return reply.status(400).send({ error: 'Ongeldig paginanummer' });
    }

    const pagesDir = path.join(process.cwd(), 'uploads', 'slimcheck', scan.sessionId, 'pages');
    const pageFile = path.join(pagesDir, `page_${String(pageNum).padStart(3, '0')}.png`);

    if (!fs.existsSync(pageFile)) {
      return reply.status(404).send({ error: 'Paginabestand niet gevonden' });
    }

    const stream = fs.createReadStream(pageFile);
    return reply.header('Content-Type', 'image/png').send(stream);
  });
}

