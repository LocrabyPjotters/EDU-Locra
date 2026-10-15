import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { generateToken } from '../../utils/crypto';
import { createAuditLog } from '../../services/auditService';
import { randomBytes } from 'crypto';

interface PairingSession {
  code: string;
  userId: string;
  orgId: string;
  userDisplayName: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory store for active pairing sessions (valid for 5 minutes)
const pairingSessions = new Map<string, PairingSession>();

// Cleanup expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [code, session] of pairingSessions.entries()) {
    if (session.expiresAt < now) {
      pairingSessions.delete(code);
    }
  }
}, 60 * 1000);

export default async function connectRoutes(fastify: FastifyInstance) {
  // 1. GET /api/connect/info — Public school branding & discovery info
  fastify.get('/info', async (request, reply) => {
    try {
      const org = await prisma.organization.findFirst({
        include: { settings: true }
      });

      if (!org) {
        return reply.status(404).send({ error: 'Geen organisatie gevonden op deze server.' });
      }

      const proto = (request.headers['x-forwarded-proto'] as string) || (request.raw as any).protocol || 'http';
      const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || 'localhost:3000';
      const serverUrl = `${proto}://${host}`;

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        connectCode: `LOCRA-${org.slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
        serverUrl,
        logoUrl: org.logoUrl,
        faviconUrl: org.faviconUrl,
        slogan: org.slogan,
        primaryColor: org.primaryColor || '#6366f1',
        secondaryColor: org.secondaryColor || '#8b5cf6',
        accentColor: org.accentColor || '#06b6d4',
        serverVersion: 'v2.5.2',
        supportedAuth: ['password', 'qr-pair'],
        aiName: org.aiName || 'Locra AI'
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij ophalen van school info: ' + e.message });
    }
  });

  // 2. POST /api/connect/pair/create — Authenticated: Create a 1-click mobile pairing QR token
  fastify.post('/pair/create', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const orgId = request.user!.orgId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { org: true }
      });

      if (!user || !user.isActive) {
        return reply.status(403).send({ error: 'Account niet actief of niet gevonden' });
      }

      // Generate secure pairing token
      const code = `pair_${randomBytes(24).toString('hex')}`;
      const now = Date.now();
      const expiresInSeconds = 300; // 5 minutes
      const expiresAt = now + expiresInSeconds * 1000;

      pairingSessions.set(code, {
        code,
        userId: user.id,
        orgId: user.orgId,
        userDisplayName: user.displayName || user.username,
        createdAt: now,
        expiresAt
      });

      const proto = (request.headers['x-forwarded-proto'] as string) || (request.raw as any).protocol || 'http';
      const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || 'localhost:3000';
      const serverUrl = `${proto}://${host}`;

      const pairingPayload = {
        type: 'locra-pair',
        version: 1,
        serverUrl,
        pairingCode: code,
        orgName: user.org?.name || 'Locra School',
        userDisplayName: user.displayName || user.username,
        expiresAt: new Date(expiresAt).toISOString()
      };

      return {
        success: true,
        pairingCode: code,
        qrData: JSON.stringify(pairingPayload),
        serverUrl,
        expiresInSeconds,
        expiresAt: new Date(expiresAt).toISOString(),
        orgName: user.org?.name,
        connectCode: user.org ? `LOCRA-${user.org.slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}` : 'LOCRA'
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij aanmaken van koppelcode: ' + e.message });
    }
  });

  // 3. POST /api/connect/pair/claim — Public: Mobile app scans QR and claims auth session
  fastify.post('/pair/claim', async (request, reply) => {
    try {
      const { pairingCode } = (request.body as any) || {};

      if (!pairingCode || typeof pairingCode !== 'string') {
        return reply.status(400).send({ error: 'pairingCode is verplicht' });
      }

      const session = pairingSessions.get(pairingCode);

      if (!session) {
        return reply.status(400).send({ error: 'Koppelcode is ongeldig of reeds gebruikt.' });
      }

      if (session.expiresAt < Date.now()) {
        pairingSessions.delete(pairingCode);
        return reply.status(400).send({ error: 'Koppelcode is verlopen. Genereer een nieuwe QR-code in de webapp.' });
      }

      // One-time use: delete immediately
      pairingSessions.delete(pairingCode);

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        include: { org: true }
      });

      if (!user || !user.isActive) {
        return reply.status(403).send({ error: 'Account is niet actief.' });
      }

      // Generate long-lived mobile JWT
      const token = generateToken({
        id: user.id,
        orgId: user.orgId,
        role: user.role
      });

      // Audit log
      await createAuditLog(prisma, {
        orgId: user.orgId,
        userId: user.id,
        action: 'mobile.qr-paired',
        category: 'auth',
        severity: 'info',
        details: { device: request.headers['user-agent'] || 'Locra Mobile' },
        ipAddress: request.ip
      });

      return {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          displayName: user.displayName,
          email: user.email
        },
        org: user.org ? {
          id: user.org.id,
          name: user.org.name,
          slug: user.org.slug,
          connectCode: `LOCRA-${user.org.slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
          logoUrl: user.org.logoUrl,
          primaryColor: user.org.primaryColor,
          secondaryColor: user.org.secondaryColor,
          accentColor: user.org.accentColor,
          aiName: user.org.aiName
        } : null
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij koppelen van mobiele app: ' + e.message });
    }
  });

  // 4. GET /api/connect/school-qr — Public: Returns general school-level QR code payload
  fastify.get('/school-qr', async (request, reply) => {
    try {
      const org = await prisma.organization.findFirst();
      if (!org) return reply.status(404).send({ error: 'Organisatie niet gevonden' });

      const proto = (request.headers['x-forwarded-proto'] as string) || (request.raw as any).protocol || 'http';
      const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || 'localhost:3000';
      const serverUrl = `${proto}://${host}`;
      const connectCode = `LOCRA-${org.slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

      const payload = {
        type: 'locra-school',
        version: 1,
        serverUrl,
        connectCode,
        orgName: org.name,
        primaryColor: org.primaryColor,
        logoUrl: org.logoUrl
      };

      return {
        success: true,
        connectCode,
        serverUrl,
        orgName: org.name,
        qrData: JSON.stringify(payload)
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij genereren school QR: ' + e.message });
    }
  });
}
