"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.performWebSearch = performWebSearch;
exports.reformulateQuery = reformulateQuery;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
/**
 * Perform a web search using DuckDuckGo HTML endpoint (reliable, no scraper libs needed).
 */
async function performWebSearch(query, maxResults = 5) {
    const MAX_RETRIES = 2;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[WebSearch] Attempt ${attempt}/${MAX_RETRIES}: Searching for "${query}"`);
            const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=nl-nl`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const html = await response.text();
            // Extract URLs from href (DDG wraps them in /l/?uddg=...)
            const urlMatches = [...html.matchAll(/uddg=([^&"]+)/g)].map(m => {
                try {
                    return decodeURIComponent(m[1]);
                }
                catch {
                    return '';
                }
            }).filter(u => u.startsWith('http') && !u.includes('duckduckgo.com'));
            // Extract titles: text inside <a class="result__a">
            const titleMatches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*>([^<]+)<\/a>/g)]
                .map(m => m[1].trim().replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"'));
            // Extract snippets: text after class="result__snippet"
            const snippetMatches = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)]
                .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim());
            const results = [];
            const count = Math.min(urlMatches.length, snippetMatches.length, maxResults);
            for (let i = 0; i < count; i++) {
                if (urlMatches[i] && snippetMatches[i]) {
                    results.push({
                        title: titleMatches[i] || urlMatches[i],
                        url: urlMatches[i],
                        snippet: snippetMatches[i].substring(0, 300),
                    });
                }
            }
            if (results.length > 0) {
                console.log(`[WebSearch] Found ${results.length} results:`, results.map(r => r.title));
                return results;
            }
            console.log(`[WebSearch] No results on attempt ${attempt}`);
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 1200));
            }
        }
        catch (err) {
            console.error(`[WebSearch] Attempt ${attempt} failed:`, err.message);
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }
    }
    console.log(`[WebSearch] All attempts exhausted, returning empty`);
    return [];
}
/**
 * Reformulate the user's prompt into a focused search query,
 * using recent conversation history for context.
 * Falls back to the raw prompt if anything goes wrong.
 */
async function reformulateQuery(prompt, history, model = 'llama3') {
    try {
        const { ollamaClient } = await Promise.resolve().then(() => __importStar(require('./ollama')));
        const recentHistory = history
            .slice(-4)
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n');
        const systemPrompt = 'Je taak is om een korte, precieze zoekquery te genereren voor een zoekmachine. ' +
            'Geef ALLEEN de zoekquery terug, zonder uitleg, aanhalingstekens of extra tekst. ' +
            'Gebruik maximaal 6 woorden. Geen volledige zinnen, alleen trefwoorden.';
        const contextPrompt = recentHistory
            ? `Gesprekscontext:\n${recentHistory}\n\nNieuwe vraag: ${prompt}\n\nZoekquery (max 6 woorden):`
            : `Vraag: ${prompt}\n\nZoekquery (max 6 woorden):`;
        const res = await ollamaClient.generate(contextPrompt, model, systemPrompt, false);
        const data = await res.json();
        // Take only the FIRST line – Ollama sometimes adds explanation on subsequent lines
        const raw = (data.response || '').split('\n')[0].trim();
        const query = raw.replace(/^[\"'«»]|[\"'«»]$/g, '').trim();
        if (query && query.length > 2 && query.length < 90) {
            console.log(`[WebSearch] Reformulated query: "${query}"`);
            return query;
        }
    }
    catch (err) {
        console.warn(`[WebSearch] reformulateQuery failed (${err.message}), using raw prompt`);
    }
    // Fallback: use first ~60 chars of prompt
    const fallback = prompt.trim().replace(/[?!.]+$/, '');
    return fallback.length > 60 ? fallback.substring(0, 60) : fallback;
}
