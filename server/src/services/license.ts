import { prisma } from '../index';
import fetch from 'node-fetch';

export type LicenseTier = 'edu-free' | 'free' | 'edu-basic' | 'edu-plus' | 'edu-premium' | 'enterprise';

export interface LicenseFeatures {
  chat: boolean;
  models: boolean;
  userManagement: boolean;
  slimCheck: boolean;
  exams: boolean;
  ragKnowledgeBases: boolean;
  maxKnowledgeBases: number;
  quotasAndLimits: boolean;
  groupsAndClasses: boolean;
  watermarkDetection: boolean;
  somtodayIntegration: boolean;
  codeMatch: boolean;
  academy: boolean;
  kennisnetSso: boolean;
  telemetryShared: boolean;
}

export interface LicenseInfo {
  valid: boolean;
  tier: LicenseTier;
  reason?: string;
  schoolName?: string;
  maxUsers?: number;
  expiresAt?: string | null;
  lastVerifiedAt?: Date | null;
  features: LicenseFeatures;
}

export interface HubStatus {
  upstreamUrl: string;
  online: boolean;
  latencyMs: number;
  status: 'active' | 'grace_period' | 'locked' | 'unlicensed';
  tier: string;
  schoolName: string;
  licenseKeyMasked: string;
  maxUsers: number;
  expiresAt: string | null;
  lastVerifiedAt: string | null;
  nextScheduledCheck: string | null;
  daysUntilNextCheck: number;
  graceDaysRemaining: number | null;
  autoCheckIntervalMonths: number;
  autoCheckIntervalDays: number;
  gracePeriodDays: number;
  lastError?: string;
  features: LicenseFeatures;
  privacyNotice: {
    transmitted: string[];
    strictlyBlocked: string[];
    e2eSecurity: string;
  };
}

export const CHECK_INTERVAL_DAYS = 90; // 3 months
export const GRACE_PERIOD_DAYS = 14;   // 14 days grace period before lockdown
export const HARD_LOCKDOWN_DAYS = CHECK_INTERVAL_DAYS + GRACE_PERIOD_DAYS; // 104 days

export function getFeaturesForTier(tier: string | null | undefined): LicenseFeatures {
  const normalizedTier = (tier || 'edu-free').toLowerCase().trim();

  if (normalizedTier === 'enterprise') {
    return {
      chat: true,
      models: true,
      userManagement: true,
      slimCheck: true,
      exams: true,
      ragKnowledgeBases: true,
      maxKnowledgeBases: 999,
      quotasAndLimits: true,
      groupsAndClasses: true,
      watermarkDetection: true,
      somtodayIntegration: true,
      codeMatch: true,
      academy: true,
      kennisnetSso: true,
      telemetryShared: false,
    };
  }

  if (normalizedTier === 'edu-premium') {
    return {
      chat: true,
      models: true,
      userManagement: true,
      slimCheck: true,
      exams: true,
      ragKnowledgeBases: true,
      maxKnowledgeBases: 999,
      quotasAndLimits: true,
      groupsAndClasses: true,
      watermarkDetection: true,
      somtodayIntegration: true,
      codeMatch: true,
      academy: true,
      kennisnetSso: false,
      telemetryShared: false,
    };
  }

  if (normalizedTier === 'edu-plus') {
    return {
      chat: true,
      models: true,
      userManagement: true,
      slimCheck: true,
      exams: true,
      ragKnowledgeBases: true,
      maxKnowledgeBases: 15,
      quotasAndLimits: true,
      groupsAndClasses: true,
      watermarkDetection: true,
      somtodayIntegration: true,
      codeMatch: false,
      academy: false,
      kennisnetSso: false,
      telemetryShared: false,
    };
  }

  if (normalizedTier === 'edu-basic') {
    return {
      chat: true,
      models: true,
      userManagement: true,
      slimCheck: true,
      exams: true,
      ragKnowledgeBases: false,
      maxKnowledgeBases: 0,
      quotasAndLimits: false,
      groupsAndClasses: false,
      watermarkDetection: false,
      somtodayIntegration: false,
      codeMatch: false,
      academy: false,
      kennisnetSso: false,
      telemetryShared: true,
    };
  }

  // edu-free or free (default)
  return {
    chat: true,
    models: true,
    userManagement: true,
    slimCheck: false,
    exams: false,
    ragKnowledgeBases: false,
    maxKnowledgeBases: 0,
    quotasAndLimits: false,
    groupsAndClasses: false,
    watermarkDetection: false,
    somtodayIntegration: false,
    codeMatch: false,
    academy: false,
    kennisnetSso: false,
    telemetryShared: true,
  };
}

export function canAccessFeature(tier: string | null | undefined, feature: keyof LicenseFeatures): boolean {
  const features = getFeaturesForTier(tier);
  return !!features[feature];
}

export function assertFeatureAccess(feature: keyof LicenseFeatures, currentTier: string | null | undefined): { allowed: boolean; requiredTier: string } {
  const allowed = canAccessFeature(currentTier, feature);
  let requiredTier = 'edu-plus';
  if (feature === 'codeMatch' || feature === 'academy') requiredTier = 'edu-premium';
  if (feature === 'kennisnetSso') requiredTier = 'enterprise';
  if (feature === 'slimCheck' || feature === 'exams') requiredTier = 'edu-basic';
  return { allowed, requiredTier };
}

const DEFAULT_FREE_LICENSE: LicenseInfo = {
  valid: true,
  tier: 'edu-free',
  features: getFeaturesForTier('edu-free')
};

let currentLicense: LicenseInfo = DEFAULT_FREE_LICENSE;
let lastPingLatencyMs = 0;
let lastPingTimestamp = 0;
let lastErrorMsg: string | undefined = undefined;
let periodicWorkerStarted = false;

export function getLicense(): LicenseInfo {
  return currentLicense;
}

/**
 * Ping api.rowmatch.nl to check latency and connectivity
 */
export async function pingUpstreamHub(): Promise<{ online: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  const endpoints = [
    'https://api.rowmatch.nl/api/locra/connect/schools',
    'http://localhost:5001/api/locra/connect/schools'
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      const latency = Date.now() - start;
      if (res.ok) {
        lastPingLatencyMs = latency;
        lastPingTimestamp = Date.now();
        lastErrorMsg = undefined;
        return { online: true, latencyMs: latency };
      }
    } catch (err: any) {
      // try fallback
    }
  }

  const latency = Date.now() - start;
  lastErrorMsg = 'api.rowmatch.nl niet bereikbaar';
  return { online: false, latencyMs: latency, error: lastErrorMsg };
}

/**
 * Validates license with api.rowmatch.nl and updates DB if valid
 */
export async function validateLicense(key: string | null, forceUpdateDb = false): Promise<LicenseInfo> {
  if (!key) {
    currentLicense = { ...DEFAULT_FREE_LICENSE, valid: false, reason: 'Geen licentiesleutel aanwezig' };
    return currentLicense;
  }

  const cleanKey = key.trim().toUpperCase();
  const endpoints = [
    `https://api.rowmatch.nl/api/locra/validate/${cleanKey}`,
    `http://localhost:5001/api/locra/validate/${cleanKey}`
  ];

  for (const url of endpoints) {
    try {
      const start = Date.now();
      const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
      lastPingLatencyMs = Date.now() - start;
      lastPingTimestamp = Date.now();

      if (res.ok) {
        const data: any = await res.json();
        if (data.valid) {
          const now = new Date();
          const tierFeatures = getFeaturesForTier(data.tier);

          currentLicense = {
            valid: true,
            tier: data.tier,
            schoolName: data.schoolName,
            maxUsers: data.maxUsers || (['edu-premium', 'enterprise'].includes(data.tier) ? 9999 : (data.tier === 'edu-plus' ? 1000 : 100)),
            expiresAt: data.expiresAt,
            lastVerifiedAt: now,
            features: tierFeatures
          };

          lastErrorMsg = undefined;

          // Update database on successful validation
          try {
            const org = await prisma.organization.findFirst({ include: { settings: true } });
            if (org) {
              await prisma.orgSettings.update({
                where: { orgId: org.id },
                data: {
                  licenseKey: cleanKey,
                  licenseTier: data.tier,
                  licenseVerifiedAt: now
                }
              });

              // Register school in central Locra Connect directory on api.rowmatch.nl
              const connectCode = org.connectCode || `LOCRA-${org.slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
              const registerEndpoints = [
                'https://api.rowmatch.nl/api/locra/connect/register-instance',
                'http://localhost:5001/api/locra/connect/register-instance'
              ];
              for (const ep of registerEndpoints) {
                fetch(ep, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    licenseKey: cleanKey,
                    connectCode,
                    schoolName: org.name,
                    logoUrl: org.logoUrl,
                    primaryColor: org.primaryColor,
                    serverVersion: 'v2.5.3'
                  }),
                  signal: AbortSignal.timeout(3000)
                }).catch(() => {});
              }
            }
          } catch (dbErr: any) {
            console.error('[License] DB update error after validation:', dbErr.message);
          }

          console.log(`[License] ✅ Succesvol gevalideerd via api.rowmatch.nl: Tier=${data.tier}, School=${data.schoolName}`);
          return currentLicense;
        } else {
          // Explicit invalid / revoked from upstream
          currentLicense = {
            ...DEFAULT_FREE_LICENSE,
            valid: false,
            reason: data.reason || 'Licentie is niet geldig of verlopen'
          };
          lastErrorMsg = currentLicense.reason;
          console.warn(`[License] ⚠️ Licentie afgewezen door api.rowmatch.nl: ${currentLicense.reason}`);
          return currentLicense;
        }
      }
    } catch (err: any) {
      // Endpoint error, try next
    }
  }

  // If remote endpoints were not reachable (offline / network issue)
  console.warn(`[License] Kon niet verbinden met api.rowmatch.nl voor ${cleanKey}. Beoordeel grace period.`);
  lastErrorMsg = 'Verbinding met api.rowmatch.nl mislukt (timeout of offline)';

  // Check last verified date from database to determine if still valid under 90d + 14d policy
  try {
    const orgSettings = await prisma.orgSettings.findFirst();
    if (orgSettings?.licenseVerifiedAt) {
      const now = Date.now();
      const verifiedAt = new Date(orgSettings.licenseVerifiedAt).getTime();
      const ageMs = now - verifiedAt;
      const msMaxAllowed = HARD_LOCKDOWN_DAYS * 24 * 60 * 60 * 1000;

      if (ageMs < msMaxAllowed) {
        // Still allowed under offline/grace period
        const tier = (orgSettings.licenseTier as any) || 'edu-basic';
        currentLicense = {
          valid: true,
          tier,
          lastVerifiedAt: orgSettings.licenseVerifiedAt,
          features: getFeaturesForTier(tier)
        };
        return currentLicense;
      }
    }
  } catch {}

  currentLicense = {
    ...DEFAULT_FREE_LICENSE,
    valid: false,
    reason: 'Offline en verificatietermijn (>3 maanden) is overschreden'
  };
  return currentLicense;
}

/**
 * Returns complete hub and license status overview for Admin/Network UI
 */
export async function getHubStatus(): Promise<HubStatus> {
  const org = await prisma.organization.findFirst({
    include: { settings: true }
  });

  const settings = org?.settings;
  const key = settings?.licenseKey || null;
  const verifiedAt = settings?.licenseVerifiedAt ? new Date(settings.licenseVerifiedAt) : null;
  const now = new Date();

  // Test ping if older than 30 seconds
  if (Date.now() - lastPingTimestamp > 30_000) {
    await pingUpstreamHub();
  }

  let status: HubStatus['status'] = 'unlicensed';
  let daysUntilNextCheck = 0;
  let graceDaysRemaining: number | null = null;
  let nextCheckDate: Date | null = null;

  if (!key) {
    status = 'unlicensed';
  } else if (!verifiedAt) {
    status = 'locked';
  } else {
    const ageMs = now.getTime() - verifiedAt.getTime();
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    
    // 90 days cycle
    daysUntilNextCheck = Math.max(0, CHECK_INTERVAL_DAYS - ageDays);
    nextCheckDate = new Date(verifiedAt.getTime() + (CHECK_INTERVAL_DAYS * 24 * 60 * 60 * 1000));

    if (ageDays <= CHECK_INTERVAL_DAYS) {
      status = 'active';
    } else if (ageDays <= HARD_LOCKDOWN_DAYS) {
      status = 'grace_period';
      graceDaysRemaining = Math.max(0, HARD_LOCKDOWN_DAYS - ageDays);
    } else {
      status = 'locked';
    }
  }

  // Mask license key for security (e.g. LOCRA-••••-••••-7YX0)
  let licenseKeyMasked = 'Niet ingesteld';
  if (key) {
    const parts = key.split('-');
    if (parts.length >= 4) {
      licenseKeyMasked = `${parts[0]}-••••-••••-${parts[parts.length - 1]}`;
    } else {
      licenseKeyMasked = key.slice(0, 6) + '••••' + key.slice(-4);
    }
  }

  const activeTier = settings?.licenseTier || currentLicense.tier || 'edu-free';
  const tierFeatures = getFeaturesForTier(activeTier);

  return {
    upstreamUrl: 'https://api.rowmatch.nl',
    online: !lastErrorMsg,
    latencyMs: lastPingLatencyMs,
    status,
    tier: activeTier,
    schoolName: currentLicense.schoolName || org?.name || 'Locra School',
    licenseKeyMasked,
    maxUsers: currentLicense.maxUsers || (['edu-premium', 'enterprise'].includes(activeTier) ? 9999 : (activeTier === 'edu-plus' ? 1000 : 100)),
    expiresAt: currentLicense.expiresAt || null,
    lastVerifiedAt: verifiedAt ? verifiedAt.toISOString() : null,
    nextScheduledCheck: nextCheckDate ? nextCheckDate.toISOString() : null,
    daysUntilNextCheck,
    graceDaysRemaining,
    autoCheckIntervalMonths: 3,
    autoCheckIntervalDays: CHECK_INTERVAL_DAYS,
    gracePeriodDays: GRACE_PERIOD_DAYS,
    lastError: lastErrorMsg,
    features: tierFeatures,
    privacyNotice: {
      transmitted: [
        'Licentiesleutel (voor verificatie en tier-autorisatie bij RowMatch/Locra)',
        'ConnectCode & school-slug (zodat leerlingen/docenten de school kunnen vinden via QR)',
        'Server softwareversie (bv. v2.5.3 voor compatibiliteitscontrole)',
        'School branding (schoolnaam, logourl en primaire themakleur)',
        ...(tierFeatures.telemetryShared ? ['Geanonimiseerde prestatiestatistieken (totale prompts, tokens, latency — GEEN chatberichten of namen)'] : [])
      ],
      strictlyBlocked: [
        'NOOIT leerling- of docentaccounts, namen of e-mailadressen',
        'NOOIT chatberichten, prompts, AI-antwoorden of context',
        'NOOIT documenten of bestanden uit de RAG-kennisbank',
        'NOOIT toetsvragen, uitwerkingen of leerlingresultaten',
        'NOOIT wachtwoorden, API keys of interne netwerkgegevens'
      ],
      e2eSecurity: tierFeatures.telemetryShared 
        ? 'Telemetrie is strikt beperkt tot geanonimiseerde kwaliteitsmetrieken conform AVG en het Privacy Convenant Onderwijs.'
        : '100% On-Premise Netwerkisolatie: Er wordt géén enkele gebruiks- of telemetriedata naar Locra verzonden.'
    }
  };
}

/**
 * Checks if system is currently locked down due to license
 */
export async function isSystemLockedDown(orgId: string): Promise<boolean> {
  const org = await prisma.orgSettings.findUnique({ where: { orgId } });
  if (!org || !org.licenseKey || !org.licenseVerifiedAt) return true;

  const ageMs = Date.now() - new Date(org.licenseVerifiedAt).getTime();
  const maxAllowedMs = HARD_LOCKDOWN_DAYS * 24 * 60 * 60 * 1000;
  if (ageMs > maxAllowedMs) return true;

  // Also check if current in-memory status explicitly failed/revoked
  if (currentLicense.valid === false && currentLicense.reason && !currentLicense.reason.includes('Offline')) {
    return true;
  }

  return false;
}

/**
 * Runs recurring automatic 3-month check in background
 */
export function startPeriodicLicenseWorker() {
  if (periodicWorkerStarted) return;
  periodicWorkerStarted = true;

  console.log(`[License Worker] 🕒 Automatische 3-maandelijkse licentiecontrole gestart (controleert periodiek op achtergrond)...`);

  // Run initial check after 5 seconds
  setTimeout(async () => {
    await runPeriodicCheck();
  }, 5000);

  // Check every 6 hours whether it's time to re-verify (90 days elapsed)
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(async () => {
    await runPeriodicCheck();
  }, SIX_HOURS);
}

async function runPeriodicCheck() {
  try {
    const org = await prisma.organization.findFirst({ include: { settings: true } });
    const settings = org?.settings;
    if (!settings?.licenseKey) return;

    const verifiedAt = settings.licenseVerifiedAt ? new Date(settings.licenseVerifiedAt).getTime() : 0;
    const ageMs = Date.now() - verifiedAt;
    const checkIntervalMs = CHECK_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

    // If 90 days have passed since last verification, re-verify with api.rowmatch.nl!
    if (ageMs >= checkIntervalMs) {
      console.log(`[License Worker] 🔄 3 Maanden (90 dagen) verstreken sinds laatste controle. Automatische re-validatie met api.rowmatch.nl...`);
      await validateLicense(settings.licenseKey, true);
    }
  } catch (err: any) {
    console.error('[License Worker] Fout bij periodieke controle:', err.message);
  }
}

export async function initializeLicenseCheck() {
  try {
    const orgSettings = await prisma.orgSettings.findFirst();
    await validateLicense(orgSettings?.licenseKey || null);
    
    // Start background auto-verification worker
    startPeriodicLicenseWorker();

    console.log(`[License] Geactiveerd: Tier = ${currentLicense.tier}${currentLicense.valid ? ' (Geldig)' : ' (Ongeldig: ' + currentLicense.reason + ')'}`);
  } catch (err) {
    console.error('[License] Database fout bij controleren van licentie:', err);
  }
}
