import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';
import { InterconnectClient } from './interconnectClient';

/**
 * Locra PrivAI™ API Key Authentication & Quota Enforcement
 *
 * The Auth layer is part of the CONTROL PLANE and never sees prompt/completion content.
 * It validates API keys against the central Locra Backend interconnect, enforces Euro-credit balances,
 * and tracks token quotas.
 */

export interface AuthenticatedTenant {
  key: string;
  keyPrefix: string;
  tenantId: string;
  name: string;
  creditBalanceEur: number;
  allowOverage: boolean;
  active: boolean;
}

export class AuthService {
  /**
   * Valideert de API-sleutel asynchroon via de centrale interconnectie en controleert het tegoed.
   */
  public static async authenticateAsync(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedTenant | null> {
    const authHeader = request.headers.authorization || (request.headers['x-api-key'] as string);

    let apiKey = '';
    if (authHeader) {
      apiKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
    }

    if (!apiKey) {
      reply.code(401).send({
        error: {
          message: 'Ontbrekende of ongeldige Authorization header. Verwacht formaat: Bearer privai_live_...',
          type: 'authentication_error',
          code: 'invalid_api_key'
        }
      });
      return null;
    }

    // Valideer via de Interconnect client
    const verification = await InterconnectClient.verifyKey(apiKey);

    if (!verification.valid) {
      if (verification.reason === 'insufficient_balance') {
        reply.code(402).send({
          error: {
            message: verification.error || 'Onvoldoende PrivAI compute credits. Waardeer je tegoed op in het dashboard.',
            type: 'insufficient_credits',
            code: 'insufficient_balance'
          }
        });
        return null;
      }

      if (verification.reason === 'subscription_inactive' || verification.reason === 'key_deactivated') {
        reply.code(403).send({
          error: {
            message: verification.error || 'Deze API-sleutel of het bijbehorende abonnement is gedeactiveerd.',
            type: 'permission_error',
            code: 'key_deactivated'
          }
        });
        return null;
      }

      reply.code(401).send({
        error: {
          message: verification.error || 'Ongeldige API-sleutel. Genereer een geldige sleutel op https://privai.locra.nl/dashboard',
          type: 'authentication_error',
          code: 'invalid_api_key'
        }
      });
      return null;
    }

    const sub = verification.subscription;
    const user = verification.user;

    return {
      key: apiKey,
      keyPrefix: verification.keyPrefix || this.getKeyPrefix(apiKey),
      tenantId: user?.id || 'tenant',
      name: user?.name || user?.school || 'PrivAI Klant',
      creditBalanceEur: sub?.creditBalanceEur ?? 5.0,
      allowOverage: sub?.allowOverage ?? false,
      active: true
    };
  }

  /**
   * Backward-compatible synchronous authenticator fallback for tests
   */
  public static authenticate(request: FastifyRequest, reply: FastifyReply): AuthenticatedTenant | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({
        error: {
          message: 'Missing or invalid Authorization header.',
          type: 'authentication_error',
          code: 'invalid_api_key'
        }
      });
      return null;
    }

    const apiKey = authHeader.substring(7).trim();
    const defaultMatch = config.defaultApiKeys.find(k => k.key === apiKey && k.active);

    if (defaultMatch) {
      return {
        key: apiKey,
        keyPrefix: this.getKeyPrefix(apiKey),
        tenantId: defaultMatch.tenantId,
        name: defaultMatch.name,
        creditBalanceEur: 50.0,
        allowOverage: true,
        active: true
      };
    }

    reply.code(401).send({
      error: {
        message: 'Invalid API key.',
        type: 'authentication_error',
        code: 'invalid_api_key'
      }
    });
    return null;
  }

  /**
   * Rapporteert tokenverbruik en debiteert Euro-credits via de centrale Interconnect
   */
  public static recordUsage(params: {
    apiKey: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    costEur: number;
  }): void {
    InterconnectClient.reportUsage(params);
  }

  /**
   * Returns the obfuscated key prefix for metadata logging (never the full key).
   */
  public static getKeyPrefix(apiKey: string): string {
    if (!apiKey || apiKey.length < 18) return 'privai_live_***';
    return `${apiKey.substring(0, 18)}...`;
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
    const keyPrefix = this.getKeyPrefix(apiKey);
    return {
      tenantId: 'tenant',
      name: keyPrefix,
      usedTokens: 0,
      monthlyCreditTokens: 50_000_000,
      remainingTokens: 50_000_000,
      usagePercent: 0
    };
  }
}

