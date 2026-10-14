import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import {
  queryAuditLogs,
  getAuditStats,
  exportAuditLogs,
  cleanupAuditLogs,
  createAuditLog,
  AuditCategory,
  AuditSeverity
} from '../../services/auditService';

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', requireRole('admin'));

  // ── GET /api/audit — Filtered, paginated audit logs ───────────────────────
  fastify.get('/', async (request, reply) => {
    const {
      page = '1',
      limit = '50',
      category,
      severity,
      userId,
      action,
      search,
      startDate,
      endDate
    } = request.query as Record<string, string>;

    const result = await queryAuditLogs(prisma, {
      orgId: request.user!.orgId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      category: category as AuditCategory | undefined,
      severity: severity as AuditSeverity | undefined,
      userId: userId || undefined,
      action: action || undefined,
      search: search || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return result;
  });

  // ── GET /api/audit/stats — Dashboard statistics ───────────────────────────
  fastify.get('/stats', async (request, reply) => {
    const stats = await getAuditStats(prisma, request.user!.orgId);
    return stats;
  });

  // ── GET /api/audit/export — Export audit logs as JSON ─────────────────────
  fastify.get('/export', async (request, reply) => {
    const { startDate, endDate, format = 'json' } = request.query as Record<string, string>;

    const data = await exportAuditLogs(
      prisma,
      request.user!.orgId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    // Log the export action itself
    await createAuditLog(prisma, {
      orgId: request.user!.orgId,
      userId: request.user!.id,
      action: 'audit.export',
      category: 'system',
      severity: 'warning',
      details: { totalEntries: data.totalEntries, format },
      ipAddress: request.ip,
    });

    if (format === 'csv') {
      // CSV export
      const csvHeader = 'id,action,category,severity,details,user,ipAddress,createdAt\n';
      const csvRows = data.logs.map(l =>
        `"${l.id}","${l.action}","${l.category}","${l.severity}","${(l.details || '').replace(/"/g, '""')}","${l.user || ''}","${l.ipAddress || ''}","${l.createdAt}"`
      ).join('\n');
      
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
      return csvHeader + csvRows;
    }

    // JSON export (default)
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.json"`);
    return data;
  });

  // ── GET /api/audit/categories — Available categories ──────────────────────
  fastify.get('/categories', async (request, reply) => {
    return {
      categories: [
        { id: 'auth', label: 'Authenticatie', description: 'Inloggen, uitloggen, wachtwoord wijzigingen' },
        { id: 'user', label: 'Gebruikers', description: 'Aanmaken, bewerken, verwijderen van gebruikers' },
        { id: 'settings', label: 'Instellingen', description: 'Organisatie-instellingen en configuratie' },
        { id: 'model', label: 'AI Modellen', description: 'Installeren, bijwerken, verwijderen van modellen' },
        { id: 'data', label: 'Data & Bestanden', description: 'Kennisbanken, documenten, backups' },
        { id: 'class', label: 'Klassen & Groepen', description: 'Aanmaken, bewerken, leden beheren' },
        { id: 'security', label: 'Beveiliging', description: 'PII-detectie, rate limits, verdachte activiteit' },
        { id: 'system', label: 'Systeem', description: 'Licentie, GitHub sync, onderhoud' },
      ],
      severities: [
        { id: 'info', label: 'Informatie', color: '#3b82f6' },
        { id: 'warning', label: 'Waarschuwing', color: '#f59e0b' },
        { id: 'critical', label: 'Kritiek', color: '#ef4444' },
      ]
    };
  });

  // ── POST /api/audit/cleanup — Remove old logs ────────────────────────────
  fastify.post('/cleanup', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { retentionDays = 90 } = request.body as { retentionDays?: number };

    if (retentionDays < 7) {
      return reply.status(400).send({ error: 'Minimaal 7 dagen bewaartermijn' });
    }

    const deletedCount = await cleanupAuditLogs(prisma, request.user!.orgId, retentionDays);

    await createAuditLog(prisma, {
      orgId: request.user!.orgId,
      userId: request.user!.id,
      action: 'audit.cleanup',
      category: 'system',
      severity: 'critical',
      details: { retentionDays, deletedCount },
      ipAddress: request.ip,
    });

    return { success: true, deletedCount, message: `${deletedCount} oude logregels verwijderd (ouder dan ${retentionDays} dagen)` };
  });

  // ── GET /api/audit/user/:userId — Logs for specific user ─────────────────
  fastify.get('/user/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { page = '1', limit = '50' } = request.query as Record<string, string>;

    // Verify user belongs to same org
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, orgId: request.user!.orgId },
      select: { displayName: true, username: true }
    });
    if (!targetUser) return reply.status(404).send({ error: 'Gebruiker niet gevonden' });

    const result = await queryAuditLogs(prisma, {
      orgId: request.user!.orgId,
      userId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });

    return {
      user: targetUser,
      ...result
    };
  });

  // ── GET /api/audit/timeline — Grouped timeline view ──────────────────────
  fastify.get('/timeline', async (request, reply) => {
    const { days = '7' } = request.query as { days?: string };
    const numDays = Math.min(90, Math.max(1, parseInt(days) || 7));
    const orgId = request.user!.orgId;
    const now = new Date();

    const timeline: { date: string; total: number; critical: number; warning: number; info: number; topActions: { action: string; count: number }[] }[] = [];

    for (let i = numDays - 1; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const [total, critical, warning, topActions] = await Promise.all([
        prisma.auditLog.count({ where: { orgId, createdAt: { gte: dayStart, lt: dayEnd } } }),
        prisma.auditLog.count({ where: { orgId, severity: 'critical', createdAt: { gte: dayStart, lt: dayEnd } } }),
        prisma.auditLog.count({ where: { orgId, severity: 'warning', createdAt: { gte: dayStart, lt: dayEnd } } }),
        prisma.auditLog.groupBy({
          by: ['action'],
          where: { orgId, createdAt: { gte: dayStart, lt: dayEnd } },
          _count: true,
          orderBy: { _count: { action: 'desc' } },
          take: 3,
        }),
      ]);

      timeline.push({
        date: dayStart.toISOString().slice(0, 10),
        total,
        critical,
        warning,
        info: total - critical - warning,
        topActions: topActions.map(a => ({ action: a.action, count: a._count })),
      });
    }

    return { days: numDays, timeline };
  });
}
