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

    // --- LICENSE LOCK-DOWN CHECK ---
    const { prisma } = await import('../index');
    const org = await prisma.orgSettings.findUnique({ where: { orgId: decoded.orgId } });
    
    // Ignore lockdown check on the specific endpoints used for re-activation
    const isLicenseEndpoint = request.url.includes('/api/settings/license');
    const isSetupEndpoint = request.url.includes('/api/setup');
    const isAuthEndpoint = request.url.includes('/api/auth');
    
    if (org && !isLicenseEndpoint && !isSetupEndpoint && !isAuthEndpoint) {
      const now = new Date();
      const verifiedAt = org.licenseVerifiedAt;
      const msIn30Days = 30 * 24 * 60 * 60 * 1000;
      
      // If the license is missing, has never been verified, or verification is older than 30 days -> lockdown
      if (!org.licenseKey || !verifiedAt || (now.getTime() - verifiedAt.getTime() > msIn30Days)) {
        return reply.status(403).send({ 
          error: 'license_expired', 
          message: 'Locra licentie verlopen of ontbrekend. Verifieer de licentiesleutel om het systeem te ontgrendelen.' 
        });
      }
    }
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
  }
}
