import * as cheerio from 'cheerio';

export interface NewsResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: string;
}

/**
 * Search for news using DuckDuckGo's HTML search with site restrictions.
 * Falls back to generic web search if no news results are found.
 */
export async function searchNews(query: string, maxResults = 5): Promise<NewsResult[]> {
  const newsQuery = `${query} nieuws`;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(newsQuery)}&t=h_&ia=news`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);

    const results: NewsResult[] = [];

    $('.result').each((_, el) => {
      if (results.length >= maxResults) return false;
      const titleEl = $(el).find('.result__title a');
      const snippetEl = $(el).find('.result__snippet');
      const urlEl = $(el).find('.result__url');

      const title = titleEl.text().trim();
      const snippet = snippetEl.text().trim();
      const rawUrl = titleEl.attr('href') || '';
      const source = urlEl.text().trim();

      // Extract actual URL from DuckDuckGo redirect
      const urlMatch = rawUrl.match(/uddg=([^&]+)/);
      const cleanUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : rawUrl;

      if (title && snippet && cleanUrl) {
        results.push({ title, url: cleanUrl, snippet, source });
      }
    });

    return results;
  } catch (e) {
    console.error('[newsSearch] DuckDuckGo search failed:', e);
    return [];
  }
}

/**
 * Scrape article content from a URL.
 */
export async function scrapeArticle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove script, style, nav, footer elements
    $('script, style, nav, footer, header, aside, .ad, .cookie, .menu').remove();

    // Try to get main content
    const contentSelectors = ['article', 'main', '.article-body', '.post-content', '.entry-content', '[role="main"]'];
    for (const sel of contentSelectors) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 200) {
        return el.text().replace(/\s+/g, ' ').trim().slice(0, 3000);
      }
    }

    // Fallback: get all paragraph text
    const paragraphs: string[] = [];
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 40) paragraphs.push(text);
    });
    return paragraphs.join(' ').slice(0, 3000) || null;
  } catch {
    return null;
  }
}

/**
 * Format news results for inclusion in AI context.
 */
export function formatNewsContext(results: NewsResult[]): string {
  if (results.length === 0) return '';
  const lines = results.map((r, i) =>
    `[${i + 1}] **${r.title}**\nBron: ${r.source} | ${r.url}\n${r.snippet}`
  );
  return `## 📰 Actueel Nieuws\n\n${lines.join('\n\n')}`;
}
