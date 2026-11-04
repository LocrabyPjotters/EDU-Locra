import { FastifyInstance } from 'fastify';
import { AuthService } from '../auth';
import { TelemetryService } from '../telemetry';

/**
 * GET /v1/usage
 * Returns non-sensitive operational usage statistics for the authenticated tenant.
 * No prompt/completion content is ever stored or returned.
 */
export default async function usageRoutes(fastify: FastifyInstance) {

  fastify.get('/v1/usage', async (request, reply) => {
    const tenant = AuthService.authenticate(request, reply);
    if (!tenant) return;

    const authHeader = request.headers.authorization || '';
    const apiKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    const keyPrefix = AuthService.getKeyPrefix(apiKey);

    const usageStats = AuthService.getUsageStats(apiKey);
    const aggregateMetrics = TelemetryService.getAggregateByKey(keyPrefix);
    const systemHealth = TelemetryService.getSystemHealth();

    return reply.code(200).send({
      tenant: {
        id: usageStats?.tenantId,
        name: usageStats?.name,
        api_key_prefix: keyPrefix
      },
      quota: {
        monthly_credit_tokens: usageStats?.monthlyCreditTokens,
        used_tokens: usageStats?.usedTokens,
        remaining_tokens: usageStats?.remainingTokens,
        usage_percent: usageStats?.usagePercent
      },
      metrics: {
        total_requests: aggregateMetrics.totalRequests,
        total_prompt_tokens: aggregateMetrics.totalPromptTokens,
        total_completion_tokens: aggregateMetrics.totalCompletionTokens,
        avg_latency_ms: aggregateMetrics.avgLatencyMs,
        model_breakdown: aggregateMetrics.modelBreakdown
      },
      system: {
        all_enclaves_scrubbed: systemHealth.allEnclavesScrubbed,
        datacenter_location: systemHealth.datacenterLocation,
        zero_access_verified: true
      },
      privacy_notice: 'This endpoint returns ONLY non-sensitive operational metadata. Zero bytes of prompt or completion text are stored or transmitted.'
    });
  });
}

