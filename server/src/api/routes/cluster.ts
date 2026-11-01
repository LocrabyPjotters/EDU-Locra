import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { clusterRouter } from '../../services/clusterRouter';
import { createAuditLog } from '../../services/auditService';

export default async function clusterRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', async (request, reply) => {
    const user = request.user!;
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return reply.status(403).send({ error: 'Alleen beheerders hebben toegang tot cluster-orchestrie.' });
    }
  });

  // ── 1. GET /api/cluster/nodes — Haal alle nodes op inclusief realtime stream & health metrics ──
  fastify.get('/nodes', async (request, reply) => {
    const user = request.user!;

    const nodes = await prisma.clusterNode.findMany({
      where: { orgId: user.orgId },
      orderBy: { priority: 'desc' }
    });

    const enriched = nodes.map(node => {
      const live = clusterRouter.getNodeMetrics(node.id, (node as any).vramGb || 48);
      return {
        ...node,
        vramGb: (node as any).vramGb || 48,
        roles: (() => {
          try { return JSON.parse(node.roles); } catch { return []; }
        })(),
        activeStreams: live.activeStreams,
        lastPingMs: live.lastPingMs,
        isHealthy: live.isHealthy,
        availableModels: live.availableModels,
        vramUsedMb: live.vramUsedMb,
        vramTotalMb: live.vramTotalMb,
        vramPercentage: live.vramPercentage,
        oomRiskLevel: live.oomRiskLevel
      };
    });

    const activeSchedule = await clusterRouter.getActiveSchedule(prisma, user.orgId);
    const clusterStats = clusterRouter.getClusterStats();

    return {
      nodes: enriched,
      clusterStats,
      activeSchedule: activeSchedule ? {
        id: activeSchedule.id,
        name: activeSchedule.name,
        startTime: activeSchedule.startTime,
        endTime: activeSchedule.endTime,
        enableSpillover: activeSchedule.enableSpillover
      } : null
    };
  });

  // ── 2. POST /api/cluster/nodes — Nieuwe node registreren ──
  fastify.post('/nodes', async (request, reply) => {
    const user = request.user!;
    const body = request.body as any;

    const { name, url, engine, roles, maxStreams, priority, isSpilloverNode, vramGb, speculativeDraftNodeId, speculativeDraftModel } = body;
    if (!name || !url) {
      return reply.status(400).send({ error: 'Naam en URL zijn verplicht.' });
    }

    const node = await prisma.clusterNode.create({
      data: {
        orgId: user.orgId,
        name,
        url: url.trim(),
        engine: engine || 'ollama',
        roles: Array.isArray(roles) ? JSON.stringify(roles) : JSON.stringify(['chat_fast']),
        maxStreams: Number(maxStreams) || 8,
        priority: Number(priority) || 1,
        vramGb: Number(vramGb) || 48,
        speculativeDraftNodeId: speculativeDraftNodeId || null,
        speculativeDraftModel: speculativeDraftModel || null,
        isSpilloverNode: Boolean(isSpilloverNode)
      }
    });

    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'cluster.node_create',
      category: 'settings',
      severity: 'info',
      details: { nodeName: name, url }
    });

    return reply.status(201).send(node);
  });

  // ── 3. PUT /api/cluster/nodes/:id — Node bijwerken ──
  fastify.put('/nodes/:id', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const existing = await prisma.clusterNode.findUnique({ where: { id } });
    if (!existing || existing.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Node niet gevonden' });
    }

    const updated = await prisma.clusterNode.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        url: body.url ? body.url.trim() : existing.url,
        engine: body.engine ?? existing.engine,
        roles: Array.isArray(body.roles) ? JSON.stringify(body.roles) : existing.roles,
        maxStreams: body.maxStreams !== undefined ? Number(body.maxStreams) : existing.maxStreams,
        priority: body.priority !== undefined ? Number(body.priority) : existing.priority,
        vramGb: body.vramGb !== undefined ? Number(body.vramGb) : (existing as any).vramGb,
        speculativeDraftNodeId: body.speculativeDraftNodeId !== undefined ? body.speculativeDraftNodeId : existing.speculativeDraftNodeId,
        speculativeDraftModel: body.speculativeDraftModel !== undefined ? body.speculativeDraftModel : existing.speculativeDraftModel,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
        isSpilloverNode: body.isSpilloverNode !== undefined ? Boolean(body.isSpilloverNode) : existing.isSpilloverNode
      }
    });

    return updated;
  });

  // ── 4. DELETE /api/cluster/nodes/:id — Node verwijderen ──
  fastify.delete('/nodes/:id', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const existing = await prisma.clusterNode.findUnique({ where: { id } });
    if (!existing || existing.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Node niet gevonden' });
    }

    await prisma.clusterNode.delete({ where: { id } });

    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'cluster.node_delete',
      category: 'settings',
      severity: 'warning',
      details: { nodeName: existing.name }
    });

    return { success: true };
  });

  // ── 5. POST /api/cluster/nodes/:id/ping — Live health-check & model inspectie ──
  fastify.post('/nodes/:id/ping', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const node = await prisma.clusterNode.findUnique({ where: { id } });
    if (!node || node.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Node niet gevonden' });
    }

    const pingResult = await clusterRouter.pingNode(node.url, node.engine, (node as any).vramGb || 48);
    return pingResult;
  });

  // ── 5b. POST /api/cluster/nodes/:id/benchmark — Voer live snelheidstest & capaciteitsmeting uit ──
  fastify.post('/nodes/:id/benchmark', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { model } = (request.body || {}) as { model?: string };

    const node = await prisma.clusterNode.findUnique({ where: { id } });
    if (!node || node.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Node niet gevonden' });
    }

    try {
      const benchmarkResult = await clusterRouter.runNodeBenchmark(
        node.url,
        model,
        node.engine,
        node.speculativeDraftModel || undefined
      );
      return benchmarkResult;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Benchmark mislukt' });
    }
  });

  // ── 6. GET /api/cluster/schedules — Haal alle spitsuur- & piekregels op ──
  fastify.get('/schedules', async (request, reply) => {
    const user = request.user!;

    const rules = await prisma.clusterScheduleRule.findMany({
      where: { orgId: user.orgId },
      orderBy: { startTime: 'asc' }
    });

    const parsed = rules.map(r => ({
      ...r,
      daysOfWeek: (() => {
        try { return JSON.parse(r.daysOfWeek); } catch { return []; }
      })()
    }));

    return parsed;
  });

  // ── 7. POST /api/cluster/schedules — Nieuwe piekregel toevoegen ──
  fastify.post('/schedules', async (request, reply) => {
    const user = request.user!;
    const body = request.body as any;

    const { name, daysOfWeek, startTime, endTime, enableSpillover } = body;
    if (!name || !startTime || !endTime) {
      return reply.status(400).send({ error: 'Naam, starttijd en eindtijd zijn verplicht.' });
    }

    const rule = await prisma.clusterScheduleRule.create({
      data: {
        orgId: user.orgId,
        name,
        daysOfWeek: Array.isArray(daysOfWeek) ? JSON.stringify(daysOfWeek) : JSON.stringify(['mon','tue','wed','thu','fri']),
        startTime,
        endTime,
        enableSpillover: enableSpillover !== undefined ? Boolean(enableSpillover) : true
      }
    });

    return reply.status(201).send(rule);
  });

  // ── 8. PUT /api/cluster/schedules/:id — Piekregel bijwerken ──
  fastify.put('/schedules/:id', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const existing = await prisma.clusterScheduleRule.findUnique({ where: { id } });
    if (!existing || existing.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Regel niet gevonden' });
    }

    const updated = await prisma.clusterScheduleRule.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        daysOfWeek: Array.isArray(body.daysOfWeek) ? JSON.stringify(body.daysOfWeek) : existing.daysOfWeek,
        startTime: body.startTime ?? existing.startTime,
        endTime: body.endTime ?? existing.endTime,
        enableSpillover: body.enableSpillover !== undefined ? Boolean(body.enableSpillover) : existing.enableSpillover,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive
      }
    });

    return updated;
  });

  // ── 9. DELETE /api/cluster/schedules/:id — Piekregel verwijderen ──
  fastify.delete('/schedules/:id', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const existing = await prisma.clusterScheduleRule.findUnique({ where: { id } });
    if (!existing || existing.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Regel niet gevonden' });
    }

    await prisma.clusterScheduleRule.delete({ where: { id } });
    return { success: true };
  });

  // ── 10. GET /api/cluster/template — Genereer Docker Compose & Systemd setup voor de school ──
  fastify.get('/template', async (request, reply) => {
    const query = request.query as any;
    const type = query?.type || '4x_gpu';
    const blueprint = clusterRouter.generateDeploymentBlueprint(type);
    return blueprint;
  });
}
