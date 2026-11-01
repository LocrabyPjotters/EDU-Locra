import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

interface FailedAttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minuten window
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minuten lockout

// In-memory cache voor inlogpogingen
const failedAttemptsMap = new Map<string, FailedAttemptRecord>();

// Schoon periodiek verlopen records op
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of failedAttemptsMap.entries()) {
    if (record.lockedUntil && record.lockedUntil < now) {
      failedAttemptsMap.delete(key);
    } else if (!record.lockedUntil && now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
      failedAttemptsMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const securityService = {
  /**
   * Controleert of een IP of gebruikersnaam momenteel vergrendeld is door brute-force detectie.
   */
  isLockedOut(identifier: string): { locked: boolean; retryAfterSeconds: number } {
    const record = failedAttemptsMap.get(identifier);
    if (!record || !record.lockedUntil) {
      return { locked: false, retryAfterSeconds: 0 };
    }

    const now = Date.now();
    if (now < record.lockedUntil) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { locked: true, retryAfterSeconds };
    }

    // Lockout is verstreken
    failedAttemptsMap.delete(identifier);
    return { locked: false, retryAfterSeconds: 0 };
  },

  /**
   * Registreert een mislukte inlogpoging en activeert eventueel een lockout.
   */
  recordFailedAttempt(identifier: string): { locked: boolean; remainingAttempts: number; retryAfterSeconds: number } {
    const now = Date.now();
    let record = failedAttemptsMap.get(identifier);

    if (!record || (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS && !record.lockedUntil)) {
      record = { count: 1, firstAttemptAt: now, lockedUntil: null };
      failedAttemptsMap.set(identifier, record);
      return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - 1, retryAfterSeconds: 0 };
    }

    record.count += 1;

    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
      return {
        locked: true,
        remainingAttempts: 0,
        retryAfterSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000)
      };
    }

    return {
      locked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS - record.count,
      retryAfterSeconds: 0
    };
  },

  /**
   * Wist mislukte inlogpogingen na een succesvolle inlog.
   */
  clearFailedAttempts(identifier: string): void {
    failedAttemptsMap.delete(identifier);
  },

  /**
   * Maakt een actieve UserSession aan in de database.
   */
  async createSession(
    prisma: PrismaClient,
    params: {
      userId: string;
      ipAddress?: string;
      userAgent?: string;
      deviceName?: string;
      devicePlatform?: string;
      expiresInDays?: number;
    }
  ) {
    const days = params.expiresInDays || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const refreshToken = crypto.randomBytes(32).toString('hex');

    return prisma.userSession.create({
      data: {
        userId: params.userId,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent ? params.userAgent.substring(0, 255) : null,
        deviceName: params.deviceName || null,
        devicePlatform: params.devicePlatform || 'desktop',
        refreshToken,
        expiresAt,
        lastActiveAt: new Date()
      }
    });
  },

  /**
   * Haalt alle actieve sessies van een gebruiker op.
   */
  async getActiveSessions(prisma: PrismaClient, userId: string) {
    const now = new Date();
    return prisma.userSession.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: now }
      },
      orderBy: { lastActiveAt: 'desc' }
    });
  },

  /**
   * Trekt een specifieke sessie in.
   */
  async revokeSession(prisma: PrismaClient, sessionId: string, userId: string): Promise<boolean> {
    const session = await prisma.userSession.findFirst({
      where: { id: sessionId, userId }
    });
    if (!session) return false;

    await prisma.userSession.update({
      where: { id: sessionId },
      data: { isRevoked: true }
    });
    return true;
  },

  /**
   * Trekt ALLE actieve sessies in voor een gebruiker en verhoogt tokenVersion,
   * waardoor ook actieve JWT's onmiddellijk ongeldig worden.
   */
  async revokeAllUserSessions(prisma: PrismaClient, userId: string): Promise<number> {
    // 1. Markeer alle sessies als ingetrokken
    const updatedSessions = await prisma.userSession.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true }
    });

    // 2. Verhoog de tokenVersion van de gebruiker (invalideert alle actieve JWTs direct)
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } }
    });

    return updatedSessions.count;
  },

  /**
   * Parseert platform- en apparaatinformatie uit een user-agent string.
   */
  parseDeviceInfo(userAgent?: string): { devicePlatform: string; deviceName: string } {
    if (!userAgent) return { devicePlatform: 'desktop', deviceName: 'Webbrowser' };
    const ua = userAgent.toLowerCase();

    let platform = 'desktop';
    let name = 'Webbrowser';

    if (ua.includes('iphone')) {
      platform = 'ios';
      name = 'Apple iPhone';
    } else if (ua.includes('ipad')) {
      platform = 'ios';
      name = 'Apple iPad';
    } else if (ua.includes('android')) {
      platform = 'android';
      name = 'Android Apparaat';
    } else if (ua.includes('macintosh') || ua.includes('mac os')) {
      name = 'Mac Desktop';
    } else if (ua.includes('windows')) {
      name = 'Windows PC';
    } else if (ua.includes('linux')) {
      name = 'Linux Werkstation';
    } else if (ua.includes('cros')) {
      name = 'Chromebook';
    }

    if (ua.includes('chrome') && !ua.includes('edg')) name += ' (Chrome)';
    else if (ua.includes('safari') && !ua.includes('chrome')) name += ' (Safari)';
    else if (ua.includes('firefox')) name += ' (Firefox)';
    else if (ua.includes('edg')) name += ' (Edge)';

    return { devicePlatform: platform, deviceName: name };
  }
};

