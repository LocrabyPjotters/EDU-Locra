import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../utils/crypto';
import { prisma } from '../index';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if ((request.query as any)?.token) {
    token = (request.query as any).token;
  }

  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized: Missing or invalid token format' });
  }

  try {
    const decoded = verifyToken(token);

    // ── STRIKTE ACTIVE USER & TOKEN VERSION VERIFICATIE ──
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        orgId: true,
        role: true,
        displayName: true,
        email: true,
        isActive: true,
        tokenVersion: true
      }
    });

    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized: User does not exist' });
    }

    if (!user.isActive) {
      return reply.status(403).send({ error: 'Forbidden: Account is deactivated' });
    }

    // Controleer of de token een oudere tokenVersion heeft dan de huidige versie in de database
    if (
      typeof decoded.tokenVersion === 'number' &&
      typeof user.tokenVersion === 'number' &&
      decoded.tokenVersion < user.tokenVersion
    ) {
      return reply.status(401).send({ error: 'Session revoked: Token is no longer valid' });
    }

    request.user = {
      ...decoded,
      role: user.role,
      orgId: user.orgId,
      displayName: user.displayName,
      tokenVersion: user.tokenVersion
    };

    // --- LICENSE LOCK-DOWN CHECK (3-maandelijkse cyclus + 14 dagen grace period) ---
    const { getLicense, HARD_LOCKDOWN_DAYS } = await import('../services/license');
    const org = await prisma.orgSettings.findUnique({ where: { orgId: user.orgId } });
    
    // Ignore lockdown check on endpoints used for re-activation and network diagnostics
    const isLicenseEndpoint = request.url.includes('/api/settings/license') || request.url.includes('/api/network/license');
    const isSetupEndpoint = request.url.includes('/api/setup');
    const isAuthEndpoint = request.url.includes('/api/auth');
    
    if (org && !isLicenseEndpoint && !isSetupEndpoint && !isAuthEndpoint) {
      const now = new Date();
      const verifiedAt = org.licenseVerifiedAt;
      const maxAllowedAgeMs = HARD_LOCKDOWN_DAYS * 24 * 60 * 60 * 1000; // 90 days + 14 days grace period
      
      const currentLic = getLicense();
      const isExplicitlyRevoked = currentLic.valid === false && currentLic.reason && !currentLic.reason.includes('Offline');

      // If the license is missing, has never been verified, age exceeds 104 days, or explicitly revoked -> lockdown
      if (!org.licenseKey || !verifiedAt || (now.getTime() - verifiedAt.getTime() > maxAllowedAgeMs) || isExplicitlyRevoked) {
        return reply.status(403).send({ 
          error: 'license_expired', 
          message: 'Locra licentie verlopen, ongeldig of ontbrekend. Verifieer de licentiesleutel via api.rowmatch.nl om het systeem te ontgrendelen.' 
        });
      }
    }
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
  }
}
