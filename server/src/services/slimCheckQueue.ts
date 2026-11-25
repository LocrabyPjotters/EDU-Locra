import { prisma } from '../index';
import { slimCheckService } from './slimCheckService';
import { aiQueueService } from './aiQueueService';
import { offPeakAnalyzer } from './offPeakAnalyzer';

export type SlimCheckScheduleMode = 'immediate' | 'offpeak_24h' | 'offpeak_7d';

export interface QueueProgressState {
  step: string;
  percent: number;
  message: string;
}

export class SlimCheckQueueManager {
  private isProcessing = false;
  private currentSessionId: string | null = null;
  private pipelineProgressMap = new Map<string, QueueProgressState>();
  private queueInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Registreer SlimCheck uitvoerder bij centrale AI Wachtrij-service
    aiQueueService.registerExecutor('slimcheck_grade', async (task, { updateProgress }) => {
      const sessionId = task.sourceRefId;
      if (!sessionId) throw new Error('Geen SlimCheck sessie-ID gekoppeld aan taak.');

      this.isProcessing = true;
      this.currentSessionId = sessionId;
      try {
        await prisma.slimCheckSession.update({
          where: { id: sessionId },
          data: { status: 'processing', queuedAt: new Date() }
        }).catch(() => {});

        await slimCheckService.runGradingPipeline(sessionId, (progress) => {
          this.setProgress(sessionId, progress);
          void updateProgress(progress.percent, progress.message);
        });

        this.setProgress(sessionId, {
          step: 'done',
          percent: 100,
          message: 'Nakijken voltooid!'
        });

        return { resultSummary: `SlimCheck sessie "${task.title}" volledig nagekeken en opgeslagen.` };
      } finally {
        this.isProcessing = false;
        this.currentSessionId = null;
      }
    });

    // Legacy achtergrond-interval voor eventuele directe 'queued'/'scheduled' sessies zonder AiQueueTask
    this.queueInterval = setInterval(() => {
      this.checkAndProcessQueue().catch(err => {
        console.error('[SlimCheckQueue] Background tick error:', err);
      });
    }, 30000);
  }

  /**
   * Fallback basiscontrole als geen orgId aanwezig is (weekend 24/7 of 22:00-07:00).
   * Voor org-specifieke checks gebruiken we offPeakAnalyzer.
   */
  isOffPeakNow(d: Date = new Date()): boolean {
    const day = d.getDay();
    const hour = d.getHours();
    if (day === 0 || day === 6) return true;
    if (hour >= 22 || hour < 7) return true;
    return false;
  }

  calculateScheduledTime(mode: SlimCheckScheduleMode, now: Date = new Date()): Date {
    if (mode === 'immediate') return new Date(now.getTime());
    if (mode === 'offpeak_24h') {
      if (this.isOffPeakNow(now)) return new Date(now.getTime() + 60 * 1000);
      const tonight = new Date(now);
      tonight.setHours(22, 0, 0, 0);
      return tonight;
    }
    const day = now.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7 || 7;
    const target = new Date(now.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000);
    target.setHours(2, 0, 0, 0);
    return target;
  }

  async getTrafficLevel(orgId?: string): Promise<'rustig' | 'normaal' | 'druk'> {
    if (orgId) {
      const snap = await offPeakAnalyzer.getLiveLoadSnapshot(orgId).catch(() => null);
      if (snap) return snap.state;
    }
    try {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
      const count = await prisma.message.count({
        where: { createdAt: { gte: fifteenMinAgo } }
      });
      if (count > 20) return 'druk';
      if (count > 5) return 'normaal';
      return 'rustig';
    } catch {
      return 'rustig';
    }
  }

  /**
   * Plan een SlimCheck sessie in — daluren & prioriteit/deadlines lopen via de centrale AiQueueService.
   */
  async enqueueSession(
    sessionId: string,
    mode: SlimCheckScheduleMode = 'immediate',
    onProgressUpdate?: (p: QueueProgressState) => void,
    options?: {
      userId?: string;
      orgId?: string;
      userPriority?: number | null;
      deadlineAt?: string | Date | null;
    }
  ): Promise<{ status: string; scheduledFor: Date; queuePosition: number; message: string; aiTask?: any }> {
    const now = new Date();
    const session = await prisma.slimCheckSession.findUnique({
      where: { id: sessionId },
      select: { id: true, orgId: true, teacherId: true, title: true, pageCount: true }
    });

    const orgId = options?.orgId || session?.orgId;
    const userId = options?.userId || session?.teacherId;
    const hasCustomScheduling =
      mode !== 'immediate' ||
      typeof options?.userPriority === 'number' ||
      Boolean(options?.deadlineAt);

    // Gebruik de centrale AI Wachtrij & Daluren-planner wanneer daluren, prioriteit (1-10) of deadline wordt gebruikt
    if (hasCustomScheduling && orgId && userId && session) {
      let effectiveDeadline: Date | null = options?.deadlineAt ? new Date(options.deadlineAt) : null;
      if (!effectiveDeadline || isNaN(effectiveDeadline.getTime())) {
        effectiveDeadline = mode === 'offpeak_24h'
          ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
          : mode === 'offpeak_7d'
          ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          : null;
      }

      const aiTask = await aiQueueService.enqueueTask({
        orgId,
        userId,
        taskType: 'slimcheck_grade',
        sourceRefId: sessionId,
        title: `SlimCheck nakijken: ${session.title || 'Toets'}`,
        description: `Automatisch nakijken van ${session.pageCount || 'diverse'} leerling-scans voor toets "${session.title || sessionId}"`,
        userPriority: options?.userPriority ?? null,
        deadlineAt: effectiveDeadline,
        schedulePreference: mode === 'immediate' ? 'immediate' : 'smart_offpeak',
        triageMetadata: {
          pageCount: session.pageCount || 20
        }
      });

      const plannedFor = aiTask.plannedStartAt ? new Date(aiTask.plannedStartAt) : now;
      const targetStatus = aiTask.status === 'queued' ? 'queued' : 'scheduled';

      await prisma.slimCheckSession.update({
        where: { id: sessionId },
        data: {
          status: targetStatus,
          scheduledMode: 'ai_queue_managed',
          scheduledFor: plannedFor,
          queuedAt: now,
          queuePriority: Math.max(1, Math.round(11 - aiTask.effectivePriority))
        }
      });

      const queuePos = await this.calculateQueuePosition(sessionId);
      const msg = aiTask.escalatedToUrgent
        ? `Urgent opgeschaald (AI-prio ${aiTask.aiPriority}/10): wordt zo snel mogelijk nagekeken. ${aiTask.aiReasoning || ''}`
        : `Ingepland via daluren-analyse op ${plannedFor.toLocaleDateString('nl-NL')} om ${plannedFor.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} (AI-prio ${aiTask.aiPriority}/10).`;

      this.setProgress(sessionId, {
        step: targetStatus,
        percent: 0,
        message: msg
      });

      return {
        status: targetStatus,
        scheduledFor: plannedFor,
        queuePosition: queuePos,
        message: msg,
        aiTask
      };
    }

    // Directe directe uitvoering zonder daluren/deadline
    if (mode === 'immediate' && !this.isProcessing) {
      await prisma.slimCheckSession.update({
        where: { id: sessionId },
        data: {
          status: 'processing',
          scheduledMode: mode,
          scheduledFor: now,
          queuedAt: now,
          queuePriority: 1
        }
      });

      this.startProcessing(sessionId, onProgressUpdate);

      return {
        status: 'processing',
        scheduledFor: now,
        queuePosition: 0,
        message: 'Direct gestart met nakijken.'
      };
    }

    const scheduledFor = this.calculateScheduledTime(mode, now);
    await prisma.slimCheckSession.update({
      where: { id: sessionId },
      data: {
        status: 'queued',
        scheduledMode: mode,
        scheduledFor,
        queuedAt: now,
        queuePriority: 1
      }
    });

    const queuePos = await this.calculateQueuePosition(sessionId);
    const message = `In de wachtrij geplaatst (positie #${queuePos}). Start zodra de huidige nakijkopdracht klaar is.`;
    this.setProgress(sessionId, { step: 'queued', percent: 0, message });

    return { status: 'queued', scheduledFor, queuePosition: queuePos, message };
  }

  async cancelSchedule(sessionId: string): Promise<boolean> {
    const session = await prisma.slimCheckSession.findUnique({
      where: { id: sessionId },
      select: { status: true }
    });

    // Annuleer eventuele gekoppelde AiQueueTask
    const linkedTasks = await prisma.aiQueueTask.findMany({
      where: { sourceRefId: sessionId, taskType: 'slimcheck_grade', status: { in: ['queued', 'scheduled', 'running'] } },
      select: { id: true }
    }).catch(() => []);
    for (const t of linkedTasks) {
      await aiQueueService.cancelTask(t.id).catch(() => {});
    }

    if (!session || (session.status !== 'scheduled' && session.status !== 'queued')) {
      return linkedTasks.length > 0;
    }

    await prisma.slimCheckSession.update({
      where: { id: sessionId },
      data: {
        status: 'draft',
        scheduledMode: 'immediate',
        scheduledFor: null,
        queuedAt: null
      }
    });

    this.pipelineProgressMap.delete(sessionId);
    return true;
  }

  async calculateQueuePosition(sessionId: string): Promise<number> {
    const target = await prisma.slimCheckSession.findUnique({
      where: { id: sessionId },
      select: { queuePriority: true, queuedAt: true, createdAt: true, status: true }
    });

    if (!target || (target.status !== 'queued' && target.status !== 'scheduled')) {
      return 0;
    }

    const priority = target.queuePriority ?? 2;
    const queuedAt = target.queuedAt || target.createdAt;

    const aheadCount = await prisma.slimCheckSession.count({
      where: {
        id: { not: sessionId },
        status: { in: ['queued', 'scheduled'] },
        OR: [
          { queuePriority: { lt: priority } },
          { queuePriority: priority, queuedAt: { lt: queuedAt } }
        ]
      }
    });

    return aheadCount + 1;
  }

  async getQueueOverview(sessionId?: string, orgId?: string) {
    const now = new Date();
    let resolvedOrgId = orgId;
    if (!resolvedOrgId && sessionId) {
      const s = await prisma.slimCheckSession.findUnique({ where: { id: sessionId }, select: { orgId: true } });
      resolvedOrgId = s?.orgId;
    }

    let isOffPeak = this.isOffPeakNow(now);
    let trafficLevel: 'rustig' | 'normaal' | 'druk' = await this.getTrafficLevel(resolvedOrgId);
    let nextOffPeakDate = this.calculateScheduledTime('offpeak_24h', now);

    if (resolvedOrgId) {
      try {
        const analysis = await offPeakAnalyzer.analyzeOrgPattern(resolvedOrgId);
        isOffPeak = analysis.live.isOffPeakNow;
        trafficLevel = analysis.live.state;
        const win = await offPeakAnalyzer.findBestOffPeakWindow(resolvedOrgId, 180, null, 5, 'smart_offpeak');
        nextOffPeakDate = win.plannedStartAt;
      } catch {}
    }

    const [activeQueued, activeScheduled] = await Promise.all([
      prisma.slimCheckSession.findMany({
        where: { status: 'queued' },
        select: { id: true, title: true, queuePriority: true, queuedAt: true, pageCount: true }
      }),
      prisma.slimCheckSession.findMany({
        where: { status: 'scheduled' },
        select: { id: true, title: true, scheduledMode: true, scheduledFor: true, pageCount: true }
      })
    ]);

    let sessionInfo = null;
    if (sessionId) {
      const sess = await prisma.slimCheckSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          title: true,
          status: true,
          scheduledMode: true,
          scheduledFor: true,
          queuedAt: true,
          queuePriority: true
        }
      });
      if (sess) {
        const queuePos = (sess.status === 'queued' || sess.status === 'scheduled')
          ? await this.calculateQueuePosition(sessionId)
          : 0;

        sessionInfo = {
          ...sess,
          queuePosition: queuePos,
          isCurrentlyProcessing: this.currentSessionId === sessionId
        };
      }
    }

    const nextWeekendOffPeakDate = this.calculateScheduledTime('offpeak_7d', now);

    return {
      isProcessing: this.isProcessing,
      currentSessionId: this.currentSessionId,
      queuedCount: activeQueued.length,
      scheduledCount: activeScheduled.length,
      totalWaiting: activeQueued.length + activeScheduled.length,
      isOffPeak,
      trafficLevel,
      nextOffPeakDate,
      nextWeekendOffPeakDate,
      sessionInfo,
      liveProgress: sessionId ? (this.pipelineProgressMap.get(sessionId) || null) : null
    };
  }

  async checkAndProcessQueue() {
    if (this.isProcessing) return;

    const now = new Date();
    // Sla sessies over die door aiQueueService ('ai_queue_managed') beheerd worden
    const nextQueued = await prisma.slimCheckSession.findFirst({
      where: {
        status: 'queued',
        scheduledMode: { not: 'ai_queue_managed' }
      },
      orderBy: [{ queuePriority: 'asc' }, { queuedAt: 'asc' }, { createdAt: 'asc' }]
    });

    if (nextQueued) {
      this.startProcessing(nextQueued.id);
      return;
    }

    if (this.isOffPeakNow(now)) {
      const nextScheduled = await prisma.slimCheckSession.findFirst({
        where: {
          status: 'scheduled',
          scheduledMode: { not: 'ai_queue_managed' },
          scheduledFor: { lte: now }
        },
        orderBy: [{ queuePriority: 'asc' }, { scheduledFor: 'asc' }, { createdAt: 'asc' }]
      });

      if (nextScheduled) {
        this.startProcessing(nextScheduled.id);
      }
    }
  }

  private startProcessing(
    sessionId: string,
    externalProgressCallback?: (p: QueueProgressState) => void
  ) {
    this.isProcessing = true;
    this.currentSessionId = sessionId;

    this.setProgress(sessionId, {
      step: 'start',
      percent: 5,
      message: 'AI Nakijk-pipeline gestart...'
    });

    if (externalProgressCallback) {
      externalProgressCallback(this.pipelineProgressMap.get(sessionId)!);
    }

    slimCheckService.runGradingPipeline(
      sessionId,
      (progress) => {
        this.setProgress(sessionId, progress);
        if (externalProgressCallback) externalProgressCallback(progress);
      }
    )
      .then(() => {
        this.setProgress(sessionId, {
          step: 'done',
          percent: 100,
          message: 'Nakijken voltooid!'
        });
      })
      .catch(err => {
        this.setProgress(sessionId, {
          step: 'error',
          percent: 0,
          message: 'Fout tijdens nakijken: ' + err.message
        });
      })
      .finally(() => {
        this.isProcessing = false;
        this.currentSessionId = null;

        setTimeout(() => {
          this.checkAndProcessQueue().catch(() => {});
        }, 1500);
      });
  }

  setProgress(sessionId: string, progress: QueueProgressState) {
    this.pipelineProgressMap.set(sessionId, progress);
  }

  getProgress(sessionId: string): QueueProgressState | undefined {
    return this.pipelineProgressMap.get(sessionId);
  }
}

export const slimCheckQueue = new SlimCheckQueueManager();
