import { prisma } from '../index';

interface IpRuleCache {
  enabled: boolean;
  allowed: string[];
  blocked: string[];
  lastLoaded: number;
}

let cache: IpRuleCache = {
  enabled: false,
  allowed: ['127.0.0.1', '::1'],
  blocked: [],
  lastLoaded: 0
};

// Normalize client IP (e.g. ::ffff:192.168.1.50 -> 192.168.1.50)
export function normalizeIp(ip: string | undefined | null): string {
  if (!ip) return '127.0.0.1';
  let clean = ip.trim();
  if (clean.startsWith('::ffff:')) {
    clean = clean.substring(7);
  }
  return clean;
}

// Convert IPv4 string to 32-bit unsigned integer
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// Check if an IPv4 is within a CIDR subnet (e.g. 192.168.1.0/24 or 10.0.0.0/8)
function ipv4InCidr(ip: string, cidr: string): boolean {
  const [rangeIp, prefixStr] = cidr.split('/');
  if (!rangeIp || !prefixStr) return false;

  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(rangeIp);
  if (ipInt === null || rangeInt === null) return false;

  if (prefix === 0) return true;
  const mask = ((0xFFFFFFFF << (32 - prefix)) >>> 0);
  return (ipInt & mask) === (rangeInt & mask);
}

// Match a single rule (Exact, CIDR, or Wildcard)
export function matchesIpRule(clientIp: string, rule: string): boolean {
  const cleanRule = rule.trim();
  if (!cleanRule) return false;

  const normClient = normalizeIp(clientIp);

  // 1. Exact match
  if (normClient === cleanRule) return true;

  // 2. Localhost aliases
  if ((cleanRule === 'localhost' || cleanRule === '127.0.0.1' || cleanRule === '::1') &&
      (normClient === '127.0.0.1' || normClient === '::1')) {
    return true;
  }

  // 3. CIDR match (e.g. 192.168.1.0/24 or 10.0.0.0/8)
  if (cleanRule.includes('/')) {
    if (ipv4InCidr(normClient, cleanRule)) return true;
  }

  // 4. Wildcard match (e.g. 192.168.1.* or 10.*)
  if (cleanRule.includes('*')) {
    const regexPattern = '^' + cleanRule.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
    try {
      if (new RegExp(regexPattern).test(normClient)) return true;
    } catch {}
  }

  return false;
}

// Load rules from SQLite Prisma into memory
export async function loadIpSecurityConfig(): Promise<IpRuleCache> {
  try {
    const orgSettings = await prisma.orgSettings.findFirst();
    if (!orgSettings) {
      cache = { enabled: false, allowed: ['127.0.0.1', '::1'], blocked: [], lastLoaded: Date.now() };
      return cache;
    }

    let allowedList: string[] = [];
    let blockedList: string[] = [];

    try {
      if (orgSettings.allowedIps) {
        const parsed = JSON.parse(orgSettings.allowedIps);
        if (Array.isArray(parsed)) allowedList = parsed.map(s => String(s).trim()).filter(Boolean);
      }
    } catch {
      if (orgSettings.allowedIps) {
        allowedList = orgSettings.allowedIps.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
      }
    }

    try {
      if (orgSettings.blockedIps) {
        const parsed = JSON.parse(orgSettings.blockedIps);
        if (Array.isArray(parsed)) blockedList = parsed.map(s => String(s).trim()).filter(Boolean);
      }
    } catch {
      if (orgSettings.blockedIps) {
        blockedList = orgSettings.blockedIps.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
      }
    }

    // Always include localhost in allowed list to avoid server self-lockout
    if (!allowedList.includes('127.0.0.1')) allowedList.push('127.0.0.1');
    if (!allowedList.includes('::1')) allowedList.push('::1');

    cache = {
      enabled: Boolean(orgSettings.ipWhitelistEnabled),
      allowed: allowedList,
      blocked: blockedList,
      lastLoaded: Date.now()
    };
    return cache;
  } catch (err) {
    console.warn('[IP SECURITY] Kon IP-configuratie niet laden:', err);
    return cache;
  }
}

// Invalidate or reload cache
export function invalidateIpSecurityCache(): void {
  cache.lastLoaded = 0;
}

// Evaluate if an IP is allowed
export async function checkIpAccess(rawClientIp: string): Promise<{ allowed: boolean; reason?: string; clientIp: string }> {
  // Reload if cache is older than 30 seconds
  if (Date.now() - cache.lastLoaded > 30000) {
    await loadIpSecurityConfig();
  }

  const clientIp = normalizeIp(rawClientIp);

  // 1. Check blacklist / blocked IPs
  for (const blockedRule of cache.blocked) {
    if (matchesIpRule(clientIp, blockedRule)) {
      return {
        allowed: false,
        reason: `Toegang geweigerd: IP-adres ${clientIp} is geblokkeerd op deze schoolserver.`,
        clientIp
      };
    }
  }

  // 2. If whitelist mode is disabled, allow all non-blacklisted IPs
  if (!cache.enabled) {
    return { allowed: true, clientIp };
  }

  // 3. Localhost loopback is always permitted for local administration
  if (clientIp === '127.0.0.1' || clientIp === '::1') {
    return { allowed: true, clientIp };
  }

  // 4. Whitelist enforcement
  for (const allowedRule of cache.allowed) {
    if (matchesIpRule(clientIp, allowedRule)) {
      return { allowed: true, clientIp };
    }
  }

  return {
    allowed: false,
    reason: `Toegang geweigerd: Je bent verbonden vanaf ${clientIp}. Deze Locra schoolserver staat enkel verbindingen toe vanaf geautoriseerde schoolnetwerken / whitelisted IP-adressen.`,
    clientIp
  };
}
