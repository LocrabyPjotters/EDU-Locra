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
import slimCheckRoutes from './api/routes/slimcheck';
import examRoutes from './api/routes/exams';
import connectRoutes from './api/routes/connect';
import networkRoutes from './api/routes/network';
import multipart from '@fastify/multipart';

import { initializeLicenseCheck } from './services/license';
import { checkIpAccess, loadIpSecurityConfig } from './services/ipSecurityService';

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

    // Initialize License & IP Security
    await initializeLicenseCheck();
    await loadIpSecurityConfig();

    // IP Security & School-Only Access Enforcement
    fastify.addHook('onRequest', async (request, reply) => {
      const url = request.url;

      // Allow static assets, health checks, and public connect info
      if (
        url.startsWith('/assets') ||
        url.includes('.js') ||
        url.includes('.css') ||
        url.includes('.svg') ||
        url.includes('.png') ||
        url.includes('.ico') ||
        url.includes('.woff') ||
        url.includes('.ttf') ||
        url === '/api/health' ||
        url.startsWith('/api/connect/info') ||
        url.startsWith('/api/connect/school-qr') ||
        url.startsWith('/api/connect/pair/claim')
      ) {
        return;
      }

      const clientIp = request.headers['x-forwarded-for']
        ? String(request.headers['x-forwarded-for']).split(',')[0].trim()
        : request.ip;

      const check = await checkIpAccess(clientIp);
      if (!check.allowed) {
        if (url.startsWith('/api/')) {
          return reply.status(403).send({
            error: check.reason,
            clientIp: check.clientIp,
            code: 'ip_restricted'
          });
        }

        reply.type('text/html').status(403);
        return reply.send(`
          <!DOCTYPE html>
          <html lang="nl">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Locra — Netwerktoegang Beperkt</title>
            <style>
              body { background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1.5rem; box-sizing: border-box; }
              .card { max-width: 560px; width: 100%; background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 24px; padding: 2.5rem; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); }
              .icon { font-size: 3.5rem; margin-bottom: 1rem; }
              h1 { font-size: 1.6rem; margin: 0 0 0.5rem 0; color: #f87171; font-weight: 800; }
              p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin: 0.75rem 0; }
              .ip-box { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); padding: 10px 16px; border-radius: 12px; font-family: monospace; color: #38bdf8; display: inline-block; margin: 1rem 0; font-size: 1rem; }
              .footer { font-size: 0.8rem; color: #64748b; margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 1rem; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">🛡️</div>
              <h1>Netwerktoegang Beperkt</h1>
              <p>Deze Locra schoolserver is geconfigureerd om enkel verbindingen toe te staan vanaf het geautoriseerde schoolnetwerk (school-Wi-Fi of goedgekeurde IP-adressen).</p>
              <div>Jouw IP-adres: <div class="ip-box">${check.clientIp}</div></div>
              <p style="font-size: 0.875rem;">Verbind je apparaat met het schoolnetwerk of vraag de IT-beheerder van jouw school om jouw netwerklocatie toe te voegen.</p>
              <div class="footer">Locra AI &middot; Beveiligde Lokale Schoolcloud</div>
            </div>
          </body>
          </html>
        `);
      }
    });

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
    await fastify.register(slimCheckRoutes, { prefix: '/api/slimcheck' });
    await fastify.register(examRoutes, { prefix: '/api/exams' });
    await fastify.register(connectRoutes, { prefix: '/api/connect' });
    await fastify.register(networkRoutes, { prefix: '/api/network' });
    
    // Import manually since it's missing from imports at top
    const { default: federationRoutes } = await import('./api/routes/federation');
    await fastify.register(federationRoutes, { prefix: '/api/federation' });

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

    // Schedule daily retention cleanup for SlimCheck data
    import('./services/slimCheckService').then(({ slimCheckService }) => {
      setTimeout(() => {
        slimCheckService.runRetentionCleanup().catch(e => fastify.log.error('SlimCheck initial retention cleanup error:', e));
      }, 30000);
      setInterval(() => {
        slimCheckService.runRetentionCleanup().catch(e => fastify.log.error('SlimCheck daily retention cleanup error:', e));
      }, 24 * 60 * 60 * 1000);
    });
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
