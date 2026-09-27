"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = groupRoutes;
const index_1 = require("../../index");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
async function groupRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.requireAuth);
    // List all groups for the org
    fastify.get('/', async (request, reply) => {
        const groups = await index_1.prisma.group.findMany({
            where: { orgId: request.user.orgId },
            include: {
                _count: {
                    select: { members: true }
                },
                knowledgeBases: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return groups;
    });
    // Get a single group with members
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params;
        const group = await index_1.prisma.group.findUnique({
            where: { id },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, username: true, displayName: true, email: true, role: true }
                        }
                    }
                },
                knowledgeBases: {
                    select: { id: true, name: true }
                }
            }
        });
        if (!group || group.orgId !== request.user.orgId) {
            return reply.status(404).send({ error: 'Groep niet gevonden' });
        }
        return group;
    });
    // Create a new group (admin only)
    fastify.post('/', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { name, description } = request.body;
        if (!name)
            return reply.status(400).send({ error: 'Groepsnaam is verplicht' });
        try {
            const group = await index_1.prisma.group.create({
                data: {
                    orgId: request.user.orgId,
                    name,
                    description: description || null,
                    members: {
                        create: {
                            userId: request.user.id,
                            role: 'owner'
                        }
                    }
                },
                include: {
                    _count: { select: { members: true } }
                }
            });
            await index_1.prisma.auditLog.create({
                data: {
                    orgId: request.user.orgId,
                    userId: request.user.id,
                    action: 'group.create',
                    details: JSON.stringify({ groupName: name })
                }
            });
            return reply.status(201).send(group);
        }
        catch (e) {
            if (e.message?.includes('Unique')) {
                return reply.status(400).send({ error: 'Er bestaat al een groep met deze naam' });
            }
            return reply.status(400).send({ error: 'Kan groep niet aanmaken: ' + e.message });
        }
    });
    // Update a group (admin only)
    fastify.put('/:id', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { id } = request.params;
        const { name, description } = request.body;
        const group = await index_1.prisma.group.findUnique({ where: { id } });
        if (!group || group.orgId !== request.user.orgId) {
            return reply.status(404).send({ error: 'Groep niet gevonden' });
        }
        try {
            const updated = await index_1.prisma.group.update({
                where: { id },
                data: {
                    name: name ?? group.name,
                    description: description !== undefined ? description : group.description
                }
            });
            return updated;
        }
        catch (e) {
            if (e.message?.includes('Unique')) {
                return reply.status(400).send({ error: 'Er bestaat al een groep met deze naam' });
            }
            return reply.status(400).send({ error: 'Kan groep niet updaten' });
        }
    });
    // Delete a group (admin only)
    fastify.delete('/:id', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { id } = request.params;
        const group = await index_1.prisma.group.findUnique({ where: { id } });
        if (!group || group.orgId !== request.user.orgId) {
            return reply.status(404).send({ error: 'Groep niet gevonden' });
        }
        // Delete members first (no cascade in schema)
        await index_1.prisma.groupMember.deleteMany({ where: { groupId: id } });
        await index_1.prisma.group.delete({ where: { id } });
        await index_1.prisma.auditLog.create({
            data: {
                orgId: request.user.orgId,
                userId: request.user.id,
                action: 'group.delete',
                details: JSON.stringify({ groupName: group.name })
            }
        });
        return { success: true };
    });
    // ── Members ───────────────────────────────
    // List members of a group
    fastify.get('/:id/members', async (request, reply) => {
        const { id } = request.params;
        const group = await index_1.prisma.group.findUnique({ where: { id } });
        if (!group || group.orgId !== request.user.orgId) {
            return reply.status(404).send({ error: 'Groep niet gevonden' });
        }
        const members = await index_1.prisma.groupMember.findMany({
            where: { groupId: id },
            include: {
                user: {
                    select: { id: true, username: true, displayName: true, email: true, role: true }
                }
            }
        });
        return members;
    });
    // Add a member to a group (admin only)
    fastify.post('/:id/members', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { id } = request.params;
        const { userId, role } = request.body;
        if (!userId)
            return reply.status(400).send({ error: 'userId is verplicht' });
        const group = await index_1.prisma.group.findUnique({ where: { id } });
        if (!group || group.orgId !== request.user.orgId) {
            return reply.status(404).send({ error: 'Groep niet gevonden' });
        }
        // Verify user belongs to same org
        const targetUser = await index_1.prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser || targetUser.orgId !== request.user.orgId) {
            return reply.status(400).send({ error: 'Gebruiker niet gevonden in je organisatie' });
        }
        try {
            const member = await index_1.prisma.groupMember.create({
                data: {
                    groupId: id,
                    userId,
                    role: role || 'member'
                },
                include: {
                    user: {
                        select: { id: true, username: true, displayName: true, email: true, role: true }
                    }
                }
            });
            return reply.status(201).send(member);
        }
        catch (e) {
            if (e.message?.includes('Unique')) {
                return reply.status(400).send({ error: 'Gebruiker is al lid van deze groep' });
            }
            return reply.status(400).send({ error: 'Kan lid niet toevoegen' });
        }
    });
    // Remove a member from a group (admin only)
    fastify.delete('/:id/members/:userId', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { id, userId } = request.params;
        const group = await index_1.prisma.group.findUnique({ where: { id } });
        if (!group || group.orgId !== request.user.orgId) {
            return reply.status(404).send({ error: 'Groep niet gevonden' });
        }
        try {
            await index_1.prisma.groupMember.delete({
                where: { groupId_userId: { groupId: id, userId } }
            });
            return { success: true };
        }
        catch {
            return reply.status(404).send({ error: 'Lid niet gevonden in deze groep' });
        }
    });
}
