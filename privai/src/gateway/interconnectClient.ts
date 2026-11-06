import crypto from 'crypto';
import fetch from 'node-fetch';
import { config } from '../config';

interface KeyVerificationResult {
  valid: boolean;
  reason?: string;
  error?: string;
  keyPrefix?: string;
  subscription?: {
    id: string;
    tier: string;
    tierName?: string;
    creditBalanceEur: number;
    allowOverage: boolean;
    overageTokenPrice?: number;
  };
  user?: {
    id: string;
    name: string;
    email?: string;
    school?: string;
  };
}

interface CacheEntry {
  result: KeyVerificationResult;
  expiresAt: number;
}

export class InterconnectClient {
  private static cache: Map<string, CacheEntry> = new Map();

  /**
   * Valideert een API-sleutel en controleert of er voldoende compute credits zijn.
   */
  public static async verifyKey(apiKey: string): Promise<KeyVerificationResult> {
    if (!apiKey) {
      return { valid: false, reason: 'missing_key', error: 'Geen API-sleutel opgegeven.' };
    }

    const keyHash = crypto.createHash('sha256').update(apiKey.trim()).digest('hex');
    const now = Date.now();

    // 1. Controleer lokale in-memory cache
    const cached = this.cache.get(keyHash);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    // 2. Raadpleeg centrale Locra Backend Interconnect API
    try {
      const res = await fetch(`${config.interconnect.url}/privai/interconnect/verify-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-privai-interconnect-secret': config.interconnect.secret
        },
        body: JSON.stringify({ apiKey, keyHash })
      });

      if (res.ok) {
        const data = await res.json() as KeyVerificationResult;

        // Cache 60 seconden
        this.cache.set(keyHash, {
          result: data,
          expiresAt: now + (config.interconnect.cacheTtlSeconds * 1000)
        });

        return data;
      }
    } catch (err: any) {
      console.warn('[PrivAI Interconnect] Kon centrale backend niet bereiken voor key verificatie:', err.message);
    }

    // 3. Fallback: Controleer default/master keys uit configuratie
    const defaultMatch = config.defaultApiKeys.find(k => k.key === apiKey && k.active);
    if (defaultMatch) {
      const fallbackResult: KeyVerificationResult = {
        valid: true,
        keyPrefix: `${apiKey.substring(0, 18)}...`,
        subscription: {
          id: 'default-master-sub',
          tier: 'school-pro',
          tierName: 'Locra Core School Master',
          creditBalanceEur: 149.00,
          allowOverage: true
        },
        user: {
          id: defaultMatch.tenantId,
          name: defaultMatch.name,
          school: defaultMatch.name
        }
      };
      return fallbackResult;
    }

    return {
      valid: false,
      reason: 'unauthorized',
      error: 'API-sleutel niet geverifieerd door Locra PrivAI™ beveiligingsenclave.'
    };
  }

  /**
   * Rapporteert het daadwerkelijke tokenverbruik en debiteert Euro-credits
   */
  public static async reportUsage(params: {
    apiKey: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    costEur: number;
  }): Promise<void> {
    const { apiKey, model, promptTokens, completionTokens, costEur } = params;
    const keyHash = crypto.createHash('sha256').update(apiKey.trim()).digest('hex');

    // Invalideer lokale cache zodat volgend verzoek het actuele saldo checkt
    this.cache.delete(keyHash);

    try {
      await fetch(`${config.interconnect.url}/privai/interconnect/report-usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-privai-interconnect-secret': config.interconnect.secret
        },
        body: JSON.stringify({
          apiKey,
          keyHash,
          model,
          promptTokens,
          completionTokens,
          costEur
        })
      });
    } catch (err: any) {
      console.error('[PrivAI Interconnect] Fout bij rapporteren van tokenverbruik:', err.message);
    }
  }

  /**
   * Berekent de exacte kosten in Euro's op basis van tokens in en uit
   */
  public static calculateCost(modelId: string, promptTokens: number, completionTokens: number): number {
    const rate = config.pricing[modelId as keyof typeof config.pricing] || config.pricing['locra-privai-fast'];
    const inputCost = (promptTokens / 1_000_000) * rate.inputEurPerMillion;
    const outputCost = (completionTokens / 1_000_000) * rate.outputEurPerMillion;
    return Math.round((inputCost + outputCost) * 100000) / 100000;
  }
}
