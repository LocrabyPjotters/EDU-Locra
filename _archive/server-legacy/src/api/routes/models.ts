import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { ollamaClient } from '../../services/ollama';

export default async function modelRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Get installed models — auto-syncs with Ollama
  fastify.get('/', async (request, reply) => {
    try {
      // Fetch models from Ollama directly
      const ollamaModels = await ollamaClient.listModels();
      const activeModelNames = ollamaModels.map(m => m.name);
      
      // Get all current models for this org
      const currentModels = await prisma.installedModel.findMany({
        where: { orgId: request.user!.orgId }
      });

      // Update existing models' active status — ONLY for Ollama models!
      for (const cm of currentModels) {
        if (cm.provider === 'ollama' && !activeModelNames.includes(cm.ollamaName) && cm.isActive) {
          // Model is no longer in Ollama, mark inactive
          await prisma.installedModel.update({
            where: { id: cm.id },
            data: { isActive: false }
          });
        }
      }
      
      // Sync: register any Ollama models not yet in the Locra DB
      for (const om of ollamaModels) {
        await prisma.installedModel.upsert({
          where: {
            orgId_ollamaName: {
              orgId: request.user!.orgId,
              ollamaName: om.name
            }
          },
          create: {
            orgId: request.user!.orgId,
            ollamaName: om.name,
            displayName: om.name,
            isActive: true,
          },
          update: {
            isActive: true // Re-activate if it was previously marked inactive
          }
        });
      }
    } catch (e) {
      // Ollama might be offline, that's fine — just show what's in DB
    }

    const models = await prisma.installedModel.findMany({
      where: { orgId: request.user!.orgId }
    });
    return models;
  });

  // Check Ollama connection status
  fastify.get('/status', { preHandler: requireRole('admin') }, async (request, reply) => {
    try {
      const version = await ollamaClient.getVersion();
      const localModels = await ollamaClient.listModels();
      return { status: 'running', version, localModelsCount: localModels.length };
    } catch (e: any) {
      return { status: 'error', message: e.message };
    }
  });

  // Pull a new model from Ollama
  fastify.post('/pull', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { modelName, displayName } = request.body as any;
    if (!modelName) return reply.status(400).send({ error: 'Model name required' });

    // Fire and forget pull job (Later moved to BullMQ)
    ollamaClient.pullModel(modelName).then(async () => {
      await prisma.installedModel.upsert({
        where: { 
          orgId_ollamaName: { 
            orgId: request.user!.orgId, 
            ollamaName: modelName 
          } 
        },
        create: {
          orgId: request.user!.orgId,
          ollamaName: modelName,
          displayName: displayName || modelName,
        },
        update: {
          isActive: true
        }
      });
      
      await prisma.auditLog.create({
        data: {
          orgId: request.user!.orgId,
          userId: request.user!.id,
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
  fastify.put('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { routingTier, isActive, creditCost, thinkingCreditCost, displayName, provider, isCodeMatchOnly } = request.body as any;

    try {
      const updated = await prisma.installedModel.update({
        where: { 
          id,
          orgId: request.user!.orgId
        },
        data: {
          ...(routingTier !== undefined && { routingTier }),
          ...(isActive !== undefined && { isActive }),
          ...(creditCost !== undefined && { creditCost: parseInt(creditCost) }),
          ...(thinkingCreditCost !== undefined && { thinkingCreditCost: parseInt(thinkingCreditCost) }),
          ...(displayName !== undefined && { displayName }),
          ...(provider !== undefined && { provider }),
          ...(isCodeMatchOnly !== undefined && { isCodeMatchOnly }),
        }
      });
      return updated;
    } catch (e: any) {
      return reply.status(400).send({ error: 'Kan model niet updaten' });
    }
  });

  // Add a custom API model
  fastify.post('/custom', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { modelName, displayName, provider } = (request.body as any) || {};
    const cleanModelName = (modelName || '').trim();
    const cleanDisplayName = (displayName || cleanModelName).trim();
    const cleanProvider = (provider || 'openrouter').trim().toLowerCase();

    if (!cleanModelName || !cleanProvider) return reply.status(400).send({ error: 'Model identifier en provider vereist' });

    try {
      const model = await prisma.installedModel.upsert({
        where: { 
          orgId_ollamaName: { 
            orgId: request.user!.orgId, 
            ollamaName: cleanModelName 
          } 
        },
        create: {
          orgId: request.user!.orgId,
          ollamaName: cleanModelName,
          displayName: cleanDisplayName,
          provider: cleanProvider,
          isActive: true,
        },
        update: {
          isActive: true,
          displayName: cleanDisplayName,
          provider: cleanProvider
        }
      });

      // Ensure apiIntegrationEnabled is on for this org
      await prisma.orgSettings.update({
        where: { orgId: request.user!.orgId },
        data: { apiIntegrationEnabled: true }
      }).catch(() => {});

      return reply.status(200).send(model);
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // Delete a model
  fastify.delete('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.installedModel.delete({
        where: { id, orgId: request.user!.orgId }
      });
      return { success: true };
    } catch (e: any) {
      return reply.status(400).send({ error: 'Fout bij verwijderen model' });
    }
  });
}

