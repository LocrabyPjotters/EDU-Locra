import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { decryptMessage } from '../../utils/crypto';
import { sendEmail, buildAccessApprovedNotificationEmail } from '../../utils/mailer';
import { createAuditLog } from '../../services/auditService';

export default async function accessRequestRoutes(fastify: FastifyInstance) {
  // Get pending access requests for the logged-in student
  fastify.get('/my/pending', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user!;
    const requests = await prisma.chatAccessRequest.findMany({
      where: {
        targetUserId: user.id,
        status: 'pending',
        expiresAt: { gt: new Date() }
      },
      include: {
        requestedBy: { select: { displayName: true, username: true, role: true } },
        conversation: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return requests;
  });

  // Fetch access request details by token
  fastify.get('/:token', async (request, reply) => {
    const { token } = request.params as { token: string };

    const accessReq = await prisma.chatAccessRequest.findUnique({
      where: { token },
      include: {
        requestedBy: {
          select: { id: true, displayName: true, username: true, role: true }
        },
        targetUser: {
          select: { id: true, displayName: true, username: true, email: true }
        },
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                role: true,
                content: true,
                contentEncrypted: true,
                createdAt: true,
                modelUsed: true
              }
            }
          }
        }
      }
    });

    if (!accessReq) {
      return reply.status(404).send({ error: 'Toegangsverzoek niet gevonden of link is verlopen.' });
    }

    if (new Date() > new Date(accessReq.expiresAt) && accessReq.status === 'pending') {
      await prisma.chatAccessRequest.update({
        where: { id: accessReq.id },
        data: { status: 'expired' }
      });
      return reply.status(410).send({ error: 'Dit toegangsverzoek is verlopen.' });
    }

    // Decrypt messages so the student sees their own messages in the selection UI
    const decryptedMessages = accessReq.conversation.messages.map(m => {
      let content = m.content;
      if (content === '[Versleuteld Bericht]' && m.contentEncrypted) {
        content = decryptMessage(m.contentEncrypted);
      }
      return {
        id: m.id,
        role: m.role,
        content,
        createdAt: m.createdAt,
        modelUsed: m.modelUsed
      };
    });

    return {
      id: accessReq.id,
      status: accessReq.status,
      scope: accessReq.scope,
      selectedMsgIds: accessReq.selectedMsgIds ? JSON.parse(accessReq.selectedMsgIds) : [],
      reason: accessReq.reason,
      expiresAt: accessReq.expiresAt,
      requestedBy: accessReq.requestedBy,
      targetUser: accessReq.targetUser,
      conversation: {
        id: accessReq.conversation.id,
        title: accessReq.conversation.title,
        messageCount: decryptedMessages.length
      },
      messages: decryptedMessages
    };
  });

  // Student responds: approve or reject with scope
  fastify.post('/:token/respond', async (request, reply) => {
    const { token } = request.params as { token: string };
    const body = (request.body as any) || {};
    const { action, scope = 'full', selectedMsgIds = [] } = body;

    if (!['approve', 'reject'].includes(action)) {
      return reply.status(400).send({ error: 'Ongeldige actie. Kies goedkeuren of afwijzen.' });
    }

    const accessReq = await prisma.chatAccessRequest.findUnique({
      where: { token },
      include: {
        requestedBy: true,
        targetUser: true,
        conversation: true
      }
    });

    if (!accessReq) {
      return reply.status(404).send({ error: 'Toegangsverzoek niet gevonden.' });
    }

    if (accessReq.status !== 'pending') {
      return reply.status(400).send({ error: `Dit verzoek is reeds beantwoord (${accessReq.status}).` });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const chosenScope = action === 'approve' ? scope : 'metadata_only';

    const updated = await prisma.chatAccessRequest.update({
      where: { id: accessReq.id },
      data: {
        status: newStatus,
        scope: chosenScope,
        selectedMsgIds: action === 'approve' && Array.isArray(selectedMsgIds) ? JSON.stringify(selectedMsgIds) : null,
        resolvedAt: new Date()
      }
    });

    // Notify requestedBy via email if SMTP is configured
    try {
      const scopeLabel = chosenScope === 'full'
        ? 'Volledige chat vrijgegeven'
        : chosenScope === 'selection'
        ? `Gedeeltelijke selectie (${selectedMsgIds.length} berichten)`
        : 'Alleen titel en metadata';

      if (accessReq.requestedBy.email && action === 'approve') {
        await sendEmail(
          accessReq.conversation.orgId || '',
          accessReq.requestedBy.email,
          `✅ Toestemming verleend voor chat: ${accessReq.conversation.title}`,
          buildAccessApprovedNotificationEmail(
            accessReq.requestedBy.displayName || accessReq.requestedBy.username,
            accessReq.targetUser.displayName || accessReq.targetUser.username,
            accessReq.conversation.title,
            scopeLabel
          )
        );
      }
    } catch (e) {
      console.warn('Could not send notification email to requester:', e);
    }

    await createAuditLog(prisma, {
      orgId: accessReq.conversation.orgId || '',
      userId: accessReq.targetUserId,
      action: action === 'approve' ? 'chat.access-approved' : 'chat.access-rejected',
      category: 'security',
      severity: 'info',
      details: {
        conversationId: accessReq.conversationId,
        requestedById: accessReq.requestedById,
        status: newStatus,
        scope: chosenScope,
        selectedCount: Array.isArray(selectedMsgIds) ? selectedMsgIds.length : 0
      },
      ipAddress: request.ip
    });

    return {
      success: true,
      status: newStatus,
      scope: chosenScope,
      message: action === 'approve'
        ? 'Toestemming succesvol verleend. De aanvrager heeft nu inzage conform jouw selectie.'
        : 'Het inzageverzoek is afgewezen. De chat blijft strikt vergrendeld.'
    };
  });
}

