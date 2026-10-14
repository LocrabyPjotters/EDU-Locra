/**
 * AuditService – Centralized audit logging for Locra EDU
 * 
 * Categories:
 *   auth     – Login, logout, password changes
 *   user     – User CRUD, role changes, GDPR deletes
 *   settings – Organization settings mutations
 *   model    – AI model install/update/delete
 *   data     – Knowledge bases, documents, backups
 *   class    – Class/group CRUD and membership
 *   security – PII detections, rate limits, suspicious activity
 *   system   – License changes, GitHub sync, maintenance
 * 
 * Severity:
 *   info     – Normal operations (login, create)
 *   warning  – Noteworthy actions (settings changed, model removed)
 *   critical – Security-relevant (GDPR delete, password reset, license change)
 */

import { prisma as prismaInstance } from '../index';

// Re-export types for consumers
export type AuditCategory = 'auth' | 'user' | 'settings' | 'model' | 'data' | 'class' | 'security' | 'system';
export type AuditSeverity = 'info' | 'warning' | 'critical';

// Type for the Prisma client instance
type PrismaClientType = typeof prismaInstance;

interface AuditLogInput {
  orgId: string;
  userId?: string | null;
  action: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  details?: string | Record<string, unknown> | null;
  ipAddress?: string | null;
}

// In-memory buffer for batched writes (optional performance optimization)
let auditBuffer: AuditLogInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const BUFFER_SIZE = 20;
const FLUSH_INTERVAL_MS = 5000;

/**
 * Infer category from action string if not explicitly provided
 */
function inferCategory(action: string): AuditCategory {
  if (action.startsWith('user.') || action.startsWith('gdpr.')) return 'user';
  if (action.startsWith('auth.') || action === 'user.login' || action === 'user.logout') return 'auth';
  if (action.startsWith('settings.') || action.startsWith('license.')) return 'settings';
  if (action.startsWith('model.')) return 'model';
  if (action.startsWith('kb.') || action.startsWith('document.') || action.startsWith('backup.')) return 'data';
  if (action.startsWith('class.') || action.startsWith('group.')) return 'class';
  if (action.startsWith('security.') || action.startsWith('pii.')) return 'security';
  return 'system';
}

/**
 * Infer severity from action string if not explicitly provided
 */
function inferSeverity(action: string): AuditSeverity {
  const criticalActions = [
    'user.gdpr_delete', 'user.password-reset', 'user.role-changed',
    'license.activate', 'license.unlink',
    'security.pii-detected', 'security.rate-limit',
    'settings.api-keys-changed', 'backup.github-push'
  ];
  const warningActions = [
    'user.deactivated', 'user.email-changed',
    'model.delete', 'model.update',
    'settings.changed', 'class.delete', 'group.delete',
    'kb.delete', 'document.delete'
  ];

  if (criticalActions.includes(action)) return 'critical';
  if (warningActions.includes(action)) return 'warning';
  return 'info';
}

/**
 * Create audit log entry.
 * This is the primary function all routes should call.
 * It never throws – failures are logged to stderr silently.
 */
export async function createAuditLog(prisma: PrismaClientType, input: AuditLogInput): Promise<void> {
  try {
    const category = input.category || inferCategory(input.action);
    const severity = input.severity || inferSeverity(input.action);
    const details = typeof input.details === 'object' && input.details !== null
      ? JSON.stringify(input.details)
      : (input.details as string | null) ?? null;

    await prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        userId: input.userId ?? null,
        action: input.action,
        category,
        severity,
        details,
        ipAddress: input.ipAddress ?? null,
      }
    });
  } catch (err) {
    // Never throw from audit logging – it should never break the main flow
    console.error('[AuditService] Failed to write audit log:', err);
  }
}

/**
 * Create multiple audit entries at once (batch insert).
 * Useful for import operations or bulk user changes.
 */
export async function createAuditLogBatch(prisma: PrismaClientType, entries: AuditLogInput[]): Promise<void> {
  try {
    const data = entries.map(input => ({
      orgId: input.orgId,
      userId: input.userId ?? null,
      action: input.action,
      category: input.category || inferCategory(input.action),
      severity: input.severity || inferSeverity(input.action),
      details: typeof input.details === 'object' && input.details !== null
        ? JSON.stringify(input.details)
        : (input.details as string | null) ?? null,
      ipAddress: input.ipAddress ?? null,
    }));

    await prisma.auditLog.createMany({ data });
  } catch (err) {
    console.error('[AuditService] Failed to write audit batch:', err);
  }
}

/**
 * Query audit logs with filtering, pagination, and search.
 */
export interface AuditQueryOptions {
  orgId: string;
  page?: number;
  limit?: number;
  category?: AuditCategory;
  severity?: AuditSeverity;
  userId?: string;
  action?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

export async function queryAuditLogs(prisma: PrismaClientType, opts: AuditQueryOptions) {
  const page = Math.max(1, opts.page || 1);
  const limit = Math.min(500, Math.max(1, opts.limit || 50));
  const skip = (page - 1) * limit;

  const where: any = { orgId: opts.orgId };
  if (opts.category) where.category = opts.category;
  if (opts.severity) where.severity = opts.severity;
  if (opts.userId) where.userId = opts.userId;
  if (opts.action) where.action = { contains: opts.action };
  if (opts.search) {
    where.OR = [
      { action: { contains: opts.search } },
      { details: { contains: opts.search } },
    ];
  }
  if (opts.startDate || opts.endDate) {
    where.createdAt = {};
    if (opts.startDate) where.createdAt.gte = opts.startDate;
    if (opts.endDate) where.createdAt.lte = opts.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { displayName: true, username: true, role: true } }
      }
    }),
    prisma.auditLog.count({ where })
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    }
  };
}

/**
 * Get audit statistics for the dashboard.
 */
export async function getAuditStats(prisma: PrismaClientType, orgId: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalLogs,
    todayLogs,
    weekLogs,
    criticalLogs,
    warningLogs,
    categoryBreakdown,
    recentCritical,
    loginCount,
  ] = await Promise.all([
    prisma.auditLog.count({ where: { orgId } }),
    prisma.auditLog.count({ where: { orgId, createdAt: { gte: today } } }),
    prisma.auditLog.count({ where: { orgId, createdAt: { gte: weekAgo } } }),
    prisma.auditLog.count({ where: { orgId, severity: 'critical' } }),
    prisma.auditLog.count({ where: { orgId, severity: 'warning' } }),
    prisma.auditLog.groupBy({
      by: ['category'],
      where: { orgId, createdAt: { gte: monthAgo } },
      _count: true,
    }),
    prisma.auditLog.findMany({
      where: { orgId, severity: 'critical' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { user: { select: { displayName: true, username: true } } }
    }),
    prisma.auditLog.count({
      where: { orgId, action: 'user.login', createdAt: { gte: weekAgo } }
    }),
  ]);

  // Daily activity for last 7 days
  const dailyActivity: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const count = await prisma.auditLog.count({
      where: { orgId, createdAt: { gte: dayStart, lt: dayEnd } }
    });
    dailyActivity.push({
      date: dayStart.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }),
      count
    });
  }

  return {
    totalLogs,
    todayLogs,
    weekLogs,
    criticalLogs,
    warningLogs,
    loginCount,
    categoryBreakdown: categoryBreakdown.map((c: any) => ({
      category: c.category,
      count: c._count
    })),
    recentCritical,
    dailyActivity,
  };
}

/**
 * Export audit logs as JSON for download or GitHub backup.
 */
export async function exportAuditLogs(
  prisma: PrismaClientType,
  orgId: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: any = { orgId };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { displayName: true, username: true } }
    }
  });

  return {
    exportedAt: new Date().toISOString(),
    orgId,
    totalEntries: logs.length,
    dateRange: {
      from: startDate?.toISOString() || 'all',
      to: endDate?.toISOString() || 'now',
    },
    logs: logs.map((l: any) => ({
      id: l.id,
      action: l.action,
      category: l.category,
      severity: l.severity,
      details: l.details,
      ipAddress: l.ipAddress,
      user: l.user?.displayName || l.user?.username || null,
      createdAt: l.createdAt.toISOString(),
    }))
  };
}

/**
 * Cleanup old audit logs based on retention policy.
 */
export async function cleanupAuditLogs(
  prisma: PrismaClientType,
  orgId: string,
  retentionDays: number
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  const result = await prisma.auditLog.deleteMany({
    where: {
      orgId,
      createdAt: { lt: cutoff },
      // Never auto-delete critical logs
      severity: { not: 'critical' }
    }
  });

  return result.count;
}
