import { FastifyInstance } from 'fastify';
import { ModelRegistry } from '../../enclave/models';
import { config } from '../../config';

/**
 * GET /v1/models
 * Lists all available sovereign models on the Locra PrivAI™ Dutch infrastructure.
 * OpenAI-compatible response format.
 */
export default async function modelsRoutes(fastify: FastifyInstance) {

  fastify.get('/v1/models', async (_request, reply) => {
    const models = ModelRegistry.listModels();

    const response = {
      object: 'list',
      data: models.map(m => ({
        id: m.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'locra-privai',
        permission: [{
          id: `modelperm-${m.id}`,
          object: 'model_permission',
          created: Math.floor(Date.now() / 1000),
          allow_create_engine: false,
          allow_sampling: true,
          allow_logprobs: false,
          allow_search_indices: false,
          allow_view: true,
          allow_fine_tuning: false,
          organization: '*',
          group: null,
          is_blocking: false
        }],
        root: m.id,
        parent: null,
        // Locra PrivAI™ extended metadata
        locra_privai: {
          name: m.name,
          family: m.family,
          context_window: m.contextWindow,
          max_output_tokens: m.maxOutputTokens,
          description: m.description,
          capabilities: m.capabilities,
          hardware_acceleration: m.hardwareAcceleration,
          datacenter: m.datacenter,
          zero_access: true,
          sovereign_jurisdiction: 'Netherlands / EU GDPR'
        }
      }))
    };

    return reply.code(200).send(response);
  });
}

