import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { verifyPassword, generateToken } from '../../utils/crypto';
import { createAuditLog } from '../../services/auditService';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body as any;

    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password required' });
    }

    const user = await prisma.user.findFirst({
      where: { username }
    });

    if (!user || !user.passwordHash) {
      // Log failed login attempt (unknown user)
      if (username) {
        await createAuditLog(prisma, {
          orgId: 'unknown',
          action: 'auth.login-failed',
          category: 'security',
          severity: 'warning',
          details: { username, reason: 'Gebruiker niet gevonden' },
          ipAddress: request.ip,
        });
      }
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      await createAuditLog(prisma, {
        orgId: user.orgId,
        userId: user.id,
        action: 'auth.login-blocked',
        category: 'security',
        severity: 'warning',
        details: { reason: 'Account gedeactiveerd' },
        ipAddress: request.ip,
      });
      return reply.status(403).send({ error: 'Account is disabled' });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      await createAuditLog(prisma, {
        orgId: user.orgId,
        userId: user.id,
        action: 'auth.login-failed',
        category: 'security',
        severity: 'warning',
        details: { reason: 'Onjuist wachtwoord' },
        ipAddress: request.ip,
      });
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      id: user.id,
      orgId: user.orgId,
      role: user.role
    });

    // Log the action
    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'user.login',
      category: 'auth',
      severity: 'info',
      ipAddress: request.ip,
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

  fastify.post('/forgot-password', async (request, reply) => {
    const { email } = request.body as any;
    const input = (email || '').trim();
    if (!input) return reply.status(400).send({ error: 'E-mailadres of gebruikersnaam is verplicht' });

    // Zoek gebruiker op e-mail óf gebruikersnaam (zowel origineel als kleine letters voor betrouwbaarheid)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input },
          { email: input.toLowerCase() },
          { username: input },
          { username: input.toLowerCase() }
        ],
        isActive: true
      },
      include: { org: true }
    });

    if (!user) {
      // Voor veiligheid geven we altijd success: true terug naar de frontend
      return reply.send({ success: true, message: 'Als dit account bestaat, is er een resetlink verstuurd.' });
    }

    const { randomBytes } = await import('crypto');
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 uur geldig

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    });

    // Detecteer https of http obv proxies/headers
    const proto = (request.headers['x-forwarded-proto'] as string) || (request.raw as any).protocol || 'http';
    const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || 'localhost:3000';
    const resetLink = `${proto}://${host}/reset-password?token=${resetToken}`;

    // Log altijd in de server terminal voor support & troubleshooting
    console.log('\n======================================================');
    console.log('🔑 [AUTH] Wachtwoord-reset link gegenereerd');
    console.log(`👤 Gebruiker: ${user.displayName} (@${user.username})`);
    console.log(`📧 E-mail: ${user.email}`);
    console.log(`🔗 Link: ${resetLink}`);
    console.log('======================================================\n');

    let emailSent = false;
    let emailError: string | null = null;

    if (user.email && user.email.includes('@')) {
      try {
        const { sendEmail, buildPasswordResetEmail } = await import('../../utils/mailer');
        const html = buildPasswordResetEmail(user.displayName || user.username, resetLink);
        
        await sendEmail(
          user.orgId,
          user.email,
          'Wachtwoord Herstellen - Locra',
          html
        );
        emailSent = true;

        await createAuditLog(prisma, {
          orgId: user.orgId,
          userId: user.id,
          action: 'auth.password-reset-email-sent',
          category: 'auth',
          severity: 'info',
          details: { email: user.email },
          ipAddress: request.ip,
        });
      } catch (e: any) {
        emailError = e.message;
        console.error('⚠️ [AUTH] Kon reset e-mail niet versturen via SMTP:', e.message);

        await createAuditLog(prisma, {
          orgId: user.orgId,
          userId: user.id,
          action: 'auth.password-reset-email-failed',
          category: 'auth',
          severity: 'warning',
          details: { error: e.message, email: user.email },
          ipAddress: request.ip,
        });
      }
    } else {
      console.warn(`⚠️ [AUTH] Gebruiker ${user.username} heeft geen geldig e-mailadres ingesteld.`);
    }

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

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'auth.password-reset-completed',
      category: 'auth',
      severity: 'critical',
      ipAddress: request.ip,
    });

    return reply.send({ success: true });
  });
}
