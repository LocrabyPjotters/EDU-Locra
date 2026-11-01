import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { verifyPassword, generateToken } from '../../utils/crypto';
import { createAuditLog } from '../../services/auditService';
import { getPublicBaseUrl } from '../../utils/urlHelper';
import { securityService } from '../../services/securityService';
import { requireAuth } from '../../middleware/auth';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body as any;
    const clientIp = request.ip || '127.0.0.1';
    const bruteForceKey = `${clientIp}:${username || 'anon'}`;

    // 1. Brute-force lockout check
    const lockout = securityService.isLockedOut(bruteForceKey);
    if (lockout.locked) {
      await createAuditLog(prisma, {
        orgId: 'unknown',
        action: 'auth.login-lockout-blocked',
        category: 'security',
        severity: 'critical',
        details: { username, clientIp, retryAfterSeconds: lockout.retryAfterSeconds },
        ipAddress: clientIp,
      });

      return reply.status(429).send({
        error: `Te veel mislukte inlogpogingen. Toegang tijdelijk vergrendeld. Probeer het opnieuw over ${lockout.retryAfterSeconds} seconden.`,
        retryAfterSeconds: lockout.retryAfterSeconds
      });
    }

    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password required' });
    }

    const user = await prisma.user.findFirst({
      where: { username }
    });

    if (!user || !user.passwordHash) {
      const attempt = securityService.recordFailedAttempt(bruteForceKey);
      if (username) {
        await createAuditLog(prisma, {
          orgId: 'unknown',
          action: 'auth.login-failed',
          category: 'security',
          severity: 'warning',
          details: { username, reason: 'Gebruiker niet gevonden', remainingAttempts: attempt.remainingAttempts },
          ipAddress: clientIp,
        });
      }
      return reply.status(401).send({
        error: 'Ongeldige inloggegevens',
        remainingAttempts: attempt.remainingAttempts
      });
    }

    if (!user.isActive) {
      await createAuditLog(prisma, {
        orgId: user.orgId,
        userId: user.id,
        action: 'auth.login-blocked',
        category: 'security',
        severity: 'warning',
        details: { reason: 'Account gedeactiveerd' },
        ipAddress: clientIp,
      });
      return reply.status(403).send({ error: 'Account is uitgeschakeld. Neem contact op met de beheerder.' });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      const attempt = securityService.recordFailedAttempt(bruteForceKey);
      await createAuditLog(prisma, {
        orgId: user.orgId,
        userId: user.id,
        action: 'auth.login-failed',
        category: 'security',
        severity: 'warning',
        details: { reason: 'Onjuist wachtwoord', remainingAttempts: attempt.remainingAttempts },
        ipAddress: clientIp,
      });

      return reply.status(401).send({
        error: 'Ongeldige inloggegevens',
        remainingAttempts: attempt.remainingAttempts
      });
    }

    // Inloggen geslaagd: reset brute-force teller
    securityService.clearFailedAttempts(bruteForceKey);

    const userAgent = (request.headers['user-agent'] as string) || '';
    const { deviceName, devicePlatform, appVersion } = (request.body as any) || {};
    const parsedDevice = securityService.parseDeviceInfo(userAgent);

    // Maak enterprise UserSession record aan
    let activeSession = null;
    try {
      activeSession = await securityService.createSession(prisma, {
        userId: user.id,
        ipAddress: clientIp,
        userAgent,
        deviceName: deviceName || parsedDevice.deviceName,
        devicePlatform: devicePlatform || parsedDevice.devicePlatform,
        expiresInDays: 7
      });
    } catch (e: any) {
      console.warn('[AUTH] Could not create user session record:', e.message);
    }

    const token = generateToken({
      id: user.id,
      orgId: user.orgId,
      role: user.role,
      tokenVersion: user.tokenVersion,
      sessionId: activeSession?.id
    });

    // Check if login is from mobile app and register device
    if (devicePlatform || userAgent.toLowerCase().includes('locra-mobile') || userAgent.toLowerCase().includes('okhttp') || userAgent.toLowerCase().includes('cfnetwork')) {
      try {
        const platform = (devicePlatform === 'ios' || devicePlatform === 'android')
          ? devicePlatform
          : (userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'ios' : 'android');
        const resolvedName = deviceName || (platform === 'ios' ? 'Apple iPhone' : 'Android Apparaat');

        await prisma.mobileDevice.create({
          data: {
            userId: user.id,
            deviceName: resolvedName,
            devicePlatform: platform,
            appVersion: appVersion || '1.0.0',
            lastActiveAt: new Date(),
            isActive: true
          }
        });
      } catch (e: any) {
        console.warn('[AUTH] Could not register mobile device:', e.message);
      }
    }

    // Log the successful login
    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'user.login',
      category: 'auth',
      severity: 'info',
      details: {
        platform: parsedDevice.devicePlatform,
        deviceName: parsedDevice.deviceName,
        sessionId: activeSession?.id
      },
      ipAddress: clientIp,
    });

    return { 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        displayName: user.displayName 
      } 
    };
  });

  // ── ACTIEVE SESSIES BEKIJKEN ──
  fastify.get('/sessions', { preHandler: [requireAuth] }, async (request, reply) => {
    const authUser = request.user!;
    const sessions = await securityService.getActiveSessions(prisma, authUser.id);
    return {
      currentSessionId: (authUser as any).sessionId || null,
      sessions: sessions.map(s => ({
        id: s.id,
        deviceName: s.deviceName,
        devicePlatform: s.devicePlatform,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        isCurrent: s.id === (authUser as any).sessionId
      }))
    };
  });

  // ── SPECIFIEKE SESSIE INTREKKEN ──
  fastify.post('/sessions/revoke', { preHandler: [requireAuth] }, async (request, reply) => {
    const { sessionId } = request.body as any;
    if (!sessionId) return reply.status(400).send({ error: 'sessionId is verplicht' });

    const success = await securityService.revokeSession(prisma, sessionId, request.user!.id);
    if (!success) {
      return reply.status(404).send({ error: 'Sessie niet gevonden of niet van deze gebruiker' });
    }

    await createAuditLog(prisma, {
      orgId: request.user!.orgId,
      userId: request.user!.id,
      action: 'auth.session-revoked',
      category: 'security',
      severity: 'info',
      details: { sessionId },
      ipAddress: request.ip
    });

    return { success: true };
  });

  // ── OVERAL UITLOGGEN (Alle sessies intrekken + tokenVersion verhogen) ──
  fastify.post('/logout-all', { preHandler: [requireAuth] }, async (request, reply) => {
    const authUser = request.user!;
    const revokedCount = await securityService.revokeAllUserSessions(prisma, authUser.id);

    await createAuditLog(prisma, {
      orgId: authUser.orgId,
      userId: authUser.id,
      action: 'auth.logout-all-devices',
      category: 'security',
      severity: 'warning',
      details: { revokedCount },
      ipAddress: request.ip
    });

    return { success: true, revokedCount, message: 'Succesvol uitgelogd op alle apparaten.' };
  });

  fastify.post('/forgot-password', async (request, reply) => {
    const { email } = request.body as any;
    const input = (email || '').trim();
    if (!input) return reply.status(400).send({ error: 'E-mailadres of gebruikersnaam is verplicht' });

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input },
          { username: input },
          { email: input.toLowerCase() },
          { username: input.toLowerCase() }
        ]
      }
    });

    if (!user) {
      await createAuditLog(prisma, {
        orgId: 'unknown',
        action: 'auth.password-reset-requested-unknown',
        category: 'security',
        severity: 'info',
        details: { input },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        message: 'Als dit e-mailadres bekend is, ontvang je spoedig een link om je wachtwoord te herstellen.'
      });
    }

    const crypto = await import('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 uur geldig

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    });

    const baseUrl = getPublicBaseUrl(request);
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { sendEmail, buildPasswordResetEmail } = await import('../../utils/mailer');
      const emailHtml = buildPasswordResetEmail(user.displayName, resetUrl);
      await sendEmail(user.orgId, user.email, 'Wachtwoord Herstellen — Locra', emailHtml);
      emailSent = true;
    } catch (err: any) {
      emailError = err.message || 'Kon e-mail niet verzenden';
    }

    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'auth.password-reset-requested',
      category: 'auth',
      severity: 'info',
      details: { emailSent, emailError: emailError ? String(emailError) : null },
      ipAddress: request.ip,
    });

    return reply.send({
      success: true,
      emailSent,
      emailError: emailError ? 'E-mail kon niet worden bezorgd via SMTP. Controleer de SMTP instellingen in het Admin paneel of de serverconsole.' : undefined,
      message: 'Als dit e-mailadres bekend is, ontvang je spoedig een link om je wachtwoord te herstellen.'
    });
  });

  fastify.post('/reset-password', async (request, reply) => {
    const { token, newPassword } = request.body as any;
    if (!token || !newPassword) return reply.status(400).send({ error: 'Token and new password required' });

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      return reply.status(400).send({ error: 'Ongeldig of verlopen token' });
    }

    const { hashPassword } = await import('../../utils/crypto');
    const passwordHash = await hashPassword(newPassword);

    // Update wachtwoord, wis tokens en verhoog tokenVersion (invalideert alle actieve sessies!)
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        tokenVersion: { increment: 1 }
      }
    });

    // Revoke all existing session records
    await securityService.revokeAllUserSessions(prisma, user.id);

    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'auth.password-reset-completed',
      category: 'auth',
      severity: 'critical',
      ipAddress: request.ip,
    });

    return reply.send({ success: true, message: 'Wachtwoord succesvol gewijzigd. Je bent nu overal veilig uitgelogd.' });
  });
}
