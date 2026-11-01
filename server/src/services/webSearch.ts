import { scrapeUrl } from './webScraper';

export interface WebSearchResult {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  keyPassage?: string;
  sourceType?: 'web' | 'encyclopedia';
}

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0'
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return 'web';
  }
}

function cleanHtmlText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 1. Primary: DuckDuckGo HTML with robust per-result block parsing
 */
async function searchDuckDuckGoHtml(query: string, maxResults: number = 6): Promise<WebSearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=nl-nl`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
      'Referer': 'https://html.duckduckgo.com/'
    },
    signal: AbortSignal.timeout(6000)
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo HTML returned ${response.status}`);
  }

  const html = await response.text();

  // Split by each result container
  const blocks = html.split(/class=[\"']result\s+results_links/g).slice(1);
  const results: WebSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const block of blocks) {
    if (results.length >= maxResults) break;

    // 1. Find title anchor and href
    const aMatch = block.match(/<a[^>]*class=[\"'][^\"']*result__a[^\"']*[\"'][^>]*href=[\"']([^\"']+)[\"'][^>]*>([\s\S]*?)<\/a>/i);
    if (!aMatch) continue;

    const rawHref = aMatch[1];
    let targetUrl = '';

    // Check for uddg parameter (DDG redirect wrapper)
    const uddgMatch = rawHref.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      try {
        targetUrl = decodeURIComponent(uddgMatch[1]);
      } catch {
        targetUrl = '';
      }
    } else if (rawHref.startsWith('http://') || rawHref.startsWith('https://')) {
      targetUrl = rawHref;
    }

    // Must be a valid absolute HTTP(S) URL and not internal DuckDuckGo or tracking
    if (!targetUrl || !targetUrl.startsWith('http') || targetUrl.includes('duckduckgo.com') || targetUrl.includes('yandex')) {
      continue;
    }

    // Deduplicate
    if (seenUrls.has(targetUrl)) continue;
    seenUrls.add(targetUrl);

    const title = cleanHtmlText(aMatch[2]) || extractDomain(targetUrl);

    // 2. Find snippet
    const snippetMatch = block.match(/class=[\"'][^\"']*result__snippet[^\"']*[\"'][^>]*>([\s\S]*?)<\/(?:a|td|div)>/i);
    const snippet = snippetMatch ? cleanHtmlText(snippetMatch[1]) : '';

    results.push({
      title,
      url: targetUrl,
      domain: extractDomain(targetUrl),
      snippet: snippet || title,
      sourceType: 'web'
    });
  }

  return results;
}

/**
 * 2. Fallback: DuckDuckGo Lite with robust row parsing
 */
async function searchDuckDuckGoLite(query: string, maxResults: number = 5): Promise<WebSearchResult[]> {
  const url = `https://lite.duckduckgo.com/lite/`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html',
      'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
    },
    body: `q=${encodeURIComponent(query)}&kl=nl-nl`,
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo Lite returned ${response.status}`);
  }

  const html = await response.text();
  const results: WebSearchResult[] = [];
  const seenUrls = new Set<string>();

  const linkMatches = [...html.matchAll(/<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const snippetMatches = [...html.matchAll(/<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g)];

  for (let i = 0; i < linkMatches.length && results.length < maxResults; i++) {
    let rawUrl = linkMatches[i][1];
    if (rawUrl.includes('uddg=')) {
      const match = rawUrl.match(/uddg=([^&]+)/);
      if (match) {
        try { rawUrl = decodeURIComponent(match[1]); } catch {}
      }
    }

    if (rawUrl.startsWith('http') && !rawUrl.includes('duckduckgo.com') && !seenUrls.has(rawUrl)) {
      seenUrls.add(rawUrl);
      const title = cleanHtmlText(linkMatches[i][2]);
      const snippet = snippetMatches[i] ? cleanHtmlText(snippetMatches[i][1]) : '';

      results.push({
        title: title || rawUrl,
        url: rawUrl,
        domain: extractDomain(rawUrl),
        snippet: snippet || title,
        sourceType: 'web'
      });
    }
  }

  return results;
}

/**
 * 3. Fallback: Wikipedia Educational API (Direct factual / educational search)
 */
async function searchWikipedia(query: string, maxResults: number = 3): Promise<WebSearchResult[]> {
  try {
    const searchUrl = `https://nl.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=${maxResults}`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'LocraEducationalPlatform/2.0 (onderwijs@locra.nl)' },
      signal: AbortSignal.timeout(4000)
    });

    if (!res.ok) return [];
    const data = await res.json() as any;
    const searchItems = data?.query?.search || [];

    const results: WebSearchResult[] = [];
    for (const item of searchItems) {
      const pageTitle = item.title;
      const snippet = cleanHtmlText(item.snippet || '');
      const pageUrl = `https://nl.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;

      results.push({
        title: `${pageTitle} — Wikipedia`,
        url: pageUrl,
        domain: 'nl.wikipedia.org',
        snippet: snippet.substring(0, 350),
        sourceType: 'encyclopedia'
      });
    }
    return results;
  } catch (err: any) {
    console.warn(`[WebSearch] Wikipedia fallback error: ${err.message}`);
    return [];
  }
}

/**
 * Deepen top results by scraping brief content snippets from the actual webpages
 */
async function deepenResultsWithContent(results: WebSearchResult[], query: string): Promise<WebSearchResult[]> {
  // Only scrape the top 2-3 results to keep latency under 3 seconds total
  const topToScrape = results.slice(0, 3);
  const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  await Promise.allSettled(
    topToScrape.map(async (res) => {
      // Skip wikipedia since we already have rich summary
      if (res.sourceType === 'encyclopedia' || res.url.includes('wikipedia.org')) return;

      try {
        const scrape = await scrapeUrl(res.url);
        if (scrape.text && scrape.text.length > 100) {
          // Find paragraphs that best match query terms
          const paragraphs = scrape.text.split('\n\n').filter(p => p.length > 50);
          let bestParagraph = '';
          let maxMatches = -1;

          for (const p of paragraphs.slice(0, 10)) {
            const pLower = p.toLowerCase();
            const matches = queryTerms.reduce((acc, term) => acc + (pLower.includes(term) ? 1 : 0), 0);
            if (matches > maxMatches) {
              maxMatches = matches;
              bestParagraph = p;
            }
          }

          if (bestParagraph) {
            res.keyPassage = bestParagraph.substring(0, 450).trim();
            // Enhance the snippet if original was too short
            if (res.snippet.length < 150) {
              res.snippet = res.keyPassage;
            }
          }
        }
      } catch (e) {
        // Scrape failure is non-fatal
      }
    })
  );

  return results;
}

/**
 * Perform a web search with multi-tier fallback and intelligent deepening.
 */
export async function performWebSearch(query: string, maxResults: number = 5): Promise<WebSearchResult[]> {
  let results: WebSearchResult[] = [];

  // Attempt 1: DuckDuckGo HTML
  try {
    console.log(`[WebSearch] Primary DuckDuckGo HTML searching for: "${query}"`);
    results = await searchDuckDuckGoHtml(query, maxResults);
  } catch (err: any) {
    console.warn(`[WebSearch] Primary DDG HTML failed: ${err.message}`);
  }

  // Attempt 2: DuckDuckGo Lite
  if (results.length === 0) {
    try {
      console.log(`[WebSearch] Fallback 1: DuckDuckGo Lite searching for: "${query}"`);
      results = await searchDuckDuckGoLite(query, maxResults);
    } catch (err: any) {
      console.warn(`[WebSearch] Fallback DDG Lite failed: ${err.message}`);
    }
  }

  // Attempt 3: Wikipedia Educational API
  if (results.length === 0) {
    try {
      console.log(`[WebSearch] Fallback 2: Wikipedia Search API for: "${query}"`);
      results = await searchWikipedia(query, Math.min(3, maxResults));
    } catch (err: any) {
      console.warn(`[WebSearch] Fallback Wikipedia failed: ${err.message}`);
    }
  }

  if (results.length === 0) {
    console.log(`[WebSearch] No results found across all search tiers`);
    return [];
  }

  // Deepen top results with real text excerpts
  try {
    results = await deepenResultsWithContent(results, query);
  } catch (e) {
    console.warn('[WebSearch] Deepening failed, proceeding with basic snippets');
  }

  console.log(`[WebSearch] Successfully retrieved ${results.length} enriched results:`, results.map(r => `${r.domain} - ${r.title}`));
  return results;
}

/**
 * Reformulate the user's prompt into a focused search query,
 * using recent conversation history for context.
 */
export async function reformulateQuery(
  prompt: string,
  history: any[],
  model: string = 'llama3'
): Promise<string> {
  try {
    const { ollamaClient } = await import('./ollama');

    const recentHistory = history
      .slice(-3)
      .map(m => `${m.role === 'user' ? 'Leerling' : 'Assistent'}: ${m.content.slice(0, 300)}`)
      .join('\n');

    const systemPrompt =
      'Je bent een zoekexpert voor het onderwijs. Je taak is om de gebruikersvraag om te zetten in 1 scherpe, feitelijke zoekquery van 3 tot 7 trefwoorden.\n' +
      'GEEN zinnen, GEEN vraagtekens, GEEN aanhalingstekens, GEEN introductie. ALLEEN de zoekwoorden.';

    const contextPrompt = recentHistory
      ? `Gesprekscontext:\n${recentHistory}\n\nNieuwe vraag van de leerling: "${prompt}"\n\nZoekquery:`
      : `Vraag van de leerling: "${prompt}"\n\nZoekquery:`;

    const res = await ollamaClient.generate(contextPrompt, model, systemPrompt, false);
    const data = await res.json() as any;

    const raw = (data.response || '').split('\n')[0].trim();
    const query = raw.replace(/^[\"'«»]|[\"'«»]$/g, '').trim();

    if (query && query.length >= 3 && query.length < 80) {
      console.log(`[WebSearch] Query reformulated: "${prompt}" → "${query}"`);
      return query;
    }
  } catch (err: any) {
    console.warn(`[WebSearch] reformulateQuery failed (${err.message}), using raw prompt`);
  }

  // Fallback: strip punctuation and take first ~60 chars
  const fallback = prompt.trim().replace(/[?!.]+$/, '');
  return fallback.length > 60 ? fallback.substring(0, 60) : fallback;
}

/**
 * Filter and redact Personally Identifiable Information (PII) from search queries
 * before they are sent to public search engines.
 */
export function filterSearchQueryPII(query: string): string {
  if (!query) return query;
  let clean = query;

  // 1. Email addresses
  clean = clean.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[email]');

  // 2. Phone numbers (Dutch & International)
  clean = clean.replace(/(?:\+31|0031|0)\s*(?:[1-9]\d{1}|[1-9]\d{2})\s*[-.\s]?\d{3}\s*[-.\s]?\d{3,4}/g, '[telefoonnummer]');
  clean = clean.replace(/\b\d{10}\b/g, '[telefoonnummer]');

  // 3. Dutch BSN (Burgerservicenummer) or Student numbers (6-9 consecutive digits)
  clean = clean.replace(/\b(leerlingnummer|studentnummer|bsn)[:\s]*\d{5,9}\b/gi, '$1 [verborgen]');
  clean = clean.replace(/\b\d{8,9}\b/g, '[nummer]');

  // 4. Common Dutch personal address patterns
  clean = clean.replace(/\b[1-9][0-9]{3}\s?[a-zA-Z]{2}\b/g, '[postcode]');

  return clean.trim();
}
