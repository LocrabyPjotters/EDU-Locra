import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';

/**
 * Locra PrivAI™ API Key Authentication & Quota Enforcement
 *
 * The Auth layer is part of the CONTROL PLANE and never sees prompt/completion content.
 * It validates API keys, enforces rate limits, and tracks token quotas.
 */

interface ApiKeyRecord {
  key: string;
  tenantId: string;
  name: string;
  monthlyCreditTokens: number;
  active: boolean;
  usedTokens: number;
}

// In-memory key store (in production: encrypted Postgres or Vault)
const apiKeyStore: Map<string, ApiKeyRecord> = new Map();

// Initialize keys from config
for (const keyDef of config.defaultApiKeys) {
  apiKeyStore.set(keyDef.key, { ...keyDef, usedTokens: 0 });
}

export class AuthService {
  /**
   * Validates the Bearer token from the Authorization header.
   * Returns the tenant record or throws a 401/403.
   */
  public static authenticate(request: FastifyRequest, reply: FastifyReply): ApiKeyRecord | null {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({
        error: {
          message: 'Missing or invalid Authorization header. Expected: Bearer privai_live_...',
          type: 'authentication_error',
          code: 'invalid_api_key'
        }
      });
      return null;
    }

    const apiKey = authHeader.substring(7).trim();
    const record = apiKeyStore.get(apiKey);

    if (!record) {
      reply.code(401).send({
        error: {
          message: 'Invalid API key. Obtain a valid key at https://privai.locra.nl/dashboard',
          type: 'authentication_error',
          code: 'invalid_api_key'
        }
      });
      return null;
    }

    if (!record.active) {
      reply.code(403).send({
        error: {
          message: 'This API key has been deactivated. Contact support@locra.nl.',
          type: 'authentication_error',
          code: 'key_deactivated'
        }
      });
      return null;
    }

    // Check monthly token quota
    if (record.usedTokens >= record.monthlyCreditTokens) {
      reply.code(429).send({
        error: {
          message: `Monthly token quota exceeded (${record.usedTokens.toLocaleString()} / ${record.monthlyCreditTokens.toLocaleString()}). Upgrade your plan or wait for reset.`,
          type: 'rate_limit_error',
          code: 'quota_exceeded'
        }
      });
      return null;
    }

    return record;
  }

  /**
   * Records token usage against the tenant's monthly quota.
   * This is non-sensitive metadata only (no prompt/completion content).
   */
  public static recordUsage(apiKey: string, tokensUsed: number): void {
    const record = apiKeyStore.get(apiKey);
    if (record) {
      record.usedTokens += tokensUsed;
    }
  }

  /**
   * Returns the obfuscated key prefix for metadata logging (never the full key).
   */
  public static getKeyPrefix(apiKey: string): string {
    if (apiKey.length > 20) {
      return apiKey.substring(0, 18) + '...';
    }
    return apiKey.substring(0, 10) + '...';
  }

  /**
   * Returns usage statistics for a given API key (non-sensitive).
   */
  public static getUsageStats(apiKey: string): {
    tenantId: string;
    name: string;
    usedTokens: number;
    monthlyCreditTokens: number;
    remainingTokens: number;
    usagePercent: number;
  } | null {
    const record = apiKeyStore.get(apiKey);
    if (!record) return null;

    return {
      tenantId: record.tenantId,
      name: record.name,
      usedTokens: record.usedTokens,
      monthlyCreditTokens: record.monthlyCreditTokens,
      remainingTokens: Math.max(0, record.monthlyCreditTokens - record.usedTokens),
      usagePercent: Math.round((record.usedTokens / record.monthlyCreditTokens) * 100)
    };
  }
}

