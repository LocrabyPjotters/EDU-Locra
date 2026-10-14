/**
 * webScraper.ts — Fetches a URL and converts it to clean plain text for AI context.
 */

const SCRAPER_USER_AGENT = 'Mozilla/5.0 (compatible; Locra-Scraper/1.0)';
const MAX_CONTENT_LENGTH = 12000;

export interface ScrapeResult {
  url: string;
  title: string;
  text: string;
  error?: string;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { url, title: '', text: '', error: 'Alleen HTTP/HTTPS URLs zijn toegestaan.' };
    }
    const res = await fetch(url, {
      headers: { 'User-Agent': SCRAPER_USER_AGENT, 'Accept': 'text/html,*/*', 'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { url, title: '', text: '', error: `HTTP ${res.status}: Pagina niet bereikbaar` };
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { url, title: '', text: '', error: `Niet-ondersteund type: ${contentType.split(';')[0]}` };
    }
    const html = await res.text();
    const { title, text } = htmlToText(html);
    if (!text.trim()) return { url, title, text: '', error: 'Geen leesbare tekst op deze pagina.' };
    return { url, title, text: text.substring(0, MAX_CONTENT_LENGTH) };
  } catch (err: any) {
    if (err.name === 'TimeoutError') return { url, title: '', text: '', error: 'Timeout: pagina laadde te traag.' };
    return { url, title: '', text: '', error: err.message };
  }
}

function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : '';
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(h[1-6]|p|div|section|article|blockquote|li|br|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  clean = decodeEntities(clean);
  const text = clean.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l.length > 1).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { title, text };
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export function extractUrlsFromMessage(text: string): string[] {
  const URL_REGEX = /https?:\/\/(?:[-\w.]|(?:%[\da-fA-F]{2}))+(?:[/?#][^\s"'<>]*)?/g;
  const found = text.match(URL_REGEX) || [];
  return [...new Set(found.map(u => u.replace(/[.,;:!?)]+$/, '')))].slice(0, 3);
}
