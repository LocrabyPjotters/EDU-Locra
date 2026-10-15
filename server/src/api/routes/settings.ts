import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validateLicense, getLicense } from '../../services/license';
import { createAuditLog } from '../../services/auditService';
import fetch from 'node-fetch';

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);
  // Only admins can access settings
  fastify.addHook('preHandler', requireRole('admin'));

  // Get current organization settings
  fastify.get('/', async (request, reply) => {
    const settings = await prisma.orgSettings.findUnique({
      where: { orgId: request.user!.orgId }
    });
    
    if (!settings) {
      return reply.status(404).send({ error: 'Settings not found' });
    }
    
    return settings;
  });

  // Get active license status
  fastify.get('/license', async (request, reply) => {
    try {
      const orgId = request.user!.orgId;
      const orgSettings = await prisma.orgSettings.findUnique({
        where: { orgId }
      });

      const key = orgSettings?.licenseKey || null;
      const tier = orgSettings?.licenseTier || 'free';
      const isEduPlus = ['edu-plus', 'enterprise'].includes(tier);

      // Refresh in-memory license status
      if (key) {
        await validateLicense(key);
      }

      const info = getLicense();

      return {
        hasLicense: !!key,
        key,
        tier,
        isEduPlus,
        watermarkActive: Boolean(orgSettings?.enableWatermark && isEduPlus),
        schoolName: info.schoolName || null,
        maxUsers: info.maxUsers || 50,
        expiresAt: info.expiresAt || null,
        info
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Activate / Link Locra License Key
  fastify.post('/license/activate', async (request, reply) => {
    let cleanKey = '';
    let validationTier = 'unknown';

    try {
      const { licenseKey } = (request.body as any) || {};
      if (!licenseKey || typeof licenseKey !== 'string') {
        return reply.status(400).send({ error: 'Vul een geldige licentiesleutel in (bijv. LOCRA-XXXX-XXXX-XXXX).' });
      }

      cleanKey = licenseKey.trim().toUpperCase();

      // Call validation via service
      const validation = await validateLicense(cleanKey);
      validationTier = validation.tier;

      if (!validation.valid) {
        return reply.status(400).send({
          error: validation.reason || 'Deze licentiesleutel is niet geldig of verlopen.'
        });
      }

      const orgId = request.user!.orgId;
      const isEduPlus = ['edu-plus', 'enterprise'].includes(validation.tier);

      const updated = await prisma.orgSettings.update({
        where: { orgId },
        data: {
          licenseKey: cleanKey,
          licenseTier: validation.tier,
          licenseVerifiedAt: new Date(),
          enableWatermark: isEduPlus ? true : undefined,
        }
      });

      return {
        success: true,
        message: `Licentie succesvol gekoppeld! ${validation.tier.toUpperCase()} is nu actief.`,
        license: {
          key: cleanKey,
          tier: validation.tier,
          schoolName: validation.schoolName,
          maxUsers: validation.maxUsers,
          expiresAt: validation.expiresAt,
          watermarkActive: isEduPlus,
          advancedRAG: isEduPlus,
          somtodayActive: true
        },
        settings: updated
      };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Fout bij activeren licentie: ' + err.message });
    } finally {
      // Always log license activation attempt
      await createAuditLog(prisma, {
        orgId: request.user!.orgId,
        userId: request.user!.id,
        action: 'license.activate',
        category: 'settings',
        severity: 'critical',
        details: { key: cleanKey?.slice(0, 10) + '...', tier: validationTier },
        ipAddress: request.ip,
      }).catch(() => {});
    }
  });

  // Unlink license
  fastify.post('/license/unlink', async (request, reply) => {
    try {
      const orgId = request.user!.orgId;
      await prisma.orgSettings.update({
        where: { orgId },
        data: {
          licenseKey: null,
          licenseTier: 'free',
        }
      });

      await validateLicense(null);

      await createAuditLog(prisma, {
        orgId,
        userId: request.user!.id,
        action: 'license.unlink',
        category: 'settings',
        severity: 'critical',
        details: { previousTier: 'unknown' },
        ipAddress: request.ip,
      });

      return {
        success: true,
        message: 'Licentie succesvol ontkoppeld. Server staat nu op de gratis modus.'
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.put('/', async (request, reply) => {
    const data = request.body as any;
    
    // Whitelist allowed fields to prevent arbitrary injections
    const allowedFields = [
      'licenseKey', 'licenseTier',
      'enableE2EEncryption', 'enableWatermark', 'enableKennisnet', 
      'kennisnetClientId', 'kennisnetClientSecret', 'maxTokensPerRequest', 
      'chatStorageMode', 'enableWebSearch', 'enableNetworkIsolation', 
      'customDomain', 'allowedIps',
      'enableAnonymization', 'dataRetentionDays', 'enableAuditLogging', 
      'userCanChooseStorage', 'enableOpenPCC', 'enableExamMode', 
      'enableLocalAuth', 'enableGuestAccess', 'enable2FA', 'registrationMode',
      'enableRateLimiting', 'maxPromptsPerDay', 'maxPromptsPerMonth', 
      'maxThinkingPerDay', 'enableSharedChats', 'enableCollabChats', 
      'enableFeedback', 'enableReporting', 'enableAttachments', 'enableAPI', 
      'enablePlugins', 'enableCaching', 'enableAutoUpdate', 'enableTelemetry', 
      'enablePlagiarismCheck', 'enableLearningGoals', 'enableAutoBackup', 
      'backupIntervalHours', 'backupRetentionDays', 'embeddingModel',
      'ragChunkSize', 'ragChunkOverlap', 'ragMinScore', 'ragTopN',
      'allowTeachersToOverrideQuota', 'maxTeacherOverrideQuota',
      'smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'smtpFromEmail',
      'enableCredits', 'defaultCreditsPerUser', 'creditResetInterval',
      'apiIntegrationEnabled', 'openAiApiKey', 'anthropicApiKey', 'huggingFaceApiKey', 'openRouterApiKey', 'geminiApiKey', 'currentApiCost', 'estimatedApiCost',
      'ollamaNumParallel', 'ollamaMaxLoadedModels', 'ollamaKeepAlive', 'ollamaContextLength',
      'maxConcurrency', 'queueTimeoutSec', 'maxTeacherOverrideQuota',
      'enableSomtoday', 'somtodayBaseUrl',
      'enableCodeMatch', 'codeMatchAccessMode', 'codeMatchAllowedClasses', 'codeMatchAllowedGroups', 'codeMatchOrgRequirement',
      'githubClientId', 'githubClientSecret',
      'imageGenApiKey', 'allowStudentCoop', 'enableQuizMode', 'enableEssayCoach', 'blockedKeywords', 'activeTimeStart', 'activeTimeEnd', 'activeDays', 'orgHelperModel',
      'slimCheckDefaultVisionModel', 'slimCheckDefaultGradingModel', 'slimCheckRetainScansDays', 'slimCheckRetainFeedbackDays', 'slimCheckRetainGradeDays',
      'teacherModelRestriction', 'teacherAllowedModels', 'teacherAllowedVisionModels'
    ];

    const dataToUpdate: any = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        dataToUpdate[field] = data[field];
      }
    }

    try {
      const updated = await prisma.orgSettings.update({
        where: { orgId: request.user!.orgId },
        data: dataToUpdate
      });

      // Log which settings were changed
      const changedFields = Object.keys(dataToUpdate);
      const sensitiveFields = ['openAiApiKey', 'anthropicApiKey', 'geminiApiKey', 'openRouterApiKey', 'huggingFaceApiKey', 'smtpPass', 'kennisnetClientSecret', 'githubClientSecret', 'imageGenApiKey'];
      const isSensitive = changedFields.some(f => sensitiveFields.includes(f));

      await createAuditLog(prisma, {
        orgId: request.user!.orgId,
        userId: request.user!.id,
        action: isSensitive ? 'settings.api-keys-changed' : 'settings.changed',
        category: 'settings',
        severity: isSensitive ? 'critical' : 'warning',
        details: { changedFields, fieldCount: changedFields.length },
        ipAddress: request.ip,
      });

      return updated;
    } catch (e: any) {
      return reply.status(400).send({ error: 'Failed to update settings: ' + e.message });
    }
  });
}
