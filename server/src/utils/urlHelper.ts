import type { FastifyRequest } from 'fastify';
import { prisma } from '../index';

/**
 * Bepaal de publieke base URL van de applicatie.
 * 
 * Prioriteit:
 * 1. customDomain uit OrgSettings (bijv. "chat.mijnschool.nl")
 * 2. Origin header van de browser request (bijv. "https://locra.school.nl")
 * 3. Referer header (fallback, parsed naar origin)
 * 4. X-Forwarded-Host + X-Forwarded-Proto (reverse proxy)
 * 5. request.headers.host (laatste resort)
 */
export async function getPublicBaseUrl(request: FastifyRequest): Promise<string> {
  // 1. Check customDomain in database
  const orgId = (request as any).user?.orgId;
  if (orgId) {
    try {
      const settings = await prisma.orgSettings.findUnique({
        where: { orgId },
        select: { customDomain: true }
      });
      if (settings?.customDomain) {
        const domain = settings.customDomain.trim();
        // Als het al een volledige URL is (https://...), gebruik direct
        if (domain.startsWith('http://') || domain.startsWith('https://')) {
          return domain.replace(/\/$/, ''); // strip trailing slash
        }
        // Anders, maak er een https URL van
        return `https://${domain}`;
      }
    } catch {
      // Database error — ga door naar headers
    }
  }

  // 2. Origin header (meest betrouwbaar vanuit de browser)
  const origin = request.headers.origin as string | undefined;
  if (origin && origin !== 'null') {
    return origin.replace(/\/$/, '');
  }

  // 3. Referer header (parse naar origin)
  const referer = request.headers.referer as string | undefined;
  if (referer) {
    try {
      const url = new URL(referer);
      return url.origin;
    } catch {
      // Ongeldige referer, ga door
    }
  }

  // 4. X-Forwarded-Host + X-Forwarded-Proto (reverse proxy)
  const fwdHost = request.headers['x-forwarded-host'] as string | undefined;
  const fwdProto = (request.headers['x-forwarded-proto'] as string | undefined) || 'http';
  if (fwdHost) {
    return `${fwdProto}://${fwdHost}`;
  }

  // 5. Fallback: request host header
  const host = request.headers.host || 'localhost:3000';
  const proto = (request.headers['x-forwarded-proto'] as string | undefined) || 'http';
  return `${proto}://${host}`;
}
