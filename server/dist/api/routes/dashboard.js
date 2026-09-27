"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = dashboardRoutes;
const index_1 = require("../../index");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
async function dashboardRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.requireAuth);
    fastify.addHook('preHandler', (0, rbac_1.requireRole)('admin'));
    fastify.get('/stats', async (request, reply) => {
        const orgId = request.user.orgId;
        const [userCount, modelCount, kbCount, conversationCount] = await Promise.all([
            index_1.prisma.user.count({ where: { orgId } }),
            index_1.prisma.installedModel.count({ where: { orgId } }),
            index_1.prisma.knowledgeBase.count({ where: { orgId } }),
            index_1.prisma.conversation.count()
        ]);
        const settings = await index_1.prisma.orgSettings.findUnique({
            where: { orgId }
        });
        return {
            users: userCount,
            models: modelCount,
            knowledgeBases: kbCount,
            conversations: conversationCount,
            e2eEnabled: settings?.enableE2EEncryption ?? false,
            kennisnetEnabled: settings?.enableKennisnet ?? false
        };
    });
}
