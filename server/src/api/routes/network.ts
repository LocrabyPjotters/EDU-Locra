import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { createAuditLog } from '../../services/auditService';
import { getHubStatus, validateLicense, pingUpstreamHub } from '../../services/license';
import { normalizeIp, invalidateIpSecurityCache, loadIpSecurityConfig } from '../../services/ipSecurityService';
import { resolveServerUrl } from './connect';
import os from 'os';
import https from 'https';
import http from 'http';
import fetch from 'node-fetch';

// ── In-memory request log (ring buffer, max 500 entries) ──
interface OutgoingRequest {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  hostname: string;
  port: number | string;
  path: string;
  protocol: 'http' | 'https';
  statusCode?: number;
  durationMs?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBodySize?: number;
  responseBodySize?: number;
  error?: string;
  category: 'ai-provider' | 'webhook' | 'federation' | 'external' | 'internal';
}

const MAX_LOG_SIZE = 500;
const outgoingRequestLog: OutgoingRequest[] = [];
let requestCounter = 0;

// Categorize requests by hostname
function categorizeRequest(hostname: string): OutgoingRequest['category'] {
  const aiProviders = ['api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com', 'openrouter.ai', 'api-inference.huggingface.co', 'api.together.xyz', 'api.groq.com', 'api.mistral.ai'];
  const internalHosts = ['localhost', '127.0.0.1', '0.0.0.0'];

  if (aiProviders.some(p => hostname.includes(p))) return 'ai-provider';
  if (internalHosts.some(h => hostname === h)) return 'internal';
  if (hostname.includes('rowmatch.nl') || hostname.includes('locra.')) return 'federation';
  return 'external';
}

// Log an outgoing request
function logOutgoingRequest(entry: OutgoingRequest) {
  if (outgoingRequestLog.length >= MAX_LOG_SIZE) {
    outgoingRequestLog.shift(); // Remove oldest
  }
  outgoingRequestLog.push(entry);
}

// ── Monkey-patch Node.js http/https to intercept outgoing requests ──
let interceptInstalled = false;

function installRequestInterceptor() {
  if (interceptInstalled) return;
  interceptInstalled = true;

  const originalHttpsRequest = https.request;
  const originalHttpRequest = http.request;

  function wrapRequest(originalFn: typeof https.request, protocol: 'http' | 'https') {
    return function (this: any, ...args: any[]) {
      const startTime = Date.now();
      const reqId = `req_${Date.now()}_${++requestCounter}`;

      // Parse options
      let options: any = {};
      if (typeof args[0] === 'string' || args[0] instanceof URL) {
        try {
          const urlObj = typeof args[0] === 'string' ? new URL(args[0]) : args[0];
          options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (protocol === 'https' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET'
          };
        } catch {}
      } else if (args[0] && typeof args[0] === 'object') {
        options = args[0];
      }

      const hostname = options.hostname || options.host || 'unknown';
      const entry: OutgoingRequest = {
        id: reqId,
        timestamp: new Date().toISOString(),
        method: (options.method || 'GET').toUpperCase(),
        url: `${protocol}://${hostname}${options.path || '/'}`,
        hostname,
        port: options.port || (protocol === 'https' ? 443 : 80),
        path: options.path || '/',
        protocol,
        category: categorizeRequest(hostname),
        requestHeaders: sanitizeHeaders(options.headers || {})
      };

      // Call original
      const req = originalFn.apply(this, args as any);

      // Track request body size
      const originalWrite = req.write.bind(req);
      let bodySize = 0;
      req.write = function (...writeArgs: any[]) {
        if (writeArgs[0]) {
          bodySize += Buffer.byteLength(writeArgs[0]);
        }
        return (originalWrite as any)(...writeArgs);
      };

      const originalEnd = req.end.bind(req);
      req.end = function (...endArgs: any[]) {
        if (endArgs[0] && typeof endArgs[0] !== 'function') {
          bodySize += Buffer.byteLength(endArgs[0]);
        }
        entry.requestBodySize = bodySize;
        return originalEnd(...endArgs);
      };

      // Track response
      req.on('response', (res: any) => {
        entry.statusCode = res.statusCode;
        entry.durationMs = Date.now() - startTime;
        entry.responseHeaders = sanitizeHeaders(res.headers || {});

        let responseSize = 0;
        res.on('data', (chunk: Buffer) => {
          responseSize += chunk.length;
        });
        res.on('end', () => {
          entry.responseBodySize = responseSize;
          logOutgoingRequest(entry);
        });
      });

      req.on('error', (err: Error) => {
        entry.error = err.message;
        entry.durationMs = Date.now() - startTime;
        logOutgoingRequest(entry);
      });

      return req;
    } as any;
  }

  (https as any).request = wrapRequest(originalHttpsRequest, 'https');
  (http as any).request = wrapRequest(originalHttpRequest, 'http');
}

// Strip sensitive headers (Authorization, Cookie, API keys)
function sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {};
  const sensitiveKeys = ['authorization', 'cookie', 'x-api-key', 'api-key', 'x-goog-api-key'];
  for (const [key, val] of Object.entries(headers)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      result[key] = '••••••••';
    } else {
      result[key] = String(val);
    }
  }
  return result;
}

// ── Network stats computation ──
function computeNetworkStats() {
  const now = Date.now();
  const oneHourAgo = now - 3600_000;
  const oneDayAgo = now - 86400_000;

  const recent = outgoingRequestLog.filter(r => new Date(r.timestamp).getTime() > oneHourAgo);
  const today = outgoingRequestLog.filter(r => new Date(r.timestamp).getTime() > oneDayAgo);

  const byCategory: Record<string, number> = {};
  const byHost: Record<string, number> = {};
  let totalDataOut = 0;
  let totalDataIn = 0;
  let errors = 0;
  let avgDuration = 0;
  let durations: number[] = [];

  for (const req of outgoingRequestLog) {
    byCategory[req.category] = (byCategory[req.category] || 0) + 1;
    byHost[req.hostname] = (byHost[req.hostname] || 0) + 1;
    totalDataOut += req.requestBodySize || 0;
    totalDataIn += req.responseBodySize || 0;
    if (req.error || (req.statusCode && req.statusCode >= 400)) errors++;
    if (req.durationMs) durations.push(req.durationMs);
  }

  if (durations.length > 0) {
    avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  }

  // Top 10 hosts by request count
  const topHosts = Object.entries(byHost)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([host, count]) => ({ host, count, category: categorizeRequest(host) }));

  return {
    total: outgoingRequestLog.length,
    lastHour: recent.length,
    last24h: today.length,
    errors,
    errorRate: outgoingRequestLog.length > 0 ? Math.round((errors / outgoingRequestLog.length) * 100) : 0,
    avgDurationMs: avgDuration,
    totalDataOutBytes: totalDataOut,
    totalDataInBytes: totalDataIn,
    byCategory,
    topHosts
  };
}

// ── Server network info ──
function getServerNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const nets: { name: string; address: string; family: string; internal: boolean; mac: string }[] = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs || []) {
      nets.push({
        name,
        address: addr.address,
        family: addr.family,
        internal: addr.internal,
        mac: addr.mac
      });
    }
  }
  return nets;
}

export default async function networkRoutes(fastify: FastifyInstance) {
  // Install the outgoing request interceptor
  installRequestInterceptor();

  // All routes require admin
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', requireRole('admin'));

  // 1. GET /api/network/stats — Overview network statistics
  fastify.get('/stats', async (request, reply) => {
    const stats = computeNetworkStats();

    // Get server info
    const serverInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptime: Math.round(os.uptime()),
      uptimeFormatted: formatUptime(os.uptime()),
      nodeVersion: process.version,
      networkInterfaces: getServerNetworkInfo().filter(n => !n.internal),
      publicUrl: process.env.PUBLIC_SERVER_URL || null,
      serverPort: process.env.PORT || 4000
    };

    return {
      success: true,
      stats,
      server: serverInfo
    };
  });

  // 2. GET /api/network/requests — Paginated outgoing request log
  fastify.get('/requests', async (request, reply) => {
    const { page = 1, limit = 50, category, search, status } = request.query as any;
    const pageNum = Number(page);
    const limitNum = Math.min(Number(limit), 100);

    let filtered = [...outgoingRequestLog].reverse(); // Newest first

    if (category && category !== 'all') {
      filtered = filtered.filter(r => r.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.url.toLowerCase().includes(q) ||
        r.hostname.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q)
      );
    }
    if (status === 'error') {
      filtered = filtered.filter(r => r.error || (r.statusCode && r.statusCode >= 400));
    } else if (status === 'success') {
      filtered = filtered.filter(r => !r.error && r.statusCode && r.statusCode < 400);
    }

    const total = filtered.length;
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return {
      success: true,
      requests: paginated,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    };
  });

  // 3. GET /api/network/request/:id — Single request details
  fastify.get('/request/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const req = outgoingRequestLog.find(r => r.id === id);
    if (!req) {
      return reply.status(404).send({ error: 'Verzoek niet gevonden' });
    }
    return { success: true, request: req };
  });

  // 4. GET /api/network/connections — Connected services overview
  fastify.get('/connections', async (request, reply) => {
    try {
      const org = await prisma.organization.findFirst({
        include: { settings: true }
      });

      // Gather connected service status
      const connections: any[] = [];

      // Locra Connect (mobile devices)
      const deviceCount = await prisma.mobileDevice.count({
        where: { isActive: true }
      });
      connections.push({
        id: 'locra-connect',
        name: 'Locra Connect',
        description: 'Mobiele app koppeling via QR-code',
        icon: '📱',
        status: 'active',
        details: `${deviceCount} actieve apparaten`,
        type: 'internal'
      });

      // AI Providers
      const settings = org?.settings;
      if (settings) {
        const providers = [
          { key: 'openAiApiKey', name: 'OpenAI', icon: '🤖', host: 'api.openai.com' },
          { key: 'anthropicApiKey', name: 'Anthropic', icon: '🧠', host: 'api.anthropic.com' },
          { key: 'googleApiKey', name: 'Google AI', icon: '🔮', host: 'generativelanguage.googleapis.com' },
          { key: 'openRouterApiKey', name: 'OpenRouter', icon: '🔀', host: 'openrouter.ai' },
        ];

        for (const p of providers) {
          const hasKey = !!(settings as any)[p.key];
          connections.push({
            id: `ai-${p.name.toLowerCase().replace(/\s/g, '-')}`,
            name: p.name,
            description: `AI model provider — ${p.host}`,
            icon: p.icon,
            status: hasKey ? 'connected' : 'not-configured',
            details: hasKey ? 'API Key geconfigureerd' : 'Niet geconfigureerd',
            type: 'ai-provider',
            host: p.host
          });
        }
      }

      // Federation / RowMatch Central
      connections.push({
        id: 'rowmatch-central',
        name: 'RowMatch Centraal',
        description: 'Centrale schooldirectory en federatie',
        icon: '🌐',
        status: 'active',
        details: 'api.rowmatch.nl',
        type: 'federation'
      });

      return {
        success: true,
        connections
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij ophalen verbindingen: ' + e.message });
    }
  });

  // 5. GET /api/network/devices — All paired mobile devices (admin view)
  fastify.get('/devices', async (request, reply) => {
    try {
      const orgId = request.user!.orgId;
      const devices = await prisma.mobileDevice.findMany({
        where: {
          user: { orgId }
        },
        include: {
          user: {
            select: { id: true, username: true, displayName: true, role: true }
          }
        },
        orderBy: { lastActiveAt: 'desc' }
      });

      return {
        success: true,
        devices: devices.map(d => ({
          id: d.id,
          userId: d.userId,
          userName: d.user?.displayName || d.user?.username || 'Onbekend',
          userRole: d.user?.role || 'student',
          deviceName: d.deviceName,
          devicePlatform: d.devicePlatform,
          appVersion: d.appVersion,
          pairedAt: d.pairedAt,
          lastActiveAt: d.lastActiveAt,
          isActive: d.isActive
        }))
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij ophalen apparaten: ' + e.message });
    }
  });

  // 6. DELETE /api/network/devices/:id — Admin force-revoke device
  fastify.delete('/devices/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const device = await prisma.mobileDevice.findUnique({ where: { id } });
      if (!device) {
        return reply.status(404).send({ error: 'Apparaat niet gevonden' });
      }

      await prisma.mobileDevice.delete({ where: { id } });

      await createAuditLog(prisma, {
        orgId: request.user!.orgId,
        userId: request.user!.id,
        action: 'admin.network.device-revoked',
        category: 'system',
        severity: 'warning',
        details: { deviceId: id, deviceName: device.deviceName, revokedUserId: device.userId },
        ipAddress: request.ip
      });

      return { success: true, message: 'Apparaat ontkoppeld' };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout: ' + e.message });
    }
  });

  // 6. GET /api/network/license/hub-info — Full RowMatch parent server & license status
  fastify.get('/license/hub-info', async (request, reply) => {
    try {
      const hubStatus = await getHubStatus();
      return { success: true, hub: hubStatus };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij ophalen hub info: ' + e.message });
    }
  });

  // 7. POST /api/network/license/verify — Manual trigger to re-verify license with api.rowmatch.nl
  fastify.post('/license/verify', async (request, reply) => {
    try {
      const org = await prisma.organization.findFirst({ include: { settings: true } });
      const key = org?.settings?.licenseKey;
      if (!key) {
        return reply.status(400).send({ error: 'Geen licentiesleutel geconfigureerd op deze server.' });
      }

      const result = await validateLicense(key, true);
      const hubStatus = await getHubStatus();

      await createAuditLog(prisma, {
        orgId: request.user!.orgId,
        userId: request.user!.id,
        action: 'network.license.manual-verify',
        category: 'system',
        severity: result.valid ? 'info' : 'warning',
        details: { tier: result.tier, valid: result.valid, reason: result.reason },
        ipAddress: request.ip
      });

      return {
        success: result.valid,
        message: result.valid ? 'Licentie succesvol geverifieerd via api.rowmatch.nl!' : (result.reason || 'Verificatie mislukt'),
        license: result,
        hub: hubStatus
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij verifiëren licentie: ' + e.message });
    }
  });

  // 8. GET /api/network/license/ping — Ping api.rowmatch.nl
  fastify.get('/license/ping', async (request, reply) => {
    try {
      const ping = await pingUpstreamHub();
      return { success: true, ping };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Ping mislukt: ' + e.message });
    }
  });

  // 9. GET /api/network/ip-security — Get IP Whitelist & Blacklist settings + current client IP
  fastify.get('/ip-security', async (request, reply) => {
    try {
      const orgSettings = await prisma.orgSettings.findFirst({
        where: { orgId: request.user!.orgId }
      });

      const rawClientIp = (request.headers['x-forwarded-for'] as string)
        ? String(request.headers['x-forwarded-for']).split(',')[0].trim()
        : request.ip;
      const clientIp = normalizeIp(rawClientIp);

      let allowedList: string[] = ['127.0.0.1', '::1'];
      let blockedList: string[] = [];

      try {
        if (orgSettings?.allowedIps) {
          const parsed = JSON.parse(orgSettings.allowedIps);
          if (Array.isArray(parsed)) allowedList = parsed;
        }
      } catch {
        if (orgSettings?.allowedIps) {
          allowedList = orgSettings.allowedIps.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
        }
      }

      try {
        if (orgSettings?.blockedIps) {
          const parsed = JSON.parse(orgSettings.blockedIps);
          if (Array.isArray(parsed)) blockedList = parsed;
        }
      } catch {
        if (orgSettings?.blockedIps) {
          blockedList = orgSettings.blockedIps.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
        }
      }

      // Collect server's own network interface IPs
      const interfaces = os.networkInterfaces();
      const serverIps: { name: string; address: string; family: string }[] = [];
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          if (!iface.internal) {
            serverIps.push({ name, address: iface.address, family: iface.family });
          }
        }
      }

      return {
        success: true,
        clientIp,
        ipWhitelistEnabled: Boolean(orgSettings?.ipWhitelistEnabled),
        allowedIps: allowedList,
        blockedIps: blockedList,
        serverIps
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij ophalen IP-beveiliging: ' + e.message });
    }
  });

  // 10. POST /api/network/ip-security — Update IP Whitelist & Blacklist settings
  fastify.post('/ip-security', async (request, reply) => {
    try {
      const { ipWhitelistEnabled, allowedIps, blockedIps } = request.body as {
        ipWhitelistEnabled: boolean;
        allowedIps: string[];
        blockedIps: string[];
      };

      const cleanAllowed = Array.isArray(allowedIps)
        ? allowedIps.map(s => s.trim()).filter(Boolean)
        : [];
      const cleanBlocked = Array.isArray(blockedIps)
        ? blockedIps.map(s => s.trim()).filter(Boolean)
        : [];

      // Ensure localhost is never removed from allowed list
      if (!cleanAllowed.includes('127.0.0.1')) cleanAllowed.push('127.0.0.1');
      if (!cleanAllowed.includes('::1')) cleanAllowed.push('::1');

      await prisma.orgSettings.update({
        where: { orgId: request.user!.orgId },
        data: {
          ipWhitelistEnabled: Boolean(ipWhitelistEnabled),
          allowedIps: JSON.stringify(cleanAllowed),
          blockedIps: JSON.stringify(cleanBlocked)
        }
      });

      invalidateIpSecurityCache();
      await loadIpSecurityConfig();

      await createAuditLog(prisma, {
        orgId: request.user!.orgId,
        userId: request.user!.id,
        action: 'network.ip-security.updated',
        category: 'security',
        severity: 'info',
        details: {
          ipWhitelistEnabled: Boolean(ipWhitelistEnabled),
          allowedCount: cleanAllowed.length,
          blockedCount: cleanBlocked.length
        },
        ipAddress: request.ip
      });

      return {
        success: true,
        message: 'IP-toegangsregels succesvol opgeslagen en geactiveerd.',
        ipWhitelistEnabled: Boolean(ipWhitelistEnabled),
        allowedIps: cleanAllowed,
        blockedIps: cleanBlocked
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij opslaan IP-beveiliging: ' + e.message });
    }
  });

  // 11. GET /api/network/connect-info — Get Locra Connect discovery & directory info
  fastify.get('/connect-info', async (request, reply) => {
    try {
      const org = await prisma.organization.findFirst({
        include: { settings: true }
      });
      if (!org) {
        return reply.status(404).send({ error: 'Geen organisatie gevonden.' });
      }

      const defaultConnectCode = org.connectCode || `LOCRA-${org.slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
      const detectedUrl = resolveServerUrl(request);
      const publicServerUrl = org.settings?.locraConnectPublicUrl || detectedUrl;
      const enableLocraConnect = org.settings?.enableLocraConnect ?? true;

      // Check central directory search status via api.rowmatch.nl
      let isRegisteredInHub = false;
      let hubRecord: any = null;
      try {
        const hubRes = await fetch(`https://api.rowmatch.nl/api/locra/connect/schools?q=${encodeURIComponent(defaultConnectCode)}`, {
          timeout: 4000
        } as any);
        if (hubRes.ok) {
          const hubData = await hubRes.json() as any;
          if (hubData.success && Array.isArray(hubData.schools) && hubData.schools.length > 0) {
            const found = hubData.schools.find((s: any) => 
              s.connectCode?.toUpperCase() === defaultConnectCode.toUpperCase() ||
              s.name?.toLowerCase() === org.name.toLowerCase()
            );
            if (found) {
              isRegisteredInHub = true;
              hubRecord = found;
            }
          }
        }
      } catch (err: any) {
        // silent hub timeout
      }

      return {
        success: true,
        orgName: org.name,
        slug: org.slug,
        connectCode: defaultConnectCode,
        detectedUrl,
        publicServerUrl,
        enableLocraConnect,
        primaryColor: org.primaryColor,
        logoUrl: org.logoUrl,
        licenseKeyMasked: org.settings?.licenseKey ? org.settings.licenseKey.replace(/-[A-Z0-9]{4}-/, '-****-') : null,
        isRegisteredInHub,
        hubRecord
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij ophalen Locra Connect info: ' + e.message });
    }
  });

  // 12. POST /api/network/connect-register — Register or update school in central Locra Connect directory
  fastify.post('/connect-register', async (request, reply) => {
    try {
      const { connectCode, publicServerUrl, enableLocraConnect } = request.body as {
        connectCode: string;
        publicServerUrl: string;
        enableLocraConnect: boolean;
      };

      const org = await prisma.organization.findFirst({
        include: { settings: true }
      });
      if (!org) {
        return reply.status(404).send({ error: 'Geen organisatie gevonden.' });
      }

      const cleanCode = (connectCode || `LOCRA-${org.slug}`).toUpperCase().trim().replace(/[^A-Z0-9-]/g, '');
      const cleanUrl = (publicServerUrl || resolveServerUrl(request)).trim().replace(/\/+$/, '');

      // Update local database
      await prisma.organization.update({
        where: { id: org.id },
        data: { connectCode: cleanCode }
      });

      if (org.settings) {
        await prisma.orgSettings.update({
          where: { id: org.settings.id },
          data: {
            enableLocraConnect: Boolean(enableLocraConnect),
            locraConnectPublicUrl: cleanUrl
          }
        });
      }

      // If enabled, sync with central api.rowmatch.nl registry
      let hubSyncSuccess = false;
      let hubSyncMessage = '';

      if (enableLocraConnect) {
        const key = org.settings?.licenseKey;
        if (!key) {
          return reply.status(400).send({
            error: 'Een geldige Locra licentiesleutel is vereist om je school aan te melden in de centrale Locra Connect directory.'
          });
        }

        try {
          const regRes = await fetch('https://api.rowmatch.nl/api/locra/connect/register-instance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              licenseKey: key,
              serverUrl: cleanUrl,
              connectCode: cleanCode,
              logoUrl: org.logoUrl || null,
              primaryColor: org.primaryColor || '#6366f1'
            }),
            timeout: 7000
          } as any);

          const regData = await regRes.json() as any;
          if (regRes.ok && regData.success) {
            hubSyncSuccess = true;
            hubSyncMessage = regData.message || 'School succesvol aangemeld in Locra Connect directory.';
          } else {
            hubSyncMessage = regData.error || 'Centrale server weigerde registratie.';
          }
        } catch (err: any) {
          hubSyncMessage = 'Kon centrale server (api.rowmatch.nl) niet bereiken: ' + err.message;
        }
      } else {
        hubSyncMessage = 'Locra Connect vindbaarheid is uitgeschakeld voor deze school.';
      }

      await createAuditLog(prisma, {
        orgId: org.id,
        userId: request.user!.id,
        action: 'network.connect.registered',
        category: 'system',
        severity: hubSyncSuccess ? 'info' : 'warning',
        details: { connectCode: cleanCode, serverUrl: cleanUrl, hubSyncSuccess, hubSyncMessage },
        ipAddress: request.ip
      });

      return {
        success: true,
        connectCode: cleanCode,
        publicServerUrl: cleanUrl,
        enableLocraConnect: Boolean(enableLocraConnect),
        hubSyncSuccess,
        hubSyncMessage
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij opslaan Locra Connect: ' + e.message });
    }
  });

  // 13. POST /api/network/connect-test — Test search query against central directory
  fastify.post('/connect-test', async (request, reply) => {
    try {
      const { query } = request.body as { query: string };
      const q = (query || '').trim();
      if (!q) {
        return reply.status(400).send({ error: 'Zoekopdracht is verplicht' });
      }

      const hubRes = await fetch(`https://api.rowmatch.nl/api/locra/connect/schools?q=${encodeURIComponent(q)}`, {
        timeout: 5000
      } as any);
      const data = await hubRes.json() as any;

      return {
        success: hubRes.ok,
        results: data.schools || [],
        count: data.count || 0,
        query: q
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Test mislukt: ' + e.message });
    }
  });
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}u ${m}m`;
  if (h > 0) return `${h}u ${m}m`;
  return `${m}m`;
}
