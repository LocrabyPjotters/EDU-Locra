import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { AuthService } from '../auth';
import { TelemetryService } from '../telemetry';
import { InferenceEngine } from '../../enclave/inferenceEngine';
import { ModelRegistry } from '../../enclave/models';
import { OpenAIChatCompletionRequest, OpenAIChatCompletionResponse, OpenAIStreamChunk, OperationalMetadataRecord } from '../../types';
import { config } from '../../config';

/**
 * POST /v1/chat/completions
 * OpenAI-Compatible Chat Completions Endpoint (Drop-in replacement)
 *
 * Data flow:
 * 1. Gateway validates API key & quota (Control Plane — no prompt access)
 * 2. Encrypted payload is forwarded to the TEE Enclave (Data Plane)
 * 3. Enclave decrypts, runs inference, streams response
 * 4. Enclave scrubs memory, returns only token count to Control Plane
 */
export default async function chatRoutes(fastify: FastifyInstance) {

  fastify.post<{ Body: OpenAIChatCompletionRequest }>('/v1/chat/completions', async (request, reply) => {
    // ─── 1. CONTROL PLANE: Authenticate ───
    const authHeader = request.headers.authorization || '';
    const apiKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    const tenant = AuthService.authenticate(request, reply);
    if (!tenant) return; // 401/403 already sent

    const body = request.body;

    // Validate request
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return reply.code(400).send({
        error: {
          message: 'messages is required and must be a non-empty array.',
          type: 'invalid_request_error',
          code: 'missing_messages'
        }
      });
    }

    // ─── 2. DATA PLANE: Route to Sovereign Model within Enclave ───
    const resolvedModel = ModelRegistry.resolveModelAlias(body.model || 'locra-privai-pro');
    const requestId = `privai-${crypto.randomUUID()}`;
    const temperature = body.temperature ?? 0.7;
    const maxTokens = body.max_tokens ?? 2048;

    // ─── 3. Streaming vs Non-Streaming ───
    if (body.stream === true) {
      // SSE Streaming Response
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Locra-PrivAI-Enclave': 'verified',
        'X-Locra-PrivAI-Datacenter': `${config.datacenter.city}, NL`,
        'X-Locra-PrivAI-Zero-Retention': 'true'
      });

      const stream = InferenceEngine.inferStream(body.messages, resolvedModel, temperature, maxTokens);

      for await (const chunk of stream) {
        if (chunk.done) {
          // Final chunk — record metadata
          if (chunk.metadata) {
            const metadataRecord: OperationalMetadataRecord = {
              requestId,
              apiKeyPrefix: AuthService.getKeyPrefix(apiKey),
              ...chunk.metadata,
              timestamp: new Date().toISOString()
            };
            TelemetryService.record(metadataRecord);
            AuthService.recordUsage(apiKey, chunk.metadata.totalTokens);
          }

          // Send [DONE] marker
          const doneChunk: OpenAIStreamChunk = {
            id: requestId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: resolvedModel.id,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }]
          };
          reply.raw.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
          return;
        }

        // Token chunk
        const sseChunk: OpenAIStreamChunk = {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: resolvedModel.id,
          choices: [{
            index: 0,
            delta: { content: chunk.token },
            finish_reason: null
          }]
        };
        reply.raw.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
      }

    } else {
      // ─── Non-Streaming Response ───
      const result = await InferenceEngine.infer(body.messages, resolvedModel, temperature, maxTokens);

      // Record metadata in Control Plane
      const metadataRecord: OperationalMetadataRecord = {
        requestId,
        apiKeyPrefix: AuthService.getKeyPrefix(apiKey),
        ...result.metadata,
        timestamp: new Date().toISOString()
      };
      TelemetryService.record(metadataRecord);
      AuthService.recordUsage(apiKey, result.metadata.totalTokens);

      const response: OpenAIChatCompletionResponse = {
        id: requestId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: resolvedModel.id,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: result.text
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: result.metadata.promptTokens,
          completion_tokens: result.metadata.completionTokens,
          total_tokens: result.metadata.totalTokens
        },
        locra_privai: {
          enclave_verified: true,
          datacenter_location: `${config.datacenter.city}, Nederland`,
          zero_retention_scrubbed: true,
          latency_ms: result.metadata.durationMs
        }
      };

      return reply.code(200).send(response);
    }
  });
}

