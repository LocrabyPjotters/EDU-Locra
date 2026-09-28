"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = organizationRoutes;
const index_1 = require("../../index");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
async function organizationRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.requireAuth);
    // Get current organization info and customization
    fastify.get('/customization', async (request, reply) => {
        const org = await index_1.prisma.organization.findUnique({
            where: { id: request.user.orgId },
            select: {
                id: true,
                name: true,
                primaryColor: true,
                secondaryColor: true,
                accentColor: true,
                systemPrompt: true,
                behaviorPrompt: true,
                aiName: true,
                welcomePageHtml: true,
                footerText: true,
                faviconUrl: true,
                logoUrl: true,
                settings: {
                    select: {
                        enableWebSearch: true,
                        enableAttachments: true,
                        enablePlugins: true
                    }
                }
            }
        });
        if (!org)
            return reply.status(404).send({ error: 'Organization not found' });
        return org;
    });
    // Admin only: Update customization
    fastify.put('/customization', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const data = request.body;
        try {
            const updated = await index_1.prisma.organization.update({
                where: { id: request.user.orgId },
                data: {
                    primaryColor: data.primaryColor,
                    secondaryColor: data.secondaryColor,
                    accentColor: data.accentColor,
                    systemPrompt: data.systemPrompt,
                    behaviorPrompt: data.behaviorPrompt,
                    aiName: data.aiName !== undefined ? data.aiName : undefined,
                    welcomePageHtml: data.welcomePageHtml,
                    footerText: data.footerText,
                    faviconUrl: data.faviconUrl,
                    logoUrl: data.logoUrl
                }
            });
            return { success: true, org: updated };
        }
        catch (e) {
            return reply.status(400).send({ error: 'Failed to update customization' });
        }
    });
}
