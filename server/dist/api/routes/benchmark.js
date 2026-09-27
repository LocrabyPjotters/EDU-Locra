"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = benchmarkRoutes;
const index_1 = require("../../index");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const benchmarkService_1 = require("../../services/benchmarkService");
const node_fetch_1 = __importDefault(require("node-fetch"));
async function benchmarkRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.requireAuth);
    fastify.addHook('preHandler', (0, rbac_1.requireRole)('admin'));
    // GET /api/admin/benchmark/hardware
    fastify.get('/hardware', async (request, reply) => {
        try {
            const hw = await benchmarkService_1.benchmarkService.getHardwareProfile();
            return { success: true, hardware: hw };
        }
        catch (err) {
            return reply.status(500).send({ error: err.message });
        }
    });
    // GET /api/admin/benchmark/report
    fastify.get('/report', async (request, reply) => {
        try {
            const report = await benchmarkService_1.benchmarkService.runFullBenchmark();
            return { success: true, report };
        }
        catch (err) {
            return reply.status(500).send({ error: err.message });
        }
    });
    // POST /api/admin/benchmark/apply-recommendation
    fastify.post('/apply-recommendation', async (request, reply) => {
        try {
            const user = request.user;
            const { maxConcurrency, queueTimeoutSec } = request.body || {};
            let orgSettings = await index_1.prisma.orgSettings.findFirst({
                where: { orgId: user.orgId }
            });
            if (!orgSettings) {
                orgSettings = await index_1.prisma.orgSettings.findFirst();
            }
            const concurrencyCap = maxConcurrency ? parseInt(maxConcurrency, 10) : 6;
            const queueTimeout = queueTimeoutSec ? parseInt(queueTimeoutSec, 10) : 45;
            if (orgSettings) {
                await index_1.prisma.orgSettings.update({
                    where: { id: orgSettings.id },
                    data: {
                        enableRateLimiting: true,
                        maxConcurrency: concurrencyCap,
                        queueTimeoutSec: queueTimeout
                    }
                });
            }
            return {
                success: true,
                message: `Aanbeveling succesvol opgeslagen: Concurrency gelimiteerd tot ${concurrencyCap} gelijktijdige verzoeken met ${queueTimeout}s wachtrij-timeout.`
            };
        }
        catch (err) {
            return reply.status(500).send({ error: err.message });
        }
    });
    // POST /api/admin/benchmark/test-live
    fastify.post('/test-live', async (request, reply) => {
        try {
            const { concurrency = 4, prompt = 'Leg de stelling van Pythagoras uit in 2 korte zinnen.', model, numPredict = 80 } = request.body || {};
            const hw = await benchmarkService_1.benchmarkService.getHardwareProfile();
            if (!hw.ollamaAvailable || !hw.installedModels.length) {
                return reply.status(400).send({
                    error: 'Ollama is niet lokaal actief of heeft geen modellen geïnstalleerd om live mee te testen.'
                });
            }
            // Allow choosing specific model or picking active
            let activeModel = model;
            if (!activeModel || !hw.installedModels.includes(activeModel)) {
                activeModel = hw.installedModels.find(m => !m.includes('embed')) || hw.installedModels[0];
            }
            const start = Date.now();
            // Launch N concurrent requests using /api/chat with think: false
            const promises = Array.from({ length: concurrency }).map(async (_, idx) => {
                const reqStart = Date.now();
                // 45 second timeout per individual request
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 45000);
                try {
                    const res = await (0, node_fetch_1.default)('http://127.0.0.1:11434/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: activeModel,
                            messages: [
                                { role: 'user', content: `${prompt} (Verzoek #${idx + 1})` }
                            ],
                            stream: false,
                            think: false, // Critical: disable thinking so models don't waste 30s reasoning
                            options: { num_predict: numPredict }
                        }),
                        signal: controller.signal
                    });
                    clearTimeout(timeout);
                    if (!res.ok) {
                        const errText = await res.text();
                        throw new Error(`Ollama fout (${res.status}): ${errText}`);
                    }
                    const data = await res.json();
                    const durationMs = Date.now() - reqStart;
                    const evalCount = data.eval_count || 0;
                    const tokensPerSec = evalCount && durationMs > 0
                        ? parseFloat(((evalCount / durationMs) * 1000).toFixed(1))
                        : 0;
                    const promptEvalMs = data.prompt_eval_duration
                        ? Math.round(data.prompt_eval_duration / 1000000)
                        : 0;
                    return {
                        index: idx + 1,
                        durationMs,
                        evalCount,
                        tokensPerSec,
                        promptEvalMs,
                        preview: data.message?.content ? data.message.content.substring(0, 100).trim() : '',
                        status: 'success'
                    };
                }
                catch (abortErr) {
                    clearTimeout(timeout);
                    const durationMs = Date.now() - reqStart;
                    return {
                        index: idx + 1,
                        durationMs,
                        evalCount: 0,
                        tokensPerSec: 0,
                        promptEvalMs: 0,
                        preview: '',
                        errorMsg: abortErr.message,
                        status: abortErr.name === 'AbortError' ? 'timeout' : 'error'
                    };
                }
            });
            const results = await Promise.all(promises);
            const totalElapsedMs = Date.now() - start;
            const successResults = results.filter(r => r.status === 'success');
            const totalTokens = successResults.reduce((acc, r) => acc + r.evalCount, 0);
            const avgDurationMs = successResults.length > 0
                ? Math.round(successResults.reduce((acc, r) => acc + r.durationMs, 0) / successResults.length)
                : 0;
            const aggregateTokPerSec = totalElapsedMs > 0
                ? parseFloat(((totalTokens / totalElapsedMs) * 1000).toFixed(1))
                : 0;
            // Intelligent Live Verdict
            const timedOutCount = results.filter(r => r.status === 'timeout').length;
            const errorCount = results.filter(r => r.status === 'error').length;
            let rating = 'uitstekend';
            let ratingText = '';
            let recommendedLiveCap = concurrency;
            if (timedOutCount > 0 || errorCount > 0) {
                rating = 'overbelast';
                ratingText = `Server overbelast bij ${concurrency} gelijktijdige streams (${timedOutCount} timeouts).`;
                recommendedLiveCap = Math.max(1, Math.floor(concurrency / 2));
            }
            else if (avgDurationMs > 8000) {
                rating = 'matig';
                ratingText = `Responstijden lopen op tot ${(avgDurationMs / 1000).toFixed(1)}s. Leerlingen merken vertraging.`;
                recommendedLiveCap = Math.max(2, concurrency - 2);
            }
            else if (avgDurationMs > 3500) {
                rating = 'goed';
                ratingText = `Voldoende voor lesgebruik (gemiddeld ${(avgDurationMs / 1000).toFixed(1)}s).`;
                recommendedLiveCap = concurrency;
            }
            else {
                rating = 'uitstekend';
                ratingText = `Uitstekende reactiesnelheid! ${(avgDurationMs / 1000).toFixed(2)}s gemiddeld met ${aggregateTokPerSec} tok/s totale doorvoer.`;
                recommendedLiveCap = Math.min(16, concurrency + 2);
            }
            return {
                success: true,
                modelUsed: activeModel,
                concurrencyTested: concurrency,
                totalElapsedMs,
                avgDurationMs,
                aggregateTokensPerSecond: aggregateTokPerSec,
                streams: results,
                timedOut: timedOutCount,
                errors: errorCount,
                verdict: {
                    rating,
                    ratingText,
                    recommendedLiveCap
                }
            };
        }
        catch (err) {
            return reply.status(500).send({ error: err.message });
        }
    });
}
