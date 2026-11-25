import { prisma } from '../index';
import { concurrencyQueue } from './concurrencyQueue';
import { offPeakAnalyzer, OffPeakAnalysisReport } from './offPeakAnalyzer';
import { aiTaskTriager, AiQueueTaskType, TriageOutput } from './aiTaskTriager';
import { decryptApiKey } from '../utils/crypto';
import { ollamaClient } from './ollama';

export interface EnqueueAiTaskInput {
  orgId: string;
  userId: string;
  taskType: AiQueueTaskType;
  sourceRefId?: string;
  title: string;
  description: string;
  payload?: any;
  userPriority?: number | null; // 1-10 of null voor Auto
  deadlineAt?: string | Date | null;
  schedulePreference?: 'smart_offpeak' | 'immediate' | 'deadline_only';
  triageMetadata?: {
    slideCount?: number;
    questionQualityMode?: string;
    pageCount?: number;
    studentCount?: number;
    sourceCharCount?: number;
    modelId?: string;
  };
}

export type TaskExecutorFn = (
  task: any,
  ctx: {
    signal: AbortSignal;
    updateProgress: (percent: number, message: string) => Promise<void>;
  }
) => Promise<{ resultSummary: string }>;

class AiQueueManagerService {
  private executors = new Map<string, TaskExecutorFn>();
  private runningControllers = new Map<string, AbortController>();
  private busyByOrg = new Set<string>();
  private ticker: NodeJS.Timeout | null = null;
  private started = false;

  /**
   * Registreer een uitvoerder voor een specifiek taaktype (bijv. live_generate, live_review, slimcheck_grade).
   */
  registerExecutor(taskType: AiQueueTaskType, fn: TaskExecutorFn) {
    this.executors.set(taskType, fn);
  }

  /**
   * Start de achtergrond-dispatcher (elke 15 seconden) en herstel eventuele afgebroken 'running' taken.
   */
  async start() {
    if (this.started) return;
    this.started = true;

    // Default executor voor losse/aangepaste AI-taken (custom_ai)
    if (!this.executors.has('custom_ai')) {
      this.registerExecutor('custom_ai', async (task, { signal, updateProgress }) => {
        await updateProgress(20, 'AI-model voorbereiden voor opdracht...');
        let payload: any = {};
        try {
          payload = task.payloadJson ? JSON.parse(task.payloadJson) : {};
        } catch {}

        const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId: task.orgId } }).catch(() => null);
        const promptText = `Voer deze onderwijstaak grondig en gestructureerd uit in het Nederlands:\nTitel: ${task.title}\nOpdracht: ${task.description}\n${payload?.extraContext ? `Context:\n${payload.extraContext}` : ''}`;
        const sysPrompt = 'Je bent de senior AI-assistent van Locra. Lever heldere, direct bruikbare Nederlandse uitwerkingen in Markdown.';

        await updateProgress(45, 'AI verwerkt opdracht...');
        let outputText = '';

        // Probeer eerst Gemini, daarna lokaal Ollama-model
        const geminiKey = decryptApiKey(orgSettings?.geminiApiKey);
        if (geminiKey) {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: sysPrompt }] },
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 4096 }
              }),
              signal
            }
          );
          if (res.ok) {
            const data = (await res.json()) as any;
            outputText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          }
        }

        if (!outputText) {
          const models = await prisma.installedModel.findMany({
            where: { orgId: task.orgId, provider: 'ollama', isActive: true, isCodeMatchOnly: false },
            orderBy: { isDefault: 'desc' }
          }).catch(() => []);
          const modelName = models[0]?.ollamaName || 'llama3.1:8b';
          const res = await ollamaClient.generate(promptText, modelName, sysPrompt, false, undefined, false, task.orgId, signal, {
            numCtx: 16384,
            numPredict: 4096,
            temperature: 0.4
          });
          if (res.ok) {
            const raw = (await res.json()) as any;
            outputText = raw?.response || '';
          }
        }

        await updateProgress(95, 'Resultaat opslaan...');
        return {
          resultSummary: outputText.trim() || `Taak "${task.title}" afgerond.`
        };
      });
    }

    // Herstel eventuele 'running' taken na herstart naar 'queued'
    await prisma.aiQueueTask.updateMany({
      where: { status: 'running' },
      data: {
        status: 'queued',
        progressPercent: 0,
        progressMessage: 'Hersteld in wachtrij na serverherstart'
      }
    }).catch(() => {});

    this.ticker = setInterval(() => {
      this.dispatchCycle().catch(err => console.error('[AiQueueService] Dispatch fout:', err?.message));
    }, 15_000);

    // Eerste run na 4s
    setTimeout(() => {
      this.dispatchCycle().catch(() => {});
    }, 4000);
  }

  stop() {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    for (const ctrl of this.runningControllers.values()) {
      ctrl.abort();
    }
    this.started = false;
  }

  /**
   * Bereken gecombineerde effectieve prioriteit uit gebruikersprioriteit (1-10), AI-prioriteit (1-10) en deadline-urgentie.
   */
  computeEffectivePriority(userPriority: number | null | undefined, aiPriority: number, deadlineAt: Date | null): number {
    let base = typeof userPriority === 'number' && userPriority >= 1 && userPriority <= 10
      ? userPriority * 0.65 + aiPriority * 0.35
      : aiPriority;

    if (deadlineAt) {
      const hoursLeft = (deadlineAt.getTime() - Date.now()) / (60 * 60 * 1000);
      if (hoursLeft <= 1.5) base += 3.5;
      else if (hoursLeft <= 4) base += 2.0;
      else if (hoursLeft <= 12) base += 1.0;
    }
    return Number(Math.min(14, Math.max(1, base)).toFixed(2));
  }

  /**
   * Snelle triage + tijdslot-preview zonder op te slaan in de database.
   */
  async previewTriage(input: EnqueueAiTaskInput) {
    const parsedDeadline = input.deadlineAt ? new Date(input.deadlineAt) : null;
    const validDeadline = parsedDeadline && !isNaN(parsedDeadline.getTime()) ? parsedDeadline : null;
    const userPrio = typeof input.userPriority === 'number' && input.userPriority >= 1 && input.userPriority <= 10
      ? Math.round(input.userPriority)
      : null;

    const triage = await aiTaskTriager.triageTask({
      orgId: input.orgId,
      taskType: input.taskType,
      title: input.title,
      description: input.description,
      userPriority: userPrio,
      deadlineAt: validDeadline,
      metadata: input.triageMetadata
    });

    const effectivePriority = this.computeEffectivePriority(userPrio, triage.aiPriority, validDeadline);
    const reserved = await this.getReservedSlots(input.orgId);
    const windowPlan = await offPeakAnalyzer.findBestOffPeakWindow(
      input.orgId,
      triage.estimatedDurationSec,
      validDeadline,
      effectivePriority,
      input.schedulePreference || 'smart_offpeak',
      reserved
    );

    return {
      triage,
      effectivePriority,
      plannedStartAt: windowPlan.plannedStartAt,
      plannedFinishAt: windowPlan.plannedFinishAt,
      mustEscalate: windowPlan.mustEscalate,
      windowClassification: windowPlan.windowClassification,
      windowReason: windowPlan.reason
    };
  }

  private async getReservedSlots(orgId: string, excludeTaskId?: string) {
    const waiting = await prisma.aiQueueTask.findMany({
      where: {
        orgId,
        status: { in: ['queued', 'scheduled', 'running'] },
        ...(excludeTaskId ? { id: { not: excludeTaskId } } : {})
      },
      select: { plannedStartAt: true, plannedFinishAt: true, aiEstimatedDurationSec: true, startedAt: true }
    }).catch(() => []);

    return waiting
      .filter(w => w.plannedStartAt || w.startedAt)
      .map(w => {
        const startMs = (w.startedAt || w.plannedStartAt)!.getTime();
        const finishMs = w.plannedFinishAt ? w.plannedFinishAt.getTime() : startMs + (w.aiEstimatedDurationSec || 180) * 1000;
        return { startMs, finishMs };
      });
  }

  /**
   * Meld een nieuwe taak aan bij de centrale AI Wachtrij & Planningsservice.
   */
  async enqueueTask(input: EnqueueAiTaskInput) {
    const parsedDeadline = input.deadlineAt ? new Date(input.deadlineAt) : null;
    const validDeadline = parsedDeadline && !isNaN(parsedDeadline.getTime()) ? parsedDeadline : null;
    const userPrio = typeof input.userPriority === 'number' && input.userPriority >= 1 && input.userPriority <= 10
      ? Math.round(input.userPriority)
      : null;
    const schedulePref = input.schedulePreference || 'smart_offpeak';

    const triage: TriageOutput = await aiTaskTriager.triageTask({
      orgId: input.orgId,
      taskType: input.taskType,
      title: input.title,
      description: input.description,
      userPriority: userPrio,
      deadlineAt: validDeadline,
      metadata: input.triageMetadata
    });

    const effectivePriority = this.computeEffectivePriority(userPrio, triage.aiPriority, validDeadline);
    const reserved = await this.getReservedSlots(input.orgId);

    const windowPlan = await offPeakAnalyzer.findBestOffPeakWindow(
      input.orgId,
      triage.estimatedDurationSec,
      validDeadline,
      effectivePriority,
      schedulePref,
      reserved
    );

    const initialStatus = windowPlan.mustEscalate || schedulePref === 'immediate' ? 'queued' : 'scheduled';
    const combinedReasoning = `${triage.reasoning} ${windowPlan.reason}`.trim();

    const task = await prisma.aiQueueTask.create({
      data: {
        orgId: input.orgId,
        userId: input.userId,
        taskType: input.taskType,
        sourceRefId: input.sourceRefId || null,
        title: input.title.trim() || 'AI Achtergrondtaak',
        description: (input.description || '').trim(),
        payloadJson: input.payload ? JSON.stringify(input.payload) : null,
        userPriority: userPrio,
        aiPriority: triage.aiPriority,
        effectivePriority,
        aiEstimatedDurationSec: triage.estimatedDurationSec,
        aiComplexity: triage.complexity,
        aiRecommendedWindow: triage.recommendedWindow,
        aiReasoning: combinedReasoning,
        schedulePreference: schedulePref,
        deadlineAt: validDeadline,
        plannedStartAt: windowPlan.plannedStartAt,
        plannedFinishAt: windowPlan.plannedFinishAt,
        escalatedToUrgent: windowPlan.mustEscalate,
        status: initialStatus,
        progressPercent: 0,
        progressMessage: windowPlan.mustEscalate
          ? 'Urgent opgeschaald wegens naderende deadline — wacht op eerstvolgend slot'
          : windowPlan.reason
      },
      include: {
        user: { select: { id: true, displayName: true, role: true } }
      }
    });

    if (initialStatus === 'queued') {
      setTimeout(() => {
        this.dispatchCycle().catch(() => {});
      }, 400);
    }

    return task;
  }

  /**
   * Pas prioriteit (1-10 / Auto) of deadline van een wachtende taak aan en herplan direct.
   */
  async updateTaskScheduling(
    taskId: string,
    patch: { userPriority?: number | null; deadlineAt?: string | Date | null; schedulePreference?: string }
  ) {
    const existing = await prisma.aiQueueTask.findUnique({ where: { id: taskId } });
    if (!existing) throw new Error('Taak niet gevonden');
    if (existing.status === 'running' || existing.status === 'completed') {
      throw new Error('Lopende of afgeronde taak kan niet meer herpland worden');
    }

    const userPrio = patch.userPriority !== undefined ? patch.userPriority : existing.userPriority;
    const deadlineAt = patch.deadlineAt !== undefined
      ? (patch.deadlineAt ? new Date(patch.deadlineAt) : null)
      : existing.deadlineAt;
    const pref = patch.schedulePreference || existing.schedulePreference;

    const effectivePriority = this.computeEffectivePriority(userPrio, existing.aiPriority, deadlineAt);
    const reserved = await this.getReservedSlots(existing.orgId, taskId);
    const windowPlan = await offPeakAnalyzer.findBestOffPeakWindow(
      existing.orgId,
      existing.aiEstimatedDurationSec,
      deadlineAt,
      effectivePriority,
      pref,
      reserved
    );

    return prisma.aiQueueTask.update({
      where: { id: taskId },
      data: {
        userPriority: userPrio,
        deadlineAt,
        schedulePreference: pref,
        effectivePriority,
        plannedStartAt: windowPlan.plannedStartAt,
        plannedFinishAt: windowPlan.plannedFinishAt,
        escalatedToUrgent: windowPlan.mustEscalate,
        status: windowPlan.mustEscalate || pref === 'immediate' ? 'queued' : 'scheduled',
        progressMessage: windowPlan.reason
      },
      include: {
        user: { select: { id: true, displayName: true, role: true } }
      }
    });
  }

  /**
   * Forceer directe uitvoering van een taak buiten het daluur-schema om.
   */
  async runTaskNow(taskId: string) {
    const existing = await prisma.aiQueueTask.findUnique({ where: { id: taskId } });
    if (!existing) throw new Error('Taak niet gevonden');
    if (existing.status === 'running') return existing;

    const updated = await prisma.aiQueueTask.update({
      where: { id: taskId },
      data: {
        status: 'queued',
        schedulePreference: 'immediate',
        escalatedToUrgent: true,
        plannedStartAt: new Date(),
        effectivePriority: Math.max(existing.effectivePriority, 12),
        progressMessage: 'Handmatig direct gestart door gebruiker'
      },
      include: {
        user: { select: { id: true, displayName: true, role: true } }
      }
    });

    setTimeout(() => {
      this.dispatchCycle().catch(() => {});
    }, 300);

    return updated;
  }

  async cancelTask(taskId: string) {
    const existing = await prisma.aiQueueTask.findUnique({ where: { id: taskId } });
    if (!existing) throw new Error('Taak niet gevonden');

    const ctrl = this.runningControllers.get(taskId);
    if (ctrl) ctrl.abort();

    return prisma.aiQueueTask.update({
      where: { id: taskId },
      data: {
        status: 'cancelled',
        progressMessage: 'Geannuleerd door gebruiker',
        completedAt: new Date()
      }
    });
  }

  /**
   * Geef compleet 2-wachtrijen overzicht + echte 7x24 daluren-analyse terug.
   */
  async getDualQueueOverview(orgId: string, userId?: string, role?: string): Promise<{
    shortQueue: ReturnType<typeof concurrencyQueue.getStats> & { label: string; description: string };
    offPeakAnalysis: OffPeakAnalysisReport;
    tasks: any[];
  }> {
    const [offPeakAnalysis, orgSettings, tasks] = await Promise.all([
      offPeakAnalyzer.analyzeOrgPattern(orgId),
      prisma.orgSettings.findUnique({ where: { orgId }, select: { maxConcurrency: true } }).catch(() => null),
      prisma.aiQueueTask.findMany({
        where: {
          orgId,
          ...(role && !['admin', 'superadmin'].includes(role) && userId ? { userId } : {})
        },
        include: {
          user: { select: { id: true, displayName: true, role: true } }
        },
        orderBy: [
          { createdAt: 'desc' }
        ],
        take: 60
      })
    ]);

    const chatStats = concurrencyQueue.getStats(orgId);
    const maxConc = orgSettings?.maxConcurrency || 6;

    return {
      shortQueue: {
        ...chatStats,
        label: `Korte Directe Chat-Wachtrij (${chatStats.activeStreams}/${maxConc} slots actief)`,
        description: chatStats.queuedCount > 0
          ? `${chatStats.queuedCount} leerling/docent(en) wachten kort op een chat-slot — krijgt altijd voorrang op achtergrondtaken.`
          : 'Vrij: directe chat-verzoeken kunnen zonder wachttijd doorstromen.'
      },
      offPeakAnalysis,
      tasks
    };
  }

  /**
   * Centrale planner-tick: escaleert deadlines, geeft voorrang aan Chat, en start max 1 zware achtergrondtaak per org.
   */
  async dispatchCycle() {
    const activeOrgRows = await prisma.aiQueueTask.findMany({
      where: { status: { in: ['queued', 'scheduled'] } },
      select: { orgId: true },
      distinct: ['orgId']
    }).catch(() => []);

    for (const { orgId } of activeOrgRows) {
      if (this.busyByOrg.has(orgId)) continue;
      await this.dispatchForOrg(orgId).catch(e => {
        console.error(`[AiQueueService] Org ${orgId} fout:`, e?.message);
      });
    }
  }

  private async dispatchForOrg(orgId: string) {
    const runningCount = await prisma.aiQueueTask.count({
      where: { orgId, status: 'running' }
    });
    if (runningCount > 0) return;

    const candidates = await prisma.aiQueueTask.findMany({
      where: { orgId, status: { in: ['queued', 'scheduled'] } },
      orderBy: [
        { escalatedToUrgent: 'desc' },
        { effectivePriority: 'desc' },
        { plannedStartAt: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    if (candidates.length === 0) return;

    const nowMs = Date.now();

    // 1. Deadline-escalatie: als een taak niet meer in een later daluur kan wachten -> opschalen!
    for (const c of candidates) {
      if (!c.escalatedToUrgent && c.deadlineAt) {
        const latestStartMs = c.deadlineAt.getTime() - (c.aiEstimatedDurationSec * 1000) - 8 * 60 * 1000;
        if (nowMs >= latestStartMs) {
          const boostedPrio = Math.max(c.effectivePriority, 11);
          await prisma.aiQueueTask.update({
            where: { id: c.id },
            data: {
              escalatedToUrgent: true,
              status: 'queued',
              effectivePriority: boostedPrio,
              progressMessage: 'Automatisch opgeschaald wegens naderende deadline'
            }
          });
          c.escalatedToUrgent = true;
          c.status = 'queued';
          c.effectivePriority = boostedPrio;
        }
      }
    }

    // Her-sorteer na eventuele deadline-escalaties
    candidates.sort((a, b) => {
      if (a.escalatedToUrgent !== b.escalatedToUrgent) return a.escalatedToUrgent ? -1 : 1;
      if (b.effectivePriority !== a.effectivePriority) return b.effectivePriority - a.effectivePriority;
      const aStart = (a.plannedStartAt || a.createdAt).getTime();
      const bStart = (b.plannedStartAt || b.createdAt).getTime();
      return aStart - bStart;
    });

    const liveLoad = await offPeakAnalyzer.getLiveLoadSnapshot(orgId);
    const chatStats = concurrencyQueue.getStats(orgId);

    // 2. Kies eerstvolgende uitvoerbare taak
    const chosen = candidates.find(c => {
      // Urgente of handmatig direct gestarte taken mogen altijd door (tenzij chat actief overvol wacht en er nog >15 min tijd is)
      if (c.escalatedToUrgent || c.schedulePreference === 'immediate') {
        if (chatStats.queuedCount > 0 && c.deadlineAt && c.deadlineAt.getTime() - nowMs > 20 * 60 * 1000) {
          return false; // Geef korte chat-piek heel even voorrang
        }
        return true;
      }

      // Normale daluur-taken: pauseer als Chat wachtenden heeft of server 'druk' is!
      if (chatStats.queuedCount > 0 || liveLoad.state === 'druk') {
        return false;
      }

      // Als daluur nu actief en rustig is: mag starten zodra geplande tijd bereikt is of live het daluur open is
      const plannedMs = (c.plannedStartAt || c.createdAt).getTime();
      if (nowMs >= plannedMs) return true;
      if (liveLoad.isOffPeakNow && c.schedulePreference === 'smart_offpeak' && nowMs - c.createdAt.getTime() > 20_000) {
        return true;
      }
      return false;
    });

    if (!chosen) return;

    this.executeTask(chosen).catch(e => {
      console.error(`[AiQueueService] Uitvoerfout voor taak ${chosen.id}:`, e?.message);
    });
  }

  private async executeTask(task: any) {
    if (this.busyByOrg.has(task.orgId)) return;
    this.busyByOrg.add(task.orgId);

    const ctrl = new AbortController();
    this.runningControllers.set(task.id, ctrl);

    const updateProgress = async (percent: number, message: string) => {
      await prisma.aiQueueTask.update({
        where: { id: task.id },
        data: {
          progressPercent: Math.max(0, Math.min(100, Math.round(percent))),
          progressMessage: message
        }
      }).catch(() => {});
    };

    try {
      await prisma.aiQueueTask.update({
        where: { id: task.id },
        data: {
          status: 'running',
          startedAt: new Date(),
          progressPercent: 5,
          progressMessage: 'Taak gestart door centrale AI-planner...'
        }
      });

      const executor = this.executors.get(task.taskType);
      if (!executor) {
        throw new Error(`Geen uitvoerder geregistreerd voor taaktype "${task.taskType}"`);
      }

      const { resultSummary } = await executor(task, {
        signal: ctrl.signal,
        updateProgress
      });

      await prisma.aiQueueTask.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          progressPercent: 100,
          progressMessage: 'Voltooid',
          resultSummary,
          completedAt: new Date()
        }
      });
    } catch (err: any) {
      const wasCancelled = ctrl.signal.aborted;
      await prisma.aiQueueTask.update({
        where: { id: task.id },
        data: {
          status: wasCancelled ? 'cancelled' : 'failed',
          errorMessage: wasCancelled ? 'Geannuleerd door gebruiker' : (err?.message || 'Onbekende fout tijdens verwerking'),
          progressMessage: wasCancelled ? 'Geannuleerd' : `Fout: ${err?.message || 'mislukt'}`,
          completedAt: new Date()
        }
      }).catch(() => {});
    } finally {
      this.runningControllers.delete(task.id);
      this.busyByOrg.delete(task.orgId);

      // Direct kijken of de volgende taak klaarstaat
      setTimeout(() => {
        this.dispatchCycle().catch(() => {});
      }, 1500);
    }
  }
}

export const aiQueueService = new AiQueueManagerService();
