import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validateLicense, getLicense, getFeaturesForTier, LicenseTier } from '../../services/license';
import { createAuditLog } from '../../services/auditService';
import { sendEmail, buildSmtpVerificationEmail, computeSmtpHash } from '../../utils/mailer';
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
    
    const result: any = { ...settings };
    const sensitiveFields = ['openAiApiKey', 'anthropicApiKey', 'geminiApiKey', 'openRouterApiKey', 'huggingFaceApiKey', 'imageGenApiKey', 'smtpPass', 'githubClientSecret'];
    for (const field of sensitiveFields) {
      if (result[field]) {
        result[field] = '••••••••••••••••';
      }
    }
    return result;
  });

  // Get active license status
  fastify.get('/license', async (request, reply) => {
    try {
      const orgId = request.user!.orgId;
      const orgSettings = await prisma.orgSettings.findUnique({
        where: { orgId }
      });

      const key = orgSettings?.licenseKey || null;
      const tier = (orgSettings?.licenseTier || 'free') as LicenseTier;
      const isEduPlus = ['edu-plus', 'edu-premium', 'enterprise'].includes(tier);

      // Refresh in-memory license status
      if (key) {
        await validateLicense(key);
      }

      const info = getLicense();
      const features = info.features || getFeaturesForTier(tier);

      return {
        hasLicense: !!key,
        key,
        tier,
        isEduPlus,
        features,
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
      'teacherModelRestriction', 'teacherAllowedModels', 'teacherAllowedVisionModels',
      'enableUserProfileBuilding', 'profileTrackInterests', 'profileTrackLearningStyle',
      'profileTrackStrengthsWeaknesses', 'profileTrackGoals', 'profileTrackPersonality',
      'profileStudentCanView', 'profileStudentCanEdit', 'profileTeacherCanView',
      'smtpVerified'
    ];

    const dataToUpdate: any = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        dataToUpdate[field] = data[field];
      }
    }

    // ── AT-REST ENCRYPTIE VOOR CLOUD API KEYS ──
    const sensitiveApiFields = ['openAiApiKey', 'anthropicApiKey', 'geminiApiKey', 'openRouterApiKey', 'huggingFaceApiKey', 'imageGenApiKey'];
    for (const field of sensitiveApiFields) {
      if (dataToUpdate[field] !== undefined) {
        if (dataToUpdate[field] === '••••••••••••••••' || dataToUpdate[field] === '') {
          delete dataToUpdate[field]; // Behoud bestaande sleutel indien gemaskeerd
        } else {
          const { encryptApiKey } = await import('../../utils/crypto');
          dataToUpdate[field] = encryptApiKey(dataToUpdate[field]);
        }
      }
    }

    try {
      // If any SMTP setting changed, recompute hash. If different, invalidate verification!
      const smtpFields = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'smtpFromEmail'];
      const hasSmtpChanges = smtpFields.some(f => dataToUpdate[f] !== undefined);
      if (hasSmtpChanges) {
        const currentSettings = await prisma.orgSettings.findUnique({
          where: { orgId: request.user!.orgId }
        });
        const mergedConfig = {
          host: dataToUpdate.smtpHost !== undefined ? dataToUpdate.smtpHost : currentSettings?.smtpHost,
          port: dataToUpdate.smtpPort !== undefined ? Number(dataToUpdate.smtpPort) : currentSettings?.smtpPort,
          user: dataToUpdate.smtpUser !== undefined ? dataToUpdate.smtpUser : currentSettings?.smtpUser,
          fromEmail: dataToUpdate.smtpFromEmail !== undefined ? dataToUpdate.smtpFromEmail : currentSettings?.smtpFromEmail,
        };
        const newHash = computeSmtpHash(mergedConfig);
        if (currentSettings?.smtpConfigHash && newHash !== currentSettings.smtpConfigHash) {
          dataToUpdate.smtpVerified = false;
          dataToUpdate.smtpVerificationCode = null;
          dataToUpdate.smtpVerificationExp = null;
        }
      }

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

  // ── Send 6-digit verification code to admin email ──
  fastify.post('/smtp/send-code', async (request, reply) => {
    const user = request.user!;
    const orgId = user.orgId;
    const body = (request.body as any) || {};

    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
    const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId } });

    let host = body.smtpHost || orgSettings?.smtpHost;
    let port = body.smtpPort ? parseInt(body.smtpPort, 10) : (orgSettings?.smtpPort as number) || 587;
    let userAuth = body.smtpUser || orgSettings?.smtpUser;
    let pass = body.smtpPass || orgSettings?.smtpPass;
    let from = body.smtpFromEmail || orgSettings?.smtpFromEmail || 'Locra <no-reply@locra.local>';

    let targetEmail = body.email || body.to || dbUser?.email || (user.username?.includes('@') ? user.username : null) || userAuth;

    if (!targetEmail) {
      return reply.status(400).send({ error: 'Geen e-mailadres gevonden voor verificatie. Vul eerst een e-mail in bij gebruikers of SMTP.' });
    }

    if (!host || !userAuth || !pass) {
      return reply.status(400).send({ error: 'SMTP instellingen zijn niet (volledig) ingevuld. Vul host, poort, gebruikersnaam en wachtwoord in.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minuten geldig
    const configHash = computeSmtpHash({ host, port, user: userAuth, fromEmail: from });

    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: userAuth, pass },
        tls: { rejectUnauthorized: false }
      });

      await transporter.sendMail({
        from,
        to: targetEmail,
        subject: '🔐 Jouw SMTP Verificatiecode - Locra',
        html: buildSmtpVerificationEmail(code)
      });

      await prisma.orgSettings.update({
        where: { orgId },
        data: {
          smtpHost: host,
          smtpPort: port,
          smtpUser: userAuth,
          ...(pass ? { smtpPass: pass } : {}),
          smtpFromEmail: from,
          smtpVerificationCode: code,
          smtpVerificationExp: expiresAt,
          smtpConfigHash: configHash,
          smtpVerified: false
        }
      });

      return {
        success: true,
        message: `6-cijferige verificatiecode is succesvol verzonden naar ${targetEmail}`,
        sentTo: targetEmail
      };
    } catch (err: any) {
      return reply.status(400).send({ error: `Versturen van verificatiecode mislukt: ${err.message}` });
    }
  });

  // ── Verify the 6-digit code ──
  fastify.post('/smtp/verify-code', async (request, reply) => {
    const orgId = request.user!.orgId;
    const { code } = (request.body as any) || {};

    if (!code || typeof code !== 'string') {
      return reply.status(400).send({ error: 'Voer de 6-cijferige verificatiecode in.' });
    }

    const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId } });
    if (!orgSettings) return reply.status(404).send({ error: 'Instellingen niet gevonden' });

    if (!orgSettings.smtpVerificationCode || !orgSettings.smtpVerificationExp) {
      return reply.status(400).send({ error: 'Er is geen actieve verificatiecode aangevraagd. Vraag eerst een code aan.' });
    }

    if (new Date() > new Date(orgSettings.smtpVerificationExp)) {
      return reply.status(400).send({ error: 'De verificatiecode is verlopen. Vraag een nieuwe aan.' });
    }

    if (orgSettings.smtpVerificationCode.trim() !== code.trim()) {
      return reply.status(400).send({ error: 'Ongeldige verificatiecode. Controleer de code in je inbox.' });
    }

    const hash = computeSmtpHash({
      host: orgSettings.smtpHost,
      port: orgSettings.smtpPort,
      user: orgSettings.smtpUser,
      fromEmail: orgSettings.smtpFromEmail
    });

    await prisma.orgSettings.update({
      where: { orgId },
      data: {
        smtpVerified: true,
        smtpConfigHash: hash,
        smtpVerificationCode: null,
        smtpVerificationExp: null
      }
    });

    await createAuditLog(prisma, {
      orgId,
      userId: request.user!.id,
      action: 'settings.smtp-verified',
      category: 'settings',
      severity: 'info',
      details: { verifiedAt: new Date().toISOString() },
      ipAddress: request.ip
    });

    return { success: true, message: 'SMTP mailserver succesvol geverifieerd! Chatmoderatie en notificaties zijn nu actief.' };
  });
}
