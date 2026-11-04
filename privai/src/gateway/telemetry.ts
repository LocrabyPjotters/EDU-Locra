import { OperationalMetadataRecord } from '../types';

/**
 * Locra PrivAI™ Operational Telemetry Service
 *
 * STRICT ZERO-ACCESS POLICY:
 * This service ONLY stores non-sensitive operational metadata:
 * - Token counts (prompt_tokens, completion_tokens)
 * - Latency (duration_ms)
 * - Model identifier
 * - API key prefix (obfuscated)
 * - Datacenter node
 * - Timestamp
 *
 * It NEVER stores, logs, or touches:
 * - Prompt text
 * - Completion text
 * - User identifiers beyond obfuscated key prefix
 * - IP addresses
 * - Any PII or chat content
 */

// In-memory ring buffer for recent metadata (in production: encrypted ClickHouse / TimescaleDB)
const MAX_RECORDS = 10_000;
const metadataBuffer: OperationalMetadataRecord[] = [];

export class TelemetryService {
  /**
   * Records a single inference request's non-sensitive metadata.
   */
  public static record(metadata: OperationalMetadataRecord): void {
    metadataBuffer.push(metadata);

    // Ring buffer: evict oldest entries
    if (metadataBuffer.length > MAX_RECORDS) {
      metadataBuffer.shift();
    }
  }

  /**
   * Returns aggregate usage statistics for a given API key prefix.
   */
  public static getAggregateByKey(apiKeyPrefix: string): {
    totalRequests: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    avgLatencyMs: number;
    modelBreakdown: Record<string, number>;
  } {
    const records = metadataBuffer.filter(r => r.apiKeyPrefix === apiKeyPrefix);

    if (records.length === 0) {
      return {
        totalRequests: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        avgLatencyMs: 0,
        modelBreakdown: {}
      };
    }

    const modelBreakdown: Record<string, number> = {};
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalLatency = 0;

    for (const r of records) {
      totalPromptTokens += r.promptTokens;
      totalCompletionTokens += r.completionTokens;
      totalLatency += r.durationMs;
      modelBreakdown[r.model] = (modelBreakdown[r.model] || 0) + 1;
    }

    return {
      totalRequests: records.length,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
      avgLatencyMs: Math.round(totalLatency / records.length),
      modelBreakdown
    };
  }

  /**
   * Returns the last N metadata records (for dashboard display).
   */
  public static getRecentRecords(limit: number = 50): OperationalMetadataRecord[] {
    return metadataBuffer.slice(-limit);
  }

  /**
   * Returns global system health metrics.
   */
  public static getSystemHealth(): {
    totalRequestsProcessed: number;
    totalTokensProcessed: number;
    avgLatencyMs: number;
    allEnclavesScrubbed: boolean;
    datacenterLocation: string;
  } {
    const total = metadataBuffer.length;
    const totalTokens = metadataBuffer.reduce((sum, r) => sum + r.totalTokens, 0);
    const avgLatency = total > 0
      ? Math.round(metadataBuffer.reduce((sum, r) => sum + r.durationMs, 0) / total)
      : 0;
    const allScrubbed = metadataBuffer.every(r => r.enclaveScrubbed === true);

    return {
      totalRequestsProcessed: total,
      totalTokensProcessed: totalTokens,
      avgLatencyMs: avgLatency,
      allEnclavesScrubbed: allScrubbed,
      datacenterLocation: 'Amsterdam, Nederland (Equinix AM4)'
    };
  }
}

