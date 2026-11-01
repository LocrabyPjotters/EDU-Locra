import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { createAuditLog } from '../../services/auditService';
import { decryptMessage } from '../../utils/crypto';
import { sendEmail, buildEmergencyUnlockNotificationEmail } from '../../utils/mailer';

export default async function vpRoutes(fastify: FastifyInstance) {
  // Vertrouwenspersoon interface: accessible by confidant (level 35), admin (level 40), and superadmin (level 50)
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', requireRole('confidant'));

  // Get confidant dashboard statistics
  fastify.get('/stats', async (request, reply) => {
    const user = request.user!;

    const [openFlags, inReviewFlags, resolvedFlags, criticalFlags, totalRequests] = await Promise.all([
      prisma.studentCareFlag.count({ where: { orgId: user.orgId, status: 'open' } }),
      prisma.studentCareFlag.count({ where: { orgId: user.orgId, status: 'in_review' } }),
      prisma.studentCareFlag.count({ where: { orgId: user.orgId, status: 'resolved' } }),
      prisma.studentCareFlag.count({ where: { orgId: user.orgId, severity: 'critical', status: 'open' } }),
      prisma.chatAccessRequest.count({
        where: {
          conversation: { orgId: user.orgId },
          status: { in: ['approved', 'confidant_unlocked'] }
        }
      })
    ]);

    const orgSettings = await prisma.orgSettings.findUnique({
      where: { orgId: user.orgId },
      select: { smtpVerified: true }
    });

    return {
      openFlags,
      inReviewFlags,
      resolvedFlags,
      criticalFlags,
      totalRequests,
      smtpVerified: Boolean(orgSettings?.smtpVerified)
    };
  });

  // Get student care flags (Zorgsignalen)
  fastify.get('/flags', async (request, reply) => {
    const user = request.user!;
    const { status, severity, page = 1, limit = 50 } = request.query as any;

    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { orgId: user.orgId };

    if (status && status !== 'all') {
      where.status = status;
    }
    if (severity && severity !== 'all') {
      where.severity = severity;
    }

    const [flags, total] = await Promise.all([
      prisma.studentCareFlag.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          user: {
            select: { id: true, username: true, displayName: true, email: true, role: true }
          }
        }
      }),
      prisma.studentCareFlag.count({ where })
    ]);

    return {
      data: flags,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    };
  });

  // GET /care-signals (VP Escalation Radar endpoint)
  fastify.get('/care-signals', async (request, reply) => {
    const user = request.user!;

    const [level3Count, level2Count, level1Count, recentSignals] = await Promise.all([
      prisma.studentCareFlag.count({ where: { orgId: user.orgId, escalationLevel: 3, status: { in: ['open', 'in_review'] } } }),
      prisma.studentCareFlag.count({ where: { orgId: user.orgId, escalationLevel: 2, status: { in: ['open', 'in_review'] } } }),
      prisma.studentCareFlag.count({ where: { orgId: user.orgId, escalationLevel: 1, status: { in: ['open', 'in_review'] } } }),
      prisma.studentCareFlag.findMany({
        where: { orgId: user.orgId },
        orderBy: [{ escalationLevel: 'desc' }, { createdAt: 'desc' }],
        take: 30,
        include: {
          user: {
            select: { id: true, username: true, displayName: true, email: true, role: true }
          }
        }
      })
    ]);

    return {
      radarSummary: {
        level3Critical: level3Count,
        level2Elevated: level2Count,
        level1Informational: level1Count,
        totalActive: level3Count + level2Count
      },
      signals: recentSignals
    };
  });

  // Update status and notes on a care flag
  fastify.patch('/flags/:id', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { status, notes } = (request.body as any) || {};

    const flag = await prisma.studentCareFlag.findFirst({
      where: { id, orgId: user.orgId }
    });

    if (!flag) {
      return reply.status(404).send({ error: 'Zorgsignaal niet gevonden' });
    }

    const updated = await prisma.studentCareFlag.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        resolvedById: user.id
      }
    });

    await createAuditLog(prisma, {
      orgId: user.orgId!,
      userId: user.id,
      action: 'CARE_FLAG_UPDATED',
      category: 'security',
      severity: 'info',
      details: `Vertrouwenspersoon ${user.username || 'Vertrouwenspersoon'} heeft zorgsignaal #${id} bijgewerkt naar status: ${status || flag.status}.`
    });

    return updated;
  });

  // Get chats that have care flags or unlock history
  fastify.get('/chats', async (request, reply) => {
    const user = request.user!;
    const { page = 1, limit = 50 } = request.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      orgId: user.orgId
    };

    const [conversations, total, orgSettings] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          user: {
            select: { id: true, username: true, displayName: true, email: true, role: true }
          },
          accessRequests: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              scope: true,
              reason: true,
              createdAt: true,
              expiresAt: true
            }
          },
          _count: {
            select: { messages: true }
          }
        }
      }),
      prisma.conversation.count({ where }),
      prisma.orgSettings.findUnique({
        where: { orgId: user.orgId },
        select: { smtpVerified: true }
      })
    ]);

    return {
      data: conversations,
      smtpVerified: Boolean(orgSettings?.smtpVerified),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    };
  });

  // Get specific chat with decryption if authorized or emergency unlocked
  fastify.get('/chats/:id', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const conversation = await prisma.conversation.findFirst({
      where: { id, orgId: user.orgId },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, email: true, role: true }
        },
        accessRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            scope: true,
            reason: true,
            selectedMsgIds: true,
            expiresAt: true,
            resolvedAt: true,
            createdAt: true,
            requestedBy: {
              select: { id: true, username: true, displayName: true, role: true }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, username: true, displayName: true, role: true } }
          }
        }
      }
    });

    if (!conversation) {
      return reply.status(404).send({ error: 'Gesprek niet gevonden' });
    }

    const latestAccess = conversation.accessRequests[0];
    const isApproved = latestAccess?.status === 'approved' && new Date(latestAccess.expiresAt) > new Date();
    const isConfidantUnlocked = latestAccess?.status === 'confidant_unlocked';
    const isUnlocked = isApproved || isConfidantUnlocked;

    let selectedIds: string[] = [];
    if (isApproved && latestAccess.scope === 'selection' && latestAccess.selectedMsgIds) {
      try {
        selectedIds = JSON.parse(latestAccess.selectedMsgIds);
      } catch {
        selectedIds = [];
      }
    }

    const processedMessages = conversation.messages.map(m => {
      let content = m.content;
      let isDecrypted = false;

      if (isUnlocked) {
        if (isConfidantUnlocked || latestAccess.scope === 'full') {
          if (m.contentEncrypted) {
            content = decryptMessage(m.contentEncrypted);
            isDecrypted = true;
          }
        } else if (latestAccess.scope === 'selection') {
          if (selectedIds.includes(m.id) && m.contentEncrypted) {
            content = decryptMessage(m.contentEncrypted);
            isDecrypted = true;
          }
        }
      }

      return {
        ...m,
        content,
        isDecrypted
      };
    });

    const orgSettings = await prisma.orgSettings.findUnique({
      where: { orgId: user.orgId },
      select: { smtpVerified: true }
    });

    return {
      ...conversation,
      messages: processedMessages,
      smtpVerified: Boolean(orgSettings?.smtpVerified),
      accessStatus: {
        isUnlocked,
        status: latestAccess?.status || 'locked',
        scope: latestAccess?.scope || 'none',
        reason: latestAccess?.reason || null,
        expiresAt: latestAccess?.expiresAt || null,
        latestRequest: latestAccess || null
      }
    };
  });

  // Emergency unlock directly from Vertrouwenspersoon portal
  fastify.post('/chats/:id/unlock', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { reason } = (request.body as any) || {};

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return reply.status(400).send({ error: 'Een duidelijke zorgreden van minimaal 10 tekens is wettelijk verplicht.' });
    }

    const orgSettings = await prisma.orgSettings.findUnique({
      where: { orgId: user.orgId },
      select: { smtpVerified: true }
    });

    if (!orgSettings?.smtpVerified) {
      return reply.status(400).send({
        error: 'Mailing server (SMTP) is niet geverifieerd. Nood-ontgrendeling vereist een actieve en met testcode geverifieerde mailserver zodat de leerling per direct op de hoogte wordt gesteld.'
      });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, orgId: user.orgId },
      include: {
        user: { select: { id: true, username: true, displayName: true, email: true } }
      }
    });

    if (!conversation) {
      return reply.status(404).send({ error: 'Gesprek niet gevonden' });
    }

    const student = conversation.user;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const unlockReq = await prisma.chatAccessRequest.create({
      data: {
        conversationId: id,
        requestedById: user.id,
        targetUserId: student.id,
        token,
        status: 'confidant_unlocked',
        scope: 'full',
        reason: reason.trim(),
        expiresAt,
        resolvedAt: new Date()
      }
    });

    const confidantName = user.username || 'Vertrouwenspersoon';
    const studentName = student.displayName || student.username;

    if (student.email) {
      try {
        await sendEmail(
          user.orgId!,
          student.email,
          `🛡️ Inzage in AI-gesprek door Vertrouwenspersoon: ${conversation.title}`,
          buildEmergencyUnlockNotificationEmail(studentName, confidantName, conversation.title, reason.trim())
        );
      } catch (e) {
        console.warn('Could not notify student of confidant unlock:', e);
      }
    }

    await createAuditLog(prisma, {
      orgId: user.orgId!,
      userId: user.id,
      action: 'CONFIDANT_CHAT_UNLOCKED',
      category: 'security',
      severity: 'warning',
      details: `Vertrouwenspersoon ${confidantName} heeft gesprek "${conversation.title}" ontgrendeld met zorgreden: "${reason.trim()}".`
    });

    return {
      success: true,
      message: 'Gesprek ontgrendeld conform de vertrouwenspersoon-procedure. De leerling is per e-mail geïnformeerd.',
      requestId: unlockReq.id
    };
  });
}
