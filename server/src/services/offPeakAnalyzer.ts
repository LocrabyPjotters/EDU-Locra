import { prisma } from '../index';
import { concurrencyQueue } from './concurrencyQueue';
import { clusterRouter } from './clusterRouter';

export type HourClassification = 'dal' | 'normaal' | 'piek';

export interface HourlyLoadCell {
  dayOfWeek: number; // 0 = Maandag .. 6 = Zondag
  dayLabel: string;
  hour: number; // 0..23
  avgPrompts: number;
  avgTokens: number;
  avgLatencyMs: number;
  backgroundTasksCount: number;
  historicalLoadScore: number; // 0.0 - 1.0
  classification: HourClassification;
}

export interface LiveLoadSnapshot {
  orgId: string;
  state: 'rustig' | 'normaal' | 'druk';
  isOffPeakNow: boolean;
  loadScore: number; // 0.0 - 1.0
  chatActiveStreams: number;
  chatQueuedCount: number;
  recentMessages10m: number;
  activeScheduleRuleName: string | null;
  currentClassification: HourClassification;
}

export interface OffPeakAnalysisReport {
  orgId: string;
  generatedAt: string;
  lookbackDays: number;
  dataPointsUsed: number;
  analysisConfidence: 'laag_koudestart' | 'gemiddeld' | 'hoog';
  matrix: HourlyLoadCell[][]; // [7][24]
  peakHoursSummary: string[];
  offPeakHoursSummary: string[];
  quietestSlot: { dayLabel: string; hour: number; label: string; score: number };
  busiestSlot: { dayLabel: string; hour: number; label: string; score: number };
  live: LiveLoadSnapshot;
}

export interface PlannedWindowResult {
  plannedStartAt: Date;
  plannedFinishAt: Date;
  mustEscalate: boolean;
  windowClassification: HourClassification;
  windowLoadScore: number;
  reason: string;
}

const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const FULL_DAY_LABELS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

/**
 * School-week basiscurve voor koude-start blending wanneer er nog weinig gebruiksdata is.
 */
function baselineSchoolLoadScore(dayOfWeek: number, hour: number): number {
  const isWeekend = dayOfWeek >= 5;
  if (isWeekend) {
    if (hour >= 10 && hour <= 20) return 0.22;
    return 0.08;
  }
  // Werkdagen (Ma-Vr)
  if (hour >= 9 && hour <= 15) return 0.85; // Lesuren = hoogste piek
  if (hour === 8 || hour === 16) return 0.55; // Opstart & uitloop
  if (hour >= 17 && hour <= 21) return 0.42; // Huiswerkuren
  return 0.1; // Nacht (22:00 - 07:59) = daluur
}

export class OffPeakAnalyzerService {
  private cache = new Map<string, { expiresAt: number; report: Omit<OffPeakAnalysisReport, 'live'> }>();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000;

  /**
   * Bouw of lees de 7x24 belastinganalyse uit echte Locra-historie voor deze organisatie.
   */
  async analyzeOrgPattern(orgId: string, forceRefresh = false): Promise<OffPeakAnalysisReport> {
    const cached = !forceRefresh ? this.cache.get(orgId) : null;
    if (cached && cached.expiresAt > Date.now()) {
      const live = await this.getLiveLoadSnapshot(orgId, cached.report.matrix);
      return { ...cached.report, live };
    }

    const lookbackDays = 21;
    const sinceDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // 1. Haal historische chat-activiteit, tokens & responstijd op
    const messages = await prisma.message.findMany({
      where: {
        role: 'user',
        createdAt: { gte: sinceDate },
        conversation: { orgId }
      },
      select: {
        createdAt: true,
        tokensUsed: true,
        responseTimeMs: true
      },
      take: 15000
    }).catch(() => []);

    // 2. Haal achtergrond-taken & SlimCheck sessies op voor completer druktebeeld
    const [queueTasks, slimSessions] = await Promise.all([
      prisma.aiQueueTask.findMany({
        where: { orgId, createdAt: { gte: sinceDate } },
        select: { startedAt: true, createdAt: true }
      }).catch(() => []),
      prisma.slimCheckSession.findMany({
        where: { orgId, createdAt: { gte: sinceDate } },
        select: { createdAt: true }
      }).catch(() => [])
    ]);

    const rawPrompts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const rawTokens: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const rawLatencySum: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const rawLatencyCnt: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const rawBgTasks: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    for (const m of messages) {
      const d = new Date(m.createdAt);
      const dow = (d.getDay() + 6) % 7; // 0 = Ma .. 6 = Zo
      const hr = d.getHours();
      rawPrompts[dow][hr] += 1;
      rawTokens[dow][hr] += m.tokensUsed || 0;
      if (m.responseTimeMs && m.responseTimeMs > 0) {
        rawLatencySum[dow][hr] += m.responseTimeMs;
        rawLatencyCnt[dow][hr] += 1;
      }
    }

    for (const t of queueTasks) {
      const d = new Date(t.startedAt || t.createdAt);
      rawBgTasks[(d.getDay() + 6) % 7][d.getHours()] += 1;
    }
    for (const s of slimSessions) {
      const d = new Date(s.createdAt);
      rawBgTasks[(d.getDay() + 6) % 7][d.getHours()] += 1;
    }

    const totalDataPoints = messages.length + queueTasks.length + slimSessions.length;
    // Hoe meer datapunten, hoe minder gewicht op de koude-start basiscurve (volledig datagedreven vanaf ~120 datapunten)
    const historicalWeight = Math.min(1, totalDataPoints / 120);

    // Vind piekwaarden voor normalisatie
    let maxSlotActivity = 1;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const weighted = rawPrompts[d][h] + rawBgTasks[d][h] * 2 + rawTokens[d][h] / 1500;
        if (weighted > maxSlotActivity) maxSlotActivity = weighted;
      }
    }

    const matrix: HourlyLoadCell[][] = [];
    let quietestSlot = { dayLabel: 'Zondag', hour: 3, label: '03:00 - 04:00', score: 1 };
    let busiestSlot = { dayLabel: 'Maandag', hour: 10, label: '10:00 - 11:00', score: 0 };
    const hourAvgAcrossDays = Array(24).fill(0);

    for (let d = 0; d < 7; d++) {
      const row: HourlyLoadCell[] = [];
      for (let h = 0; h < 24; h++) {
        const weeksInWindow = Math.max(1, lookbackDays / 7);
        const avgPrompts = Number((rawPrompts[d][h] / weeksInWindow).toFixed(2));
        const avgTokens = Math.round(rawTokens[d][h] / weeksInWindow);
        const avgLatencyMs = rawLatencyCnt[d][h] > 0 ? Math.round(rawLatencySum[d][h] / rawLatencyCnt[d][h]) : 0;

        const weightedActivity = rawPrompts[d][h] + rawBgTasks[d][h] * 2 + rawTokens[d][h] / 1500;
        const observedScore = Math.min(1, weightedActivity / maxSlotActivity);
        const latencyFactor = avgLatencyMs > 12000 ? 0.12 : avgLatencyMs > 6000 ? 0.06 : 0;
        const measuredWithLatency = Math.min(1, observedScore + latencyFactor);

        const baseScore = baselineSchoolLoadScore(d, h);
        const combinedScore = Number((historicalWeight * measuredWithLatency + (1 - historicalWeight) * baseScore).toFixed(3));

        const classification: HourClassification =
          combinedScore >= 0.58 ? 'piek' : combinedScore >= 0.30 ? 'normaal' : 'dal';

        hourAvgAcrossDays[h] += combinedScore / 7;

        const hrLabel = `${String(h).padStart(2, '0')}:00 - ${String((h + 1) % 24).padStart(2, '0')}:00`;
        if (combinedScore < quietestSlot.score) {
          quietestSlot = { dayLabel: FULL_DAY_LABELS[d], hour: h, label: hrLabel, score: combinedScore };
        }
        if (combinedScore > busiestSlot.score) {
          busiestSlot = { dayLabel: FULL_DAY_LABELS[d], hour: h, label: hrLabel, score: combinedScore };
        }

        row.push({
          dayOfWeek: d,
          dayLabel: DAY_LABELS[d],
          hour: h,
          avgPrompts,
          avgTokens,
          avgLatencyMs,
          backgroundTasksCount: rawBgTasks[d][h],
          historicalLoadScore: combinedScore,
          classification
        });
      }
      matrix.push(row);
    }

    const peakHoursSummary = this.compressHourRanges(
      hourAvgAcrossDays.map((s, h) => ({ h, match: s >= 0.52 }))
    );
    const offPeakHoursSummary = this.compressHourRanges(
      hourAvgAcrossDays.map((s, h) => ({ h, match: s < 0.32 }))
    );

    const analysisConfidence: OffPeakAnalysisReport['analysisConfidence'] =
      totalDataPoints >= 120 ? 'hoog' : totalDataPoints >= 25 ? 'gemiddeld' : 'laag_koudestart';

    const baseReport: Omit<OffPeakAnalysisReport, 'live'> = {
      orgId,
      generatedAt: new Date().toISOString(),
      lookbackDays,
      dataPointsUsed: totalDataPoints,
      analysisConfidence,
      matrix,
      peakHoursSummary,
      offPeakHoursSummary,
      quietestSlot,
      busiestSlot
    };

    this.cache.set(orgId, {
      expiresAt: Date.now() + this.CACHE_TTL_MS,
      report: baseReport
    });

    const live = await this.getLiveLoadSnapshot(orgId, matrix);
    return { ...baseReport, live };
  }

  private compressHourRanges(flags: Array<{ h: number; match: boolean }>): string[] {
    const ranges: string[] = [];
    let start: number | null = null;
    for (let i = 0; i < flags.length; i++) {
      if (flags[i].match && start === null) start = flags[i].h;
      if ((!flags[i].match || i === flags.length - 1) && start !== null) {
        const endHour = flags[i].match ? (flags[i].h + 1) % 24 : flags[i].h;
        ranges.push(`${String(start).padStart(2, '0')}:00–${String(endHour).padStart(2, '0')}:00`);
        start = null;
      }
    }
    return ranges;
  }

  /**
   * Meet actuele live serverbelasting (chat streams, wachtrij, recente prompts & clusterregels).
   */
  async getLiveLoadSnapshot(orgId: string, existingMatrix?: HourlyLoadCell[][]): Promise<LiveLoadSnapshot> {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const hr = now.getHours();

    const chatStats = concurrencyQueue.getStats(orgId);
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

    const [recentMessages10m, activeRule, orgSettings] = await Promise.all([
      prisma.message.count({
        where: {
          role: 'user',
          createdAt: { gte: tenMinAgo },
          conversation: { orgId }
        }
      }).catch(() => 0),
      clusterRouter.getActiveSchedule(prisma, orgId).catch(() => null),
      prisma.orgSettings.findUnique({ where: { orgId }, select: { maxConcurrency: true } }).catch(() => null)
    ]);

    const maxConc = Math.max(1, orgSettings?.maxConcurrency || 6);
    const streamRatio = chatStats.activeStreams / maxConc;
    const queuePressure = chatStats.queuedCount > 0 ? Math.min(1, 0.5 + chatStats.queuedCount * 0.15) : 0;
    const msgPressure = Math.min(1, recentMessages10m / 18);

    const historicalCell = existingMatrix?.[dow]?.[hr];
    const histScore = historicalCell ? historicalCell.historicalLoadScore : baselineSchoolLoadScore(dow, hr);

    const combinedLive = Number(
      Math.min(1, Math.max(streamRatio * 0.65 + queuePressure * 0.6 + msgPressure * 0.35, histScore * 0.65)).toFixed(3)
    );

    const ruleForcesPeak = Boolean(activeRule);
    let state: 'rustig' | 'normaal' | 'druk' = 'rustig';
    if (chatStats.queuedCount > 0 || streamRatio >= 0.7 || msgPressure >= 0.75 || ruleForcesPeak) {
      state = 'druk';
    } else if (combinedLive >= 0.42 || recentMessages10m >= 5 || chatStats.activeStreams >= 2) {
      state = 'normaal';
    }

    const currentClassification: HourClassification =
      state === 'druk' || histScore >= 0.58 ? 'piek' : histScore >= 0.30 || state === 'normaal' ? 'normaal' : 'dal';

    const isOffPeakNow =
      state === 'rustig' && !ruleForcesPeak && (historicalCell ? historicalCell.classification !== 'piek' : baselineSchoolLoadScore(dow, hr) < 0.45);

    return {
      orgId,
      state,
      isOffPeakNow,
      loadScore: combinedLive,
      chatActiveStreams: chatStats.activeStreams,
      chatQueuedCount: chatStats.queuedCount,
      recentMessages10m,
      activeScheduleRuleName: activeRule?.name || null,
      currentClassification
    };
  }

  /**
   * Zoek het beste daluur-starttijdstip vóór een eventuele deadline zonder bestaande ingeplande taken te overlappen.
   */
  async findBestOffPeakWindow(
    orgId: string,
    estimatedDurationSec: number,
    deadlineAt: Date | null,
    effectivePriority: number,
    schedulePreference: string = 'smart_offpeak',
    reservedSlots: Array<{ startMs: number; finishMs: number }> = []
  ): Promise<PlannedWindowResult> {
    const report = await this.analyzeOrgPattern(orgId);
    const nowMs = Date.now();
    const durationMs = Math.max(30_000, estimatedDurationSec * 1000);
    const safetyBufferMs = 5 * 60 * 1000;

    if (schedulePreference === 'immediate') {
      const start = new Date(nowMs);
      return {
        plannedStartAt: start,
        plannedFinishAt: new Date(nowMs + durationMs),
        mustEscalate: true,
        windowClassification: report.live.currentClassification,
        windowLoadScore: report.live.loadScore,
        reason: 'Directe uitvoering gekozen — taak start zo snel mogelijk met voorrang.'
      };
    }

    // Deadline-check: past het überhaupt nog in de toekomst vóór de deadline?
    const horizonEndMs = deadlineAt
      ? deadlineAt.getTime() - durationMs - safetyBufferMs
      : nowMs + 5 * 24 * 60 * 60 * 1000;

    if (deadlineAt && horizonEndMs <= nowMs + 10 * 60 * 1000) {
      return {
        plannedStartAt: new Date(nowMs),
        plannedFinishAt: new Date(nowMs + durationMs),
        mustEscalate: true,
        windowClassification: report.live.currentClassification,
        windowLoadScore: report.live.loadScore,
        reason: `Deadline (${deadlineAt.toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}) is te dichtbij voor een daluur-venster — automatisch opgeschaald naar urgente uitvoering.`
      };
    }

    // Als het NU een rustig daluur is én de plek vrij is én prioriteit hoog/normaal is
    const isNowOccupied = reservedSlots.some(r => nowMs < r.finishMs && nowMs + durationMs > r.startMs);
    if (report.live.isOffPeakNow && !isNowOccupied && schedulePreference !== 'deadline_only') {
      return {
        plannedStartAt: new Date(nowMs + 15_000),
        plannedFinishAt: new Date(nowMs + 15_000 + durationMs),
        mustEscalate: false,
        windowClassification: 'dal',
        windowLoadScore: report.live.loadScore,
        reason: `Momenteel rustig daluur (${report.live.state}, belasting ${Math.round(report.live.loadScore * 100)}%) — start direct op korte termijn.`
      };
    }

    // Evalueer kandidaat-tijdstippen in stappen van 30 minuten tot aan horizonEndMs
    let bestStartMs = nowMs + 60_000;
    let bestCost = Infinity;
    let bestScore = report.live.loadScore;
    let bestClass: HourClassification = report.live.currentClassification;

    const STEP_MS = 30 * 60 * 1000;
    const maxCandidates = 240; // Max 5 dagen vooruit in 30-min stappen
    const startCursor = Math.ceil(nowMs / STEP_MS) * STEP_MS;

    for (let idx = 0; idx < maxCandidates; idx++) {
      let candMs = startCursor + idx * STEP_MS;
      if (candMs > horizonEndMs) break;

      // Verschuif voorbij bezette slots
      for (const res of reservedSlots) {
        if (candMs < res.finishMs && candMs + durationMs > res.startMs) {
          candMs = res.finishMs + 30_000;
        }
      }
      if (candMs > horizonEndMs) continue;

      const candDate = new Date(candMs);
      const dow = (candDate.getDay() + 6) % 7;
      const hr = candDate.getHours();
      const cell = report.matrix[dow]?.[hr];
      const cellScore = cell ? cell.historicalLoadScore : baselineSchoolLoadScore(dow, hr);
      const cellClass: HourClassification = cell ? cell.classification : 'normaal';

      // Wachttijdstraf: hoge prioriteit (8-10) wil niet onnodig dagen wachten
      const hoursWait = Math.max(0, (candMs - nowMs) / (60 * 60 * 1000));
      const waitPenalty = hoursWait * (0.008 * (effectivePriority / 5));

      const cost = cellScore + waitPenalty;
      if (cost < bestCost) {
        bestCost = cost;
        bestStartMs = candMs;
        bestScore = cellScore;
        bestClass = cellClass;
      }
    }

    // Als het allerbeste beschikbare slot vóór de deadline nog steeds een piekuur is en deadline < 4u weg is -> escaleren
    const hoursUntilBest = (bestStartMs - nowMs) / (60 * 60 * 1000);
    if (deadlineAt && bestClass === 'piek' && deadlineAt.getTime() - nowMs < 4 * 60 * 60 * 1000) {
      return {
        plannedStartAt: new Date(nowMs),
        plannedFinishAt: new Date(nowMs + durationMs),
        mustEscalate: true,
        windowClassification: report.live.currentClassification,
        windowLoadScore: report.live.loadScore,
        reason: 'Geen daluur beschikbaar vóór de strakke deadline — taak krijgt urgente voorrang.'
      };
    }

    const plannedDate = new Date(bestStartMs);
    const timeLabel = plannedDate.toLocaleString('nl-NL', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      plannedStartAt: plannedDate,
      plannedFinishAt: new Date(bestStartMs + durationMs),
      mustEscalate: false,
      windowClassification: bestClass,
      windowLoadScore: bestScore,
      reason: hoursUntilBest < 0.25
        ? `Direct ingepland in huidig gunstig tijdslot (belasting ${Math.round(bestScore * 100)}%).`
        : `Ingepland in ${bestClass === 'dal' ? 'daluur' : 'rustiger tijdslot'} rond ${timeLabel} (verwachte schoolbelasting ${Math.round(bestScore * 100)}%).`
    };
  }
}

export const offPeakAnalyzer = new OffPeakAnalyzerService();
