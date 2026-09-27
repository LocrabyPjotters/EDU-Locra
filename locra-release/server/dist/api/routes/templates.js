"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = templateRoutes;
const index_1 = require("../../index");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
async function templateRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.requireAuth);
    // List all templates for the org
    fastify.get('/', async (request, reply) => {
        const templates = await index_1.prisma.promptTemplate.findMany({
            where: { orgId: request.user.orgId, isActive: true },
            orderBy: { sortOrder: 'asc' }
        });
        return templates;
    });
    // Create a new template (admin only)
    fastify.post('/', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { name, description, prompt, category, icon } = request.body;
        if (!name || !prompt)
            return reply.status(400).send({ error: 'Name and prompt required' });
        const template = await index_1.prisma.promptTemplate.create({
            data: {
                orgId: request.user.orgId,
                name,
                description,
                prompt,
                category: category || 'Algemeen',
                icon: icon || '💡'
            }
        });
        return template;
    });
    // Update a template
    fastify.put('/:id', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { id } = request.params;
        const { name, description, prompt, category, icon, isActive, sortOrder } = request.body;
        const template = await index_1.prisma.promptTemplate.update({
            where: { id },
            data: { name, description, prompt, category, icon, isActive, sortOrder }
        });
        return template;
    });
    // Delete a template
    fastify.delete('/:id', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { id } = request.params;
        await index_1.prisma.promptTemplate.delete({ where: { id } });
        return { success: true };
    });
}
