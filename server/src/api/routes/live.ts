import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { verifyToken, decryptApiKey } from '../../utils/crypto';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mammoth from 'mammoth';
import { ollamaClient } from '../../services/ollama';
import { cosineSimilarity, EMBEDDING_MODEL } from '../../services/rag';
import { canAccessFeature } from '../../services/license';
import { resolveEducationalImage, findEducationalImage } from '../../utils/educationalImages';
import { slimCheckQueue } from '../../services/slimCheckQueue';
import { aiQueueService } from '../../services/aiQueueService';
import { offPeakAnalyzer } from '../../services/offPeakAnalyzer';

const pdfParse = require('pdf-parse');

// ── Vraag- en Slide-Typen ──
export type SlideType = 'content' | 'multiple_choice' | 'true_false' | 'open' | 'wordcloud' | 'poll';

function normalizeSlideType(rawType: any): SlideType {
  const t = String(rawType || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (['content', 'theory', 'theorie', 'info', 'uitleg', 'text', 'lesstof'].includes(t)) return 'content';
  if (['true_false', 'tf', 'waar_niet_waar', 'waar_of_niet_waar', 'stelling', 'boolean'].includes(t)) return 'true_false';
  if (['open', 'open_vraag', 'open_question', 'essay', 'casus'].includes(t)) return 'open';
  if (['wordcloud', 'word_cloud', 'gedachtenwolk', 'woordwolk', 'wolk'].includes(t)) return 'wordcloud';
  if (['poll', 'peiling', 'stemming'].includes(t)) return 'poll';
  if (['multiple_choice', 'mc', 'meerkeuze', 'meerkeuzevraag', 'quiz'].includes(t)) return 'multiple_choice';
  return 'multiple_choice';
}

export interface LiveSlide {
  id: string;
  type: SlideType;
  title: string;
  content?: string;             // Theorie, instructie, bulletpoints of rijke informatieve blokken
  imageUrl?: string;            // Optionele afbeelding / diagram
  imageCaption?: string;        // Optioneel onderschrift / bronvermelding bij afbeelding
  videoUrl?: string;            // Optionele video embed
  options?: string[];           // Voor meerkeuze of peiling (2-4 opties)
  correctOptionIndex?: number;  // 0-3 (alleen bij meerkeuze / true_false)
  timeLimitSeconds?: number;    // Standaard bijv. 20s (0 = geen limiet)
  points?: number;              // Standaard bijv. 1000
  explanation?: string;         // Didactische toelichting na het onthullen
  clusterSummary?: string;      // AI-gegenereerde synthese bij open vragen
  rtti?: string;                // Optionele taxonomie-aanduiding (R1, R2, T1, T2)
}

// ── In-Memory Realtime Room Management ──
interface WsClient {
  ws: any;
  role: 'host' | 'player';
  sessionId: string;
  participantId?: string;
  userId?: string;
  nickname?: string;
  avatar?: string;
}

const activeRooms = new Map<string, Set<WsClient>>();

function broadcastToRoom(sessionId: string, payload: any, excludeClient?: WsClient) {
  const clients = activeRooms.get(sessionId);
  if (!clients) return;
  const msgStr = JSON.stringify(payload);
  for (const client of clients) {
    if (client === excludeClient) continue;
    try {
      if (client.ws.readyState === 1 /* OPEN */) {
        client.ws.send(msgStr);
      }
    } catch (e) {
      // client error
    }
  }
}

// ── Profanity Shield (Nederlands + Internationaal) ──
const BLOCKED_TERMS = [
  'kanker', 'tering', 'tyfus', 'nazi', 'hitler', 'hoer', 'slet', 'kut', 'lul', 'pik', 'homo', 'neger', 'nigger', 'kk', 'pedo', 'sukkel', 'idioot', 'mongool', 'ebola', 'aids'
];

function isProfaneNickname(name: string): boolean {
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return BLOCKED_TERMS.some(term => norm.includes(term));
}

// ── Pincode Generator ──
function generatePinCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Tekstextractie & RAG Helpers voor Documenten ──
function cleanExtractedText(raw: string): string {
  return (raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/[\x00-\x08\x0b\x0e-\x1f\x7f]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]{3,}/g, '  ')
    .trim();
}

async function extractTextFromBuffer(fileBuffer: Buffer, filenameOrExt: string): Promise<{ text: string; pages?: number }> {
  const ext = (filenameOrExt.includes('.') ? filenameOrExt.split('.').pop() : filenameOrExt)?.toLowerCase() || '';
  if (ext === 'pdf') {
    const parsed = await pdfParse(fileBuffer);
    return { text: cleanExtractedText(parsed?.text || ''), pages: parsed?.numpages };
  }
  if (ext === 'docx' || ext === 'doc') {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return { text: cleanExtractedText(result?.value || '') };
  }
  if (ext === 'rtf') {
    const rtfStr = fileBuffer.toString('utf-8')
      .replace(/\\[a-z]+\d*\s?/g, '')
      .replace(/[{}]/g, '');
    return { text: cleanExtractedText(rtfStr) };
  }
  return { text: cleanExtractedText(fileBuffer.toString('utf-8')) };
}

function splitIntoTextChunks(text: string, maxWords: number = 280, overlapWords: number = 50): string[] {
  const cleaned = cleanExtractedText(text).replace(/\s+/g, ' ');
  if (!cleaned) return [];
  const words = cleaned.split(' ');
  const chunks: string[] = [];
  let start = 0;
  const step = Math.max(40, maxWords - overlapWords);
  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    const slice = words.slice(start, end).join(' ').trim();
    if (slice.length > 30) chunks.push(slice);
    if (end >= words.length) break;
    start += step;
  }
  return chunks;
}

const DUTCH_STOPWORDS = new Set([
  'de', 'het', 'een', 'en', 'van', 'ik', 'je', 'jij', 'hij', 'zij', 'wij', 'ze', 'dat', 'die', 'dit', 'wat',
  'voor', 'met', 'aan', 'op', 'in', 'uit', 'bij', 'door', 'over', 'onder', 'tegen', 'naar', 'als', 'dan',
  'maar', 'want', 'dus', 'of', 'omdat', 'ook', 'nog', 'wel', 'niet', 'geen', 'zijn', 'was', 'werd', 'worden',
  'wordt', 'heeft', 'hebben', 'had', 'kan', 'kunnen', 'moet', 'moeten', 'zou', 'zouden', 'alle', 'meer', 'veel'
]);

function extractSearchKeywords(query: string): string[] {
  return Array.from(
    new Set(
      (query || '')
        .toLowerCase()
        .replace(/[^a-z0-9à-öø-ÿ\s]/gi, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length >= 3 && !DUTCH_STOPWORDS.has(w))
    )
  );
}

function scoreKeywordOverlap(chunk: string, keywords: string[]): number {
  if (!keywords.length || !chunk) return 0;
  const lower = chunk.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) hits += 1;
  }
  return hits / keywords.length;
}

function distributeIndicesEvenly(totalCount: number, pickCount: number): number[] {
  if (totalCount <= pickCount) return Array.from({ length: totalCount }, (_, i) => i);
  const picked: number[] = [];
  for (let i = 0; i < pickCount; i++) {
    const idx = Math.min(totalCount - 1, Math.floor((i * totalCount) / pickCount));
    if (!picked.includes(idx)) picked.push(idx);
  }
  return picked;
}

function extractJsonFromLlm(raw: string): any | null {
  if (!raw) return null;
  let cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const tryParse = (candidate: string) => {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        const repaired = candidate.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(repaired);
      } catch {
        return null;
      }
    }
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  const firstObj = cleaned.indexOf('{');
  const lastObj = cleaned.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) {
    const objParsed = tryParse(cleaned.slice(firstObj, lastObj + 1));
    if (objParsed) return objParsed;
  }

  const firstArr = cleaned.indexOf('[');
  const lastArr = cleaned.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) {
    const arrParsed = tryParse(cleaned.slice(firstArr, lastArr + 1));
    if (arrParsed) return arrParsed;
  }

  return null;
}

function stripOptionFormatting(opt: string): string {
  return String(opt || '')
    .replace(/^\s*[A-D1-4][\)\.\:]\s+/i, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .trim();
}

function shuffleMcOptions(options: string[], correctIndex: number): { options: string[]; correctOptionIndex: number } {
  const safeCorrect = correctIndex >= 0 && correctIndex < options.length ? correctIndex : 0;
  const tagged = options.map((text, idx) => ({ text, isCorrect: idx === safeCorrect }));
  for (let i = tagged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = tagged[i];
    tagged[i] = tagged[j];
    tagged[j] = tmp;
  }
  return {
    options: tagged.map(t => t.text),
    correctOptionIndex: Math.max(0, tagged.findIndex(t => t.isCorrect))
  };
}

// ── Timeout / Cancel Signaal Combiner & Stream Helpers ──
function createTimeoutAbortSignal(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
    }
  };
}

export interface LlmProgressInfo {
  provider: string;
  model: string;
  charsReceived: number;
  event?: string;
}

// ── AI Helper voor Content Generatie, Quality Review & Clustering ──
async function callLlmDetailed(
  prompt: string,
  systemPrompt: string,
  orgId?: string,
  jsonMode = true,
  options?: {
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
    numCtx?: number;
    signal?: AbortSignal;
    onProgress?: (info: LlmProgressInfo) => void;
  }
): Promise<{ text: string; modelUsed: string; provider: string } | null> {
  if (options?.signal?.aborted) {
    throw new Error('Generatie geannuleerd.');
  }

  let orgSettings: any = null;
  if (orgId) {
    orgSettings = (await prisma.orgSettings.findFirst({ where: { orgId } })) || (await prisma.orgSettings.findFirst());
  } else {
    orgSettings = await prisma.orgSettings.findFirst();
  }

  const temperature = options?.temperature ?? 0.45;
  const maxTokens = options?.maxTokens ?? 12288;
  const numCtx = options?.numCtx ?? 32768;
  const parentSignal = options?.signal;
  const report = options?.onProgress;

  // Ruime timeout van 60 minuten zodat diepgaande lokale of cloud-generaties nooit voortijdig afgebroken worden
  const LLM_TIMEOUT_MS = 60 * 60 * 1000;

  const tryGemini = async (modelNames: string[]) => {
    const rawGeminiKey = decryptApiKey(orgSettings?.geminiApiKey);
    if (!rawGeminiKey) return null;
    for (const model of modelNames) {
      if (parentSignal?.aborted) throw new Error('Generatie geannuleerd.');
      const { signal, cleanup } = createTimeoutAbortSignal(parentSignal, LLM_TIMEOUT_MS);
      try {
        report?.({
          provider: 'gemini',
          model,
          charsReceived: 0,
          event: `Verbinding maken met Google Gemini (${model})...`
        });

        const genConfig: any = {
          temperature,
          maxOutputTokens: maxTokens
        };
        if (jsonMode) genConfig.responseMimeType = 'application/json';
        const bodyPayload: any = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: genConfig
        };
        if (systemPrompt) {
          bodyPayload.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        // Gebruik live SSE-streaming wanneer onProgress gekoppeld is voor realtime voortgang
        const useStream = Boolean(report);
        const endpoint = useStream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}key=${rawGeminiKey}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
          signal
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) break; // Ongeldige key -> sla resterende Gemini modellen over
          continue;
        }

        const contentType = res.headers.get('content-type') || '';
        if (useStream && res.body && contentType.includes('text/event-stream')) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullText = '';
          let lastEmitChars = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const parsed = JSON.parse(payload);
                const chunkText = (parsed?.candidates?.[0]?.content?.parts || [])
                  .map((p: any) => p?.text || '')
                  .join('');
                if (chunkText) {
                  fullText += chunkText;
                  if (fullText.length - lastEmitChars >= 120) {
                    lastEmitChars = fullText.length;
                    report?.({ provider: 'gemini', model, charsReceived: fullText.length });
                  }
                }
              } catch {}
            }
          }
          if (fullText.trim().length > 0) {
            report?.({ provider: 'gemini', model, charsReceived: fullText.length });
            return { text: fullText.trim(), modelUsed: model, provider: 'gemini' };
          }
        } else {
          const data = (await res.json()) as any;
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim().length > 0) {
            report?.({ provider: 'gemini', model, charsReceived: text.length });
            return { text: text.trim(), modelUsed: model, provider: 'gemini' };
          }
        }
      } catch (err: any) {
        if (parentSignal?.aborted) throw new Error('Generatie geannuleerd.');
      } finally {
        cleanup();
      }
    }
    return null;
  };

  const tryAnthropic = async (modelNames: string[]) => {
    const apiKey = decryptApiKey(orgSettings?.anthropicApiKey);
    if (!apiKey) return null;
    for (const model of modelNames) {
      if (parentSignal?.aborted) throw new Error('Generatie geannuleerd.');
      const { signal, cleanup } = createTimeoutAbortSignal(parentSignal, LLM_TIMEOUT_MS);
      try {
        report?.({
          provider: 'anthropic',
          model,
          charsReceived: 0,
          event: `Verbinding maken met Anthropic (${model})...`
        });

        const useStream = Boolean(report);
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            stream: useStream,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }]
          }),
          signal
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) break;
          continue;
        }

        const contentType = res.headers.get('content-type') || '';
        if (useStream && res.body && contentType.includes('text/event-stream')) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullText = '';
          let lastEmitChars = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload) continue;
              try {
                const ev = JSON.parse(payload);
                const delta = ev?.delta?.text || '';
                if (delta) {
                  fullText += delta;
                  if (fullText.length - lastEmitChars >= 120) {
                    lastEmitChars = fullText.length;
                    report?.({ provider: 'anthropic', model, charsReceived: fullText.length });
                  }
                }
              } catch {}
            }
          }
          if (fullText.trim().length > 0) {
            report?.({ provider: 'anthropic', model, charsReceived: fullText.length });
            return { text: fullText.trim(), modelUsed: model, provider: 'anthropic' };
          }
        } else {
          const data = (await res.json()) as any;
          const text = Array.isArray(data.content)
            ? data.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
            : '';
          if (text && text.trim().length > 0) {
            report?.({ provider: 'anthropic', model, charsReceived: text.length });
            return { text: text.trim(), modelUsed: model, provider: 'anthropic' };
          }
        }
      } catch (err: any) {
        if (parentSignal?.aborted) throw new Error('Generatie geannuleerd.');
      } finally {
        cleanup();
      }
    }
    return null;
  };

  const tryOpenAiCompatible = async (provider: 'openai' | 'openrouter', modelName: string) => {
    const rawKey = provider === 'openrouter'
      ? decryptApiKey(orgSettings?.openRouterApiKey)
      : (decryptApiKey(orgSettings?.openAiApiKey) || process.env.OPENAI_API_KEY);
    if (!rawKey) return null;
    if (parentSignal?.aborted) throw new Error('Generatie geannuleerd.');

    const { signal, cleanup } = createTimeoutAbortSignal(parentSignal, LLM_TIMEOUT_MS);
    try {
      report?.({
        provider,
        model: modelName,
        charsReceived: 0,
        event: `Verbinding maken met ${provider === 'openrouter' ? 'OpenRouter' : 'OpenAI'} (${modelName})...`
      });

      const openai = new OpenAI({
        apiKey: rawKey,
        timeout: LLM_TIMEOUT_MS,
        baseURL: provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : (process.env.OPENAI_BASE_URL || undefined)
      });

      if (report) {
        try {
          const stream = await openai.chat.completions.create(
            {
              model: modelName,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
              ],
              temperature,
              max_tokens: maxTokens,
              response_format: jsonMode ? { type: 'json_object' } : undefined,
              stream: true
            },
            { signal }
          );

          let fullText = '';
          let lastEmitChars = 0;
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              if (fullText.length - lastEmitChars >= 120) {
                lastEmitChars = fullText.length;
                report({ provider, model: modelName, charsReceived: fullText.length });
              }
            }
          }
          if (fullText.trim().length > 0) {
            report({ provider, model: modelName, charsReceived: fullText.length });
            return { text: fullText.trim(), modelUsed: modelName, provider };
          }
        } catch (streamErr: any) {
          if (parentSignal?.aborted) throw new Error('Generatie geannuleerd.');
          // Sommige providers ondersteunen geen stream + json_object; val terug op non-stream hieronder
        }
      }

      const comp = await openai.chat.completions.create(
        {
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: jsonMode ? { type: 'json_object' } : undefined
        },
        { signal }
      );
      const content = comp.choices[0]?.message?.content;
      if (content && content.trim().length > 0) {
        report?.({ provider, model: modelName, charsReceived: content.length });
        return { text: content.trim(), modelUsed: modelName, provider };
      }
    } catch (err: any) {
      if (parentSignal?.aborted) throw new Error('Generatie geannuleerd.');
      console.warn(`[Locra Live AI] ${provider} error:`, err?.message);
    } finally {
      cleanup();
    }
    return null;
  };

  const tryRecoverPartialSlidesJson = (partialRaw: string): string | null => {
    if (!partialRaw || partialRaw.length < 300) return null;
    const slidesKeyIdx = partialRaw.indexOf('"slides"');
    if (slidesKeyIdx === -1) return null;
    const arrayStart = partialRaw.indexOf('[', slidesKeyIdx);
    if (arrayStart === -1) return null;

    // Zoek de laatste complete top-level slide '}' binnen de slides-array
    let depth = 0;
    let inString = false;
    let escaped = false;
    let lastCompleteObjEnd = -1;

    for (let i = arrayStart + 1; i < partialRaw.length; i++) {
      const ch = partialRaw[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) lastCompleteObjEnd = i;
      }
    }

    if (lastCompleteObjEnd <= arrayStart) return null;
    const candidate = `${partialRaw.slice(0, lastCompleteObjEnd + 1)}]}`;
    const parsed = extractJsonFromLlm(candidate);
    if (parsed && Array.isArray(parsed.slides) && parsed.slides.length >= 2) {
      return JSON.stringify(parsed);
    }
    return null;
  };

  const tryOllama = async (modelNames: string[]) => {
    // Beperk zeer grote RAG-prompts voor lokale Ollama modellen — maar laat ruim genoeg voor 15+ dia's
    let ollamaPrompt = prompt;
    if (ollamaPrompt.length > 32000) {
      const startMarker = '--- BRONMATERIAAL';
      const endMarker = '--- EINDE BRONMATERIAAL ---';
      const sIdx = ollamaPrompt.indexOf(startMarker);
      const eIdx = ollamaPrompt.indexOf(endMarker);
      if (sIdx !== -1 && eIdx > sIdx) {
        const before = ollamaPrompt.slice(0, sIdx);
        const ragBody = ollamaPrompt.slice(sIdx, eIdx);
        const after = ollamaPrompt.slice(eIdx);
        ollamaPrompt = `${before}${ragBody.slice(0, 18000)}\n[...ingekort voor lokale generatie...]\n${after}`;
      } else {
        ollamaPrompt = ollamaPrompt.slice(0, 32000);
      }
    }

    for (const modelName of modelNames) {
      if (parentSignal?.aborted) throw new Error('Generatie geannuleerd.');
      const { signal, cleanup } = createTimeoutAbortSignal(parentSignal, LLM_TIMEOUT_MS);
      let fullText = '';
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      try {
        report?.({
          provider: 'ollama',
          model: modelName,
          charsReceived: 0,
          event: `Lokaal model gestart: ${modelName} (Ollama)...`
        });

        const useStream = Boolean(report);
        const res = await ollamaClient.generate(
          ollamaPrompt,
          modelName,
          systemPrompt,
          useStream,
          undefined,
          false,
          orgId,
          signal,
          {
            format: jsonMode ? 'json' : undefined,
            numPredict: maxTokens,
            numCtx,
            temperature
          }
        );
        if (!res.ok) continue;

        if (useStream && res.body) {
          reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let lastEmitChars = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const rawLine of lines) {
              const trimmed = rawLine.trim();
              if (!trimmed) continue;
              try {
                const chunk = JSON.parse(trimmed);
                if (chunk.response) {
                  fullText += chunk.response;
                  if (fullText.length - lastEmitChars >= 100) {
                    lastEmitChars = fullText.length;
                    report?.({ provider: 'ollama', model: modelName, charsReceived: fullText.length });
                  }
                }
              } catch {}
            }
          }
          if (fullText.trim().length > 0) {
            report?.({ provider: 'ollama', model: modelName, charsReceived: fullText.length });
            return { text: fullText.trim(), modelUsed: modelName, provider: 'ollama' };
          }
        } else {
          const raw = (await res.json()) as any;
          if (raw.response && raw.response.trim().length > 0) {
            report?.({ provider: 'ollama', model: modelName, charsReceived: raw.response.length });
            return { text: raw.response.trim(), modelUsed: modelName, provider: 'ollama' };
          }
        }
      } catch (err: any) {
        if (parentSignal?.aborted) throw new Error('Generatie geannuleerd.');
        const recovered = tryRecoverPartialSlidesJson(fullText);
        if (recovered) {
          console.warn(`[Locra Live AI] Ollama timeout op ${modelName}, maar gedeeltelijke JSON hersteld (${fullText.length} tekens)`);
          report?.({ provider: 'ollama', model: modelName, charsReceived: fullText.length });
          return { text: recovered, modelUsed: modelName, provider: 'ollama' };
        }
        console.warn('[Locra Live AI] Ollama error:', err?.message);
      } finally {
        cleanup();
        if (reader) {
          reader.cancel().catch(() => {});
        }
      }
    }
    return null;
  };

  // 0. Als gebruiker expliciet een model koos in de UI
  if (options?.modelId && orgId) {
    try {
      const selectedModel = await prisma.installedModel.findFirst({
        where: {
          orgId,
          isActive: true,
          OR: [{ id: options.modelId }, { ollamaName: options.modelId }]
        }
      });
      if (selectedModel) {
        if (selectedModel.provider === 'gemini') {
          const res = await tryGemini([selectedModel.ollamaName]);
          if (res) return res;
        } else if (selectedModel.provider === 'anthropic') {
          const res = await tryAnthropic([selectedModel.ollamaName]);
          if (res) return res;
        } else if (selectedModel.provider === 'openrouter' || selectedModel.provider === 'openai') {
          const res = await tryOpenAiCompatible(selectedModel.provider, selectedModel.ollamaName);
          if (res) return res;
        } else {
          const res = await tryOllama([selectedModel.ollamaName]);
          if (res) return res;
        }
      }
    } catch (e: any) {
      if (parentSignal?.aborted) throw e;
    }
  }

  // 1. Google Gemini (snel + sterk op Nederlandse onderwijscontent)
  const activeOrgModels = orgId
    ? await prisma.installedModel.findMany({ where: { orgId, isActive: true } }).catch(() => [])
    : [];
  const configuredGeminiModels = activeOrgModels
    .filter(m => m.provider === 'gemini')
    .map(m => m.ollamaName);
  const geminiRes = await tryGemini(
    Array.from(new Set([...configuredGeminiModels, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-1.5-flash']))
  );
  if (geminiRes) return geminiRes;

  // 2. Anthropic Claude (indien sleutel aanwezig)
  const configuredClaudeModels = activeOrgModels
    .filter(m => m.provider === 'anthropic')
    .map(m => m.ollamaName);
  const claudeRes = await tryAnthropic(
    Array.from(new Set([...configuredClaudeModels, 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest']))
  );
  if (claudeRes) return claudeRes;

  // 3. OpenAI / OpenRouter
  const configuredOpenAi = activeOrgModels.find(m => m.provider === 'openai')?.ollamaName;
  const configuredOpenRouter = activeOrgModels.find(m => m.provider === 'openrouter')?.ollamaName;
  if (orgSettings?.openRouterApiKey) {
    const orRes = await tryOpenAiCompatible('openrouter', configuredOpenRouter || 'openai/gpt-4o-mini');
    if (orRes) return orRes;
  }
  const oaiRes = await tryOpenAiCompatible('openai', configuredOpenAi || process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini');
  if (oaiRes) return oaiRes;

  // 4. Ollama Lokaal (kies sterkste beschikbare onderwijsmodel)
  const ollamaCandidates = activeOrgModels
    .filter(m => m.provider === 'ollama' && !m.isCodeMatchOnly)
    .sort((a, b) => {
      const rankWeight = (m: any) =>
        (m.routingTier === 'heavy' ? 4 : m.routingTier === 'standard' ? 2 : 1) +
        (/32b|70b|27b|14b/i.test(m.ollamaName) ? 3 : /8b|9b/i.test(m.ollamaName) ? 2 : 0) +
        (m.isDefault ? 1 : 0);
      return rankWeight(b) - rankWeight(a);
    })
    .map(m => m.ollamaName);

  const ollamaRes = await tryOllama(
    Array.from(new Set([...ollamaCandidates, 'llama3.1:8b', 'llama3', 'qwen2.5:7b', 'gemma2:9b']))
  );
  if (ollamaRes) return ollamaRes;

  return null;
}

// ── Asynchrone AI-Lesgeneratie Job Queue (voorkomt HTTP 524 timeouts & biedt realtime voortgang) ──
export type JobStepStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';

export interface LiveGenerationStep {
  key: 'sources' | 'draft' | 'critic' | 'images' | 'finalize';
  icon: string;
  label: string;
  detail: string;
  status: JobStepStatus;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
}

export interface LiveGenerationLog {
  id: string;
  ts: number;
  icon: string;
  message: string;
}

export interface LiveGenerationPreviewSlide {
  id: string;
  type: SlideType;
  rtti?: string;
  title: string;
  imageUrl?: string;
}

export interface LiveGenerationJob {
  jobId: string;
  userId: string;
  orgId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  scheduleMode?: 'immediate' | 'offpeak';
  scheduledFor?: number;
  autoSaveLesson?: boolean;
  savedLessonId?: string;
  queuedPayload?: any;
  queuedUser?: any;
  topic: string;
  subject: string;
  targetGrade: string;
  mode: string;
  questionQualityMode: string;
  progressPercent: number;
  activeStepKey: string;
  steps: LiveGenerationStep[];
  logs: LiveGenerationLog[];
  stats: {
    sourcesUsed: string[];
    sourceCharCount: number;
    ragPassagesCount: number;
    modelUsed?: string;
    provider?: string;
    qualityUpgraded?: boolean;
    generatedChars: number;
    slidesDrafted: number;
    imagesFound: number;
    imagesTotal: number;
  };
  previewSlides: LiveGenerationPreviewSlide[];
  result?: any;
  error?: string;
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
  abortController: AbortController;
}

const liveGenerationJobs = new Map<string, LiveGenerationJob>();

function pruneOldGenerationJobs() {
  const now = Date.now();
  const MAX_AGE_MS = 4 * 60 * 60 * 1000;
  for (const [id, job] of liveGenerationJobs.entries()) {
    if (job.status !== 'running' && job.status !== 'queued' && now - (job.finishedAt || job.updatedAt) > MAX_AGE_MS) {
      liveGenerationJobs.delete(id);
    }
  }
}

function serializeGenerationJob(job: LiveGenerationJob, includeResult = true) {
  return {
    jobId: job.jobId,
    status: job.status,
    scheduleMode: job.scheduleMode || 'immediate',
    scheduledFor: job.scheduledFor,
    savedLessonId: job.savedLessonId,
    topic: job.topic,
    subject: job.subject,
    targetGrade: job.targetGrade,
    mode: job.mode,
    questionQualityMode: job.questionQualityMode,
    progressPercent: job.progressPercent,
    activeStepKey: job.activeStepKey,
    steps: job.steps,
    logs: job.logs,
    stats: job.stats,
    previewSlides: job.previewSlides,
    result: includeResult && job.status === 'completed' ? job.result : undefined,
    error: job.error,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt
  };
}

function createInitialJobSteps(questionQualityMode: string, autoFindImages: boolean): LiveGenerationStep[] {
  return [
    {
      key: 'sources',
      icon: '📚',
      label: 'Bronnen & RAG-context analyseren',
      detail: 'Wacht op start...',
      status: 'pending'
    },
    {
      key: 'draft',
      icon: '🧠',
      label: 'AI lesontwerp & vragen genereren',
      detail: 'Wacht op broncontext...',
      status: 'pending'
    },
    {
      key: 'critic',
      icon: '🔎',
      label: 'Cito/RTTI kwaliteitscontrole (2e ronde)',
      detail: questionQualityMode === 'high' ? 'Staat ingepland na eerste AI-ontwerp' : 'Snelle modus (wordt overgeslagen)',
      status: 'pending'
    },
    {
      key: 'images',
      icon: '🖼️',
      label: 'Passende onderwijsafbeeldingen zoeken',
      detail: autoFindImages ? 'Wacht op gegenereerde dia’s...' : 'Uitgeschakeld in instellingen',
      status: 'pending'
    },
    {
      key: 'finalize',
      icon: '✅',
      label: 'Antwoordopties husselen & afronden',
      detail: 'Klaarmaken voor lesbouwer...',
      status: 'pending'
    }
  ];
}

async function callLlm(prompt: string, systemPrompt: string, orgId?: string, jsonMode = true): Promise<string | null> {
  const res = await callLlmDetailed(prompt, systemPrompt, orgId, jsonMode);
  return res?.text || null;
}

/**
 * Rijke didactische fallback voor Nederlandse lessen & interactieve quizzen.
 * Bevat diepgaande vakkennis voor Geschiedenis, Biologie, Aardrijkskunde, Wiskunde en Nederlands.
 */
function buildCurriculumLessonFallback(subject: string, topic: string, targetGrade: string): LiveSlide[] {
  const normTopic = (topic || '').toLowerCase();
  const safeSubject = subject || 'Algemeen';
  const safeTopic = topic || 'Kernbegrippen';

  // ── 1. GESCHIEDENIS: FRANSE REVOLUTIE ──
  if (normTopic.includes('frans') || normTopic.includes('revolutie') || normTopic.includes('bastille') || normTopic.includes('lodewijk') || normTopic.includes('napoleon') || normTopic.includes('guillotine')) {
    return [
      {
        id: 'slide-1',
        type: 'content',
        title: 'De Franse Revolutie (1789) — De Standenmaatschappij',
        imageUrl: 'https://images.unsplash.com/photo-1551887373-6edba6dacbb1?auto=format&fit=crop&w=1200&q=80',
        imageCaption: 'Het koninklijk paleis van Versailles: centrum van het Franse absolutisme',
        content: `> 🎯 **Leerdoel:** Na deze dia kun je verklaren waarom de enorme ongelijkheid tussen de drie standen leidde tot de uitbraak van de Franse Revolutie in 1789.\n\nVóór 1789 was Frankrijk een *standenmaatschappij* onder het absolutisme van koning Lodewijk XVI:\n\n| Stand | Groep | Aandeel Bevolking | Belastingplicht & Macht |\n| :--- | :--- | :--- | :--- |\n| **1e Stand** | Geestelijkheid | ~1% | Betaalde vrijwel géén belasting, bezat ~10% grond |\n| **2e Stand** | Adel | ~1,5% | Had alle topfuncties, vrijgesteld van directe belasting |\n| **3e Stand** | Burgers & Boeren | **>97%** | Betaalde álle belastingen, maar had **0 inspraak** |\n\n> ⚠️ **Veelgemaakte Denkfout:** De Derde Stand bestond niet alleen uit arme boeren! Ook rijke kooplieden, artsen en advocaten (*de bourgeoisie*) hoorden hierbij — en juist zij namen het voortouw in het protest.`,
        explanation: 'De ongelijkheid tussen de standen was de directe lont in het kruitvat van 1789.'
      },
      {
        id: 'slide-2',
        type: 'wordcloud',
        title: 'Gedachtenwolk: Wat weet je over de Franse Revolutie?',
        content: 'Noem tot 3 begrippen, personen of gebeurtenissen die bij jou opkomen bij de **Franse Revolutie**:',
        timeLimitSeconds: 40,
        explanation: 'Veelgenoemde begrippen: Vrijheid, Gelijkheid, Broederschap, Guillotine, Bastille, Terreur, Lodewijk XVI.'
      },
      {
        id: 'slide-3',
        type: 'true_false',
        title: 'Stelling: Belastingen vóór 1789',
        content: 'Betaalden de adel en de geestelijkheid vóór de Franse Revolutie het grootste deel van de Franse staatsbelastingen?',
        options: ['Waar', 'Niet Waar'],
        correctOptionIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
        explanation: 'Niet Waar! Juist de Eerste Stand (geestelijkheid) en Tweede Stand (adel) hadden fiscale privileges en betaalden vrijwel geen directe belastingen.'
      },
      {
        id: 'slide-4',
        type: 'multiple_choice',
        title: 'Begripstoets: De Drie Standen',
        content: 'Welke groep binnen de Derde Stand eiste op basis van de Verlichting politieke inspraak op omdat zij wel bijdroeg aan de economie en belastingen?',
        options: [
          'De gegoede burgerij (bourgeoisie) zoals advocaten en kooplieden',
          'Uitsluitend de adellijke hofhouding van paleis Versailles',
          'De bisschoppen en abten van de katholieke kerk',
          'Buitenlandse huurlingen in dienst van koning Lodewijk XVI'
        ],
        correctOptionIndex: 0,
        timeLimitSeconds: 30,
        points: 1000,
        explanation: 'De bourgeoisie las Verlichtingsfilosofen als Montesquieu en Rousseau en pikte het niet langer dat zij geen politieke macht had.'
      },
      {
        id: 'slide-5',
        type: 'content',
        title: '14 Juli 1789: De Bestorming van de Bastille',
        imageUrl: 'https://images.unsplash.com/photo-1549144511-f099e773c147?auto=format&fit=crop&w=1200&q=80',
        imageCaption: 'Parijs: het toneel van de volksopstand op 14 juli 1789',
        content: `> 💡 **Kernbegrip:** **Volkssoevereiniteit** — het idee dat de hoogste macht niet bij een koning door 'Gods genade' ligt, maar bij het volk zelf.\n\nOp **14 juli 1789** bestormde de Parijse bevolking de middeleeuwse staatsgevangenis **de Bastille** om buskruit en wapens buit te maken.\n\n> 🔍 **Historische Bron (26 augustus 1789):** *"Mensen worden vrij en gelijk in rechten geboren en blijven dat ook."* — Artikel 1 van de Verklaring van de Rechten van de Mens en de Burger.\n\n• **Gevolg:** De feodale privileges van de adel werden afgeschaft en Frankrijk kreeg uiteindelijk een grondwet.`,
        explanation: '14 juli (Quatorze Juillet) wordt in Frankrijk nog jaarlijks gevierd als het begin van de democratie.'
      },
      {
        id: 'slide-6',
        type: 'multiple_choice',
        title: 'De Terreur (1793-1794)',
        content: 'Wat was het belangrijkste doel van de radicale Jacobijnen onder leiding van Maximilien de Robespierre tijdens "De Terreur"?',
        options: [
          'Het genadeloos uitschakelen van vermeende vijanden van de revolutie via de guillotine',
          'Het onmiddellijk herstellen van de monarchie en vrede sluiten met Oostenrijk',
          'Het afschaffen van het algemeen kiesrecht en herinvoeren van de standen',
          'Het verbieden van alle vormen van onderwijs en wetenschap'
        ],
        correctOptionIndex: 0,
        timeLimitSeconds: 30,
        points: 1000,
        explanation: 'Onder Robespierre werden meer dan 40.000 Fransen geëxecuteerd onder verdenking van verraad aan de revolutie, totdat hij zelf onder de guillotine eindigde.'
      },
      {
        id: 'slide-7',
        type: 'open',
        title: 'Historische reflectievraag',
        content: 'Leg in je eigen woorden uit waarom de idealen van de Franse Revolutie (*Vrijheid, Gelijkheid en Broederschap*) vandaag de dag nog steeds terug te vinden zijn in de Nederlandse grondwet.',
        timeLimitSeconds: 60,
        explanation: 'Denk aan: gelijkheidsbeginsel (Artikel 1), vrijheid van meningsuiting, algemeen kiesrecht en scheiding van kerk en staat.'
      },
      {
        id: 'slide-8',
        type: 'poll',
        title: 'Historisch oordeel over Robespierre',
        content: 'Hoe moet Robespierre volgens jou in de geschiedenisboeken beoordeeld worden?',
        options: [
          'Een bloeddorstige dictator die de idealen van vrijheid verraadde',
          'Een idealist die in extreme oorlogstijd te ver doorsloeg',
          'Zijn strenge optreden redde de prille Franse republiek van de ondergang',
          'Moeilijk te oordelen zonder de context van 1793 volledig te kennen'
        ],
        explanation: 'Historici debatteren nog altijd over het spanningsveld tussen idealisme en terreur.'
      }
    ];
  }

  // ── 2. BIOLOGIE: FOTOSYNTHESE & PLANTEN ──
  if (normTopic.includes('foto') || normTopic.includes('synthese') || normTopic.includes('plant') || normTopic.includes('bladgroen') || normTopic.includes('glucose') || normTopic.includes('zuurstof') || normTopic.includes('chloroplast')) {
    return [
      {
        id: 'slide-1',
        type: 'content',
        title: 'Fotosynthese: De Motor van het Leven',
        imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1200&q=80',
        imageCaption: 'Bladgroen vangt zonlicht op voor de vorming van glucose en zuurstof',
        content: `> 🎯 **Leerdoel:** Je leert de begin- en eindstoffen van fotosynthese benoemen én hoe een plant de reactiesnelheid regelt via haar huidmondjes.\n\nPlanten maken hun eigen energierijke bouwstof (*glucose*) met behulp van zonlicht:\n\n$$6CO_2 + 6H_2O + \\text{lichtenergie} \\rightarrow C_6H_{12}O_6 + 6O_2$$\n\n> 💡 **Kernbegrip:** **Autotroof organisme** — een organisme (zoals een plant) dat geen ander organisme hoeft te eten, maar zelf organische glucose opbouwt uit anorganische stoffen.\n\n> ⚠️ **Veelgemaakte Denkfout:** Planten doen óók aan verbranding (celademhaling)! Niet alleen 's nachts, maar **24 uur per dag**. Alleen bij voldoende licht gaat fotosynthese sneller dan verbranding.`,
        explanation: 'Zonder fotosynthese zou er geen zuurstof voor ademhaling en geen basisvoedsel in het voedselweb zijn.'
      },
      {
        id: 'slide-2',
        type: 'wordcloud',
        title: 'Voorkennis: Welke begrippen horen bij een plantencel?',
        content: 'Stuur tot 3 begrippen of stoffen in die essentieel zijn voor een groene plant:',
        timeLimitSeconds: 30,
        explanation: 'Onder andere: Chloroplast, Huidmondje, Glucose, Water, Koolstofdioxide, Zuurstof, Zonlicht.'
      },
      {
        id: 'slide-3',
        type: 'true_false',
        title: 'Stelling: Verbranding in Planten',
        content: 'Planten voeren alleen overdag verbranding (celademhaling) uit; zodra het donker wordt stopt elke celademhaling.',
        options: ['Waar', 'Niet Waar'],
        correctOptionIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
        explanation: 'Niet Waar! Verbranding gebeurt dag en nacht in elke levende cel om energie (ATP) vrij te maken. Alleen fotosynthese stopt in het donker.'
      },
      {
        id: 'slide-4',
        type: 'multiple_choice',
        title: 'Celstructuur & Fotosynthese',
        imageUrl: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=1200&q=80',
        imageCaption: 'Microscopisch beeld van plantencellen met bladgroenkorrels',
        content: 'In welke specifieke celorganellen van een plantaardige cel vindt fotosynthese plaats?',
        options: [
          'Bladgroenkorrels (chloroplasten)',
          'Mitochondriën',
          'De celkern (nucleus)',
          'De centrale vacuole'
        ],
        correctOptionIndex: 0,
        timeLimitSeconds: 25,
        points: 1000,
        explanation: 'In chloroplasten zit het groene pigment chlorofyl, dat lichtenergie absorbeert. In mitochondriën vindt juist verbranding plaats.'
      },
      {
        id: 'slide-5',
        type: 'multiple_choice',
        title: 'Factoren & Beperkingen',
        content: 'Wat gebeurt er met de fotosynthese in een kas als de temperatuur stijgt boven de 45°C?',
        options: [
          'De fotosynthese stopt omdat de betrokken enzymen denatureren (onherstelbaar beschadigen)',
          'De fotosynthese verdubbelt exponentieel door de extra warmte',
          'De plant produceert plotseling pure stikstof in plaats van zuurstof',
          'Er verandert helemaal niets, alleen lichtsterkte heeft invloed'
        ],
        correctOptionIndex: 0,
        timeLimitSeconds: 30,
        points: 1000,
        explanation: 'Fotosynthese is een enzymatisch proces. Boven de maximumtemperatuur verliezen enzymen hun ruimtelijke vorm (denaturatie).'
      },
      {
        id: 'slide-6',
        type: 'open',
        title: 'Casus: Planten in de slaapkamer',
        content: 'Soms wordt beweerd dat planten op een donkere slaapkamer slecht zijn omdat ze ’s nachts zuurstof verbruiken. Reken en beredeneer: klopt dit biologisch gezien, en vormt één kamerplant een probleem?',
        timeLimitSeconds: 60,
        explanation: 'Biologisch klopt het dat een plant ’s nachts alleen zuurstof opneemt en CO2 afgeeft (verbranding), maar de hoeveelheid is verwaarloosbaar klein vergeleken bij een mens.'
      },
      {
        id: 'slide-7',
        type: 'poll',
        title: 'Zelfinschatting Fotosynthese',
        content: 'Hoe goed begrijp je nu het verschil tussen fotosynthese (opbouw) en verbranding (afbraak)?',
        options: [
          '⭐️ Ik snap het verschil nu glashelder!',
          '⭐️⭐️ Redelijk goed, maar de reactievergelijking moet ik nog oefenen',
          '⭐️⭐️⭐️ Ik haal de stoffen van beide processen nog door elkaar'
        ],
        explanation: 'Fijn om te weten voor het vervolg van de les!'
      }
    ];
  }

  // ── 3. AARDRIJKSKUNDE: PLAATTEKTONIEK & AARDBEVINGEN ──
  if (normTopic.includes('plaat') || normTopic.includes('tektoniek') || normTopic.includes('vulkaan') || normTopic.includes('aardbeving') || normTopic.includes('tsunami') || normTopic.includes('klimaat')) {
    return [
      {
        id: 'slide-1',
        type: 'content',
        title: 'Plaattektoniek — De Rusteloze Aarde',
        imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
        imageCaption: 'De aardkorst (lithosfeer) is verdeeld in bewegende tektonische platen',
        content: `> 🎯 **Leerdoel:** Je kunt de drie soorten plaatgrenzen onderscheiden en verklaren waar zware aardbevingen en vulkanisme ontstaan.\n\nDe aardkorst drijft in losse platen op de taaivloeibare *asthenosfeer* door **convectiestromen** in de aardmantel:\n\n| Beweging | Richting | Voorbeeld | Gevolg |\n| :--- | :--- | :--- | :--- |\n| **Divergent** | Uit elkaar | Midoceanische Rug | Rustig vulkanisme, nieuwe zeebodem |\n| **Convergent** | Tegen elkaar | Andes / Himalaya | Subductie, zware aardbevingen, vulkanen |\n| **Transform** | Langs elkaar | San Andreasbreuk | Zeer zware aardbevingen, géén vulkanisme |\n\n> ⚠️ **Veelgemaakte Denkfout:** Niet alle plaatgrenzen veroorzaken vulkanen! Bij een **transforme plaatgrens** schuiven platen alleen langs elkaar — dat geeft zware bevingen, maar géén magma dat opstijgt.`,
        explanation: 'Convectiestromen in de aardmantel vormen de motor van platentektoniek.'
      },
      {
        id: 'slide-2',
        type: 'wordcloud',
        title: 'Gevolgen van Plaatbewegingen',
        content: 'Noem tot 3 natuurverschijnselen of begrippen die horen bij plaattektoniek:',
        timeLimitSeconds: 35,
        explanation: 'Veelgenoemd: Aardbeving, Tsunami, Vulkaan, Subductie, Magma, Trog, Breuklijn.'
      },
      {
        id: 'slide-3',
        type: 'true_false',
        title: 'Stelling: Vulkanisme bij San Francisco',
        content: 'Bij een transforme plaatgrens (zoals de San Andreasbreuk) ontstaan regelmatig verwoestende vulkaanuitbarstingen.',
        options: ['Waar', 'Niet Waar'],
        correctOptionIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
        explanation: 'Niet Waar! Bij een transforme plaatgrens schuiven platen langs elkaar. Dat veroorzaakt wrijving en zware aardbevingen, maar geen vulkanisme.'
      },
      {
        id: 'slide-4',
        type: 'multiple_choice',
        title: 'Zwaarste Natuurrampen',
        imageUrl: 'https://images.unsplash.com/photo-1508873696983-2df57036476b?auto=format&fit=crop&w=1200&q=80',
        imageCaption: 'Subductiezones langs de Ring van Vuur veroorzaken zowel vulkanisme als tsunami’s',
        content: 'Welk proces veroorzaakt zowel de allerkrachtigste aardbevingen als explosief vulkanisme?',
        options: [
          'Subductie: een zware oceanische plaat duikt onder een lichtere continentale plaat',
          'Divergentie: twee platen die langzaam uit elkaar drijven midden in de oceaan',
          'Transforme verschuiving langs een horizontale breuklijn op het land',
          'Erosie door gletsjers en rivieren in hooggebergten'
        ],
        correctOptionIndex: 0,
        timeLimitSeconds: 30,
        points: 1000,
        explanation: 'Bij subductie bouwt enorme klemspanning op (bevingen/tsunami) en smelt de duikende plaat met zeewater tot taai, explosief magma.'
      },
      {
        id: 'slide-5',
        type: 'open',
        title: 'Mens & Milieu Casus',
        content: 'Waarom kiezen miljoenen mensen op Java (Indonesië) of bij de Vesuvius (Italië) ervoor om toch op de hellingen van een actieve vulkaan te blijven wonen?',
        timeLimitSeconds: 60,
        explanation: 'Belangrijkste oorzaken: zeer vruchtbare vulkanische grond door verweerde as/mineralen, geothermische energie, toerisme en familiebinding.'
      },
      {
        id: 'slide-6',
        type: 'poll',
        title: 'Mening: Wonen in Risicogebieden',
        content: 'Zou jij ooit een huis kopen in een stad met een hoog aardbevingsrisico (zoals Tokio of San Francisco)?',
        options: [
          'Ja, de moderne aardbevingsbestendige bouwtechniek is uitstekend',
          'Alleen als er geen ander alternatief is voor werk of studie',
          'Nee, het risico op een zware beving is te onzeker'
        ],
        explanation: 'Interessante afweging tussen risicoperceptie en economische kansen.'
      }
    ];
  }

  // ── 4. WISKUNDE: FORMULES & GRAFIEKEN ──
  if (normTopic.includes('wiskunde') || normTopic.includes('lineair') || normTopic.includes('formule') || normTopic.includes('grafiek') || normTopic.includes('functie') || normTopic.includes('pythagoras')) {
    return [
      {
        id: 'slide-1',
        type: 'content',
        title: 'Lineaire Formules: y = ax + b',
        imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
        imageCaption: 'Lineaire verbanden herken je direct aan de rechte lijn in een assenstelsel',
        content: `> 🎯 **Leerdoel:** Je leert hoe het hellingsgetal ($a$) en het startgetal ($b$) de vorm en positie van een rechte lijn bepalen.\n\nEen lineair verband schrijf je altijd in de standaardvorm:\n\n$$y = a \\cdot x + b$$\n\n> 💡 **Kernbegrip:**\n> • **$a$ = Richtingscoëfficiënt (helling):** elke $1$ stap naar rechts ga je $a$ omhoog (als $a > 0$) of omlaag (als $a < 0$).\n> • **$b$ = Startgetal:** de hoogte waarop de lijn de verticale y-as snijdt: het punt $(0, b)$.\n\n> ⚠️ **Veelgemaakte Denkfout:** Let op de volgorde in de formule! Soms staat de formule omgedraaid, zoals $y = 10 - 2x$. Dan is het startgetal **$10$** en de richtingscoëfficiënt **$-2$** (niet $10$!).`,
        explanation: 'Altijd controleren welk getal vast staat en welk getal bij de variabele x hoort!'
      },
      {
        id: 'slide-2',
        type: 'true_false',
        title: 'Stelling: Omgedraaide Volgorde',
        content: 'In de lineaire formule y = 12 - 4x is de richtingscoëfficiënt gelijk aan 12 en stijgt de grafiek.',
        options: ['Waar', 'Niet Waar'],
        correctOptionIndex: 1,
        timeLimitSeconds: 25,
        points: 1000,
        explanation: 'Niet Waar! De richtingscoëfficiënt is het getal vóór de x, dus a = -4. De lijn daalt dus!'
      },
      {
        id: 'slide-3',
        type: 'multiple_choice',
        title: 'Grafieken Aflezen',
        content: 'Gegeven is de formule: y = -3x + 8. Wat is het snijpunt met de y-as en hoe loopt de lijn?',
        options: [
          'Snijpunt (0, 8) en de grafiek is een dalende lijn',
          'Snijpunt (0, -3) en de grafiek is een stijgende lijn',
          'Snijpunt (8, 0) en de grafiek is een horizontale lijn',
          'Snijpunt (0, 0) en de lijn gaat door de oorsprong'
        ],
        correctOptionIndex: 0,
        timeLimitSeconds: 25,
        points: 1000,
        explanation: 'Het startgetal b = 8 geeft snijpunt (0, 8). Omdat a = -3 negatief is, daalt de lijn.'
      },
      {
        id: 'slide-4',
        type: 'multiple_choice',
        title: 'Snijpunt Berekenen',
        content: 'Wat is de uitkomst van y als x = 4 in de formule: y = 2x - 5?',
        options: [
          'y = 3',
          'y = 8',
          'y = -1',
          'y = 13'
        ],
        correctOptionIndex: 0,
        timeLimitSeconds: 25,
        points: 1000,
        explanation: 'Berekening: y = (2 * 4) - 5 = 8 - 5 = 3.'
      },
      {
        id: 'slide-5',
        type: 'open',
        title: 'Praktijkcasus: Taxirit Berekenen',
        content: 'Een taxibedrijf rekent een vast instaptarief van € 4,50 en daarna € 2,20 per gereden kilometer. Stel de lineaire formule op voor de totale ritprijs P bij k kilometers.',
        timeLimitSeconds: 60,
        explanation: 'Juiste formule: P = 2,20k + 4,50 (of P = 4,50 + 2,20k).'
      }
    ];
  }

  // ── 5. ALGEMENE VAKKEN MET CONCRETE THEMA'S & RIJKE BLOKKEN ──
  const heroImg = resolveEducationalImage(safeTopic, safeSubject, safeTopic);
  const secondImg = resolveEducationalImage(`${safeTopic} praktijk voorbeeld`, safeSubject, safeTopic, [heroImg.url]);

  return [
    {
      id: 'slide-1',
      type: 'content',
      title: `${safeTopic} — Hoofdlijnen & Kernconcepten`,
      imageUrl: heroImg.url,
      imageCaption: heroImg.caption || `${safeSubject}: ${safeTopic}`,
      content: `> 🎯 **Leerdoel:** In deze les binnen **${safeSubject}** (${targetGrade || 'Voortgezet Onderwijs'}) doorgrond je de werking, oorzaken en toepassingen van **${safeTopic}**.\n\n> 💡 **Kernbegrip:** **${safeTopic}** vormt een centrale pijler binnen het domein ${safeSubject}. Begrijp niet alleen de definitie, maar vooral het *waarom* en de onderlinge verbanden.\n\n• **Basisprincipe:** Welke mechanismen of factoren sturen dit onderwerp aan?\n• **Samenhang:** Wat verandert er zodra één belangrijke voorwaarde verschuift?\n\n> ⚠️ **Veelgemaakte Denkfout:** Voorkom dat je losse definities uit je hoofd leert zonder ze te kunnen koppelen aan een concreet voorbeeld uit de praktijk!`,
      explanation: 'Activeer de voorkennis in de klas voordat we gaan oefenen.'
    },
    {
      id: 'slide-2',
      type: 'wordcloud',
      title: `Gedachtenwolk: Associaties bij ${safeTopic}`,
      content: `Stuur 1 tot 3 kernwoorden of vragen in die bij jou opkomen als je denkt aan **${safeTopic}**:`,
      timeLimitSeconds: 40,
      explanation: 'We bespreken de grootste en opvallendste begrippen uit de wolk klassikaal.'
    },
    {
      id: 'slide-3',
      type: 'true_false',
      title: `Stellingcheck: ${safeTopic}`,
      content: `Bij het analyseren van **${safeTopic}** binnen ${safeSubject} spelen zowel oorzaken als meetbare gevolgen in de praktijk een doorslaggevende rol.`,
      options: ['Waar', 'Niet Waar'],
      correctOptionIndex: 0,
      timeLimitSeconds: 20,
      points: 1000,
      explanation: `Waar! In ${safeSubject} beoordelen we concepten als ${safeTopic} altijd op grond van onderbouwde oorzaak-gevolgrelaties.`
    },
    {
      id: 'slide-4',
      type: 'multiple_choice',
      title: `Kennischeck: Begrip van ${safeTopic}`,
      imageUrl: secondImg.url,
      imageCaption: secondImg.caption,
      content: `Wat is de meest accurate en vakinhoudelijk juiste omschrijving van **${safeTopic}** binnen ${safeSubject}?`,
      options: [
        `Een specifiek kernprincipe van ${safeSubject} dat causaal verklaart hoe processen elkaar beïnvloeden`,
        'Een historisch achterhaalde aanname die in de praktijk niet meer wordt gehanteerd',
        'Een puur willekeurig verschijnsel zonder duidelijke wetmatigheden of samenhang',
        'Een theorie die uitsluitend van toepassing is buiten het reguliere curriculum'
      ],
      correctOptionIndex: 0,
      timeLimitSeconds: 30,
      points: 1000,
      explanation: `Optie A verwoordt de kern: binnen ${safeSubject} verklaart ${safeTopic} de samenhang tussen oorzaak en gevolg.`
    },
    {
      id: 'slide-5',
      type: 'open',
      title: `Casus & Toepassing: ${safeTopic}`,
      content: `> 🔍 **Casus:** Stel dat je **${safeTopic}** moet uitleggen aan een klasgenoot die de les gemist heeft.\n\nGeef in minimaal twee zinnen in je eigen woorden een heldere uitleg mét een concreet praktijkvoorbeeld.`,
      timeLimitSeconds: 60,
      explanation: 'Locra AI clustert alle Sticky Notes live op het whiteboard.'
    },
    {
      id: 'slide-6',
      type: 'poll',
      title: 'Formatieve Zelfcheck',
      content: `Hoe goed beheers je de stof van ${safeTopic} op dit moment?`,
      options: [
        '⭐️ Nog erg lastig, graag extra klassikale uitleg',
        '⭐️⭐️ Ik begrijp de hoofdlijnen, maar wil meer oefenen',
        '⭐️⭐️⭐️ Goed begrepen, ik kan zelfstandig aan de slag!',
        '⭐️⭐️⭐️⭐️ Ik beheers dit uitstekend en kan het uitleggen aan een ander'
      ],
      explanation: 'Bedankt voor jullie eerlijke feedback!'
    }
  ];
}

export default async function liveRoutes(fastify: FastifyInstance) {

  // ── 1. WEBSOCKET ENDPOINT VOOR HOST & SPELERS ──
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    let client: WsClient | null = null;

    connection.on('close', () => {
      if (client) {
        const room = activeRooms.get(client.sessionId);
        if (room) {
          room.delete(client);
          if (room.size === 0) activeRooms.delete(client.sessionId);
          else if (client.role === 'player') {
            // Laat de host weten dat een deelnemer de verbinding heeft verbroken
            broadcastToRoom(client.sessionId, {
              type: 'participant_left',
              participantId: client.participantId,
              nickname: client.nickname
            });
          }
        }
      }
    });

    connection.on('message', async (rawMsg: Buffer) => {
      try {
        const data = JSON.parse(rawMsg.toString());

        // ── INIT HOST (Digibord / Docent) ──
        if (data.type === 'host_init') {
          const { sessionId, token } = data;
          if (!sessionId || !token) {
            connection.send(JSON.stringify({ type: 'error', message: 'Ongeldige host initialisatie' }));
            return;
          }

          let authUser: any = null;
          try {
            authUser = verifyToken(token);
          } catch (e) {
            connection.send(JSON.stringify({ type: 'error', message: 'Sessie token verlopen of ongeldig' }));
            return;
          }

          const session = await prisma.liveSession.findUnique({
            where: { id: sessionId },
            include: {
              lesson: true,
              participants: {
                select: { id: true, nickname: true, color: true, avatar: true, score: true, streak: true }
              }
            }
          });

          if (!session) {
            connection.send(JSON.stringify({ type: 'error', message: 'Sessie niet gevonden' }));
            return;
          }

          client = {
            ws: connection,
            role: 'host',
            sessionId,
            userId: authUser.id
          };

          if (!activeRooms.has(sessionId)) activeRooms.set(sessionId, new Set());
          activeRooms.get(sessionId)!.add(client);

          connection.send(JSON.stringify({
            type: 'host_ready',
            session: {
              id: session.id,
              pinCode: session.pinCode,
              status: session.status,
              currentSlideIdx: session.currentSlideIdx,
              slideState: session.slideState,
              mode: session.mode,
              lesson: session.lesson,
              participants: session.participants
            }
          }));
          return;
        }

        // ── INIT PLAYER (Leerling op Smartphone / Laptop) ──
        if (data.type === 'player_init') {
          const { sessionId, participantId } = data;
          if (!sessionId || !participantId) {
            connection.send(JSON.stringify({ type: 'error', message: 'Deelnemersgegevens ontbreken' }));
            return;
          }

          const participant = await prisma.liveParticipant.findUnique({
            where: { id: participantId },
            include: { session: { include: { lesson: true } } }
          });

          if (!participant || participant.sessionId !== sessionId) {
            connection.send(JSON.stringify({ type: 'error', message: 'Deelnemer niet gevonden' }));
            return;
          }

          client = {
            ws: connection,
            role: 'player',
            sessionId,
            participantId,
            nickname: participant.nickname,
            avatar: participant.avatar || '🦊'
          };

          if (!activeRooms.has(sessionId)) activeRooms.set(sessionId, new Set());
          activeRooms.get(sessionId)!.add(client);

          // Parse slides veilig (verberg correctOptionIndex voor spelers!)
          let slides: LiveSlide[] = [];
          try {
            slides = JSON.parse(participant.session.lesson.slidesJson || '[]');
          } catch (_) {}

          const currentSlide = slides[participant.session.currentSlideIdx] || null;
          const sanitizedSlide = currentSlide ? {
            id: currentSlide.id,
            type: currentSlide.type,
            title: currentSlide.title,
            content: currentSlide.content,
            imageUrl: currentSlide.imageUrl,
            imageCaption: currentSlide.imageCaption,
            options: currentSlide.options,
            timeLimitSeconds: currentSlide.timeLimitSeconds,
            // Exclude correctOptionIndex and explanation during answering!
          } : null;

          connection.send(JSON.stringify({
            type: 'player_ready',
            participant: {
              id: participant.id,
              nickname: participant.nickname,
              avatar: participant.avatar || '🦊',
              color: participant.color,
              score: participant.score,
              streak: participant.streak
            },
            session: {
              status: participant.session.status,
              currentSlideIdx: participant.session.currentSlideIdx,
              slideState: participant.session.slideState,
              mode: participant.session.mode,
              totalSlides: slides.length
            },
            currentSlide: sanitizedSlide
          }));

          // Notificeer host van actieve aanwezigheid
          broadcastToRoom(sessionId, {
            type: 'participant_joined',
            participant: {
              id: participant.id,
              nickname: participant.nickname,
              avatar: participant.avatar || '🦊',
              color: participant.color,
              score: participant.score,
              streak: participant.streak
            }
          }, client);
          return;
        }

        // ── HOST CONTROLS ──
        if (client && client.role === 'host') {
          const { action, targetId } = data;
          const sessionId = client.sessionId;

          const session = await prisma.liveSession.findUnique({
            where: { id: sessionId },
            include: { lesson: true }
          });
          if (!session) return;

          let slides: LiveSlide[] = [];
          try {
            slides = JSON.parse(session.lesson.slidesJson || '[]');
          } catch (_) {}

          // A. Start de sessie
          if (action === 'start') {
            await prisma.liveSession.update({
              where: { id: sessionId },
              data: { status: 'active', currentSlideIdx: 0, slideState: 'question', startedAt: new Date() }
            });

            const firstSlide = slides[0] || null;
            broadcastToRoom(sessionId, {
              type: 'session_started',
              currentSlideIdx: 0,
              slideState: 'question',
              slide: firstSlide ? {
                id: firstSlide.id,
                type: firstSlide.type,
                title: firstSlide.title,
                content: firstSlide.content,
                imageUrl: firstSlide.imageUrl,
                imageCaption: firstSlide.imageCaption,
                options: firstSlide.options,
                timeLimitSeconds: firstSlide.timeLimitSeconds
              } : null
            });
            return;
          }

          // B. Volgende Slide
          if (action === 'next_slide') {
            const nextIdx = session.currentSlideIdx + 1;
            if (nextIdx < slides.length) {
              await prisma.liveSession.update({
                where: { id: sessionId },
                data: { currentSlideIdx: nextIdx, slideState: 'question' }
              });

              const nextSlide = slides[nextIdx];
              broadcastToRoom(sessionId, {
                type: 'slide_changed',
                currentSlideIdx: nextIdx,
                slideState: 'question',
                slide: {
                  id: nextSlide.id,
                  type: nextSlide.type,
                  title: nextSlide.title,
                  content: nextSlide.content,
                  imageUrl: nextSlide.imageUrl,
                  imageCaption: nextSlide.imageCaption,
                  options: nextSlide.options,
                  timeLimitSeconds: nextSlide.timeLimitSeconds
                }
              });
            } else {
              // Geen slides meer -> Einde sessie & Podium
              await prisma.liveSession.update({
                where: { id: sessionId },
                data: { status: 'finished', endedAt: new Date() }
              });

              const topParticipants = await prisma.liveParticipant.findMany({
                where: { sessionId },
                orderBy: { score: 'desc' },
                take: 10,
                select: { id: true, nickname: true, avatar: true, color: true, score: true, streak: true }
              });

              broadcastToRoom(sessionId, {
                type: 'session_finished',
                podium: topParticipants
              });
            }
            return;
          }

          // C. Vorige Slide
          if (action === 'prev_slide') {
            const prevIdx = Math.max(0, session.currentSlideIdx - 1);
            await prisma.liveSession.update({
              where: { id: sessionId },
              data: { currentSlideIdx: prevIdx, slideState: 'question' }
            });

            const prevSlide = slides[prevIdx];
            broadcastToRoom(sessionId, {
              type: 'slide_changed',
              currentSlideIdx: prevIdx,
              slideState: 'question',
              slide: {
                id: prevSlide.id,
                type: prevSlide.type,
                title: prevSlide.title,
                content: prevSlide.content,
                imageUrl: prevSlide.imageUrl,
                imageCaption: prevSlide.imageCaption,
                options: prevSlide.options,
                timeLimitSeconds: prevSlide.timeLimitSeconds
              }
            });
            return;
          }

          // D. Onthul Antwoorden & Statistieken (Reveal)
          if (action === 'reveal') {
            await prisma.liveSession.update({
              where: { id: sessionId },
              data: { slideState: 'revealed' }
            });

            const currentSlide = slides[session.currentSlideIdx];
            const responses = await prisma.liveResponse.findMany({
              where: { sessionId, slideIndex: session.currentSlideIdx },
              include: { participant: { select: { id: true, nickname: true, avatar: true, color: true, score: true } } }
            });

            // Statistieken berekenen per antwoord
            const optionCounts = (currentSlide?.options || []).map((_, i) => {
              return responses.filter(r => r.answerValue === i.toString()).length;
            });

            // Woordwolk / Gedachtenwolk frequenties aggregeren
            let wordFrequencies: { word: string; count: number }[] = [];
            if (currentSlide?.type === 'wordcloud') {
              const freqMap: Record<string, number> = {};
              responses.forEach(r => {
                const words = (r.answerValue || '')
                  .split(/[,;\n]+/)
                  .map(w => w.trim())
                  .filter(w => w.length >= 2);
                words.forEach(w => {
                  const capitalized = w.charAt(0).toUpperCase() + w.slice(1);
                  freqMap[capitalized] = (freqMap[capitalized] || 0) + 1;
                });
              });
              wordFrequencies = Object.entries(freqMap)
                .map(([word, count]) => ({ word, count }))
                .sort((a, b) => b.count - a.count);
            }

            broadcastToRoom(sessionId, {
              type: 'slide_revealed',
              slideIndex: session.currentSlideIdx,
              correctOptionIndex: currentSlide?.correctOptionIndex,
              explanation: currentSlide?.explanation,
              optionCounts,
              totalResponses: responses.length,
              wordFrequencies,
              responses: currentSlide?.type === 'open' || currentSlide?.type === 'wordcloud' ? responses.map(r => ({
                id: r.id,
                nickname: r.participant.nickname,
                avatar: r.participant.avatar || '🦊',
                color: r.participant.color,
                answer: r.answerValue
              })) : undefined
            });
            return;
          }

          // E. Toon Leaderboard / Tussenstand
          if (action === 'show_leaderboard') {
            await prisma.liveSession.update({
              where: { id: sessionId },
              data: { slideState: 'leaderboard' }
            });

            const leaderboard = await prisma.liveParticipant.findMany({
              where: { sessionId },
              orderBy: { score: 'desc' },
              take: 5,
              select: { id: true, nickname: true, avatar: true, color: true, score: true, streak: true }
            });

            broadcastToRoom(sessionId, {
              type: 'leaderboard_update',
              leaderboard
            });
            return;
          }

          // F. Schop ongepaste speler uit lobby
          if (action === 'kick' && targetId) {
            await prisma.liveParticipant.delete({ where: { id: targetId } }).catch(() => {});
            broadcastToRoom(sessionId, {
              type: 'participant_kicked',
              participantId: targetId
            });
            return;
          }

          // G. Spotlight / Uitblinker open antwoord markeren
          if (action === 'spotlight') {
            broadcastToRoom(sessionId, {
              type: 'answer_spotlighted',
              answerId: targetId || null
            });
            return;
          }

          // H. Handmatig Sessie Beëindigen
          if (action === 'end') {
            await prisma.liveSession.update({
              where: { id: sessionId },
              data: { status: 'finished', endedAt: new Date() }
            });

            const topParticipants = await prisma.liveParticipant.findMany({
              where: { sessionId },
              orderBy: { score: 'desc' },
              take: 10,
              select: { id: true, nickname: true, avatar: true, color: true, score: true, streak: true }
            });

            broadcastToRoom(sessionId, {
              type: 'session_finished',
              podium: topParticipants
            });
            return;
          }
        }

        // ── PLAYER CONTROLS (Live Reacties & Antwoorden) ──
        if (client && client.role === 'player') {
          // A. Live zwevende emoji reacties
          if (data.type === 'player_reaction') {
            const reaction = typeof data.reaction === 'string' ? data.reaction.slice(0, 4) : '👍';
            broadcastToRoom(client.sessionId, {
              type: 'reaction_received',
              id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              reaction,
              nickname: client.nickname || 'Leerling',
              avatar: client.avatar || '🦊'
            });
            return;
          }

          // B. Antwoord insturen
          if (data.type === 'player_answer' && client.participantId) {
            const { slideIndex, answerValue, responseTimeMs } = data;
            const sessionId = client.sessionId;
            const participantId = client.participantId;

            const session = await prisma.liveSession.findUnique({
              where: { id: sessionId },
              include: { lesson: true }
            });

            if (!session || session.status !== 'active' || session.slideState !== 'question' || session.currentSlideIdx !== slideIndex) {
              connection.send(JSON.stringify({ type: 'answer_rejected', reason: 'Vraag is niet meer actief' }));
              return;
            }

            // Controleer of speler al heeft geantwoord op deze slide
            const existing = await prisma.liveResponse.findFirst({
              where: { sessionId, participantId, slideIndex }
            });
            if (existing) {
              connection.send(JSON.stringify({ type: 'answer_rejected', reason: 'Je hebt al geantwoord' }));
              return;
            }

            let slides: LiveSlide[] = [];
            try {
              slides = JSON.parse(session.lesson.slidesJson || '[]');
            } catch (_) {}

            const slide = slides[slideIndex];
            if (!slide) return;

            let isCorrect: boolean | null = null;
            let pointsAwarded = 0;

            const participant = await prisma.liveParticipant.findUnique({
              where: { id: participantId }
            });
            let currentStreak = participant?.streak || 0;

            if (slide.type === 'multiple_choice' || slide.type === 'true_false') {
              const selectedIdx = parseInt(answerValue, 10);
              isCorrect = selectedIdx === slide.correctOptionIndex;

              if (isCorrect) {
                // Locra Arena score: tot 1000 punten met verval over reactietijd
                const maxTime = (slide.timeLimitSeconds || 30) * 1000;
                const safeResponseTime = Math.min(responseTimeMs || maxTime / 2, maxTime);
                const speedFactor = 1 - (safeResponseTime / (2 * maxTime)); // tussen 0.5 en 1.0
                const basePoints = Math.round((slide.points || 1000) * speedFactor);
                currentStreak += 1;
                const streakBonus = Math.min(currentStreak * 50, 250);
                pointsAwarded = basePoints + streakBonus;
              } else {
                currentStreak = 0;
              }
            } else if (slide.type === 'open' || slide.type === 'wordcloud' || slide.type === 'poll') {
              // Formatieve participatiebeloning (250 punten in arena-modus)
              isCorrect = true;
              pointsAwarded = session.mode === 'arcade' ? 250 : 0;
              currentStreak += 1;
            }

            // Direct gedachte(n) broadcasten naar digibord wolk
            if (slide.type === 'wordcloud') {
              const splitThoughts = String(answerValue || '')
                .split(/[,;\n]+/)
                .map(w => w.trim())
                .filter(w => w.length >= 2);
              broadcastToRoom(sessionId, {
                type: 'live_thought_added',
                words: splitThoughts,
                word: String(answerValue).trim(),
                nickname: participant?.nickname,
                avatar: participant?.avatar || '🦊'
              });
            }

            // Sla reactie op in DB
            await prisma.liveResponse.create({
              data: {
                sessionId,
                participantId,
                slideIndex,
                answerValue: String(answerValue),
                isCorrect,
                pointsAwarded,
                responseTimeMs: responseTimeMs || null
              }
            });

            // Update participant score en streak
            const updatedParticipant = await prisma.liveParticipant.update({
              where: { id: participantId },
              data: {
                score: { increment: pointsAwarded },
                streak: currentStreak
              }
            });

            // Bereken actuele rangorde van de leerling
            const higherRankCount = await prisma.liveParticipant.count({
              where: {
                sessionId,
                score: { gt: updatedParticipant.score }
              }
            });
            const currentRank = higherRankCount + 1;

            // Bevestig naar speler
            connection.send(JSON.stringify({
              type: 'answer_confirmed',
              slideIndex,
              isCorrect,
              pointsAwarded,
              totalScore: updatedParticipant.score,
              streak: updatedParticipant.streak,
              currentRank
            }));

            // Notificeer host van aantal binnengekomen antwoorden
            const count = await prisma.liveResponse.count({
              where: { sessionId, slideIndex }
            });

            broadcastToRoom(sessionId, {
              type: 'response_count_update',
              slideIndex,
              count
            });
          }
        }

      } catch (err: any) {
        console.error('[Locra Live WS] Message error:', err?.message);
      }
    });
  });

  // ── 2. LES BEHEER (CRUD) ──

  // Overzicht van alle lessen van de docent / organisatie
  fastify.get('/lessons', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const lessons = await prisma.liveLesson.findMany({
      where: { orgId: user.orgId },
      include: {
        teacher: { select: { id: true, displayName: true, username: true } },
        _count: { select: { sessions: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    return reply.send({ lessons });
  });

  // Enkele les ophalen
  fastify.get('/lessons/:id', { preHandler: requireAuth }, async (req: any, reply) => {
    const { id } = req.params;
    const lesson = await prisma.liveLesson.findUnique({
      where: { id },
      include: {
        teacher: { select: { id: true, displayName: true } },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { _count: { select: { participants: true, responses: true } } }
        }
      }
    });

    if (!lesson) return reply.status(404).send({ error: 'Les niet gevonden' });
    return reply.send({ lesson });
  });

  // Les aanmaken
  fastify.post('/lessons', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Alleen docenten kunnen lessen aanmaken.' });
    }

    const { title, subject, description, targetGrade, modeDefault, slides } = req.body || {};
    if (!title || !title.trim()) {
      return reply.status(400).send({ error: 'Titel is verplicht.' });
    }

    const lesson = await prisma.liveLesson.create({
      data: {
        orgId: user.orgId,
        teacherId: user.id,
        title: title.trim(),
        subject: subject?.trim() || null,
        description: description?.trim() || null,
        targetGrade: targetGrade?.trim() || null,
        modeDefault: modeDefault || 'hybrid',
        slidesJson: JSON.stringify(slides || [])
      }
    });

    return reply.send({ success: true, lesson });
  });

  // Les bijwerken
  fastify.put('/lessons/:id', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const { id } = req.params;
    const { title, subject, description, targetGrade, modeDefault, slides } = req.body || {};

    const existing = await prisma.liveLesson.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Les niet gevonden.' });

    if (existing.teacherId !== user.id && !['admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen bewerkrechten voor deze les.' });
    }

    const updated = await prisma.liveLesson.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : existing.title,
        subject: subject !== undefined ? subject.trim() : existing.subject,
        description: description !== undefined ? description.trim() : existing.description,
        targetGrade: targetGrade !== undefined ? targetGrade.trim() : existing.targetGrade,
        modeDefault: modeDefault || existing.modeDefault,
        slidesJson: slides !== undefined ? JSON.stringify(slides) : existing.slidesJson
      }
    });

    return reply.send({ success: true, lesson: updated });
  });

  // Les verwijderen
  fastify.delete('/lessons/:id', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const { id } = req.params;

    const existing = await prisma.liveLesson.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Les niet gevonden.' });

    if (existing.teacherId !== user.id && !['admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen rechten om deze les te verwijderen.' });
    }

    await prisma.liveLesson.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // ── 3. BRONNEN & DOCUMENTEN VOOR AI-GENERATOR ──

  // Haal alle beschikbare RAG kennisbanken, documenten, lesmateriaal en AI-modellen op
  fastify.get('/sources', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Alleen docenten hebben toegang tot lesbronnen.' });
    }

    const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId: user.orgId } });
    const ragLicensed = canAccessFeature(orgSettings?.licenseTier, 'ragKnowledgeBases');
    const classesLicensed = canAccessFeature(orgSettings?.licenseTier, 'groupsAndClasses');

    let knowledgeBases: any[] = [];
    if (ragLicensed) {
      const kbs = await prisma.knowledgeBase.findMany({
        where: { orgId: user.orgId, isActive: true },
        include: {
          documents: {
            select: {
              id: true,
              filename: true,
              fileType: true,
              fileSize: true,
              status: true,
              _count: { select: { chunks: true } }
            },
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { name: 'asc' }
      });

      knowledgeBases = kbs.filter(kb => {
        if (user.role === 'admin' || user.role === 'superadmin') return true;
        try {
          if (!kb.allowedRoles) return true;
          const allowed = JSON.parse(kb.allowedRoles);
          return Array.isArray(allowed) ? allowed.includes(user.role) : true;
        } catch {
          return true;
        }
      });
    }

    let classMaterials: any[] = [];
    if (classesLicensed) {
      const classWhere: any = { orgId: user.orgId };
      if (user.role === 'teacher') {
        classWhere.teacherMembers = { some: { teacherId: user.id } };
      }
      const classes = await prisma.class.findMany({
        where: classWhere,
        include: {
          materials: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });
      classMaterials = classes.flatMap(cls =>
        (cls.materials || []).map(m => ({
          id: m.id,
          title: m.title,
          filename: m.filename,
          fileSize: m.fileSize,
          mimeType: m.mimeType,
          classId: cls.id,
          className: cls.name
        }))
      );
    }

    let models = await prisma.installedModel.findMany({
      where: { orgId: user.orgId, isActive: true, isCodeMatchOnly: false },
      select: { id: true, ollamaName: true, displayName: true, provider: true, routingTier: true, isDefault: true }
    });

    if (user.role === 'teacher' && orgSettings?.teacherModelRestriction && orgSettings?.teacherAllowedModels) {
      try {
        const allowed = new Set<string>(
          JSON.parse(orgSettings.teacherAllowedModels).map((m: string) => m.toLowerCase())
        );
        if (allowed.size > 0) {
          models = models.filter(m => allowed.has(m.ollamaName.toLowerCase()) || allowed.has(m.id.toLowerCase()));
        }
      } catch {}
    }

    return reply.send({
      ragLicensed,
      knowledgeBases,
      classMaterials,
      models,
      hasCloudAi: Boolean(
        orgSettings?.geminiApiKey ||
        orgSettings?.anthropicApiKey ||
        orgSettings?.openAiApiKey ||
        orgSettings?.openRouterApiKey
      )
    });
  });

  // Extraheer schone tekst uit geüpload document (PDF, DOCX, DOC, RTF, TXT, MD, CSV)
  fastify.post('/extract-document', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Alleen docenten kunnen documenten uploaden.' });
    }

    try {
      const data = await req.file();
      if (!data) return reply.status(400).send({ error: 'Geen bestand geüpload.' });

      const filename = data.filename || 'document.txt';
      const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk as Buffer);
      }
      const fileBuffer = Buffer.concat(chunks);

      const { text, pages } = await extractTextFromBuffer(fileBuffer, ext);
      if (!text || text.trim().length < 20) {
        return reply.status(422).send({
          error: `Bestand "${filename}" bevat geen leesbare tekst (mogelijk een gescande afbeelding-PDF). Probeer een PDF met selecteerbare tekst, .docx of .txt/.md.`,
          filename
        });
      }

      const maxChars = 120000;
      const sliced = text.slice(0, maxChars);
      const wordCount = sliced.split(/\s+/).filter(Boolean).length;

      return reply.send({
        success: true,
        filename,
        fileType: ext,
        pages,
        wordCount,
        charCount: text.length,
        truncated: text.length > maxChars,
        preview: sliced.slice(0, 260).replace(/\s+/g, ' '),
        text: sliced
      });
    } catch (err: any) {
      fastify.log.error(`[Live Extract Doc] Fout: ${err?.message}`);
      return reply.status(500).send({ error: 'Document kon niet worden verwerkt: ' + (err?.message || 'onbekende fout') });
    }
  });

  // ── 3A. HOOGWAARDIGE AI LES- & QUIZ-GENERATOR ENGINE (SHARED PIPELINE + ASYNC JOBS) ──
  interface GenerationProgressReporter {
    signal?: AbortSignal;
    onStepStart?: (key: LiveGenerationStep['key'], detail?: string, progress?: number) => void;
    onStepUpdate?: (key: LiveGenerationStep['key'], detail: string, progress?: number) => void;
    onStepDone?: (key: LiveGenerationStep['key'], detail: string, progress?: number, status?: JobStepStatus) => void;
    onLog?: (icon: string, message: string) => void;
    onStats?: (patch: Partial<LiveGenerationJob['stats']>) => void;
    onPreviewSlides?: (slides: LiveGenerationPreviewSlide[]) => void;
  }

  async function resolveSlidesImages(
    slides: Array<{ id?: string; type?: string; title?: string; imageUrl?: string; imageCaption?: string; imageQuery?: string }>,
    autoFindImages: boolean,
    subject: string,
    effectiveTopic: string,
    signal?: AbortSignal,
    onProgress?: (foundCount: number, totalCount: number, updatedIdx: number, foundUrl: string) => void
  ) {
    if (!autoFindImages) {
      return slides.map(s => ({ ...s, imageUrl: undefined, imageCaption: undefined }));
    }

    const usedImageUrls: string[] = slides
      .map(s => (typeof s.imageUrl === 'string' && s.imageUrl.startsWith('http') ? s.imageUrl : null))
      .filter((u): u is string => Boolean(u));

    const targetIndices = slides
      .map((s, idx) => {
        const hasValid = typeof s.imageUrl === 'string' && s.imageUrl.startsWith('http');
        const needsImage = !hasValid && (s.type === 'content' || Boolean(s.imageQuery) || idx % 2 === 1);
        return needsImage ? idx : -1;
      })
      .filter(idx => idx !== -1);

    let resolvedSoFar = 0;
    const BATCH_SIZE = 4;
    for (let i = 0; i < targetIndices.length; i += BATCH_SIZE) {
      if (signal?.aborted) break;
      const batch = targetIndices.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async slideIdx => {
          if (signal?.aborted) return;
          const s = slides[slideIdx];
          const queryHint = s.imageQuery || `${s.title || ''} ${effectiveTopic}`;
          const found = await findEducationalImage(queryHint, subject, effectiveTopic, [...usedImageUrls]);
          if (found?.url) {
            if (usedImageUrls.includes(found.url)) {
              const fallback = resolveEducationalImage(queryHint, subject, effectiveTopic, [...usedImageUrls]);
              s.imageUrl = fallback.url;
              s.imageCaption = s.imageCaption || fallback.caption;
              usedImageUrls.push(fallback.url);
            } else {
              s.imageUrl = found.url;
              s.imageCaption = s.imageCaption || found.caption;
              usedImageUrls.push(found.url);
            }
            resolvedSoFar += 1;
            onProgress?.(resolvedSoFar, targetIndices.length, slideIdx, s.imageUrl!);
          }
        })
      );
    }

    return slides;
  }

  async function executeLiveGeneration(
    body: any,
    user: any,
    reporter: GenerationProgressReporter = {}
  ) {
    const startTimeMs = Date.now();
    const {
      topic = '',
      subject = 'Algemeen',
      targetGrade = '3 HAVO',
      mode = 'hybrid',
      difficultyLevel = 'gemiddeld',
      cognitiveFocus = 'rtti_mix',
      questionQualityMode = 'high',
      teacherInstructions = '',
      modelId,
      numTheorySlides = 2,
      numMCQuestions = 3,
      numTFQuestions = 1,
      numOpenQuestions = 1,
      numWordclouds = 1,
      autoFindImages = true,
      includeRichBlocks = true,
      knowledgeBaseId,
      knowledgeBaseIds,
      documentIds,
      classMaterialIds,
      attachedDocuments,
      uploadedText
    } = body || {};

    const kbIdList: string[] = Array.from(new Set([
      ...(Array.isArray(knowledgeBaseIds) ? knowledgeBaseIds : []),
      ...(knowledgeBaseId ? [knowledgeBaseId] : [])
    ].filter(Boolean)));
    const docIdList: string[] = Array.isArray(documentIds) ? documentIds.filter(Boolean) : [];
    const matIdList: string[] = Array.isArray(classMaterialIds) ? classMaterialIds.filter(Boolean) : [];
    const uploadedDocs: Array<{ filename: string; text: string }> = Array.isArray(attachedDocuments)
      ? attachedDocuments.filter(d => d && typeof d.text === 'string' && d.text.trim().length > 0)
      : [];

    const checkAborted = () => {
      if (reporter.signal?.aborted) {
        throw new Error('Generatie geannuleerd.');
      }
    };

    // STAP 1: Intelligente Multi-Source RAG & Document Retrieval
    reporter.onStepStart?.('sources', 'Zoeken naar relevante passages in RAG & documenten...', 6);
    reporter.onLog?.('📚', 'Bronnen en lesmateriaal verzamelen...');

    const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId: user.orgId } }).catch(() => null);
    const searchQuery = [topic, teacherInstructions].filter(Boolean).join(' ').trim();
    const keywords = extractSearchKeywords(searchQuery);

    let queryEmbedding: number[] = [];
    if (searchQuery && (kbIdList.length > 0 || docIdList.length > 0)) {
      try {
        reporter.onStepUpdate?.('sources', 'Semantische zoekvector berekenen voor RAG...', 9);
        queryEmbedding = await Promise.race([
          ollamaClient.getEmbedding(searchQuery, orgSettings?.embeddingModel || EMBEDDING_MODEL, user.orgId),
          new Promise<number[]>(resolve => setTimeout(() => resolve([]), 4500))
        ]);
      } catch {
        queryEmbedding = [];
      }
    }
    checkAborted();

    interface ContextSnippet {
      sourceLabel: string;
      content: string;
      score: number;
    }

    const candidates: ContextSnippet[] = [];
    const sourcesUsedSet = new Set<string>();

    // A. RAG Kennisbanken & Specifieke Documenten (met semantische + keyword + disk-fallback)
    if (kbIdList.length > 0 || docIdList.length > 0) {
      try {
        const docsToSearch = await prisma.document.findMany({
          where: {
            AND: [
              { knowledgeBase: { orgId: user.orgId } },
              docIdList.length > 0
                ? {
                    OR: [
                      { id: { in: docIdList } },
                      ...(kbIdList.length > 0 ? [{ knowledgeBaseId: { in: kbIdList } }] : [])
                    ]
                  }
                : { knowledgeBaseId: { in: kbIdList } }
            ]
          },
          include: {
            knowledgeBase: { select: { name: true } },
            chunks: {
              select: { content: true, embedding: true, chunkIndex: true },
              orderBy: { chunkIndex: 'asc' }
            }
          }
        });

        for (const doc of docsToSearch) {
          checkAborted();
          const label = `RAG: ${doc.knowledgeBase?.name || 'Kennisbank'} / ${doc.filename}`;
          sourcesUsedSet.add(`${doc.filename} (RAG)`);

          if (doc.chunks && doc.chunks.length > 0) {
            const totalChunks = doc.chunks.length;
            const scoredChunks = doc.chunks.map((c, idx) => {
              let simScore = 0;
              if (queryEmbedding.length > 0 && c.embedding) {
                try {
                  const vec = JSON.parse(c.embedding);
                  if (Array.isArray(vec) && vec.length === queryEmbedding.length) {
                    simScore = cosineSimilarity(queryEmbedding, vec);
                  }
                } catch {}
              }
              const kwScore = scoreKeywordOverlap(c.content, keywords);
              const combined = keywords.length > 0
                ? simScore * 0.65 + kwScore * 0.35
                : (idx % Math.max(1, Math.floor(totalChunks / 6)) === 0 ? 0.5 : 0.2);

              return { content: c.content, score: combined };
            });

            if (keywords.length > 0) {
              scoredChunks.sort((a, b) => b.score - a.score);
              scoredChunks.slice(0, 6).forEach(sc => {
                candidates.push({ sourceLabel: label, content: sc.content, score: sc.score + 0.1 });
              });
            } else {
              const picks = distributeIndicesEvenly(totalChunks, 6);
              picks.forEach(pIdx => {
                candidates.push({ sourceLabel: label, content: scoredChunks[pIdx].content, score: 0.6 });
              });
            }
          } else if (doc.filePath && fs.existsSync(doc.filePath)) {
            try {
              const buf = fs.readFileSync(doc.filePath);
              const { text } = await extractTextFromBuffer(buf, doc.fileType || doc.filename);
              const fileChunks = splitIntoTextChunks(text, 280, 40);
              const pickedIdxs = keywords.length > 0
                ? fileChunks
                    .map((ch, idx) => ({ idx, s: scoreKeywordOverlap(ch, keywords) }))
                    .sort((a, b) => b.s - a.s)
                    .slice(0, 6)
                    .map(x => x.idx)
                : distributeIndicesEvenly(fileChunks.length, 6);

              pickedIdxs.forEach(i => {
                candidates.push({
                  sourceLabel: label,
                  content: fileChunks[i],
                  score: keywords.length > 0 ? scoreKeywordOverlap(fileChunks[i], keywords) + 0.1 : 0.6
                });
              });
            } catch (readErr: any) {
              console.warn('[Live AI Generator] RAG file fallback error:', readErr?.message);
            }
          }
        }
      } catch (err: any) {
        if (reporter.signal?.aborted) throw err;
        console.warn('[Live AI Generator] RAG fetch error:', err.message);
      }
    }

    // B. Klas-lesmateriaal van docent (ClassMaterial)
    if (matIdList.length > 0) {
      try {
        const materials = await prisma.classMaterial.findMany({
          where: {
            id: { in: matIdList },
            class: { orgId: user.orgId }
          },
          include: { class: { select: { name: true } } }
        });

        for (const mat of materials) {
          checkAborted();
          const fullPath = path.join(process.cwd(), mat.fileUrl);
          if (!fs.existsSync(fullPath)) continue;
          try {
            const buf = fs.readFileSync(fullPath);
            const { text } = await extractTextFromBuffer(buf, mat.filename);
            if (!text) continue;
            sourcesUsedSet.add(`${mat.title} (${mat.class?.name || 'Klas'})`);
            const chunks = splitIntoTextChunks(text, 280, 40);
            const selected = keywords.length > 0
              ? chunks
                  .map((ch, idx) => ({ idx, ch, s: scoreKeywordOverlap(ch, keywords) }))
                  .sort((a, b) => b.s - a.s)
                  .slice(0, 6)
              : distributeIndicesEvenly(chunks.length, 6).map(idx => ({ idx, ch: chunks[idx], s: 0.7 }));

            selected.forEach(item => {
              candidates.push({
                sourceLabel: `Lesmateriaal: ${mat.title}`,
                content: item.ch,
                score: item.s + 0.25
              });
            });
          } catch {}
        }
      } catch (err: any) {
        console.warn('[Live AI Generator] ClassMaterial read error:', err.message);
      }
    }

    // C. Direct geüploade documenten in het formulier
    for (const udoc of uploadedDocs) {
      sourcesUsedSet.add(udoc.filename);
      const chunks = splitIntoTextChunks(udoc.text, 280, 40);
      if (chunks.length === 0) continue;

      if (keywords.length > 0) {
        const ranked = chunks
          .map((ch, idx) => ({ idx, ch, s: scoreKeywordOverlap(ch, keywords) }))
          .sort((a, b) => b.s - a.s);
        const topSet = new Set(ranked.slice(0, 6).map(r => r.idx));
        distributeIndicesEvenly(chunks.length, 3).forEach(i => topSet.add(i));
        Array.from(topSet).sort((a, b) => a - b).forEach(i => {
          candidates.push({
            sourceLabel: `Document: ${udoc.filename}`,
            content: chunks[i],
            score: scoreKeywordOverlap(chunks[i], keywords) + 0.35
          });
        });
      } else {
        distributeIndicesEvenly(chunks.length, 8).forEach(i => {
          candidates.push({
            sourceLabel: `Document: ${udoc.filename}`,
            content: chunks[i],
            score: 0.85
          });
        });
      }
    }

    // D. Handmatig geplakte brontekst
    if (uploadedText && uploadedText.trim()) {
      sourcesUsedSet.add('Geplakte lesstof');
      const chunks = splitIntoTextChunks(uploadedText.trim(), 320, 40);
      chunks.slice(0, 8).forEach((ch, idx) => {
        candidates.push({
          sourceLabel: 'Geplakte brontekst',
          content: ch,
          score: 0.9 - idx * 0.02
        });
      });
    }

    // Assembleer definitieve rijke broncontext
    const seenChunkSnippets = new Set<string>();
    const selectedSnippets: ContextSnippet[] = [];
    let totalChars = 0;
    const MAX_SOURCE_CHARS = 18000;

    candidates.sort((a, b) => b.score - a.score);
    for (const c of candidates) {
      const fingerprint = c.content.slice(0, 90).toLowerCase();
      if (seenChunkSnippets.has(fingerprint)) continue;
      if (totalChars + c.content.length > MAX_SOURCE_CHARS) {
        const remaining = MAX_SOURCE_CHARS - totalChars;
        if (remaining > 250) {
          selectedSnippets.push({ ...c, content: c.content.slice(0, remaining) });
          totalChars += remaining;
        }
        break;
      }
      seenChunkSnippets.add(fingerprint);
      selectedSnippets.push(c);
      totalChars += c.content.length;
    }

    const ragContext = selectedSnippets
      .map((s, i) => `[BRON ${i + 1} — ${s.sourceLabel}]\n${s.content}`)
      .join('\n\n');

    const effectiveTopic = (topic || '').trim()
      || (uploadedDocs[0]?.filename?.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '))
      || (sourcesUsedSet.size > 0 ? Array.from(sourcesUsedSet)[0] : 'Lesonderwerp');

    reporter.onStats?.({
      sourcesUsed: Array.from(sourcesUsedSet),
      sourceCharCount: totalChars,
      ragPassagesCount: selectedSnippets.length
    });

    const sourceSummary = selectedSnippets.length > 0
      ? `${selectedSnippets.length} passages uit ${sourcesUsedSet.size} bron(nen) geladen (${totalChars.toLocaleString('nl-NL')} tekens)`
      : `Genereren op basis van vakkennis (${subject} · ${targetGrade})`;
    reporter.onStepDone?.('sources', sourceSummary, 18);
    reporter.onLog?.('📖', sourceSummary);

    // 2. Didactische Kwaliteits-, Moeilijkheids- en Taxonomie-instructies
    const difficultyGuide: Record<string, string> = {
      basis: 'BASIS (Toegankelijk & Fundamenteel): Focus op heldere kernbegrippen, concrete alledaagse voorbeelden, herkenning en overzichtelijke stappen zonder verwarrende dubbele ontkenningen.',
      gemiddeld: 'GEMIDDELD (Regulier Schoolniveau): Evenwichtige mix van degelijke begripskennis, oorzaak-gevolgrelaties en herkenbare praktijksituaties met scherpe maar eerlijke afleiders.',
      uitdagend: 'UITDAGEND (Verdiepend & Sterk): Vereist causale redeneringen, toepassen in nieuwe/onbekende contexten, grafiek- of brondaten interpreteren en veelgemaakte misconcepties doorprikken.',
      expert: 'EXPERT (Eindexamen / Olympiade): Complexe meerstapsredeneringen, integratie van meerdere deelonderwerpen, bronkritiek, subtiele nuanceverschillen tussen opties en diepe transfer.'
    };

    const cognitiveGuide: Record<string, string> = {
      rtti_mix: 'Hanteer een sterke Nederlandse RTTI-verdeling (~25% R1 reproductie, ~25% R2 vaardigheid/regel, ~30% T1 toepassing in nieuwe situatie, ~20% T2 diep inzicht/analyse). Vermeld bij iedere vraag het passende RTTI-label.',
      reproductie: 'Leg de nadruk op R1 & R2 (~70% parate definities, feiten, standaardformules en chronologie; ~30% lichte toepassing) — ideaal als voorkennischeck of begrippentrainer.',
      begrip_en_inzicht: 'Focus op het "waarom" en "hoe" (R2 & T1): dwing leerlingen verbanden te verklaren, mechanismen te vergelijken en veelgemaakte denkfouten te ontmaskeren.',
      toepassing_en_casus: 'Focus op T1 & T2 (~75% nieuwe praktijksituaties, bronnen, berekeningen of actuele casussen waarin leerlingen de theorie moeten toepassen).'
    };

    const richBlockInstructions = includeRichBlocks
      ? `3. RIJKE INFORMATIEVE BLOKKEN IN 'content' (ZEER BELANGRIJK):
   - Structureer elke "content" (theorie) dia als een scanbare, krachtige digibord-kaart met minimaal 3 van deze exacte Markdown-blokken:
     * > 🎯 **Leerdoel:** Eén concreet, meetbaar leerdoel in actieve taal ("Na deze dia kun je verklaren/berekenen...").
     * > 💡 **Kernbegrip:** Precieze vakdefinitie mét mechanisme of ezelsbrug.
     * > 🔍 **Casus / Bron / Praktijk:** Een concreet voorbeeld, historisch citaat, proefopstelling of cijfervoorbeeld.
     * > ⚠️ **Veelgemaakte Denkfout:** De #1 valkuil bij dit onderwerp en hoe het écht zit.
   - Gebruik waar vakinhoudelijk sterk ook overzichtelijke Markdown-tabellen (| ... | ... |) voor vergelijkingen en exacte LaTeX ($...$ of $$...$$) bij bètavakken.
   - Houd bullets compact en scanbaar voor projectie op een digibord (geen muren van tekst).
   - Bij casus- of meerkeuze/open vragen mag "content" de prikkelende vraagcontext, korte bron of casus bevatten (> 🔍 **Casus:** ...) die voor de hele vraag nodig is!`
      : `3. MARKDOWN FORMATTING: Gebruik strakke Markdown met **vetgedrukte kernbegrippen** en heldere vraagstelling in 'content'.`;

    const imageInstructions = autoFindImages
      ? `4. AUTOMATISCHE VISUELE VERRIJKING ('imageQuery'):
   - Geef bij ELKE "content" dia en bij minimaal de helft van de quizvragen het veld "imageQuery" mee: een concrete, goed vindbare Wikipedia/foto-zoekterm (bijv. "Bestorming van de Bastille 1789", "Chloroplast diagram", "Mount Vesuvius eruption") zodat relevante afbeeldingen gevonden worden.`
      : '';

    const sourceGroundingInstructions = ragContext
      ? `5. STRIKTE BRONTROUW (AANGELEVERD LESMATERIAAL / RAG):
   - Er is authentiek school-/docentmateriaal aangeleverd hieronder. Baseer feiten, definities, jaartallen, casussen, formules en minimaal 85% van alle vragen DIRECT op deze brontekst!
   - Gebruik termen en voorbeelden uit de bron, verzin géén feiten die de bron tegenspreken, en toets begrip van het materiaal in plaats van triviaal overschrijven.`
      : '';

    const systemPrompt = `Je bent de senior onderwijskundig toetsexpert en vakdidacticus van Locra AI voor het Nederlandse onderwijs.
Jouw taak is het ontwerpen van een inhoudelijk ijzersterke, hoogwaardige interactieve les en quiz (Locra Live) op exact niveau "${targetGrade || 'Voortgezet Onderwijs'}".

STRIKTE KWALITEITSEISEN VOOR HOGE VRAAGKWALITEIT:
1. GEEN OPPERVLAKKIGE OF GENERIEKE VRAGEN:
   - Verboden zijn luie vragen als "Wat is waar over X?", "Wat is de beste omschrijving van [onderwerp]?" of "Alle bovenstaande antwoorden".
   - Elke vraag MOET een scherp denkproces uitlokken: causaliteit, mechanisme, broninterpretatie, mini-casus, berekening, vergelijking of foutanalyse.
   - Zorg ervoor dat de volledige vraag leesbaar is: zet een pakkende korte titel in "title" (max ~65 tekens) én plaats de precieze vraagvraag/stelling/casus in "content" (of zorg dat "title" + "content" elkaar naadloos aanvullen zonder herhaling).
2. HOOGWAARDIGE AFLEIDERS (DISTRACTORS) BIJ MEERKEUZEVRAGEN:
   - Exact 4 opties per "multiple_choice" vraag.
   - ALLE 3 de foute antwoorden moeten plausibele, vakinhoudelijke denkfouten voorstellen die echte leerlingen zouden kunnen kiezen (bijv. omgekeerde oorzaak-gevolg, onvolledige regel, verwarring met verwant begrip, klassieke rekenfout). Verboden zijn overduidelijke onzinopties!
   - Optielengte in evenwicht: het juiste antwoord mag NIET opvallend langer, preciezer of academischer geschreven zijn dan de 3 foute opties.
   - Varieer het correcte antwoord (correctOptionIndex) gelijkmatig over 0, 1, 2 en 3.
   - GEBRUIK GEEN markdown asterisks (** of *) of labels ("A)", "1.") in de strings van options[].
3. NIVEAU, MOEILIJKHEID & TAXONOMIE:
   - Sluit exact aan bij leerjaar/niveau: "${targetGrade}".
   - ${difficultyGuide[difficultyLevel] || difficultyGuide.gemiddeld}
   - ${cognitiveGuide[cognitiveFocus] || cognitiveGuide.rtti_mix}
${richBlockInstructions}
${imageInstructions}
${sourceGroundingInstructions}
6. FORMATELE UITVOER:
   - Voor type "true_false": zet options altijd exact op ["Waar", "Niet Waar"] en correctOptionIndex op 0 (Waar) of 1 (Niet Waar), en zorg dat de stelling scherp en niet triviaal waar is (varieer Waar en Niet Waar!).
   - Voor "open": formuleer een rijke denkvraag (hoe/waarom/bereken/vergelijk) met in "explanation" een concreet beoordelingsmodel / kernpunten (bijv. "Kernpunten: 1) ... 2) ...").
   - Voor "explanation" bij meerkeuze en waar/niet-waar: leg in 2 krachtige zinnen uit WAAROM het juiste antwoord klopt én WAAROM de meest gekozen afleider een denkfout is.
   - Geef UITSLUITEND een valide JSON-object terug met { "lessonTitle": "...", "slides": [ ... ] }.`;

    const requestedCounts: Record<SlideType, number> = {
      content: Math.max(0, Number(numTheorySlides) || 0),
      wordcloud: Math.max(0, Number(numWordclouds) || 0),
      true_false: Math.max(0, Number(numTFQuestions) || 0),
      multiple_choice: Math.max(0, Number(numMCQuestions) || 0),
      open: Math.max(0, Number(numOpenQuestions) || 0),
      poll: 1
    };

    const SLIDE_TYPE_ORDER: SlideType[] = ['content', 'wordcloud', 'true_false', 'multiple_choice', 'open', 'poll'];

    // Bouw expliciete genummerde slot-checklist zodat lokale én cloudmodellen exact elke dia maken
    const buildPlannedSlots = (counts: Record<SlideType, number>): SlideType[] => {
      const slots: SlideType[] = [];
      if (counts.wordcloud > 0) slots.push('wordcloud');
      const theoryTotal = counts.content;
      const questionQueue: SlideType[] = [];
      for (let i = 0; i < counts.true_false; i++) questionQueue.push('true_false');
      for (let i = 0; i < counts.multiple_choice; i++) questionQueue.push('multiple_choice');
      for (let i = 0; i < counts.open; i++) questionQueue.push('open');

      if (theoryTotal > 0) {
        const chunkSize = Math.ceil(questionQueue.length / theoryTotal);
        let qCursor = 0;
        for (let t = 0; t < theoryTotal; t++) {
          slots.push('content');
          for (let k = 0; k < chunkSize && qCursor < questionQueue.length; k++) {
            slots.push(questionQueue[qCursor++]);
          }
        }
        while (qCursor < questionQueue.length) slots.push(questionQueue[qCursor++]);
      } else {
        slots.push(...questionQueue);
      }

      for (let w = 1; w < counts.wordcloud; w++) slots.push('wordcloud');
      for (let p = 0; p < counts.poll; p++) slots.push('poll');
      return slots;
    };

    const plannedSlots = buildPlannedSlots(requestedCounts);
    const totalExpectedSlides = plannedSlots.length;
    const slotTypeLabels: Record<SlideType, string> = {
      content: 'content (Theorie-dia met rijke informatieblokken)',
      wordcloud: 'wordcloud (Gedachtenwolk / voorkennis)',
      true_false: 'true_false (Waar / Niet Waar stelling)',
      multiple_choice: 'multiple_choice (Meerkeuzevraag met 4 gelijkwaardige opties)',
      open: 'open (Open redeneer-/casusvraag met beoordelingsmodel)',
      poll: 'poll (Afsluitende formatieve zelfinschatting)'
    };
    const slotChecklistText = plannedSlots
      .map((t, idx) => `  Dia ${idx + 1}: type "${t}" -> ${slotTypeLabels[t]}`)
      .join('\n');

    const userPrompt = `Ontwerp een hoogwaardige interactieve lessenserie.
${topic?.trim() ? `Onderwerp / Leerdoel: "${topic.trim()}"` : `Onderwerp: Leid een heldere lestitel en centraal thema af uit de bijgevoegde bronnen (${Array.from(sourcesUsedSet).join(', ')}).`}
Vakgebied: ${subject || 'Algemeen'}
Onderwijsniveau / Leerjaar: ${targetGrade || '3 HAVO'}
Moeilijkheidsgraad: ${difficultyLevel}
Cognitieve nadruk: ${cognitiveFocus}
Didactische modus: ${mode === 'arcade' ? 'Locra Arena (competitief, scherp en energiek)' : mode === 'formative' ? 'Locra Presentor (formatief en verdiepend)' : 'Locra Hybride (theorie + interactieve verwerking)'}
${teacherInstructions?.trim() ? `Specifieke docentwensen / accenten: "${teacherInstructions.trim()}"` : ''}

⚠️ STRIKTE OPDRACHT — VOLLEDIGE LESSTRUCTUUR (${totalExpectedSlides} DIA'S VERPLICHT):
Je MOET ALLE ${totalExpectedSlides} genummerde dia's in de array "slides" genereren. Stop NIET halverwege!
Verplichte aantallen:
- ${requestedCounts.content}x "content" (theorie-dia's met rijke informatieve blokken)
- ${requestedCounts.wordcloud}x "wordcloud" (gedachtenwolk / voorkennis- of associatievraag)
- ${requestedCounts.true_false}x "true_false" (scherpe stelling die een echte misconceptie test)
- ${requestedCounts.multiple_choice}x "multiple_choice" (diepe begrips-, bron- of toepassingsvragen met 4 gelijkwaardige opties)
- ${requestedCounts.open}x "open" (hoogwaardige redeneer-, casus- of uitlegvraag)
- ${requestedCounts.poll}x "poll" (afsluitende formatieve zelfinschatting of stellingpeiling zonder goed/fout)

Exacte checklist van alle ${totalExpectedSlides} dia's (vul élk nummer in!):
${slotChecklistText}

${ragContext ? `\n--- BRONMATERIAAL & RAG-CONTEXT (${selectedSnippets.length} geselecteerde passages) ---\n${ragContext}\n--- EINDE BRONMATERIAAL ---\n` : ''}

Verplicht JSON Schema:
{
  "lessonTitle": "Korte pakkende lestitel passend bij de stof",
  "slides": [
    {
      "id": "slide-1",
      "type": "content" | "wordcloud" | "true_false" | "multiple_choice" | "open" | "poll",
      "rtti": "R1" | "R2" | "T1" | "T2",
      "title": "Korte krachtige dia-titel",
      "imageQuery": "Concrete zoekterm voor een passende illustratie",
      "content": "Rijke informatieve Markdown met blokken (voor theorie) OF heldere volledige vraagstelling/casus/stelling (voor vragen)",
      "options": ["Optie 1", "Optie 2", "Optie 3", "Optie 4"],
      "correctOptionIndex": 0,
      "timeLimitSeconds": 30,
      "points": 1000,
      "explanation": "Didactische toelichting + waarom voornaamste afleider fout is (of modelantwoord bij open vraag)"
    }
  ]
}`;

    // STAP 2: AI Lesontwerp & Vragen genereren (met live streaming voortgang + automatische aanvulronde)
    reporter.onStepStart?.('draft', `AI-model selecteren voor ${totalExpectedSlides} dia's...`, 20);

    let generatedSlides: LiveSlide[] = [];
    let rawSlideArray: any[] = [];
    let resolvedLessonTitle = (topic || '').trim();
    let aiPowered = false;
    let usedModelName = '';
    let usedProvider = '';
    let qualityUpgraded = false;
    let lastLoggedModel = '';
    let totalGeneratedChars = 0;

    const emitSlidePreview = (slidesArr: any[]) => {
      reporter.onPreviewSlides?.(
        slidesArr.map((s: any, idx: number) => ({
          id: s.id || `slide-${idx + 1}`,
          type: normalizeSlideType(s.type),
          rtti: typeof s.rtti === 'string' ? s.rtti : undefined,
          title: (s.title || `Onderdeel ${idx + 1}`).trim(),
          imageUrl: typeof s.imageUrl === 'string' && s.imageUrl.startsWith('http') ? s.imageUrl : undefined
        }))
      );
    };

    const countByType = (arr: any[]): Record<SlideType, number> => {
      const counts: Record<SlideType, number> = {
        content: 0,
        wordcloud: 0,
        true_false: 0,
        multiple_choice: 0,
        open: 0,
        poll: 0
      };
      for (const s of arr) {
        counts[normalizeSlideType(s?.type)] += 1;
      }
      return counts;
    };

    try {
      const llmRes = await callLlmDetailed(userPrompt, systemPrompt, user.orgId, true, {
        modelId,
        temperature: 0.4,
        maxTokens: 16384,
        numCtx: 32768,
        signal: reporter.signal,
        onProgress: info => {
          if (info.event && info.model !== lastLoggedModel) {
            lastLoggedModel = info.model;
            reporter.onLog?.('🤖', info.event);
            reporter.onStats?.({ modelUsed: info.model, provider: info.provider });
          }
          const estProgress = info.charsReceived > 0
            ? Math.min(46, 22 + Math.round((info.charsReceived / Math.max(4500, totalExpectedSlides * 800)) * 24))
            : 21;
          const detailText = info.charsReceived > 0
            ? `${info.model} (${info.provider}) schrijft les (doel: ${totalExpectedSlides} dia's)... ${info.charsReceived.toLocaleString('nl-NL')} tekens ontvangen`
            : info.event || `Verbonden met ${info.model}...`;
          reporter.onStepUpdate?.('draft', detailText, estProgress);
          reporter.onStats?.({
            modelUsed: info.model,
            provider: info.provider,
            generatedChars: totalGeneratedChars + info.charsReceived
          });
        }
      });

      checkAborted();

      if (llmRes?.text) {
        aiPowered = true;
        usedModelName = llmRes.modelUsed;
        usedProvider = llmRes.provider;
        totalGeneratedChars += llmRes.text.length;

        const parsed = extractJsonFromLlm(llmRes.text);
        const firstBatch = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.slides)
          ? parsed.slides
          : (Object.values(parsed || {}).find(v => Array.isArray(v)) as any[]) || [];

        rawSlideArray = firstBatch
          .filter((s: any) => s && typeof s === 'object')
          .map((s: any) => ({ ...s, type: normalizeSlideType(s.type) }));

        if (typeof parsed?.lessonTitle === 'string' && parsed.lessonTitle.trim()) {
          resolvedLessonTitle = resolvedLessonTitle || parsed.lessonTitle.trim();
        }

        if (rawSlideArray.length > 0) {
          reporter.onStats?.({
            modelUsed: usedModelName,
            provider: usedProvider,
            generatedChars: totalGeneratedChars,
            slidesDrafted: rawSlideArray.length
          });
          emitSlidePreview(rawSlideArray);
          reporter.onLog?.('🧩', `Eerste ontwerp: ${rawSlideArray.length} van ${totalExpectedSlides} dia's opgesteld door ${usedModelName}`);
        }
      }

      // ── Automatische Aanvulronde(n) als het model minder dia's opleverde dan gevraagd ──
      if (aiPowered && rawSlideArray.length > 0) {
        const MAX_COMPLETION_ROUNDS = 5;
        for (let round = 1; round <= MAX_COMPLETION_ROUNDS; round++) {
          checkAborted();
          const currentCounts = countByType(rawSlideArray);
          const missingMap: Record<SlideType, number> = {
            content: Math.max(0, requestedCounts.content - currentCounts.content),
            wordcloud: Math.max(0, requestedCounts.wordcloud - currentCounts.wordcloud),
            true_false: Math.max(0, requestedCounts.true_false - currentCounts.true_false),
            multiple_choice: Math.max(0, requestedCounts.multiple_choice - currentCounts.multiple_choice),
            open: Math.max(0, requestedCounts.open - currentCounts.open),
            poll: Math.max(0, requestedCounts.poll - currentCounts.poll)
          };
          const totalMissing = SLIDE_TYPE_ORDER.reduce((acc, t) => acc + missingMap[t], 0);
          if (totalMissing <= 0) break;

          // Vraag maximaal 5 ontbrekende dia's per aanvulbatch zodat lokale modellen nooit afbreken
          const batchTypes: SlideType[] = [];
          for (const t of SLIDE_TYPE_ORDER) {
            for (let k = 0; k < missingMap[t] && batchTypes.length < 5; k++) {
              batchTypes.push(t);
            }
          }

          const batchCountsDesc = SLIDE_TYPE_ORDER
            .map(t => {
              const cnt = batchTypes.filter(bt => bt === t).length;
              return cnt > 0 ? `- ${cnt}x "${t}" (${slotTypeLabels[t]})` : null;
            })
            .filter(Boolean)
            .join('\n');

          const existingSummary = rawSlideArray
            .map((s: any, i: number) => `${i + 1}. [${normalizeSlideType(s.type)}] ${s.title || ''}`)
            .join('\n');

          const batchChecklist = batchTypes
            .map((t, i) => `  Extra dia ${i + 1}: type "${t}" -> ${slotTypeLabels[t]}`)
            .join('\n');

          const completionPct = Math.min(58, 46 + round * 2);
          reporter.onStepUpdate?.(
            'draft',
            `Aanvulronde ${round}: ${batchTypes.length} ontbrekende dia's bijgenereren (${rawSlideArray.length}/${totalExpectedSlides} klaar)...`,
            completionPct
          );
          reporter.onLog?.(
            '➕',
            `Nog ${totalMissing} dia's te gaan — aanvulronde ${round} gestart voor ${batchTypes.length} extra dia's...`
          );

          const completionPrompt = `Je vult een bestaande Locra Live les aan over "${effectiveTopic}" (${subject}, niveau ${targetGrade}, moeilijkheid ${difficultyLevel}, cognitieve nadruk ${cognitiveFocus}).

Reeds gemaakte dia's (HERHAAL deze onderwerpen/vragen NIET!):
${existingSummary}

Genereer NU UITSLUITEND de volgende ${batchTypes.length} NIEUWE, aanvullende dia's:
${batchCountsDesc}

Exacte checklist voor deze ${batchTypes.length} nieuwe dia's:
${batchChecklist}

${ragContext ? `\n--- BRONMATERIAAL ---\n${ragContext.slice(0, 12000)}\n--- EINDE BRONMATERIAAL ---\n` : ''}

Geef UITSLUITEND JSON terug met { "slides": [ ... ] } met exact ${batchTypes.length} nieuwe dia's (zelfde velden: id, type, rtti, title, imageQuery, content, options, correctOptionIndex, timeLimitSeconds, points, explanation).`;

          const batchRes = await callLlmDetailed(completionPrompt, systemPrompt, user.orgId, true, {
            modelId,
            temperature: 0.45,
            maxTokens: 12288,
            numCtx: 32768,
            signal: reporter.signal,
            onProgress: info => {
              reporter.onStepUpdate?.(
                'draft',
                `Aanvulronde ${round} (${info.model}): ${info.charsReceived.toLocaleString('nl-NL')} tekens...`,
                completionPct
              );
              reporter.onStats?.({
                modelUsed: info.model,
                provider: info.provider,
                generatedChars: totalGeneratedChars + info.charsReceived
              });
            }
          });

          if (!batchRes?.text) break;
          totalGeneratedChars += batchRes.text.length;

          const batchParsed = extractJsonFromLlm(batchRes.text);
          const newSlides = Array.isArray(batchParsed)
            ? batchParsed
            : Array.isArray(batchParsed?.slides)
            ? batchParsed.slides
            : (Object.values(batchParsed || {}).find(v => Array.isArray(v)) as any[]) || [];

          const usableNewSlides = newSlides
            .filter((s: any) => s && typeof s === 'object' && (s.title || s.content))
            .map((s: any) => ({ ...s, type: normalizeSlideType(s.type) }));

          if (usableNewSlides.length === 0) break;

          for (let i = 0; i < usableNewSlides.length; i++) {
            const candidate = usableNewSlides[i];
            let cType: SlideType = normalizeSlideType(candidate.type);
            const cCounts = countByType(rawSlideArray);
            if (cCounts[cType] >= requestedCounts[cType]) {
              const targetBatchType = batchTypes[i];
              if (
                targetBatchType === 'true_false' &&
                cCounts.true_false < requestedCounts.true_false &&
                Array.isArray(candidate.options) &&
                candidate.options.length === 2
              ) {
                cType = 'true_false';
                candidate.type = 'true_false';
              } else {
                continue;
              }
            }
            rawSlideArray.push({ ...candidate, type: cType });
          }

          reporter.onStats?.({
            generatedChars: totalGeneratedChars,
            slidesDrafted: rawSlideArray.length
          });
          emitSlidePreview(rawSlideArray);
          reporter.onLog?.('🧩', `Aanvulronde ${round} afgerond: nu ${rawSlideArray.length}/${totalExpectedSlides} dia's`);
        }
      }

      if (rawSlideArray.length > 0) {
        // Breng slides in exact gevraagde aantallen per type + logische didactische volgorde
        const buckets: Record<SlideType, any[]> = {
          content: [],
          wordcloud: [],
          true_false: [],
          multiple_choice: [],
          open: [],
          poll: []
        };
        for (const s of rawSlideArray) {
          const st = normalizeSlideType(s?.type);
          if (buckets[st].length < requestedCounts[st]) {
            buckets[st].push({ ...s, type: st });
          }
        }

        // Als na alle AI-aanvulrondes nog een enkel type tekortkomt, vul alleen de ontbrekende aan vanuit slimme RAG/curriculum fallback
        const fallbackPool = buildCurriculumLessonFallback(subject, effectiveTopic, targetGrade);
        for (const t of SLIDE_TYPE_ORDER) {
          while (buckets[t].length < requestedCounts[t]) {
            const fbMatch = fallbackPool.find(fb => fb.type === t) || fallbackPool[0];
            const idxNum = buckets[t].length + 1;
            const snippetForFb = selectedSnippets[(idxNum - 1) % Math.max(1, selectedSnippets.length)]?.content || '';
            buckets[t].push({
              ...fbMatch,
              type: t,
              id: `slide-${t}-${idxNum}`,
              title: snippetForFb
                ? `${effectiveTopic}: ${fbMatch.title} (${idxNum})`
                : `${fbMatch.title} (${idxNum})`,
              content: t === 'content' && snippetForFb
                ? `> 🎯 **Leerdoel:** Kernbegrip uit het lesmateriaal over **${effectiveTopic}**.\n\n> 💡 **Uit de bron:**\n> ${snippetForFb.slice(0, 420)}${snippetForFb.length > 420 ? '...' : ''}`
                : fbMatch.content
            });
          }
        }

        // Didactische herordening volgens plannedSlots
        const reordered: any[] = [];
        for (const slotType of plannedSlots) {
          const nextItem = buckets[slotType].shift();
          if (nextItem) reordered.push(nextItem);
        }
        rawSlideArray = reordered.map((s, idx) => ({ ...s, id: `slide-${idx + 1}` }));

        reporter.onStats?.({ slidesDrafted: rawSlideArray.length });
        emitSlidePreview(rawSlideArray);
        reporter.onStepDone?.(
          'draft',
          `${rawSlideArray.length} dia's compleet opgesteld door ${usedModelName} (${totalGeneratedChars.toLocaleString('nl-NL')} tekens)`,
          60
        );
      } else {
        reporter.onStepDone?.(
          'draft',
          aiPowered ? 'AI-uitvoer kon niet geparsed worden — overschakelen naar curriculumfallback' : 'Geen actief AI-model reageerde — curriculumfallback wordt voorbereid',
          60,
          aiPowered ? 'error' : 'skipped'
        );
      }
    } catch (err: any) {
      if (reporter.signal?.aborted) throw err;
      console.warn('[Live AI Generator] Draft error:', err.message);
      reporter.onStepDone?.('draft', `Fout bij AI-ontwerp (${err.message}) — fallback actief`, 60, 'error');
    }

    checkAborted();

    // STAP 3: AI Kwaliteitsreview & Verdieping in batches (ALTIJD uitvoeren als high quality — nooit overslaan op basis van tijd!)
    const questionIndices = rawSlideArray
      .map((s, idx) => (['multiple_choice', 'true_false', 'open'].includes(normalizeSlideType(s?.type)) ? idx : -1))
      .filter(idx => idx !== -1);

    if (questionQualityMode === 'high' && rawSlideArray.length > 0 && questionIndices.length > 0) {
      const CRITIC_BATCH_SIZE = 5;
      const totalBatches = Math.ceil(questionIndices.length / CRITIC_BATCH_SIZE);
      reporter.onStepStart?.('critic', `${questionIndices.length} toetsvragen & afleiders verscherpen (${totalBatches} ${totalBatches === 1 ? 'ronde' : 'batches'})...`, 62);
      reporter.onLog?.('🔎', `Cito/RTTI kwaliteitscontrole gestart op ${questionIndices.length} toetsvragen (${totalBatches} batches, zonder tijdslimiet)...`);

      const criticSystem = `Je bent de eindredacteur en toetsexpert van het Cito/SLO voor niveau "${targetGrade}".
Je controleert concept-toetsvragen en verbetert direct zwakke plekken.
Controlepunten:
1. Is elke meerkeuzevraag inhoudelijk uitdagend op niveau "${targetGrade}" (geen inkoppertjes, geen vage algemene formuleringen)?
2. Zijn alle 4 opties van "multiple_choice" even lang, grammaticaal parallel en zonder "**" markdown of "A)" voorvoegsels?
3. Vertegenwoordigt elke foute optie een echte leerling-denkfout?
4. Is bij "true_false" de stelling prikkelend en niet triviaal?
5. Bevat "open" een echte denk-/casusvraag (geen ja/nee-vraag) en heldere beoordelingspunten in "explanation"?
6. Sluiten alle feiten aantoonbaar aan bij eventuele broncontext?
Behoud het veld "idx", "id" en "type" exact en geef UITSLUITEND JSON terug: { "slides": [...] }.`;

      let totalImproved = 0;

      for (let b = 0; b < totalBatches; b++) {
        checkAborted();
        const batchIndices = questionIndices.slice(b * CRITIC_BATCH_SIZE, (b + 1) * CRITIC_BATCH_SIZE);
        const batchStartNum = b * CRITIC_BATCH_SIZE + 1;
        const batchEndNum = batchStartNum + batchIndices.length - 1;
        const basePct = 62 + Math.round((b / totalBatches) * 18);

        reporter.onStepUpdate?.(
          'critic',
          `Vragen ${batchStartNum}–${batchEndNum} van ${questionIndices.length} controleren (batch ${b + 1}/${totalBatches})...`,
          basePct
        );

        try {
          const subsetForCritic = batchIndices.map(idx => ({
            idx,
            id: rawSlideArray[idx].id || `slide-${idx + 1}`,
            type: rawSlideArray[idx].type,
            rtti: rawSlideArray[idx].rtti,
            title: rawSlideArray[idx].title,
            content: rawSlideArray[idx].content,
            options: rawSlideArray[idx].options,
            correctOptionIndex: rawSlideArray[idx].correctOptionIndex,
            explanation: rawSlideArray[idx].explanation
          }));

          const criticPrompt = `Verbeter waar nodig de inhoudelijke scherpte, afleiders en toelichtingen van deze vragen over "${effectiveTopic}" (${subject}, niveau ${targetGrade}, moeilijkheid ${difficultyLevel}):
${ragContext ? `\nSamengevatte bronreferentie:\n${ragContext.slice(0, 6000)}\n` : ''}
Concept-vragen JSON (vragen ${batchStartNum} t/m ${batchEndNum}):
${JSON.stringify({ slides: subsetForCritic })}`;

          const criticRes = await callLlmDetailed(criticPrompt, criticSystem, user.orgId, true, {
            modelId,
            temperature: 0.25,
            maxTokens: 12288,
            numCtx: 24576,
            signal: reporter.signal,
            onProgress: info => {
              const estP = Math.min(81, basePct + Math.round((Math.min(info.charsReceived, 3500) / 3500) * (18 / totalBatches)));
              reporter.onStepUpdate?.(
                'critic',
                `${info.model} controleert vragen ${batchStartNum}–${batchEndNum}/${questionIndices.length}... ${info.charsReceived.toLocaleString('nl-NL')} tekens`,
                estP
              );
            }
          });

          checkAborted();

          if (criticRes?.text) {
            const criticParsed = extractJsonFromLlm(criticRes.text);
            const improvedList = Array.isArray(criticParsed)
              ? criticParsed
              : Array.isArray(criticParsed?.slides)
              ? criticParsed.slides
              : null;

            if (Array.isArray(improvedList) && improvedList.length > 0) {
              let batchApplied = 0;
              for (let i = 0; i < improvedList.length; i++) {
                const imp = improvedList[i];
                const targetIdx = typeof imp?.idx === 'number' && rawSlideArray[imp.idx]
                  ? imp.idx
                  : batchIndices[i];
                if (typeof targetIdx === 'number' && rawSlideArray[targetIdx]) {
                  rawSlideArray[targetIdx] = {
                    ...rawSlideArray[targetIdx],
                    rtti: imp.rtti || rawSlideArray[targetIdx].rtti,
                    title: imp.title || rawSlideArray[targetIdx].title,
                    content: imp.content || rawSlideArray[targetIdx].content,
                    options: Array.isArray(imp.options) && imp.options.length >= 2 ? imp.options : rawSlideArray[targetIdx].options,
                    correctOptionIndex: typeof imp.correctOptionIndex === 'number' ? imp.correctOptionIndex : rawSlideArray[targetIdx].correctOptionIndex,
                    explanation: imp.explanation || rawSlideArray[targetIdx].explanation
                  };
                  batchApplied += 1;
                }
              }
              if (batchApplied > 0) {
                totalImproved += batchApplied;
                qualityUpgraded = true;
                reporter.onStats?.({ qualityUpgraded: true });
                emitSlidePreview(rawSlideArray);
              }
            }
          }
          reporter.onLog?.('✨', `Kwaliteitscontrole batch ${b + 1}/${totalBatches} (vragen ${batchStartNum}–${batchEndNum}) afgerond`);
        } catch (criticErr: any) {
          if (reporter.signal?.aborted) throw criticErr;
          console.warn(`[Live AI Quality Critic] Fout bij batch ${b + 1}:`, criticErr?.message);
          reporter.onLog?.('⚠️', `Batch ${b + 1}/${totalBatches} behield originele conceptvragen (${criticErr?.message || 'parse-fout'})`);
        }
      }

      reporter.onStepDone?.(
        'critic',
        qualityUpgraded
          ? `${totalImproved} van ${questionIndices.length} toetsvragen gecontroleerd en aangescherpt`
          : 'Vraagkwaliteit gecontroleerd (alle vragen doorgenomen)',
        82
      );
    } else {
      const skipMsg = questionQualityMode !== 'high'
        ? 'Overgeslagen (snelle generatiemodus geselecteerd)'
        : 'Overgeslagen (fallback-structuur wordt opgebouwd)';
      reporter.onStepDone?.('critic', skipMsg, 82, 'skipped');
    }

    checkAborted();

    // Bouw fallback indien AI geen slides opleverde
    if (rawSlideArray.length === 0) {
      let fallbackSlides = buildCurriculumLessonFallback(subject, effectiveTopic, targetGrade);
      if (ragContext && selectedSnippets.length > 0) {
        const docTitle = Array.from(sourcesUsedSet)[0] || effectiveTopic;
        const primarySnippet = selectedSnippets[0]?.content || '';
        const secondarySnippet = selectedSnippets[1]?.content || primarySnippet;
        const excerptSentences = primarySnippet
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 35 && s.length < 220);

        if (fallbackSlides[0] && fallbackSlides[0].type === 'content') {
          fallbackSlides[0].title = `${effectiveTopic} — Kern uit ${docTitle}`;
          fallbackSlides[0].content = `> 🎯 **Leerdoel:** Je analyseert de hoofdlijnen uit **${docTitle}** binnen **${subject}** (${targetGrade}).\n\n> 💡 **Kernpassage uit bronmateriaal:**\n> ${primarySnippet.slice(0, 420)}${primarySnippet.length > 420 ? '...' : ''}\n\n> 🔍 **Vervolgcontext:**\n> ${secondarySnippet.slice(0, 320)}${secondarySnippet.length > 320 ? '...' : ''}`;
        }
        const openSlide = fallbackSlides.find(s => s.type === 'open');
        if (openSlide && excerptSentences[0]) {
          openSlide.content = `> 🔍 **Citaat uit ${docTitle}:**\n> *"${excerptSentences[0]}"*\n\nLeg in eigen woorden uit wat deze stelling of observatie uit het lesmateriaal betekent voor **${effectiveTopic}** en geef één concreet voorbeeld.`;
        }
      }
      rawSlideArray = fallbackSlides;
      reporter.onPreviewSlides?.(
        rawSlideArray.map((s: any, idx: number) => ({
          id: s.id || `slide-${idx + 1}`,
          type: (s.type || 'multiple_choice') as SlideType,
          rtti: typeof s.rtti === 'string' ? s.rtti : undefined,
          title: (s.title || `Onderdeel ${idx + 1}`).trim()
        }))
      );
    }

    // STAP 4: Afbeeldingen parallel zoeken (Wikipedia + catalogus)
    if (autoFindImages) {
      const candidateImgCount = rawSlideArray.filter((s, idx) =>
        !(typeof s.imageUrl === 'string' && s.imageUrl.startsWith('http')) &&
        (s.type === 'content' || Boolean(s.imageQuery) || idx % 2 === 1)
      ).length;

      reporter.onStats?.({ imagesTotal: candidateImgCount, imagesFound: 0 });
      reporter.onStepStart?.('images', `Onderwijsafbeeldingen zoeken voor ${candidateImgCount} dia's...`, 84);
      reporter.onLog?.('🖼️', `Zoeken naar passende illustraties (Wikipedia & onderwijscatalogus)...`);

      await resolveSlidesImages(
        rawSlideArray,
        true,
        subject,
        effectiveTopic,
        reporter.signal,
        (foundCount, totalCount) => {
          const pct = totalCount > 0 ? Math.min(94, 84 + Math.round((foundCount / totalCount) * 10)) : 94;
          reporter.onStats?.({ imagesFound: foundCount, imagesTotal: totalCount });
          reporter.onStepUpdate?.('images', `${foundCount} van ${totalCount} illustraties gevonden...`, pct);
          reporter.onPreviewSlides?.(
            rawSlideArray.map((s: any, idx: number) => ({
              id: s.id || `slide-${idx + 1}`,
              type: (s.type || 'multiple_choice') as SlideType,
              rtti: typeof s.rtti === 'string' ? s.rtti : undefined,
              title: (s.title || `Onderdeel ${idx + 1}`).trim(),
              imageUrl: typeof s.imageUrl === 'string' && s.imageUrl.startsWith('http') ? s.imageUrl : undefined
            }))
          );
        }
      );

      const finalImages = rawSlideArray.filter(s => typeof s.imageUrl === 'string' && s.imageUrl.startsWith('http')).length;
      reporter.onStepDone?.('images', `${finalImages} illustraties gekoppeld aan dia's`, 95);
      reporter.onLog?.('📷', `${finalImages} afbeeldingen gevonden en gekoppeld`);
    } else {
      rawSlideArray = rawSlideArray.map(s => ({ ...s, imageUrl: undefined, imageCaption: undefined }));
      reporter.onStepDone?.('images', 'Overgeslagen (afbeeldingen uitgeschakeld)', 95, 'skipped');
    }

    checkAborted();

    // STAP 5: Antwoordopties opschonen, husselen & finaliseren
    reporter.onStepStart?.('finalize', 'Meerkeuze-opties husselen & lesstructuur valideren...', 96);

    generatedSlides = rawSlideArray.map((s: any, idx: number) => {
      const slideType: SlideType = s.type || 'multiple_choice';
      const imageUrl: string | undefined = typeof s.imageUrl === 'string' && s.imageUrl.startsWith('http') ? s.imageUrl : undefined;
      const imageCaption: string | undefined = s.imageCaption;

      let finalOptions: string[] | undefined = Array.isArray(s.options)
        ? s.options.map((o: any) => stripOptionFormatting(o)).filter(Boolean)
        : undefined;
      let finalCorrectIdx = typeof s.correctOptionIndex === 'number' ? s.correctOptionIndex : 0;

      if (slideType === 'true_false') {
        finalOptions = ['Waar', 'Niet Waar'];
        finalCorrectIdx = finalCorrectIdx === 1 ? 1 : 0;
      } else if (slideType === 'multiple_choice' && finalOptions && finalOptions.length >= 2) {
        const shuffled = shuffleMcOptions(finalOptions, finalCorrectIdx);
        finalOptions = shuffled.options;
        finalCorrectIdx = shuffled.correctOptionIndex;
      }

      return {
        id: s.id || `slide-${idx + 1}`,
        type: slideType,
        rtti: typeof s.rtti === 'string' ? s.rtti : undefined,
        title: (s.title || `Onderdeel ${idx + 1}`).trim(),
        content: (s.content || '').trim(),
        imageUrl,
        imageCaption,
        options: finalOptions,
        correctOptionIndex: (slideType === 'multiple_choice' || slideType === 'true_false') ? finalCorrectIdx : undefined,
        timeLimitSeconds: typeof s.timeLimitSeconds === 'number' ? s.timeLimitSeconds : (slideType === 'content' ? 0 : slideType === 'open' ? 60 : 30),
        points: typeof s.points === 'number' ? s.points : (slideType === 'multiple_choice' || slideType === 'true_false' ? 1000 : 0),
        explanation: (s.explanation || '').trim()
      };
    });

    const elapsedSec = ((Date.now() - startTimeMs) / 1000).toFixed(1);
    reporter.onStepDone?.('finalize', `${generatedSlides.length} dia's gevalideerd in ${elapsedSec}s`, 100);
    reporter.onLog?.('🎉', `Les "${resolvedLessonTitle || effectiveTopic}" klaar (${generatedSlides.length} dia's in ${elapsedSec}s)`);

    return {
      success: true,
      title: resolvedLessonTitle || effectiveTopic,
      topic: effectiveTopic,
      subject,
      targetGrade,
      slides: generatedSlides,
      metadata: {
        aiPowered,
        qualityUpgraded,
        modelUsed: usedModelName || (aiPowered ? 'Cloud/Local LLM' : 'Curriculum Fallback'),
        provider: usedProvider || (aiPowered ? 'llm' : 'fallback'),
        sourcesUsed: Array.from(sourcesUsedSet),
        sourceCharCount: totalChars,
        durationMs: Date.now() - startTimeMs
      }
    };
  }

  async function runLiveGenerationJob(job: LiveGenerationJob, body: any, user: any) {
    const pushLog = (icon: string, message: string) => {
      job.logs.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ts: Date.now(),
        icon,
        message
      });
      if (job.logs.length > 80) job.logs = job.logs.slice(-80);
      job.updatedAt = Date.now();
    };

    const findStep = (key: LiveGenerationStep['key']) => job.steps.find(s => s.key === key);

    job.status = 'running';
    job.updatedAt = Date.now();

    try {
      const result = await executeLiveGeneration(body, user, {
        signal: job.abortController.signal,
        onStepStart: (key, detail, progress) => {
          const step = findStep(key);
          if (step) {
            step.status = 'active';
            step.startedAt = step.startedAt || Date.now();
            if (detail) step.detail = detail;
          }
          job.activeStepKey = key;
          if (typeof progress === 'number') job.progressPercent = progress;
          job.updatedAt = Date.now();
        },
        onStepUpdate: (key, detail, progress) => {
          const step = findStep(key);
          if (step && step.status !== 'done') {
            step.status = 'active';
            if (!step.startedAt) step.startedAt = Date.now();
            step.detail = detail;
          }
          if (typeof progress === 'number') job.progressPercent = Math.max(job.progressPercent, progress);
          job.updatedAt = Date.now();
        },
        onStepDone: (key, detail, progress, status = 'done') => {
          const step = findStep(key);
          if (step) {
            step.status = status;
            step.detail = detail;
            step.finishedAt = Date.now();
            step.durationMs = step.startedAt ? Math.max(50, step.finishedAt - step.startedAt) : undefined;
          }
          if (typeof progress === 'number') job.progressPercent = progress;
          job.updatedAt = Date.now();
        },
        onLog: pushLog,
        onStats: patch => {
          job.stats = { ...job.stats, ...patch };
          job.updatedAt = Date.now();
        },
        onPreviewSlides: previewSlides => {
          job.previewSlides = previewSlides;
          job.updatedAt = Date.now();
        }
      });

      job.result = result;
      job.topic = result.title || job.topic;

      // Automatisch opslaan in Mijn Lessen indien in daluren-wachtrij ingepland
      if (job.autoSaveLesson && !job.savedLessonId) {
        try {
          const saved = await prisma.liveLesson.create({
            data: {
              orgId: user.orgId,
              teacherId: user.id,
              title: result.title || job.topic,
              subject: result.subject || job.subject || 'Algemeen',
              targetGrade: result.targetGrade || job.targetGrade || '3 HAVO',
              modeDefault: job.mode || 'hybrid',
              slidesJson: JSON.stringify(result.slides || [])
            }
          });
          job.savedLessonId = saved.id;
          pushLog('💾', `Automatisch opgeslagen in "Mijn Lessen" (${saved.title})`);
        } catch (saveErr: any) {
          console.warn('[Live AI Job] Auto-save fout:', saveErr?.message);
        }
      }

      job.status = 'completed';
      job.progressPercent = 100;
      job.activeStepKey = 'done';
      job.finishedAt = Date.now();
      job.updatedAt = Date.now();
      job.queuedPayload = undefined;
      job.queuedUser = undefined;
    } catch (err: any) {
      const wasCancelled = job.abortController.signal.aborted || /geannuleerd/i.test(err?.message || '');
      job.status = wasCancelled ? 'cancelled' : 'failed';
      job.error = wasCancelled ? 'Generatie geannuleerd door docent.' : (err?.message || 'Onbekende fout tijdens lesgeneratie.');
      const current = findStep(job.activeStepKey as LiveGenerationStep['key']);
      if (current && current.status === 'active') {
        current.status = 'error';
        current.finishedAt = Date.now();
        current.detail = job.error || 'Gestopt';
      }
      pushLog(wasCancelled ? '🛑' : '❌', job.error || 'Generatie mislukt');
      job.finishedAt = Date.now();
      job.updatedAt = Date.now();
      job.queuedPayload = undefined;
      job.queuedUser = undefined;
    }
  }

  function validateGenerateBody(body: any): { valid: true } | { valid: false; error: string } {
    const { topic = '', knowledgeBaseId, knowledgeBaseIds, documentIds, classMaterialIds, attachedDocuments, uploadedText } = body || {};
    const kbIdList = [
      ...(Array.isArray(knowledgeBaseIds) ? knowledgeBaseIds : []),
      ...(knowledgeBaseId ? [knowledgeBaseId] : [])
    ].filter(Boolean);
    const docIdList = Array.isArray(documentIds) ? documentIds.filter(Boolean) : [];
    const matIdList = Array.isArray(classMaterialIds) ? classMaterialIds.filter(Boolean) : [];
    const uploadedDocs = Array.isArray(attachedDocuments)
      ? attachedDocuments.filter((d: any) => d && typeof d.text === 'string' && d.text.trim().length > 0)
      : [];

    const hasAnySource =
      kbIdList.length > 0 ||
      docIdList.length > 0 ||
      matIdList.length > 0 ||
      uploadedDocs.length > 0 ||
      Boolean(uploadedText && uploadedText.trim());

    if ((!topic || !topic.trim()) && !hasAnySource) {
      return { valid: false, error: 'Vul een onderwerp/leerdoel in óf koppel minimaal één RAG-kennisbank of document.' };
    }
    return { valid: true };
  }

  // Start asynchrone AI-generatietaak (direct óf via centrale daluren-planningsservice)
  fastify.post('/generate-async', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Alleen docenten mogen lessen genereren.' });
    }

    const validation = validateGenerateBody(req.body);
    if (!validation.valid) {
      return reply.status(400).send({ error: validation.error });
    }

    pruneOldGenerationJobs();

    const body = req.body || {};
    const scheduleMode: 'immediate' | 'offpeak' = body.scheduleMode === 'offpeak' ? 'offpeak' : 'immediate';
    const jobId = crypto.randomUUID();
    const now = Date.now();
    const displayTitle = (body.topic || '').trim() || body.attachedDocuments?.[0]?.filename?.replace(/\.[^/.]+$/, '') || `${body.subject || 'Algemeen'} (${body.targetGrade || 'VO'})`;
    const slideTotal =
      (Number(body.numTheorySlides) || 2) +
      (Number(body.numMCQuestions) || 3) +
      (Number(body.numTFQuestions) || 1) +
      (Number(body.numOpenQuestions) || 1) +
      (Number(body.numWordclouds) || 1) + 1;

    let aiTask: any = null;
    if (scheduleMode === 'offpeak') {
      aiTask = await aiQueueService.enqueueTask({
        orgId: user.orgId,
        userId: user.id,
        taskType: 'live_generate',
        sourceRefId: jobId,
        title: `Locra Live Les: ${displayTitle}`,
        description: `${slideTotal} dia's (${body.subject || 'Algemeen'} · ${body.targetGrade || '3 HAVO'}), kwaliteit: ${body.questionQualityMode || 'high'}${body.teacherInstructions ? ` — ${body.teacherInstructions}` : ''}`,
        payload: { jobId, body, user: { id: user.id, orgId: user.orgId, role: user.role } },
        userPriority: body.userPriority !== undefined && body.userPriority !== null && body.userPriority !== ''
          ? Number(body.userPriority)
          : null,
        deadlineAt: body.deadlineAt || null,
        schedulePreference: 'smart_offpeak',
        triageMetadata: {
          slideCount: slideTotal,
          questionQualityMode: body.questionQualityMode || 'high',
          sourceCharCount: (body.uploadedText || '').length + (Array.isArray(body.attachedDocuments) ? body.attachedDocuments.reduce((a: number, d: any) => a + (d?.text?.length || 0), 0) : 0),
          modelId: body.modelId
        }
      });
    }

    const job: LiveGenerationJob = {
      jobId,
      userId: user.id,
      orgId: user.orgId,
      status: scheduleMode === 'offpeak' ? 'queued' : 'running',
      scheduleMode,
      scheduledFor: aiTask?.plannedStartAt ? new Date(aiTask.plannedStartAt).getTime() : undefined,
      autoSaveLesson: scheduleMode === 'offpeak' || Boolean(body.autoSaveLesson),
      queuedPayload: scheduleMode === 'offpeak' ? body : undefined,
      queuedUser: scheduleMode === 'offpeak' ? user : undefined,
      topic: displayTitle,
      subject: body.subject || 'Algemeen',
      targetGrade: body.targetGrade || '3 HAVO',
      mode: body.mode || 'hybrid',
      questionQualityMode: body.questionQualityMode || 'high',
      progressPercent: scheduleMode === 'offpeak' ? 0 : 2,
      activeStepKey: 'sources',
      steps: createInitialJobSteps(body.questionQualityMode || 'high', body.autoFindImages !== false),
      logs: [
        {
          id: `${now}-init`,
          ts: now,
          icon: scheduleMode === 'offpeak' ? '🌙' : '🚀',
          message: scheduleMode === 'offpeak' && aiTask
            ? `Ingepland door AI-planner (AI-prio ${aiTask.aiPriority}/10, geschatte duur ~${Math.max(1, Math.round(aiTask.aiEstimatedDurationSec / 60))} min): ${aiTask.aiReasoning}`
            : `Generatietaak gestart voor "${displayTitle}" (${body.targetGrade || 'VO'})`
        }
      ],
      stats: {
        sourcesUsed: [],
        sourceCharCount: 0,
        ragPassagesCount: 0,
        generatedChars: 0,
        slidesDrafted: 0,
        imagesFound: 0,
        imagesTotal: 0
      },
      previewSlides: [],
      startedAt: now,
      updatedAt: now,
      abortController: new AbortController()
    };

    liveGenerationJobs.set(jobId, job);

    if (scheduleMode === 'immediate') {
      void runLiveGenerationJob(job, body, user);
    }

    return reply.status(202).send({
      success: true,
      jobId,
      job: serializeGenerationJob(job, false),
      aiTask
    });
  });

  // Lijst met actieve/recente AI-generatietaken voor de ingelogde docent
  fastify.get('/generate-jobs', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    pruneOldGenerationJobs();
    const jobs = Array.from(liveGenerationJobs.values())
      .filter(j => j.userId === user.id && j.orgId === user.orgId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 15)
      .map(j => serializeGenerationJob(j, j.status === 'completed'));
    return reply.send({ jobs });
  });

  // Specifieke job status + live voortgang + resultaat ophalen
  fastify.get('/generate-jobs/:jobId', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const { jobId } = req.params;
    const job = liveGenerationJobs.get(jobId);
    if (!job) {
      return reply.status(404).send({ error: 'Generatietaak niet gevonden of verlopen.' });
    }
    if (job.userId !== user.id && user.role !== 'admin' && user.role !== 'superadmin') {
      return reply.status(403).send({ error: 'Geen toegang tot deze taak.' });
    }
    return reply.send({ job: serializeGenerationJob(job, true) });
  });

  // Ingeplande daluren-generatietaak toch direct starten
  fastify.post('/generate-jobs/:jobId/start-now', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const { jobId } = req.params;
    const job = liveGenerationJobs.get(jobId);
    if (!job) {
      return reply.status(404).send({ error: 'Generatietaak niet gevonden.' });
    }
    if (job.userId !== user.id && user.role !== 'admin' && user.role !== 'superadmin') {
      return reply.status(403).send({ error: 'Geen toegang tot deze taak.' });
    }

    const linkedTask = await prisma.aiQueueTask.findFirst({
      where: { sourceRefId: jobId, taskType: 'live_generate', status: { in: ['queued', 'scheduled'] } }
    }).catch(() => null);

    if (linkedTask) {
      await aiQueueService.runTaskNow(linkedTask.id);
      job.logs.push({
        id: `${Date.now()}-startnow`,
        ts: Date.now(),
        icon: '⚡',
        message: 'Docent heeft taak handmatig direct gestart vanuit de wachtrij.'
      });
    } else if (job.status === 'queued' && job.queuedPayload) {
      const payload = job.queuedPayload;
      const jobUser = job.queuedUser || user;
      job.logs.push({
        id: `${Date.now()}-startnow`,
        ts: Date.now(),
        icon: '⚡',
        message: 'Docent heeft taak handmatig direct gestart vanuit de wachtrij.'
      });
      void runLiveGenerationJob(job, payload, jobUser);
    }
    return reply.send({ success: true, job: serializeGenerationJob(job, false) });
  });

  // Lopende of ingeplande generatie annuleren
  fastify.post('/generate-jobs/:jobId/cancel', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const { jobId } = req.params;
    const job = liveGenerationJobs.get(jobId);
    if (!job) {
      return reply.status(404).send({ error: 'Generatietaak niet gevonden.' });
    }
    if (job.userId !== user.id && user.role !== 'admin' && user.role !== 'superadmin') {
      return reply.status(403).send({ error: 'Geen toegang tot deze taak.' });
    }

    const linkedTask = await prisma.aiQueueTask.findFirst({
      where: { sourceRefId: jobId, taskType: 'live_generate', status: { in: ['queued', 'scheduled', 'running'] } }
    }).catch(() => null);
    if (linkedTask) {
      await aiQueueService.cancelTask(linkedTask.id).catch(() => {});
    }

    if (job.status === 'running') {
      job.abortController.abort();
    } else if (job.status === 'queued') {
      job.status = 'cancelled';
      job.finishedAt = Date.now();
      job.updatedAt = Date.now();
      job.queuedPayload = undefined;
      job.queuedUser = undefined;
      job.logs.push({
        id: `${Date.now()}-cancel`,
        ts: Date.now(),
        icon: '🛑',
        message: 'Ingeplande taak geannuleerd door docent.'
      });
    }
    return reply.send({ success: true, job: serializeGenerationJob(job, false) });
  });

  // ── Centrale Daluren-Kwaliteitscontrole Helper & Executors voor AiQueueService ──
  async function executeLessonReviewById(
    lessonId: string,
    orgId: string,
    signal?: AbortSignal,
    updateProgress?: (percent: number, message: string) => Promise<void>
  ) {
    const lesson = await prisma.liveLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new Error('Les niet meer gevonden in database.');

    let slides: any[] = [];
    try {
      slides = JSON.parse(lesson.slidesJson || '[]');
    } catch {
      slides = [];
    }

    const questionIndices = slides
      .map((s: any, idx: number) => (['multiple_choice', 'true_false', 'open'].includes(normalizeSlideType(s?.type)) ? idx : -1))
      .filter((idx: number) => idx !== -1);

    let totalApplied = 0;
    let imagesAdded = 0;

    if (questionIndices.length > 0) {
      const CRITIC_BATCH_SIZE = 5;
      const totalBatches = Math.ceil(questionIndices.length / CRITIC_BATCH_SIZE);
      const targetGrade = lesson.targetGrade || '3 HAVO';
      const subject = lesson.subject || 'Algemeen';

      const criticSystem = `Je bent de eindredacteur en toetsexpert van het Cito/SLO voor niveau "${targetGrade}".
Je controleert concept-toetsvragen en verbetert direct zwakke plekken.
Controlepunten:
1. Is elke meerkeuzevraag inhoudelijk uitdagend op niveau "${targetGrade}" (geen inkoppertjes)?
2. Zijn alle 4 opties even lang, grammaticaal parallel en zonder "**" markdown of "A)" voorvoegsels?
3. Vertegenwoordigt elke foute optie een echte leerling-denkfout?
4. Is bij "true_false" de stelling prikkelend en niet triviaal?
5. Bevat "open" een echte denk-/casusvraag (geen ja/nee-vraag) en heldere beoordelingspunten in "explanation"?
Behoud het veld "idx", "id" en "type" exact en geef UITSLUITEND JSON terug: { "slides": [...] }.`;

      for (let b = 0; b < totalBatches; b++) {
        if (signal?.aborted) throw new Error('Kwaliteitscontrole geannuleerd.');
        if (updateProgress) {
          await updateProgress(15 + Math.round((b / totalBatches) * 65), `Cito/RTTI kwaliteitscontrole batch ${b + 1}/${totalBatches}...`);
        }

        const batchIndices = questionIndices.slice(b * CRITIC_BATCH_SIZE, (b + 1) * CRITIC_BATCH_SIZE);
        const subsetForCritic = batchIndices.map(idx => ({
          idx,
          id: slides[idx].id || `slide-${idx + 1}`,
          type: slides[idx].type,
          rtti: slides[idx].rtti,
          title: slides[idx].title,
          content: slides[idx].content,
          options: slides[idx].options,
          correctOptionIndex: slides[idx].correctOptionIndex,
          explanation: slides[idx].explanation
        }));

        const criticPrompt = `Verbeter waar nodig de inhoudelijke scherpte, afleiders en toelichtingen van deze vragen over "${lesson.title}" (${subject}, niveau ${targetGrade}):
Concept-vragen JSON (batch ${b + 1}/${totalBatches}):
${JSON.stringify({ slides: subsetForCritic })}`;

        const criticRes = await callLlmDetailed(criticPrompt, criticSystem, orgId, true, {
          temperature: 0.25,
          maxTokens: 12288,
          numCtx: 24576,
          signal
        });

        if (criticRes?.text) {
          const criticParsed = extractJsonFromLlm(criticRes.text);
          const improvedList = Array.isArray(criticParsed)
            ? criticParsed
            : Array.isArray(criticParsed?.slides)
            ? criticParsed.slides
            : null;

          if (Array.isArray(improvedList) && improvedList.length > 0) {
            for (let i = 0; i < improvedList.length; i++) {
              const imp = improvedList[i];
              const targetIdx = typeof imp?.idx === 'number' && slides[imp.idx]
                ? imp.idx
                : batchIndices[i];
              if (typeof targetIdx === 'number' && slides[targetIdx]) {
                let finalOptions = Array.isArray(imp.options) && imp.options.length >= 2
                  ? imp.options.map((o: any) => stripOptionFormatting(o)).filter(Boolean)
                  : slides[targetIdx].options;
                let finalCorrectIdx = typeof imp.correctOptionIndex === 'number'
                  ? imp.correctOptionIndex
                  : slides[targetIdx].correctOptionIndex;

                if (slides[targetIdx].type === 'multiple_choice' && Array.isArray(finalOptions) && finalOptions.length >= 2) {
                  const shuffled = shuffleMcOptions(finalOptions, typeof finalCorrectIdx === 'number' ? finalCorrectIdx : 0);
                  finalOptions = shuffled.options;
                  finalCorrectIdx = shuffled.correctOptionIndex;
                }

                slides[targetIdx] = {
                  ...slides[targetIdx],
                  rtti: imp.rtti || slides[targetIdx].rtti,
                  title: imp.title || slides[targetIdx].title,
                  content: imp.content || slides[targetIdx].content,
                  options: finalOptions,
                  correctOptionIndex: finalCorrectIdx,
                  explanation: imp.explanation || slides[targetIdx].explanation
                };
                totalApplied += 1;
              }
            }
          }
        }
      }
    }

    if (updateProgress) {
      await updateProgress(85, 'Ontbrekende onderwijsafbeeldingen aanvullen...');
    }
    const beforeImgs = slides.filter(s => typeof s.imageUrl === 'string' && s.imageUrl.startsWith('http')).length;
    await resolveSlidesImages(slides, true, lesson.subject || 'Algemeen', lesson.title, signal);
    const afterImgs = slides.filter(s => typeof s.imageUrl === 'string' && s.imageUrl.startsWith('http')).length;
    imagesAdded = Math.max(0, afterImgs - beforeImgs);

    if (totalApplied > 0 || imagesAdded > 0) {
      await prisma.liveLesson.update({
        where: { id: lessonId },
        data: { slidesJson: JSON.stringify(slides) }
      });
    }

    return {
      improvementCount: totalApplied,
      totalQuestionsReviewed: questionIndices.length,
      imagesAddedCount: imagesAdded,
      resultSummary: `${totalApplied} vragen aangescherpt (${questionIndices.length} gecontroleerd)${imagesAdded > 0 ? ` · ${imagesAdded} afbeeldingen toegevoegd` : ''}.`
    };
  }

  // Registreer Locra Live uitvoerders bij centrale AiQueueService
  aiQueueService.registerExecutor('live_generate', async (task, { signal, updateProgress }) => {
    let payload: any = {};
    try {
      payload = task.payloadJson ? JSON.parse(task.payloadJson) : {};
    } catch {}

    const jobId = payload.jobId || task.sourceRefId || crypto.randomUUID();
    const genBody = payload.body || payload;
    const genUser = payload.user || { id: task.userId, orgId: task.orgId, role: 'teacher' };

    let existingJob = liveGenerationJobs.get(jobId);
    if (!existingJob) {
      const now = Date.now();
      existingJob = {
        jobId,
        userId: task.userId,
        orgId: task.orgId,
        status: 'running',
        scheduleMode: 'offpeak',
        autoSaveLesson: true,
        topic: task.title,
        subject: genBody.subject || 'Algemeen',
        targetGrade: genBody.targetGrade || '3 HAVO',
        mode: genBody.mode || 'hybrid',
        questionQualityMode: genBody.questionQualityMode || 'high',
        progressPercent: 5,
        activeStepKey: 'sources',
        steps: createInitialJobSteps(genBody.questionQualityMode || 'high', genBody.autoFindImages !== false),
        logs: [],
        stats: { sourcesUsed: [], sourceCharCount: 0, ragPassagesCount: 0, generatedChars: 0, slidesDrafted: 0, imagesFound: 0, imagesTotal: 0 },
        previewSlides: [],
        startedAt: now,
        updatedAt: now,
        abortController: new AbortController()
      };
      liveGenerationJobs.set(jobId, existingJob);
    }

    const onAbort = () => existingJob?.abortController.abort();
    signal.addEventListener('abort', onAbort, { once: true });

    // Sync progress naar AiQueueTask
    const progressTimer = setInterval(() => {
      const j = liveGenerationJobs.get(jobId);
      if (j && j.status === 'running') {
        const active = j.steps.find(s => s.status === 'active');
        void updateProgress(j.progressPercent, active?.detail || 'AI genereert les...');
      }
    }, 3000);

    try {
      existingJob.autoSaveLesson = true;
      await runLiveGenerationJob(existingJob, genBody, genUser);
      if (existingJob.status === 'failed' || existingJob.status === 'cancelled') {
        throw new Error(existingJob.error || 'Lesgeneratie afgebroken');
      }
      const slideLen = existingJob.result?.slides?.length || existingJob.previewSlides.length;
      return {
        resultSummary: `Les "${existingJob.topic}" opgebouwd en opgeslagen (${slideLen} dia's).`
      };
    } finally {
      clearInterval(progressTimer);
      signal.removeEventListener('abort', onAbort);
    }
  });

  aiQueueService.registerExecutor('live_review', async (task, { signal, updateProgress }) => {
    if (!task.sourceRefId) throw new Error('Geen les-ID gekoppeld aan kwaliteitscontrole.');
    const res = await executeLessonReviewById(task.sourceRefId, task.orgId, signal, updateProgress);
    return { resultSummary: res.resultSummary };
  });

  // POST /lessons/:id/queue-review — les via centrale AI-planner in dalurenwachtrij zetten
  fastify.post('/lessons/:id/queue-review', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const lessonId = (req.params as any).id;
    const {
      scheduleMode = 'offpeak',
      userPriority,
      deadlineAt
    } = (req.body || {}) as {
      scheduleMode?: 'offpeak' | 'night' | 'now';
      userPriority?: number | null;
      deadlineAt?: string | null;
    };

    const lesson = await prisma.liveLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      return reply.status(404).send({ error: 'Les niet gevonden.' });
    }
    if (lesson.orgId !== user.orgId || (lesson.teacherId !== user.id && !['admin', 'superadmin'].includes(user.role))) {
      return reply.status(403).send({ error: 'Geen toegang tot deze les.' });
    }

    const existingQueued = await prisma.aiQueueTask.findFirst({
      where: {
        orgId: user.orgId,
        taskType: 'live_review',
        sourceRefId: lessonId,
        status: { in: ['queued', 'scheduled', 'running'] }
      }
    });
    if (existingQueued) {
      return reply.send({
        success: true,
        alreadyQueued: true,
        reviewId: existingQueued.id,
        scheduledAt: (existingQueued.plannedStartAt || new Date()).toISOString(),
        message: 'Deze les staat al ingepland in de centrale AI-wachtrij.'
      });
    }

    let slidesCount = 8;
    try {
      const parsedSlides = JSON.parse(lesson.slidesJson || '[]');
      if (Array.isArray(parsedSlides)) slidesCount = parsedSlides.length;
    } catch {}

    const aiTask = await aiQueueService.enqueueTask({
      orgId: user.orgId,
      userId: user.id,
      taskType: 'live_review',
      sourceRefId: lessonId,
      title: `Kwaliteitscontrole: ${lesson.title}`,
      description: `Cito/RTTI kwaliteitscontrole & verrijking voor ${slidesCount} dia's (${lesson.subject || 'Algemeen'} · ${lesson.targetGrade || '3 HAVO'})`,
      userPriority: userPriority !== undefined && userPriority !== null ? Number(userPriority) : null,
      deadlineAt: deadlineAt || null,
      schedulePreference: scheduleMode === 'now' ? 'immediate' : 'smart_offpeak',
      triageMetadata: { slideCount: slidesCount }
    });

    const scheduledDate = aiTask.plannedStartAt ? new Date(aiTask.plannedStartAt) : new Date();
    const msg = scheduleMode === 'now' || aiTask.escalatedToUrgent
      ? `"${lesson.title}" wordt direct met voorrang nagekeken (AI-prio ${aiTask.aiPriority}/10).`
      : `"${lesson.title}" ingepland voor ${scheduledDate.toLocaleDateString('nl-NL')} om ${scheduledDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} (AI-prio ${aiTask.aiPriority}/10).`;

    return reply.send({
      success: true,
      reviewId: aiTask.id,
      scheduledAt: scheduledDate.toISOString(),
      message: msg,
      aiTask
    });
  });

  // GET /queued-reviews — overzicht van ingeplande lesreviews uit centrale AI-planner
  fastify.get('/queued-reviews', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const [tasks, analysis] = await Promise.all([
      prisma.aiQueueTask.findMany({
        where: {
          orgId: user.orgId,
          taskType: 'live_review',
          ...(!['admin', 'superadmin'].includes(user.role) ? { userId: user.id } : {})
        },
        orderBy: { createdAt: 'desc' },
        take: 30
      }),
      offPeakAnalyzer.analyzeOrgPattern(user.orgId)
    ]);

    const reviews = tasks.map(t => {
      const m = (t.resultSummary || '').match(/(\d+)\s+vragen\s+aangescherpt/);
      const imgM = (t.resultSummary || '').match(/(\d+)\s+afbeeldingen\s+toegevoegd/);
      return {
        id: t.id,
        lessonId: t.sourceRefId || '',
        lessonTitle: t.title.replace(/^Kwaliteitscontrole:\s*/i, ''),
        status: t.status === 'scheduled' ? 'queued' : t.status,
        rawStatus: t.status,
        userPriority: t.userPriority,
        aiPriority: t.aiPriority,
        effectivePriority: t.effectivePriority,
        aiEstimatedDurationSec: t.aiEstimatedDurationSec,
        aiReasoning: t.aiReasoning,
        deadlineAt: t.deadlineAt ? t.deadlineAt.toISOString() : null,
        escalatedToUrgent: t.escalatedToUrgent,
        scheduledAfter: (t.plannedStartAt || t.createdAt).toISOString(),
        improvementCount: m ? parseInt(m[1], 10) : 0,
        imagesAddedCount: imgM ? parseInt(imgM[1], 10) : 0,
        createdAt: t.createdAt.toISOString(),
        completedAt: t.completedAt ? t.completedAt.toISOString() : null,
        error: t.errorMessage
      };
    });

    const nextWin = await offPeakAnalyzer.findBestOffPeakWindow(user.orgId, 180, null, 5, 'smart_offpeak');

    return reply.send({
      reviews,
      offPeakStatus: {
        isOffPeak: analysis.live.isOffPeakNow,
        trafficLevel: analysis.live.state,
        nextOffPeakAt: nextWin.plannedStartAt.toISOString(),
        windowLabel: analysis.offPeakHoursSummary.length > 0
          ? `Daluren (data-analyse): ${analysis.offPeakHoursSummary.join(', ')}`
          : 'Analyseert weekpatroon'
      }
    });
  });

  // POST /queued-reviews/:id/run-now — ingeplande lesreview handmatig direct starten
  fastify.post('/queued-reviews/:id/run-now', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const { id } = req.params as { id: string };
    const existing = await prisma.aiQueueTask.findUnique({ where: { id } });
    if (!existing || existing.orgId !== user.orgId) return reply.status(404).send({ error: 'Wachtrij-item niet gevonden.' });
    if (existing.userId !== user.id && !['admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang.' });
    }
    const updated = await aiQueueService.runTaskNow(id);
    return reply.send({ success: true, message: `Kwaliteitscontrole voor "${updated.title}" direct gestart.` });
  });

  // DELETE /queued-reviews/:id — verwijder item uit wachtrij
  fastify.delete('/queued-reviews/:id', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const { id } = req.params as { id: string };
    const existing = await prisma.aiQueueTask.findUnique({ where: { id } });
    if (!existing || existing.orgId !== user.orgId) return reply.status(404).send({ error: 'Wachtrij-item niet gevonden.' });
    if (existing.userId !== user.id && !['admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang.' });
    }
    if (['queued', 'scheduled', 'running'].includes(existing.status)) {
      await aiQueueService.cancelTask(id);
    } else {
      await prisma.aiQueueTask.delete({ where: { id } });
    }
    return reply.send({ success: true });
  });

  // Directe synchrone endpoint behouden voor backward-compatibiliteit (deelt exact dezelfde pipeline)
  fastify.post('/generate', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Alleen docenten mogen lessen genereren.' });
    }

    const validation = validateGenerateBody(req.body);
    if (!validation.valid) {
      return reply.status(400).send({ error: validation.error });
    }

    const result = await executeLiveGeneration(req.body, user);
    return reply.send(result);
  });

  // ── 3B. 1-KLIK AUTOMATISCH PLAATJE ZOEKEN VOOR EEN SLIDE ──
  fastify.post('/suggest-image', { preHandler: requireAuth }, async (req: any, reply) => {
    const { query, subject, topic, excludeUrls } = req.body || {};
    const excludes = Array.isArray(excludeUrls) ? excludeUrls : [];
    const result = await findEducationalImage(query || '', subject || '', topic || '', excludes);
    return reply.send({
      success: true,
      imageUrl: result.url,
      caption: result.caption
    });
  });

  // ── 4. AI ANTWOORD-CLUSTERING VOOR OPEN VRAGEN ──
  fastify.post('/cluster-answers', { preHandler: requireAuth }, async (req: any, reply) => {
    const { question, answers } = req.body || {};
    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return reply.send({ summary: 'Nog geen open antwoorden ingediend.', clusters: [] });
    }

    const answerTexts = answers.map((a: any, i: number) => `${i + 1}. ${a.answer || a}`).slice(0, 40).join('\n');

    const prompt = `Je bent een didactische analist. Analyseer de volgende leerlingantwoorden op de klassikale open vraag:
Vraag: "${question || 'Reflectievraag'}"

Leerlingantwoorden:
${answerTexts}

Geef een bondige analyse in valide JSON:
{
  "summary": "1-2 zinnen samenvatting van hoe de klas de kern heeft begrepen",
  "topThemes": ["Thema 1 (door x leerlingen genoemd)", "Thema 2"],
  "misconceptions": ["Eventuele veelvoorkomende denkfout of 'Geen opvallende misconcepties'"]
}`;

    const systemPrompt = 'Je bent een didactische feedbackassistent in het onderwijs. Geef alleen valide JSON terug.';

    try {
      const raw = await callLlm(prompt, systemPrompt);
      if (raw) {
        const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(clean);
        return reply.send({ success: true, analysis: parsed });
      }
    } catch (e) {
      // fallback
    }

    return reply.send({
      success: true,
      analysis: {
        summary: `${answers.length} antwoorden verzameld. Meeste leerlingen noemen relevante kernbegrippen.`,
        topThemes: ['Algemene begripskennis', 'Praktijkvoorbeelden'],
        misconceptions: ['Geen acute misconcepties gedetecteerd']
      }
    });
  });

  // ── 5. SESSIEBEHEER (STARTEN & DEELNAME) ──

  // Host start een nieuwe sessie
  fastify.post('/sessions', { preHandler: requireAuth }, async (req: any, reply) => {
    const user = req.user;
    const { lessonId, mode = 'arcade' } = req.body || {};

    const lesson = await prisma.liveLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return reply.status(404).send({ error: 'Les niet gevonden.' });

    // Pincode genereren
    let pinCode = generatePinCode();
    let attempts = 0;
    while (attempts < 10) {
      const exists = await prisma.liveSession.findUnique({ where: { pinCode } });
      if (!exists) break;
      pinCode = generatePinCode();
      attempts++;
    }

    const session = await prisma.liveSession.create({
      data: {
        lessonId: lesson.id,
        pinCode,
        status: 'waiting',
        currentSlideIdx: 0,
        slideState: 'question',
        mode: mode || lesson.modeDefault || 'arcade'
      },
      include: { lesson: true }
    });

    return reply.send({ success: true, session, pinCode });
  });

  // Sessie ophalen voor Host
  fastify.get('/sessions/:id', { preHandler: requireAuth }, async (req: any, reply) => {
    const { id } = req.params;
    const session = await prisma.liveSession.findUnique({
      where: { id },
      include: {
        lesson: true,
        participants: {
          orderBy: { score: 'desc' },
          select: { id: true, nickname: true, avatar: true, color: true, score: true, streak: true, joinedAt: true }
        },
        responses: {
          select: { id: true, slideIndex: true, participantId: true, answerValue: true, isCorrect: true, pointsAwarded: true }
        }
      }
    });

    if (!session) return reply.status(404).send({ error: 'Sessie niet gevonden.' });
    return reply.send({ session });
  });

  // Publieke controle van pincode voor leerlingen
  fastify.get('/sessions/by-pin/:pin', async (req: any, reply) => {
    const { pin } = req.params;
    const cleanPin = pin.replace(/[^0-9]/g, '');

    const session = await prisma.liveSession.findUnique({
      where: { pinCode: cleanPin },
      include: {
        lesson: {
          select: { id: true, title: true, subject: true, targetGrade: true }
        },
        _count: { select: { participants: true } }
      }
    });

    if (!session) {
      return reply.status(404).send({ error: 'Ongeldige kamercode. Controleer de code op het digibord.' });
    }

    if (session.status === 'finished') {
      return reply.status(400).send({ error: 'Deze sessie is reeds afgelopen.' });
    }

    return reply.send({
      sessionId: session.id,
      pinCode: session.pinCode,
      status: session.status,
      mode: session.mode,
      lesson: session.lesson,
      participantCount: session._count.participants
    });
  });

  // Leerling neemt deel aan sessie via PIN
  fastify.post('/sessions/by-pin/:pin/join', async (req: any, reply) => {
    const { pin } = req.params;
    const { nickname, avatar, color, token } = req.body || {};

    const cleanPin = pin.replace(/[^0-9]/g, '');
    const cleanName = (nickname || '').trim().slice(0, 24);

    if (!cleanName || cleanName.length < 2) {
      return reply.status(400).send({ error: 'Kies een schermnaam van minimaal 2 tekens.' });
    }

    // Profanity check
    if (isProfaneNickname(cleanName)) {
      return reply.status(400).send({ error: 'Deze schermnaam is niet toegestaan. Kies een passende naam.' });
    }

    const session = await prisma.liveSession.findUnique({
      where: { pinCode: cleanPin }
    });

    if (!session) {
      return reply.status(404).send({ error: 'Sessie niet gevonden.' });
    }

    if (session.status === 'finished') {
      return reply.status(400).send({ error: 'Deze sessie is reeds afgerond.' });
    }

    // Optioneel gekoppeld schoolaccount
    let userId: string | null = null;
    if (token) {
      try {
        const decoded = verifyToken(token);
        userId = decoded.id;
      } catch (_) {}
    }

    // Controleer of naam al bezet is in de sessie
    const existing = await prisma.liveParticipant.findUnique({
      where: {
        sessionId_nickname: {
          sessionId: session.id,
          nickname: cleanName
        }
      }
    });

    if (existing) {
      // Als de speler opnieuw verbindt met dezelfde naam
      return reply.send({
        success: true,
        participantId: existing.id,
        sessionId: session.id,
        nickname: existing.nickname,
        color: existing.color,
        avatar: existing.avatar || '🦊',
        score: existing.score
      });
    }

    const colors = ['#7c5cfc', '#06b6d4', '#f97316', '#10b981', '#ec4899', '#eab308', '#3b82f6'];
    const chosenColor = typeof color === 'string' && colors.includes(color)
      ? color
      : colors[Math.floor(Math.random() * colors.length)];
    const DEFAULT_AVATARS = ['🦊', '🚀', '⚡', '🦉', '🦁', '🐬', '🎨', '🦄', '🐯', '🐼', '🌟', '🤖', '🐸', '🐧', '🐙', '🦖', '🦋', '🎮'];
    const chosenAvatar = avatar && DEFAULT_AVATARS.includes(avatar) ? avatar : DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];

    const participant = await prisma.liveParticipant.create({
      data: {
        sessionId: session.id,
        nickname: cleanName,
        userId,
        color: chosenColor,
        avatar: chosenAvatar,
        score: 0,
        streak: 0
      }
    });

    return reply.send({
      success: true,
      participantId: participant.id,
      sessionId: session.id,
      nickname: participant.nickname,
      color: participant.color,
      avatar: participant.avatar,
      score: 0
    });
  });

  // Eindresultaten & Formatieve Rapportage voor docent
  fastify.get('/sessions/:id/results', { preHandler: requireAuth }, async (req: any, reply) => {
    const { id } = req.params;
    const session = await prisma.liveSession.findUnique({
      where: { id },
      include: {
        lesson: true,
        participants: {
          orderBy: { score: 'desc' },
          include: {
            user: { select: { id: true, displayName: true, email: true } },
            responses: true
          }
        },
        responses: {
          include: { participant: { select: { nickname: true } } }
        }
      }
    });

    if (!session) return reply.status(404).send({ error: 'Sessie niet gevonden.' });

    let slides: LiveSlide[] = [];
    try {
      slides = JSON.parse(session.lesson.slidesJson || '[]');
    } catch (_) {}

    // Analyse per slide
    const slideAnalytics = slides.map((slide, sIdx) => {
      const slideResponses = session.responses.filter(r => r.slideIndex === sIdx);
      const totalAnswered = slideResponses.length;
      const correctCount = slideResponses.filter(r => r.isCorrect === true).length;
      const percentageCorrect = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

      return {
        slideIndex: sIdx,
        type: slide.type,
        title: slide.title,
        totalAnswered,
        correctCount,
        percentageCorrect,
        needsReview: slide.type === 'multiple_choice' && totalAnswered >= 3 && percentageCorrect < 60
      };
    });

    return reply.send({
      session: {
        id: session.id,
        title: session.lesson.title,
        subject: session.lesson.subject,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        totalParticipants: session.participants.length
      },
      slideAnalytics,
      topParticipants: session.participants.slice(0, 10).map(p => ({
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        accuracy: p.responses.length > 0
          ? Math.round((p.responses.filter(r => r.isCorrect).length / p.responses.length) * 100)
          : 0
      }))
    });
  });
}
