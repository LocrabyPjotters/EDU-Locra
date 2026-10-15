import { prisma } from '../index';
import fetch from 'node-fetch';

export interface LicenseInfo {
  valid: boolean;
  tier: 'free' | 'edu-basic' | 'edu-plus' | 'enterprise';
  reason?: string;
  schoolName?: string;
  maxUsers?: number;
  expiresAt?: string | null;
  features: {
    watermarkDetection: boolean;
    advancedRAG: boolean;
    somtodayIntegration: boolean;
    maxKnowledgeBases: number;
  };
}

const DEFAULT_FREE_LICENSE: LicenseInfo = {
  valid: true,
  tier: 'free',
  features: {
    watermarkDetection: false,
    advancedRAG: false,
    somtodayIntegration: false,
    maxKnowledgeBases: 1,
  }
};

let currentLicense: LicenseInfo = DEFAULT_FREE_LICENSE;

export function getLicense(): LicenseInfo {
  return currentLicense;
}

export async function validateLicense(key: string | null): Promise<LicenseInfo> {
  if (!key) {
    currentLicense = DEFAULT_FREE_LICENSE;
    return currentLicense;
  }

  const cleanKey = key.trim().toUpperCase();
  const endpoints = [
    `https://api.rowmatch.nl/api/locra/validate/${cleanKey}`,
    `http://localhost:5001/api/locra/validate/${cleanKey}`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data: any = await res.json();
        if (data.valid) {
          const isPlus = ['edu-plus', 'enterprise'].includes(data.tier);
          currentLicense = {
            valid: true,
            tier: data.tier,
            schoolName: data.schoolName,
            maxUsers: data.maxUsers,
            expiresAt: data.expiresAt,
            features: {
              watermarkDetection: isPlus,
              advancedRAG: isPlus,
              somtodayIntegration: true,
              maxKnowledgeBases: data.tier === 'enterprise' ? 999 : (data.tier === 'edu-plus' ? 15 : 3),
            }
          };
          return currentLicense;
        } else {
          currentLicense = {
            ...DEFAULT_FREE_LICENSE,
            valid: false,
            reason: data.reason || 'Licentie is niet geldig'
          };
          return currentLicense;
        }
      }
    } catch (err: any) {
      // Probeer fallback endpoint
    }
  }

  // Als beide endpoints niet bereikbaar zijn (offline)
  console.warn(`[License] Kon niet valideren voor sleutel ${cleanKey}, offline modus actief.`);
  currentLicense = {
    ...DEFAULT_FREE_LICENSE,
    reason: 'Offline of geen verbinding met Pjotters licentieserver'
  };
  return currentLicense;
}

export async function initializeLicenseCheck() {
  try {
    const orgSettings = await prisma.orgSettings.findFirst();
    await validateLicense(orgSettings?.licenseKey || null);
    
    console.log(`[License] Geactiveerd: Tier = ${currentLicense.tier}${currentLicense.valid ? ' (Geldig)' : ' (Ongeldig: ' + currentLicense.reason + ')'}`);
  } catch (err) {
    console.error('[License] Database fout bij controleren van licentie:', err);
  }
}
