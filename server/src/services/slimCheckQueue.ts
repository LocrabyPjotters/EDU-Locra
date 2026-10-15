import { prisma } from '../index';
import { slimCheckService } from './slimCheckService';

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
    // Start background queue inspector every 30 seconds
    this.queueInterval = setInterval(() => {
      this.checkAndProcessQueue().catch(err => {
        console.error('[SlimCheckQueue] Background tick error:', err);
      });
    }, 30000);
  }

  /**
   * Determine if the current moment is considered an off-peak hour (daluren).
   * - Weekend (Saturday & Sunday) is off-peak 24/7.
   * - Weekdays: 22:00 to 07:00 is off-peak.
   */
  isOffPeakNow(d: Date = new Date()): boolean {
    const day = d.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = d.getHours();
    if (day === 0 || day === 6) return true;
    if (hour >= 22 || hour < 7) return true;
    return false;
  }

  /**
   * Calculate target start time for a chosen mode
   */
  calculateScheduledTime(mode: SlimCheckScheduleMode, now: Date = new Date()): Date {
    if (mode === 'immediate') {
      return new Date(now.getTime());
    }

    if (mode === 'offpeak_24h') {
      if (this.isOffPeakNow(now)) {
        // We are already in daluren, run soon
        return new Date(now.getTime() + 60 * 1000);
      }
      // Target tonight at 22:00
      const tonight = new Date(now);
      tonight.setHours(22, 0, 0, 0);
      return tonight;
    }

    // mode === 'offpeak_7d'
    // Target upcoming weekend (Saturday 02:00) or upcoming quietest night window
    const day = now.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7 || 7;
    const target = new Date(now.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000);
    target.setHours(2, 0, 0, 0);
    return target;
  }

  /**
   * Evaluates recent message traffic to assess current load
   */
  async getTrafficLevel(): Promise<'rustig' | 'normaal' | 'druk'> {
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
   * Enqueue or schedule a SlimCheck session
   */
  async enqueueSession(
    sessionId: string,
    mode: SlimCheckScheduleMode = 'immediate',
    onProgressUpdate?: (p: QueueProgressState) => void
  ): Promise<{ status: string; scheduledFor: Date; queuePosition: number; message: string }> {
    const now = new Date();
    const scheduledFor = this.calculateScheduledTime(mode, now);

    const priorityMap: Record<SlimCheckScheduleMode, number> = {
      immediate: 1,
      offpeak_24h: 2,
      offpeak_7d: 3
    };
    const priority = priorityMap[mode] || 2;

    const isOffPeak = this.isOffPeakNow(now);

    // If immediate mode and nothing is running right now: start immediately!
    if (mode === 'immediate' && !this.isProcessing) {
      await prisma.slimCheckSession.update({
        where: { id: sessionId },
        data: {
          status: 'processing',
          scheduledMode: mode,
          scheduledFor: now,
          queuedAt: now,
          queuePriority: priority
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

    // If offpeak_24h and it is ALREADY off-peak now and server is idle: start immediately!
    if (mode === 'offpeak_24h' && isOffPeak && !this.isProcessing) {
      await prisma.slimCheckSession.update({
        where: { id: sessionId },
        data: {
          status: 'processing',
          scheduledMode: mode,
          scheduledFor: now,
          queuedAt: now,
          queuePriority: priority
        }
      });

      this.startProcessing(sessionId, onProgressUpdate);

      return {
        status: 'processing',
        scheduledFor: now,
        queuePosition: 0,
        message: 'Het is momenteel daluren (rustig). Direct gestart met verwerking!'
      };
    }

    // Otherwise: put in 'queued' (if immediate or overdue) or 'scheduled'
    const targetStatus = (mode === 'immediate' || (isOffPeak && mode === 'offpeak_24h')) ? 'queued' : 'scheduled';

    await prisma.slimCheckSession.update({
      where: { id: sessionId },
      data: {
        status: targetStatus,
        scheduledMode: mode,
        scheduledFor,
        queuedAt: now,
        queuePriority: priority
      }
    });

    const queuePos = await this.calculateQueuePosition(sessionId);

    const message = targetStatus === 'queued'
      ? `In de wachtrij geplaatst (positie #${queuePos}). Start automatisch zodra de huidige nakijkopdracht klaar is.`
      : `Ingepland voor daluren op ${scheduledFor.toLocaleDateString('nl-NL')} om ${scheduledFor.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}.`;

    this.setProgress(sessionId, {
      step: targetStatus,
      percent: 0,
      message
    });

    return {
      status: targetStatus,
      scheduledFor,
      queuePosition: queuePos,
      message
    };
  }

  /**
   * Cancel scheduling and revert to draft
   */
  async cancelSchedule(sessionId: string): Promise<boolean> {
    const session = await prisma.slimCheckSession.findUnique({
      where: { id: sessionId },
      select: { status: true }
    });

    if (!session || (session.status !== 'scheduled' && session.status !== 'queued')) {
      return false;
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

  /**
   * Calculate position of a session in the queue
   */
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

    // Count jobs that have higher priority or were queued earlier with same priority
    const aheadCount = await prisma.slimCheckSession.count({
      where: {
        id: { not: sessionId },
        status: { in: ['queued', 'scheduled'] },
        OR: [
          { queuePriority: { lt: priority } },
          {
            queuePriority: priority,
            queuedAt: { lt: queuedAt }
          }
        ]
      }
    });

    return aheadCount + 1;
  }

  /**
   * Get complete queue status and live statistics
   */
  async getQueueOverview(sessionId?: string) {
    const now = new Date();
    const isOffPeak = this.isOffPeakNow(now);
    const trafficLevel = await this.getTrafficLevel();

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

    const nextOffPeakDate = this.calculateScheduledTime('offpeak_24h', now);
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

  /**
   * Background tick to check pending queue items and execute next eligible session
   */
  async checkAndProcessQueue() {
    if (this.isProcessing) {
      return;
    }

    const now = new Date();
    const isOffPeak = this.isOffPeakNow(now);

    // 1. Check if there are 'queued' jobs (waiting to run right now)
    const nextQueued = await prisma.slimCheckSession.findFirst({
      where: { status: 'queued' },
      orderBy: [
        { queuePriority: 'asc' },
        { queuedAt: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    if (nextQueued) {
      console.log(`[SlimCheckQueue] Picking next queued session: ${nextQueued.id} (${nextQueued.title})`);
      this.startProcessing(nextQueued.id);
      return;
    }

    // 2. If it's off-peak, check for 'scheduled' jobs whose start time has arrived
    if (isOffPeak) {
      const nextScheduled = await prisma.slimCheckSession.findFirst({
        where: {
          status: 'scheduled',
          scheduledFor: { lte: now }
        },
        orderBy: [
          { queuePriority: 'asc' },
          { scheduledFor: 'asc' },
          { createdAt: 'asc' }
        ]
      });

      if (nextScheduled) {
        console.log(`[SlimCheckQueue] Daluren actief! Starting scheduled session: ${nextScheduled.id} (${nextScheduled.title})`);
        this.startProcessing(nextScheduled.id);
        return;
      }
    }
  }

  /**
   * Internal runner to process a single session
   */
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
        console.log(`[SlimCheckQueue] Session ${sessionId} completed successfully.`);
      })
      .catch(err => {
        this.setProgress(sessionId, {
          step: 'error',
          percent: 0,
          message: 'Fout tijdens nakijken: ' + err.message
        });
        console.error(`[SlimCheckQueue] Session ${sessionId} error:`, err);
      })
      .finally(() => {
        this.isProcessing = false;
        this.currentSessionId = null;

        // Immediately check if another job is waiting in the queue
        setTimeout(() => {
          this.checkAndProcessQueue().catch(e => console.error('[SlimCheckQueue] Next job trigger error:', e));
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
