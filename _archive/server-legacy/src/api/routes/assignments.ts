import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';

export default async function assignmentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // ── GET / — Lijst opdrachten (teacher/admin: alle, student: actieve) ──
  fastify.get('/', async (request) => {
    const user = request.user as any;

    if (['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return prisma.assignment.findMany({
        where: { orgId: user.orgId },
        include: {
          teacher: { select: { displayName: true, email: true } },
          group: { select: { name: true } },
          class: { select: { name: true } },
          _count: { select: { submissions: true } },
          submissions: {
            include: { student: { select: { displayName: true, email: true } } }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    // Studenten zien alleen actieve opdrachten
    const userGroups = await prisma.groupMember.findMany({
      where: { userId: user.id },
      select: { groupId: true }
    });
    const groupIds = userGroups.map(g => g.groupId);

    const userClasses = await prisma.studentClass.findMany({
      where: { studentId: user.id },
      select: { classId: true }
    });
    const classIds = userClasses.map(c => c.classId);

    return prisma.assignment.findMany({
      where: {
        orgId: user.orgId,
        isActive: true,
        OR: [
          { groupId: null, classId: null },
          { groupId: { in: groupIds } },
          { classId: { in: classIds } }
        ]
      },
      include: {
        teacher: { select: { displayName: true } },
        group: { select: { name: true } },
        class: { select: { name: true } },
        submissions: {
          where: { studentId: user.id },
          select: { id: true, status: true, conversationId: true, messageCount: true, startedAt: true, submittedAt: true, grade: true, teacherNotes: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  });

  // ── GET /:id — Detail van een opdracht ──
  fastify.get('/:id', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as any;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        teacher: { select: { displayName: true, email: true } },
        group: { select: { name: true } },
        class: { select: { name: true } },
        submissions: {
          where: user.role === 'student' ? { studentId: user.id } : undefined,
          include: {
            student: { select: { id: true, displayName: true, email: true } }
          },
          orderBy: { startedAt: 'desc' }
        }
      }
    });

    if (!assignment || assignment.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Opdracht niet gevonden' });
    }

    return assignment;
  });

  // ── POST / — Nieuwe opdracht aanmaken (alleen docenten/admins) ──
  fastify.post('/', async (request, reply) => {
    const user = request.user as any;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Alleen docenten kunnen opdrachten aanmaken' });
    }

    const { title, description, instructions, subject, dueDate, maxAttempts, groupId, classId, modelOverride, allowAttachments, aiRules } = request.body as any;

    if (!title || !description || !instructions) {
      return reply.status(400).send({ error: 'Titel, beschrijving en instructies zijn verplicht' });
    }

    const assignment = await prisma.assignment.create({
      data: {
        orgId: user.orgId,
        teacherId: user.id,
        title,
        description,
        instructions,
        aiRules: aiRules || null,
        subject: subject || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        maxAttempts: maxAttempts ? parseInt(maxAttempts, 10) : 0,
        groupId: groupId || null,
        classId: classId || null,
        modelOverride: modelOverride || null,
        allowAttachments: allowAttachments !== false
      }
    });

    return { success: true, assignment };
  });

  // ── PUT /:id — Opdracht bijwerken ──
  fastify.put('/:id', async (request, reply) => {
    const user = request.user as any;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { id } = request.params as any;
    const updates = request.body as any;

    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment || assignment.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Opdracht niet gevonden' });
    }

    const updated = await prisma.assignment.update({
      where: { id },
      data: {
        ...(updates.title && { title: updates.title }),
        ...(updates.description && { description: updates.description }),
        ...(updates.instructions && { instructions: updates.instructions }),
        ...(updates.subject !== undefined && { subject: updates.subject }),
        ...(updates.dueDate !== undefined && { dueDate: updates.dueDate ? new Date(updates.dueDate) : null }),
        ...(updates.maxAttempts !== undefined && { maxAttempts: parseInt(updates.maxAttempts, 10) }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        ...(updates.groupId !== undefined && { groupId: updates.groupId || null }),
        ...(updates.aiRules !== undefined && { aiRules: updates.aiRules || null }),
        ...(updates.classId !== undefined && { classId: updates.classId || null }),
        ...(updates.modelOverride !== undefined && { modelOverride: updates.modelOverride || null }),
        ...(updates.allowAttachments !== undefined && { allowAttachments: updates.allowAttachments })
      }
    });

    return { success: true, assignment: updated };
  });

  // ── DELETE /submissions/:id — Inzending Herstarten / Verwijderen ──
  fastify.delete('/submissions/:id', async (request, reply) => {
    const user = request.user as any;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { id } = request.params as any;

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id },
      include: { assignment: true }
    });

    if (!submission || submission.assignment.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Inzending niet gevonden' });
    }

    const convId = submission.conversationId;

    // 1. Delete messages in the conversation first
    if (convId) {
      await prisma.message.deleteMany({ where: { conversationId: convId } });
    }

    // 2. Delete the submission (has FK to conversation)
    await prisma.assignmentSubmission.delete({ where: { id } });

    // 3. Now safely delete the conversation
    if (convId) {
      await prisma.conversation.deleteMany({ where: { id: convId } });
    }

    return { success: true };
  });

  // ── DELETE /:id — Opdracht verwijderen ──
  fastify.delete('/:id', async (request, reply) => {
    const user = request.user as any;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { id } = request.params as any;
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment || assignment.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Opdracht niet gevonden' });
    }

    await prisma.assignment.delete({ where: { id } });
    return { success: true };
  });

  // ── POST /:id/start — Leerling begint met opdracht ──
  fastify.post('/:id/start', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as any;

    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment || assignment.orgId !== user.orgId || !assignment.isActive) {
      return reply.status(404).send({ error: 'Opdracht niet gevonden of niet actief' });
    }

    // Check max attempts
    if (assignment.maxAttempts > 0) {
      const existingCount = await prisma.assignmentSubmission.count({
        where: { assignmentId: id, studentId: user.id }
      });
      if (existingCount >= assignment.maxAttempts) {
        return reply.status(403).send({ error: `Maximaal ${assignment.maxAttempts} pogingen bereikt` });
      }
    }

    // Check for existing in-progress submission
    const existing = await prisma.assignmentSubmission.findFirst({
      where: { assignmentId: id, studentId: user.id, status: 'in_progress' }
    });

    if (existing) {
      return { success: true, submission: existing, conversationId: existing.conversationId, resuming: true };
    }

    // Create new conversation preloaded with instructions as system/assistant context
    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: `[Opdracht] ${assignment.title}`,
        modelId: assignment.modelOverride || null
      }
    });

    // Build comprehensive system prompt so the AI truly understands the assignment
    const deadlineStr = assignment.dueDate
      ? new Date(assignment.dueDate).toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '';
    const subjectLine = assignment.subject ? `Vak: ${assignment.subject}` : '';
    const deadlineLine = deadlineStr ? `Deadline: ${deadlineStr}` : '';

    const systemLines = [
      `=== OPDRACHT CONTEXT (NIET TONEN AAN LEERLING) ===`,
      `Titel: "${assignment.title}"`,
      `Beschrijving: ${assignment.description}`,
      subjectLine,
      deadlineLine,
      ``,
      `=== OPDRACHT INSTRUCTIES (VAN DE DOCENT) ===`,
      assignment.instructions,
      ``,
      `=== JOUW GEDRAGSREGELS ===`,
      `- Je bent de AI-assistent voor deze specifieke opdracht.`,
      `- Begeleid de leerling stap voor stap bij het maken van de opdracht.`,
      `- Geef NIET direct de antwoorden! Stel vragen om de leerling zelf na te laten denken.`,
      `- Verwijs naar de opdracht-instructies hierboven wanneer de leerling afdwaalt.`,
      `- Moedig de leerling aan en geef hints wanneer ze vastlopen.`,
      `- Houd je antwoorden relevant aan de opdracht.`,
      `- Als de leerling klaar lijkt te zijn, herinner hen eraan dat ze de opdracht kunnen inleveren.`,
      assignment.aiRules ? `\n=== EXTRA REGELS VAN DE DOCENT ===\n${assignment.aiRules}` : ''
    ].filter(Boolean).join('\n');

    // Seed system instruction message (hidden from UI but sent to AI)
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: user.id,
        role: 'system',
        content: systemLines
      }
    });

    // Build visible welcome message for the student
    const welcomeParts: string[] = [];
    welcomeParts.push(`# ${assignment.title}`);
    welcomeParts.push('');
    if (assignment.subject) {
      welcomeParts.push(`> **Vak:** ${assignment.subject}`);
    }
    if (deadlineStr) {
      welcomeParts.push(`> **Deadline:** ${deadlineStr}`);
    }
    welcomeParts.push('');
    welcomeParts.push('### 📝 Opdracht');
    welcomeParts.push('');
    welcomeParts.push(assignment.description);
    welcomeParts.push('');
    welcomeParts.push('---');
    welcomeParts.push('');
    welcomeParts.push('Hoi! Ik ben je AI-assistent voor deze opdracht. Ik help je stap voor stap, maar ik geef niet zomaar de antwoorden. Ik stel vragen zodat je er zelf over nadenkt!');
    welcomeParts.push('');
    welcomeParts.push('**Stel gerust je eerste vraag of begin gewoon met de opdracht!**');

    // Generate visible welcome message for the student
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: user.id,
        role: 'assistant',
        content: welcomeParts.join('\n')
      }
    });

    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId: id,
        studentId: user.id,
        conversationId: conversation.id
      }
    });

    return { success: true, submission, conversationId: conversation.id };
  });

  // ── POST /:id/submit — Leerling dient opdracht in ──
  fastify.post('/:id/submit', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as any;

    const submission = await prisma.assignmentSubmission.findFirst({
      where: { assignmentId: id, studentId: user.id, status: 'in_progress' }
    });

    if (!submission) {
      return reply.status(404).send({ error: 'Geen lopende opdracht gevonden om in te leveren' });
    }

    let messageCount = 0;
    if (submission.conversationId) {
      messageCount = await prisma.message.count({
        where: { conversationId: submission.conversationId }
      });
    }

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
        messageCount
      }
    });

    return { success: true, submission: updated };
  });

  // ── PUT /submissions/:submissionId/review — Docent beoordeelt ──
  fastify.put('/submissions/:submissionId/review', async (request, reply) => {
    const user = request.user as any;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { submissionId } = request.params as any;
    const { grade, teacherNotes } = request.body as any;

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: true }
    });

    if (!submission || submission.assignment.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Inzending niet gevonden' });
    }

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'reviewed',
        grade: grade !== undefined ? String(grade) : null,
        teacherNotes: teacherNotes || null,
        reviewedAt: new Date()
      }
    });

    return { success: true, submission: updated };
  });

  // ── GET /submissions/:submissionId/chat — Docent bekijkt chat van leerling ──
  fastify.get('/submissions/:submissionId/chat', async (request, reply) => {
    const user = request.user as any;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { submissionId } = request.params as any;
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { 
        assignment: true,
        student: { select: { id: true, displayName: true, email: true } }
      }
    });

    if (!submission || submission.assignment.orgId !== user.orgId || !submission.conversationId) {
      return reply.status(404).send({ error: 'Chat of inzending niet gevonden' });
    }

    const rawMessages = await prisma.message.findMany({
      where: { conversationId: submission.conversationId },
      orderBy: { createdAt: 'asc' },
      include: { feedback: true }
    });

    // Decrypt encrypted messages so teachers can read them
    let decryptFn: ((s: string) => string) | null = null;
    try {
      const { decryptMessage } = require('../../utils/crypto');
      decryptFn = decryptMessage;
    } catch (_) {}

    const messages = rawMessages.map(m => ({
      ...m,
      content: (m as any).contentEncrypted && decryptFn 
        ? decryptFn((m as any).contentEncrypted) 
        : m.content,
      teacherFeedback: m.feedback?.[0]?.reason || null
    }));

    return { 
      submission,
      messages, 
      conversationId: submission.conversationId 
    };
  });

  // ── POST /submissions/:submissionId/attach-doc — Student links a Google Doc ──
  fastify.post('/submissions/:submissionId/attach-doc', async (request, reply) => {
    const user = request.user as any;
    const { submissionId } = request.params as any;
    const { googleDocUrl } = request.body as any;

    if (!googleDocUrl || !googleDocUrl.includes('docs.google.com/document')) {
      return reply.status(400).send({ error: 'Geldige Google Doc URL vereist' });
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: true }
    });

    if (!submission || submission.studentId !== user.id) {
      return reply.status(404).send({ error: 'Inzending niet gevonden of geen toegang' });
    }

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { googleDocUrl }
    });

    return { success: true, submission: updated };
  });

  // ── POST /submissions/:submissionId/auto-grade — AI auto-grading voor docenten ──
  fastify.post('/submissions/:submissionId/auto-grade', async (request, reply) => {
    const user = request.user as any;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { submissionId } = request.params as any;

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: true }
    });

    if (!submission || !submission.googleDocUrl) {
      return reply.status(400).send({ error: 'Geen Google Doc gekoppeld aan deze inzending' });
    }

    // Voor nu een stub-reactie. De daadwerkelijke Google Docs uitlezing vereist credentials
    // of parsing van een openbare link, gevolgd door een call naar het AI-model.
    const aiGradeReport = "AI Beoordeling (Demo):\n\nHet document ziet er goed uit. De leerling heeft de instructies grotendeels gevolgd. \n\nVoorlopig cijfer: 7.5";

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { aiGradeReport }
    });

    return { success: true, submission: updated };
  });
}
