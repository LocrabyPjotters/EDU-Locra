import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { generateToken } from '../../utils/crypto';
import { createAuditLog } from '../../services/auditService';
import { randomBytes } from 'crypto';

import os from 'os';

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

export function resolveServerUrl(request: any, clientOrigin?: string): string {
  // 1. Explicit override from client browser (most accurate: what the user is currently viewing!)
  if (clientOrigin && typeof clientOrigin === 'string' && clientOrigin.startsWith('http')) {
    const cleanOrigin = clientOrigin.trim().replace(/\/+$/, '');
    if (!cleanOrigin.includes('localhost') && !cleanOrigin.includes('127.0.0.1')) {
      return cleanOrigin;
    }
  }

  // 2. Explicit environment override
  if (process.env.PUBLIC_SERVER_URL) {
    return process.env.PUBLIC_SERVER_URL.trim().replace(/\/+$/, '');
  }

  // 3. Check Origin or Referer header (reliable when behind reverse proxy)
  const originHeader = (request.headers.origin as string) || (request.headers.referer as string);
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      if (!parsed.hostname.includes('localhost') && !parsed.hostname.includes('127.0.0.1')) {
        return parsed.origin;
      }
    } catch {}
  }

  // 4. Check X-Forwarded-Host (from Nginx / Cloudflare)
  const fwdHost = request.headers['x-forwarded-host'] as string;
  const fwdProto = (request.headers['x-forwarded-proto'] as string) || 'https';
  if (fwdHost && !fwdHost.includes('localhost') && !fwdHost.includes('127.0.0.1')) {
    return `${fwdProto}://${fwdHost}`;
  }

  // 5. Check Host header
  const host = request.headers.host;
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const proto = fwdProto || 'https';
    return `${proto}://${host}`;
  }

  // 6. Default to standard public school server address if running locally
  if (process.env.NODE_ENV === 'production' || !process.env.DEV_LAN_IP) {
    return 'https://locra.pieteroosterling.online';
  }

  // Optional LAN resolution only for local Wi-Fi debugging if DEV_LAN_IP=true
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const port = host?.split(':')[1] || '4000';
          return `http://${iface.address}:${port}`;
        }
      }
    }
  } catch {}

  return 'https://locra.pieteroosterling.online';
}

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

      // Ensure connectCode is set in the database if empty
      const computedConnectCode = org.connectCode || `LOCRA-${org.slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
      if (!org.connectCode) {
        try {
          await prisma.organization.update({
            where: { id: org.id },
            data: { connectCode: computedConnectCode }
          });
        } catch {
          // ignore unique race
        }
      }

      const { clientOrigin: queryOrigin } = (request.query as any) || {};
      const serverUrl = resolveServerUrl(request, queryOrigin);

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        connectCode: computedConnectCode,
        serverUrl,
        logoUrl: org.logoUrl,
        faviconUrl: org.faviconUrl,
        slogan: org.slogan,
        primaryColor: org.primaryColor || '#6366f1',
        secondaryColor: org.secondaryColor || '#8b5cf6',
        accentColor: org.accentColor || '#06b6d4',
        serverVersion: 'v2.5.3',
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

      const { clientOrigin } = (request.body as any) || {};
      const serverUrl = resolveServerUrl(request, clientOrigin);
      const connectCode = user.org?.connectCode || (user.org ? `LOCRA-${user.org.slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}` : 'LOCRA');

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
        connectCode
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij aanmaken van koppelcode: ' + e.message });
    }
  });

  // 3. POST /api/connect/pair/claim — Public: Mobile app scans QR and claims auth session
  fastify.post('/pair/claim', async (request, reply) => {
    try {
      const { pairingCode, deviceName, devicePlatform, pushToken, appVersion } = (request.body as any) || {};

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

      // ── Persist to Database: MobileDevice ──
      const platform = (devicePlatform === 'ios' || devicePlatform === 'android')
        ? devicePlatform
        : (request.headers['user-agent']?.includes('iPhone') || request.headers['user-agent']?.includes('iPad') ? 'ios' : 'android');

      const resolvedDeviceName = deviceName || (platform === 'ios' ? 'Apple iPhone' : 'Android Toestel');

      let savedDevice = null;
      try {
        savedDevice = await prisma.mobileDevice.create({
          data: {
            userId: user.id,
            deviceName: resolvedDeviceName,
            devicePlatform: platform,
            pushToken: pushToken || null,
            appVersion: appVersion || '1.0.0',
            lastActiveAt: new Date(),
            isActive: true
          }
        });
      } catch (err: any) {
        console.warn('[CONNECT] Device registration warning:', err.message);
      }

      // Audit log in database
      await createAuditLog(prisma, {
        orgId: user.orgId,
        userId: user.id,
        action: 'mobile.qr-paired',
        category: 'auth',
        severity: 'info',
        details: { 
          deviceName: resolvedDeviceName,
          platform,
          deviceId: savedDevice?.id
        },
        ipAddress: request.ip
      });

      return {
        success: true,
        token,
        device: savedDevice ? {
          id: savedDevice.id,
          deviceName: savedDevice.deviceName,
          platform: savedDevice.devicePlatform,
          pairedAt: savedDevice.pairedAt
        } : null,
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
          connectCode: user.org.connectCode || `LOCRA-${user.org.slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
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

  // 4. GET /api/connect/devices — Get user's paired mobile devices from database
  fastify.get('/devices', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const devices = await prisma.mobileDevice.findMany({
        where: { userId: request.user!.id },
        orderBy: { lastActiveAt: 'desc' }
      });

      return {
        success: true,
        devices: devices.map(d => ({
          id: d.id,
          deviceName: d.deviceName || (d.devicePlatform === 'ios' ? 'Apple iPhone' : 'Android Toestel'),
          devicePlatform: d.devicePlatform,
          appVersion: d.appVersion,
          pairedAt: d.pairedAt,
          lastActiveAt: d.lastActiveAt,
          isActive: d.isActive
        }))
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij ophalen van gekoppelde apparaten: ' + e.message });
    }
  });

  // 5. DELETE /api/connect/devices/:id — Revoke/Ontkoppel a mobile device from database
  fastify.delete('/devices/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const device = await prisma.mobileDevice.findFirst({
        where: { id, userId: request.user!.id }
      });

      if (!device) {
        return reply.status(404).send({ error: 'Apparaat niet gevonden of al ontkoppeld.' });
      }

      await prisma.mobileDevice.delete({
        where: { id }
      });

      await createAuditLog(prisma, {
        orgId: request.user!.orgId,
        userId: request.user!.id,
        action: 'mobile.device-revoked',
        category: 'auth',
        severity: 'info',
        details: { deviceId: id, deviceName: device.deviceName },
        ipAddress: request.ip
      });

      return {
        success: true,
        message: 'Apparaat succesvol ontkoppeld.'
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij ontkoppelen van apparaat: ' + e.message });
    }
  });

  // 6. GET /api/connect/school-qr — Public: Returns general school-level QR code payload
  fastify.get('/school-qr', async (request, reply) => {
    try {
      const org = await prisma.organization.findFirst();
      if (!org) return reply.status(404).send({ error: 'Organisatie niet gevonden' });

      const proto = (request.headers['x-forwarded-proto'] as string) || (request.raw as any).protocol || 'http';
      const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || 'localhost:3000';
      const serverUrl = `${proto}://${host}`;
      const connectCode = org.connectCode || `LOCRA-${org.slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

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
