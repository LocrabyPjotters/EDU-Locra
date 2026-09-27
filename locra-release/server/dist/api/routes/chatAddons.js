"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = chatAddonsRoutes;
const index_1 = require("../../index");
const auth_1 = require("../../middleware/auth");
async function chatAddonsRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.requireAuth);
    // ── GET /labels — Lijst alle labels in de org ──
    fastify.get('/labels', async (request) => {
        const user = request.user;
        return index_1.prisma.chatLabel.findMany({
            where: { orgId: user.orgId },
            orderBy: { name: 'asc' }
        });
    });
    // ── POST /labels — Nieuw label aanmaken ──
    fastify.post('/labels', async (request, reply) => {
        const user = request.user;
        const { name, color, icon } = request.body;
        if (!name || !name.trim()) {
            return reply.status(400).send({ error: 'Naam is verplicht' });
        }
        try {
            const label = await index_1.prisma.chatLabel.create({
                data: {
                    orgId: user.orgId,
                    name: name.trim(),
                    color: color || '#6366f1',
                    icon: icon || '🏷️'
                }
            });
            return label;
        }
        catch (err) {
            if (err.code === 'P2002') {
                return reply.status(400).send({ error: 'Dit label bestaat al' });
            }
            throw err;
        }
    });
    // ── DELETE /labels/:id — Label verwijderen ──
    fastify.delete('/labels/:id', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const label = await index_1.prisma.chatLabel.findUnique({ where: { id } });
        if (!label || label.orgId !== user.orgId) {
            return reply.status(404).send({ error: 'Label niet gevonden' });
        }
        await index_1.prisma.chatLabel.delete({ where: { id } });
        return { success: true };
    });
    // ── POST /conversations/:id/labels — Labels koppelen aan gesprek ──
    fastify.post('/conversations/:id/labels', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const { labelIds } = request.body;
        const conv = await index_1.prisma.conversation.findUnique({ where: { id } });
        if (!conv || conv.userId !== user.id) {
            return reply.status(403).send({ error: 'Geen toegang tot dit gesprek' });
        }
        // Replace existing labels
        await index_1.prisma.conversationLabel.deleteMany({ where: { conversationId: id } });
        if (Array.isArray(labelIds) && labelIds.length > 0) {
            await index_1.prisma.conversationLabel.createMany({
                data: labelIds.map(labelId => ({
                    conversationId: id,
                    labelId
                }))
            });
        }
        const updated = await index_1.prisma.conversation.findUnique({
            where: { id },
            include: { labels: { include: { label: true } } }
        });
        return updated;
    });
    // ── POST /messages/:id/pin — Bericht vastpinnen ──
    fastify.post('/messages/:id/pin', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const { note } = request.body || {};
        const msg = await index_1.prisma.message.findUnique({ where: { id } });
        if (!msg) {
            return reply.status(404).send({ error: 'Bericht niet gevonden' });
        }
        const pinned = await index_1.prisma.pinnedMessage.upsert({
            where: {
                messageId_userId: {
                    messageId: id,
                    userId: user.id
                }
            },
            update: { note },
            create: {
                messageId: id,
                userId: user.id,
                note
            }
        });
        return { success: true, pinned };
    });
    // ── DELETE /messages/:id/pin — Bericht ontpinnen ──
    fastify.delete('/messages/:id/pin', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        await index_1.prisma.pinnedMessage.deleteMany({
            where: {
                messageId: id,
                userId: user.id
            }
        });
        return { success: true };
    });
    // ── GET /conversations/:id/pinned — Alle vastgepinde berichten in een gesprek ──
    fastify.get('/conversations/:id/pinned', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const messages = await index_1.prisma.message.findMany({
            where: { conversationId: id },
            select: { id: true }
        });
        const messageIds = messages.map(m => m.id);
        const pinnedItems = await index_1.prisma.pinnedMessage.findMany({
            where: {
                userId: user.id,
                messageId: { in: messageIds }
            }
        });
        const pinnedMessageIds = pinnedItems.map(p => p.messageId);
        const fullPinnedMessages = await index_1.prisma.message.findMany({
            where: { id: { in: pinnedMessageIds } },
            orderBy: { createdAt: 'asc' }
        });
        return fullPinnedMessages.map(m => {
            const pinInfo = pinnedItems.find(p => p.messageId === m.id);
            return {
                ...m,
                pinNote: pinInfo?.note,
                pinnedAt: pinInfo?.createdAt
            };
        });
    });
}
