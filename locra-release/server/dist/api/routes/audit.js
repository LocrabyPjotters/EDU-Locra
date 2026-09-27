"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = auditRoutes;
const index_1 = require("../../index");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
async function auditRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.requireAuth);
    // Get audit logs for org
    fastify.get('/', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const logs = await index_1.prisma.auditLog.findMany({
            where: { orgId: request.user.orgId },
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                user: { select: { displayName: true, username: true } }
            }
        });
        return logs;
    });
}
