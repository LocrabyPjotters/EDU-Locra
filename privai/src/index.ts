import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { ModelRegistry } from './enclave/models';
import chatRoutes from './gateway/routes/chat';
import messagesRoutes from './gateway/routes/messages';
import modelsRoutes from './gateway/routes/models';
import attestationRoutes from './gateway/routes/attestation';
import usageRoutes from './gateway/routes/usage';

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Locra PrivAI™ — Sovereign Dutch Zero-Access AI-API Service    ║
 * ║                                                                 ║
 * ║  OpenPCC Confidential Computing · X25519 + AES-256-GCM TEE    ║
 * ║  100% Nederlandse Bodem · 0 Bytes Prompt Logging               ║
 * ║  OpenAI & Anthropic Claude Drop-in Compatible                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

async function startPrivAI() {
  // Initialize sovereign model registry
  ModelRegistry.initialize();

  const app = Fastify({
    logger: {
      level: config.environment === 'production' ? 'warn' : 'info',
      // CRITICAL: Disable request body logging to prevent accidental prompt leakage
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            // Deliberately EXCLUDE headers and body from logs
          };
        }
      }
    },
    bodyLimit: 10 * 1024 * 1024, // 10MB max (for large context windows)
    trustProxy: true
  });

  // CORS for Locra Core and external developer access
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Locra-PrivAI-Attestation'],
    credentials: true
  });

  // ─── Root Health Check ───
  app.get('/', async (_req, reply) => {
    return reply.send({
      service: 'Locra PrivAI™',
      version: '1.0.0',
      status: 'operational',
      enclave: config.enclave.type,
      datacenter: {
        country: config.datacenter.country,
        city: config.datacenter.city,
        facility: config.datacenter.facility,
        operator: config.datacenter.operator,
        jurisdiction: config.datacenter.jurisdiction
      },
      capabilities: {
        openai_compatible: '/v1/chat/completions',
        anthropic_compatible: '/v1/messages',
        models: '/v1/models',
        attestation: '/v1/attestation',
        usage: '/v1/usage'
      },
      security: {
        encryption: 'X25519 ECDH + AES-256-GCM (End-to-End within TEE)',
        hardware_enclave: config.enclave.type,
        zero_retention: true,
        prompt_logging: false,
        telemetry_scope: 'Non-sensitive metadata only (tokens, latency, model)',
        remote_attestation: true
      },
      privacy_statement: 'Locra PrivAI™ garandeert cryptografisch dat prompts en antwoorden NOOIT worden opgeslagen, gelogd of ingezien door Locra of derden. Alleen niet-gevoelige metadata (tokenaantallen, latency, modelkeuze) wordt geregistreerd voor quota-administratie.'
    });
  });

  // ─── Register API Routes ───
  await app.register(chatRoutes);
  await app.register(messagesRoutes);
  await app.register(modelsRoutes);
  await app.register(attestationRoutes);
  await app.register(usageRoutes);

  // ─── Start Server ───
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                  ║');
    console.log('║   🔒 Locra PrivAI™ — Sovereign Zero-Access AI-API               ║');
    console.log('║                                                                  ║');
    console.log(`║   ▸ Server:     http://${config.host}:${config.port}                         ║`);
    console.log(`║   ▸ Enclave:    ${config.enclave.type.padEnd(35)}       ║`);
    console.log(`║   ▸ Datacenter: ${config.datacenter.city}, ${config.datacenter.country} (${config.datacenter.facility.substring(0, 18)})       ║`);
    console.log('║   ▸ Zero-Log:   ✓ Prompt/completion NEVER stored              ║');
    console.log('║   ▸ Metadata:   Tokens, latency, model only                    ║');
    console.log('║                                                                  ║');
    console.log('║   Endpoints:                                                     ║');
    console.log('║   POST /v1/chat/completions  (OpenAI compatible)                ║');
    console.log('║   POST /v1/messages          (Anthropic Claude compatible)      ║');
    console.log('║   GET  /v1/models            (List sovereign models)            ║');
    console.log('║   GET  /v1/attestation        (TEE hardware verification)       ║');
    console.log('║   GET  /v1/usage             (Non-sensitive usage metrics)      ║');
    console.log('║                                                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
  } catch (err) {
    console.error('Failed to start Locra PrivAI™:', err);
    process.exit(1);
  }
}

startPrivAI();

