import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { AuthService } from '../auth';
import { TelemetryService } from '../telemetry';
import { InferenceEngine } from '../../enclave/inferenceEngine';
import { ModelRegistry } from '../../enclave/models';
import { AnthropicMessageRequest, AnthropicMessageResponse, ChatMessage, OperationalMetadataRecord } from '../../types';
import { config } from '../../config';

/**
 * POST /v1/messages
 * Anthropic Claude-Compatible Messages Endpoint (Drop-in replacement)
 */
export default async function messagesRoutes(fastify: FastifyInstance) {

  fastify.post<{ Body: AnthropicMessageRequest }>('/v1/messages', async (request, reply) => {
    // ─── 1. CONTROL PLANE: Authenticate ───
    const authHeader = request.headers['x-api-key'] as string || '';
    const apiKeyFromBearer = (request.headers.authorization || '').startsWith('Bearer ')
      ? (request.headers.authorization || '').substring(7).trim()
      : '';
    const apiKey = authHeader || apiKeyFromBearer;

    if (!apiKey) {
      return reply.code(401).send({
        type: 'error',
        error: {
          type: 'authentication_error',
          message: 'Missing x-api-key header or Bearer token.'
        }
      });
    }

    // Manually check (since Anthropic uses x-api-key instead of Bearer)
    const tenant = AuthService.authenticate(request, reply);
    if (!tenant) return;

    const body = request.body;

    if (!body.messages || body.messages.length === 0) {
      return reply.code(400).send({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: 'messages is required and must be a non-empty array.'
        }
      });
    }

    // ─── 2. DATA PLANE: Map Anthropic format to internal ChatMessage ───
    const resolvedModel = ModelRegistry.resolveModelAlias(body.model || 'locra-privai-pro');
    const requestId = `privai-msg-${crypto.randomUUID()}`;

    const internalMessages: ChatMessage[] = [];
    if (body.system) {
      internalMessages.push({ role: 'system', content: body.system });
    }
    for (const msg of body.messages) {
      internalMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      });
    }

    const temperature = body.temperature ?? 0.7;
    const maxTokens = body.max_tokens ?? 2048;

    // ─── 3. Inference within Enclave ───
    if (body.stream === true) {
      // SSE Streaming (Anthropic event format)
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Locra-PrivAI-Enclave': 'verified',
        'X-Locra-PrivAI-Zero-Retention': 'true'
      });

      // Send message_start event
      reply.raw.write(`event: message_start\ndata: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: requestId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: resolvedModel.id,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      })}\n\n`);

      // Send content_block_start
      reply.raw.write(`event: content_block_start\ndata: ${JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' }
      })}\n\n`);

      const stream = InferenceEngine.inferStream(internalMessages, resolvedModel, temperature, maxTokens);

      for await (const chunk of stream) {
        if (chunk.done) {
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

          reply.raw.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`);
          reply.raw.write(`event: message_delta\ndata: ${JSON.stringify({
            type: 'message_delta',
            delta: { stop_reason: 'end_turn', stop_sequence: null },
            usage: { output_tokens: chunk.metadata?.completionTokens || 0 }
          })}\n\n`);
          reply.raw.write(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
          reply.raw.end();
          return;
        }

        reply.raw.write(`event: content_block_delta\ndata: ${JSON.stringify({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: chunk.token }
        })}\n\n`);
      }

    } else {
      // Non-streaming
      const result = await InferenceEngine.infer(internalMessages, resolvedModel, temperature, maxTokens);

      const metadataRecord: OperationalMetadataRecord = {
        requestId,
        apiKeyPrefix: AuthService.getKeyPrefix(apiKey),
        ...result.metadata,
        timestamp: new Date().toISOString()
      };
      TelemetryService.record(metadataRecord);
      AuthService.recordUsage(apiKey, result.metadata.totalTokens);

      const response: AnthropicMessageResponse = {
        id: requestId,
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: result.text }],
        model: resolvedModel.id,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: result.metadata.promptTokens,
          output_tokens: result.metadata.completionTokens
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

