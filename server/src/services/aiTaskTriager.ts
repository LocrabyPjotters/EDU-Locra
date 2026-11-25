import { prisma } from '../index';
import { decryptApiKey } from '../utils/crypto';
import { ollamaClient } from './ollama';

export type AiQueueTaskType = 'live_generate' | 'live_review' | 'slimcheck_grade' | 'custom_ai';

export interface TriageInput {
  orgId: string;
  taskType: AiQueueTaskType;
  title: string;
  description: string;
  userPriority?: number | null; // 1-10 of null/undefined voor Auto
  deadlineAt?: Date | null;
  metadata?: {
    slideCount?: number;
    questionQualityMode?: string;
    pageCount?: number;
    studentCount?: number;
    sourceCharCount?: number;
    modelId?: string;
  };
}

export interface TriageOutput {
  aiPriority: number; // 1-10
  estimatedDurationSec: number;
  complexity: 'light' | 'medium' | 'heavy';
  recommendedWindow: 'immediate' | 'offpeak_next' | 'offpeak_night';
  reasoning: string;
  triagedByModel: string;
}

function clampPriority(val: any, fallback = 5): number {
  const n = Math.round(Number(val));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(10, n));
}

function extractFirstJsonObject(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Kwalitatieve heuristische basisinschatting (altijd beschikbaar als anker én als snelle fallback).
 */
function buildQuantitativeBaseline(input: TriageInput): Omit<TriageOutput, 'triagedByModel'> {
  const meta = input.metadata || {};
  const isLocalHeavyHint = !meta.modelId || /ollama|qwen|llama|gemma|mistral/i.test(String(meta.modelId));
  let durationSec = 180;
  let complexity: 'light' | 'medium' | 'heavy' = 'medium';
  let baseAiPriority = 5;

  if (input.taskType === 'live_generate') {
    const slides = Math.max(4, Number(meta.slideCount || 8));
    const criticMult = meta.questionQualityMode === 'fast' ? 1 : 1.7;
    const perSlideSec = isLocalHeavyHint ? 22 : 6;
    durationSec = Math.round(slides * perSlideSec * criticMult + (meta.sourceCharCount ? 20 : 5));
    complexity = slides >= 10 || meta.questionQualityMode !== 'fast' ? 'heavy' : 'medium';
    baseAiPriority = 6;
  } else if (input.taskType === 'live_review') {
    const slides = Math.max(3, Number(meta.slideCount || 8));
    durationSec = Math.round(slides * (isLocalHeavyHint ? 16 : 4));
    complexity = slides >= 8 ? 'heavy' : 'medium';
    baseAiPriority = 5;
  } else if (input.taskType === 'slimcheck_grade') {
    const pages = Math.max(5, Number(meta.pageCount || meta.studentCount || 20));
    durationSec = Math.round(pages * (isLocalHeavyHint ? 14 : 4));
    complexity = pages >= 15 ? 'heavy' : 'medium';
    baseAiPriority = 7; // Nakijken voor leerlingen weegt onderwijskundig zwaar
  } else {
    const textLen = (input.title + ' ' + input.description).length;
    durationSec = textLen > 600 ? 300 : 120;
    complexity = textLen > 600 ? 'medium' : 'light';
    baseAiPriority = 5;
  }

  // Deadline urgentie boost op AI-prioriteit
  if (input.deadlineAt) {
    const hoursLeft = (input.deadlineAt.getTime() - Date.now()) / (60 * 60 * 1000);
    if (hoursLeft <= 2) baseAiPriority = Math.max(baseAiPriority, 9);
    else if (hoursLeft <= 8) baseAiPriority = Math.max(baseAiPriority, 8);
    else if (hoursLeft <= 24) baseAiPriority = Math.max(baseAiPriority, 7);
  }

  // Inhoudelijke keywords voor snelle urgentie-inschatting
  const combinedText = `${input.title} ${input.description}`.toLowerCase();
  if (/toets|proefwerk|examen|pta|herkansing|morgen|spoed|urgent|lesuur|klas/i.test(combinedText)) {
    baseAiPriority = Math.min(10, baseAiPriority + 1);
  }

  const mins = Math.max(1, Math.round(durationSec / 60));
  const windowPref: TriageOutput['recommendedWindow'] =
    baseAiPriority >= 9 && input.deadlineAt && input.deadlineAt.getTime() - Date.now() < 3 * 60 * 60 * 1000
      ? 'immediate'
      : complexity === 'heavy'
      ? 'offpeak_night'
      : 'offpeak_next';

  return {
    aiPriority: clampPriority(baseAiPriority, 5),
    estimatedDurationSec: Math.max(30, durationSec),
    complexity,
    recommendedWindow: windowPref,
    reasoning: `Inschatting op basis van taaktype (${input.taskType}), geschatte rekenzwaarte (~${mins} min) en eventuele deadline.`
  };
}

export class AiTaskTriagerService {
  /**
   * Laat een licht, snel AI-model (met max 7s timeout) kwalitatief de taak beoordelen:
   * - extra AI-prioriteit (1-10)
   * - realistische taakduur (seconden)
   * - beste type tijdslot & korte Nederlandse motivatie.
   */
  async triageTask(input: TriageInput): Promise<TriageOutput> {
    const baseline = buildQuantitativeBaseline(input);

    const systemPrompt = `Je bent de slimme AI-Taakplanner van Locra (Nederlands onderwijsplatform).
Beoordeel een achtergrondtaak razendsnel en kwalitatief.
Geef UITSLUITEND een geldig JSON-object terug:
{
  "aiPriority": <integer 1 t/m 10, waar 10 zeer urgent/belangrijk voor onderwijs of naderende deadline is>,
  "estimatedDurationSec": <integer, realistische verwerkingstijd in seconden (tussen 30 en 3600)>,
  "complexity": "light" | "medium" | "heavy",
  "recommendedWindow": "immediate" | "offpeak_next" | "offpeak_night",
  "reasoning": "<1-2 krachtige Nederlandse zinnen waarom deze prioriteit, duur en tijdslot gekozen zijn>"
}`;

    const deadlineStr = input.deadlineAt
      ? input.deadlineAt.toLocaleString('nl-NL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'Geen harde deadline';

    const userPrompt = `Beoordeel deze AI-taak:
- Type: ${input.taskType}
- Titel: "${input.title}"
- Omschrijving: "${input.description || 'Geen extra omschrijving'}"
- Opgegeven gebruikersprioriteit: ${input.userPriority ? `${input.userPriority}/10` : 'Auto (AI bepaalt)'}
- Deadline: ${deadlineStr}
- Omvang-metadata: ${JSON.stringify(input.metadata || {})}
- Huidige referentie-inschatting: ~${Math.round(baseline.estimatedDurationSec / 60)} min (${baseline.complexity})`;

    try {
      const [orgSettings, fastModels] = await Promise.all([
        prisma.orgSettings.findUnique({ where: { orgId: input.orgId } }).catch(() => null),
        prisma.installedModel.findMany({
          where: { orgId: input.orgId, isActive: true },
          orderBy: { isDefault: 'desc' }
        }).catch(() => [])
      ]);

      // 1. Probeer snelle Gemini Flash indien key aanwezig (sub-1.5s)
      const rawGeminiKey = decryptApiKey(orgSettings?.geminiApiKey);
      if (rawGeminiKey) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6500);
        try {
          const model = fastModels.find(m => m.provider === 'gemini')?.ollamaName || 'gemini-2.5-flash';
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${rawGeminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: userPrompt }] }],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 320,
                  responseMimeType: 'application/json'
                }
              }),
              signal: ctrl.signal
            }
          );
          if (res.ok) {
            const data = (await res.json()) as any;
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const parsed = extractFirstJsonObject(rawText);
            if (parsed) {
              return this.mergeAiAndBaseline(parsed, baseline, `gemini:${model}`);
            }
          }
        } catch {
          // Val door naar lokaal snel model of baseline
        } finally {
          clearTimeout(t);
        }
      }

      // 2. Probeer snel lokaal Ollama-model (chat_fast / kleinste actieve model) met 7.5s limiet
      const ollamaCandidates = fastModels
        .filter(m => m.provider === 'ollama' && !m.isCodeMatchOnly)
        .sort((a, b) => {
          const score = (m: any) => (/1b|2b|3b|4b|7b|8b|9b/i.test(m.ollamaName) ? 3 : 1) + (m.isDefault ? 1 : 0);
          return score(b) - score(a);
        })
        .map(m => m.ollamaName);

      if (ollamaCandidates.length > 0) {
        const chosenModel = ollamaCandidates[0];
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 7500);
        try {
          const res = await ollamaClient.generate(
            userPrompt,
            chosenModel,
            systemPrompt,
            false,
            undefined,
            false,
            input.orgId,
            ctrl.signal,
            { format: 'json', numPredict: 260, numCtx: 4096, temperature: 0.2 }
          );
          if (res.ok) {
            const raw = (await res.json()) as any;
            const parsed = extractFirstJsonObject(raw?.response || '');
            if (parsed) {
              return this.mergeAiAndBaseline(parsed, baseline, `ollama:${chosenModel}`);
            }
          }
        } catch {
          // Veilige fallback naar kwantitatieve triage
        } finally {
          clearTimeout(t);
        }
      }
    } catch {
      // ignore
    }

    return { ...baseline, triagedByModel: 'heuristic-fast-triage' };
  }

  private mergeAiAndBaseline(
    parsed: any,
    baseline: Omit<TriageOutput, 'triagedByModel'>,
    modelLabel: string
  ): TriageOutput {
    const aiPriority = clampPriority(parsed.aiPriority, baseline.aiPriority);
    const estRaw = Number(parsed.estimatedDurationSec);
    const estimatedDurationSec = Number.isFinite(estRaw) && estRaw >= 20 && estRaw <= 7200
      ? Math.round((estRaw * 0.65) + (baseline.estimatedDurationSec * 0.35))
      : baseline.estimatedDurationSec;

    const complexity: TriageOutput['complexity'] =
      parsed.complexity === 'light' || parsed.complexity === 'medium' || parsed.complexity === 'heavy'
        ? parsed.complexity
        : baseline.complexity;

    const recommendedWindow: TriageOutput['recommendedWindow'] =
      parsed.recommendedWindow === 'immediate' || parsed.recommendedWindow === 'offpeak_next' || parsed.recommendedWindow === 'offpeak_night'
        ? parsed.recommendedWindow
        : baseline.recommendedWindow;

    const reasoning = typeof parsed.reasoning === 'string' && parsed.reasoning.trim().length > 8
      ? parsed.reasoning.trim().slice(0, 320)
      : baseline.reasoning;

    return {
      aiPriority,
      estimatedDurationSec,
      complexity,
      recommendedWindow,
      reasoning,
      triagedByModel: modelLabel
    };
  }
}

export const aiTaskTriager = new AiTaskTriagerService();
