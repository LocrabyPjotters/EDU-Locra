import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../utils/crypto';

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
    request.user = decoded;

    // --- LICENSE LOCK-DOWN CHECK (3-maandelijkse cyclus + 14 dagen grace period) ---
    const { prisma } = await import('../index');
    const { getLicense, HARD_LOCKDOWN_DAYS } = await import('../services/license');
    const org = await prisma.orgSettings.findUnique({ where: { orgId: decoded.orgId } });
    
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
