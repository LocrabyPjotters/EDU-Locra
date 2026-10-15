import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const prisma = new PrismaClient();
const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

import authRoutes from './api/routes/auth';
import userRoutes from './api/routes/users';
import setupRoutes from './api/routes/setup';
import modelRoutes from './api/routes/models';
import chatRoutes from './api/routes/chat';
import knowledgeRoutes from './api/routes/knowledge';
import settingsRoutes from './api/routes/settings';
import dashboardRoutes from './api/routes/dashboard';
import organizationRoutes from './api/routes/organization';
import feedbackRoutes from './api/routes/feedback';
import templateRoutes from './api/routes/templates';
import auditRoutes from './api/routes/audit';
import groupRoutes from './api/routes/groups';
import classRoutes from './api/routes/classes';
import adminApiRoutes from './api/routes/admin';
import somtodayRoutes from './api/routes/somtoday';
import reactionRoutes from './api/routes/reactions';
import watermarkRoutes from './api/routes/watermark';
import benchmarkRoutes from './api/routes/benchmark';
import assignmentRoutes from './api/routes/assignments';
import chatAddonsRoutes from './api/routes/chatAddons';
import quickActionRoutes from './api/routes/quickActions';
import codematchRoutes from './api/routes/codematch';
import multipart from '@fastify/multipart';

import { initializeLicenseCheck } from './services/license';

async function start() {
  try {
    await fastify.register(cors, {
      origin: '*', // TODO: configure based on settings
    });
    
    await fastify.register(require('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute',
      allowList: ['127.0.0.1'] // Localhost bypass
    });
    await fastify.register(websocket);
    await fastify.register(multipart, {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit for docs
      }
    });

    // Initialize License
    await initializeLicenseCheck();

    // Register API routes
    await fastify.register(setupRoutes, { prefix: '/api/setup' });
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(userRoutes, { prefix: '/api/users' });
    await fastify.register(modelRoutes, { prefix: '/api/models' });
    await fastify.register(chatRoutes, { prefix: '/api/chat' });
    await fastify.register(chatAddonsRoutes, { prefix: '/api/chat' });
    await fastify.register(knowledgeRoutes, { prefix: '/api/knowledge' });
    await fastify.register(settingsRoutes, { prefix: '/api/settings' });
    await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
    await fastify.register(organizationRoutes, { prefix: '/api/organization' });
    await fastify.register(feedbackRoutes, { prefix: '/api/feedback' });
    await fastify.register(templateRoutes, { prefix: '/api/templates' });
    await fastify.register(auditRoutes, { prefix: '/api/audit' });
    await fastify.register(groupRoutes, { prefix: '/api/groups' });
    await fastify.register(classRoutes, { prefix: '/api/classes' });
    await fastify.register(adminApiRoutes, { prefix: '/api/admin' });
    await fastify.register(somtodayRoutes, { prefix: '/api/somtoday' });
    await fastify.register(reactionRoutes, { prefix: '/api/chat/messages' });
    await fastify.register(watermarkRoutes, { prefix: '/api/watermark' });
    await fastify.register(benchmarkRoutes, { prefix: '/api/admin/benchmark' });
    await fastify.register(assignmentRoutes, { prefix: '/api/assignments' });
    await fastify.register(quickActionRoutes, { prefix: '/api/quick-actions' });
    await fastify.register(codematchRoutes, { prefix: '/api/codematch' });

    // Health check
    fastify.get('/api/health', async (request, reply) => {
      return { status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() };
    });

    // Serve built frontend (SPA) — all non-API routes serve index.html
    const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
    await fastify.register(staticFiles, {
      root: clientDist,
      prefix: '/',
      wildcard: false,
    });
    // SPA catch-all: any unknown route returns index.html so React Router works
    fastify.get('/*', async (_req, reply) => {
      return reply.sendFile('index.html');
    });
    const port = parseInt(process.env.PORT || '4000', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Locra Server started on http://0.0.0.0:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Ensure Prisma disconnects gracefully
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
