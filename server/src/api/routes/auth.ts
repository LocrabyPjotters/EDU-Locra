import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { verifyPassword, generateToken } from '../../utils/crypto';

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
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return reply.status(403).send({ error: 'Account is disabled' });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      id: user.id,
      orgId: user.orgId,
      role: user.role
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        orgId: user.orgId,
        userId: user.id,
        action: 'user.login',
        ipAddress: request.ip
      }
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
    if (!email) return reply.status(400).send({ error: 'Email required' });

    const user = await prisma.user.findFirst({
      where: { email, isActive: true },
      include: { org: true }
    });

    if (!user) {
      // Return 200 even if not found for security reasons
      return reply.send({ success: true });
    }

    const { randomBytes } = await import('crypto');
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    });

    const resetLink = `http://${request.headers.host}/reset-password?token=${resetToken}`;
    
    try {
      const { sendEmail } = await import('../../utils/mailer');
      await sendEmail(
        user.orgId,
        user.email,
        'Wachtwoord Herstellen - Locra',
        `<p>Beste ${user.displayName},</p><p>Je hebt een wachtwoord herstel aangevraagd. Klik op de volgende link om een nieuw wachtwoord in te stellen:</p><p><a href="${resetLink}">Wachtwoord herstellen</a></p><p>Deze link is 1 uur geldig.</p>`
      );
    } catch (e) {
      console.error('Email failed:', e);
      // Even if email fails, for security we don't expose it to user (maybe could return 500 but standard is 200)
    }

    return reply.send({ success: true });
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

    return reply.send({ success: true });
  });
}
