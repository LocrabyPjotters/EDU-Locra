"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = modelRoutes;
const index_1 = require("../../index");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const ollama_1 = require("../../services/ollama");
async function modelRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.requireAuth);
    // Get installed models — auto-syncs with Ollama
    fastify.get('/', async (request, reply) => {
        try {
            // Fetch models from Ollama directly
            const ollamaModels = await ollama_1.ollamaClient.listModels();
            // Sync: register any Ollama models not yet in the Locra DB
            for (const om of ollamaModels) {
                await index_1.prisma.installedModel.upsert({
                    where: {
                        orgId_ollamaName: {
                            orgId: request.user.orgId,
                            ollamaName: om.name
                        }
                    },
                    create: {
                        orgId: request.user.orgId,
                        ollamaName: om.name,
                        displayName: om.name,
                        isActive: true,
                    },
                    update: {} // don't overwrite existing settings
                });
            }
        }
        catch (e) {
            // Ollama might be offline, that's fine — just show what's in DB
        }
        const models = await index_1.prisma.installedModel.findMany({
            where: { orgId: request.user.orgId }
        });
        return models;
    });
    // Check Ollama connection status
    fastify.get('/status', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        try {
            const version = await ollama_1.ollamaClient.getVersion();
            const localModels = await ollama_1.ollamaClient.listModels();
            return { status: 'running', version, localModelsCount: localModels.length };
        }
        catch (e) {
            return { status: 'error', message: e.message };
        }
    });
    // Pull a new model from Ollama
    fastify.post('/pull', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { modelName, displayName } = request.body;
        if (!modelName)
            return reply.status(400).send({ error: 'Model name required' });
        // Fire and forget pull job (Later moved to BullMQ)
        ollama_1.ollamaClient.pullModel(modelName).then(async () => {
            await index_1.prisma.installedModel.upsert({
                where: {
                    orgId_ollamaName: {
                        orgId: request.user.orgId,
                        ollamaName: modelName
                    }
                },
                create: {
                    orgId: request.user.orgId,
                    ollamaName: modelName,
                    displayName: displayName || modelName,
                },
                update: {
                    isActive: true
                }
            });
            await index_1.prisma.auditLog.create({
                data: {
                    orgId: request.user.orgId,
                    userId: request.user.id,
                    action: 'model.install',
                    details: JSON.stringify({ modelName })
                }
            });
            fastify.log.info(`Model ${modelName} installed successfully.`);
        }).catch(e => {
            fastify.log.error(`Failed to pull model ${modelName}: ${e.message}`);
        });
        return reply.status(202).send({ message: `Installatie van model ${modelName} is gestart.` });
    });
    // Update model settings (routing tier)
    fastify.put('/:id', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { id } = request.params;
        const { routingTier, isActive, creditCost, thinkingCreditCost, displayName } = request.body;
        try {
            const updated = await index_1.prisma.installedModel.update({
                where: {
                    id,
                    orgId: request.user.orgId
                },
                data: {
                    ...(routingTier !== undefined && { routingTier }),
                    ...(isActive !== undefined && { isActive }),
                    ...(creditCost !== undefined && { creditCost: parseInt(creditCost) }),
                    ...(thinkingCreditCost !== undefined && { thinkingCreditCost: parseInt(thinkingCreditCost) }),
                    ...(displayName !== undefined && { displayName }),
                }
            });
            return updated;
        }
        catch (e) {
            return reply.status(400).send({ error: 'Kan model niet updaten' });
        }
    });
}
