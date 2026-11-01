import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { createAuditLog } from '../../services/auditService';
import { profileService } from '../../services/profileService';

export default async function profileRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // ── 1. GET /api/profiles/me — Leerling bekijkt eigen profiel ──
  fastify.get('/me', async (request, reply) => {
    const user = request.user!;
    const settings = await prisma.orgSettings.findUnique({ where: { orgId: user.orgId } });

    if (!settings?.enableUserProfileBuilding) {
      return reply.status(403).send({ error: 'AI-gebruikersprofilering is niet ingeschakeld door de schoolbeheerder.' });
    }

    if (user.role === 'student' && !settings.profileStudentCanView) {
      return reply.status(403).send({ error: 'Inzage in het AI-profiel is door de beheerder uitgeschakeld voor leerlingen.' });
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id }
    });

    return {
      profile: profile || null,
      settings: {
        canEdit: settings.profileStudentCanEdit,
        trackInterests: settings.profileTrackInterests,
        trackLearningStyle: settings.profileTrackLearningStyle,
        trackStrengthsWeaknesses: settings.profileTrackStrengthsWeaknesses,
        trackGoals: settings.profileTrackGoals,
        trackPersonality: settings.profileTrackPersonality
      }
    };
  });

  // ── 2. PATCH /api/profiles/me/personalization — Toggle personalisatie aan/uit ──
  fastify.patch('/me/personalization', async (request, reply) => {
    const user = request.user!;
    const { enabled } = request.body as { enabled: boolean };

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        orgId: user.orgId,
        isPersonalizationEnabled: Boolean(enabled)
      },
      update: {
        isPersonalizationEnabled: Boolean(enabled)
      }
    });

    return { success: true, isPersonalizationEnabled: profile.isPersonalizationEnabled };
  });

  // ── 3. DELETE /api/profiles/me/item — Leerling verwijdert specifiek item uit eigen profiel ──
  fastify.delete('/me/item', async (request, reply) => {
    const user = request.user!;
    const settings = await prisma.orgSettings.findUnique({ where: { orgId: user.orgId } });

    if (user.role === 'student' && !settings?.profileStudentCanEdit) {
      return reply.status(403).send({ error: 'Je hebt geen rechten om items uit je profiel te verwijderen.' });
    }

    const { category, item } = request.body as { category: string; item: string };
    if (!category || !item) {
      return reply.status(400).send({ error: 'Categorie en item zijn verplicht.' });
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return reply.status(404).send({ error: 'Profiel niet gevonden.' });

    const validCategories = ['interests', 'strengths', 'difficulties', 'goals', 'personalityTraits'];
    if (!validCategories.includes(category)) {
      return reply.status(400).send({ error: 'Ongeldige categorie.' });
    }

    let items: string[] = [];
    try {
      if ((profile as any)[category]) items = JSON.parse((profile as any)[category]);
    } catch {}

    const updated = items.filter(i => i.toLowerCase().trim() !== item.toLowerCase().trim());

    await prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        [category]: JSON.stringify(updated)
      }
    });

    return { success: true, updatedItems: updated };
  });

  // ── 4. GET /api/profiles/user/:userId — Admin of Docent bekijkt profiel van gebruiker ──
  fastify.get('/user/:userId', async (request, reply) => {
    const caller = request.user!;
    const { userId } = request.params as { userId: string };

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.orgId !== caller.orgId) {
      return reply.status(404).send({ error: 'Gebruiker niet gevonden in jouw organisatie.' });
    }

    const settings = await prisma.orgSettings.findUnique({ where: { orgId: caller.orgId } });

    if (caller.role !== 'admin' && caller.role !== 'superadmin') {
      if (caller.role === 'teacher' && !settings?.profileTeacherCanView) {
        return reply.status(403).send({ error: 'Docenten hebben geen toestemming om profielen in te zien.' });
      }
      if (caller.role !== 'teacher') {
        return reply.status(403).send({ error: 'Onvoldoende rechten.' });
      }
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId }
    });

    return {
      targetUser: {
        id: targetUser.id,
        displayName: targetUser.displayName,
        username: targetUser.username,
        role: targetUser.role
      },
      profile: profile || null,
      settings: {
        enabled: settings?.enableUserProfileBuilding,
        trackInterests: settings?.profileTrackInterests,
        trackLearningStyle: settings?.profileTrackLearningStyle,
        trackStrengthsWeaknesses: settings?.profileTrackStrengthsWeaknesses,
        trackGoals: settings?.profileTrackGoals,
        trackPersonality: settings?.profileTrackPersonality
      }
    };
  });

  // ── 5. PUT /api/profiles/user/:userId — Admin past handmatig velden aan ──
  fastify.put('/user/:userId', async (request, reply) => {
    const caller = request.user!;
    if (caller.role !== 'admin' && caller.role !== 'superadmin') {
      return reply.status(403).send({ error: 'Alleen beheerders kunnen profielen handmatig aanpassen.' });
    }

    const { userId } = request.params as { userId: string };
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.orgId !== caller.orgId) {
      return reply.status(404).send({ error: 'Gebruiker niet gevonden.' });
    }

    const body = request.body as any;

    const dataToUpdate: any = {};
    if (body.interests !== undefined) dataToUpdate.interests = typeof body.interests === 'string' ? body.interests : JSON.stringify(body.interests);
    if (body.learningStyle !== undefined) dataToUpdate.learningStyle = body.learningStyle;
    if (body.strengths !== undefined) dataToUpdate.strengths = typeof body.strengths === 'string' ? body.strengths : JSON.stringify(body.strengths);
    if (body.difficulties !== undefined) dataToUpdate.difficulties = typeof body.difficulties === 'string' ? body.difficulties : JSON.stringify(body.difficulties);
    if (body.goals !== undefined) dataToUpdate.goals = typeof body.goals === 'string' ? body.goals : JSON.stringify(body.goals);
    if (body.personalityTraits !== undefined) dataToUpdate.personalityTraits = typeof body.personalityTraits === 'string' ? body.personalityTraits : JSON.stringify(body.personalityTraits);
    if (body.aiPersonaSummary !== undefined) dataToUpdate.aiPersonaSummary = body.aiPersonaSummary;

    const updatedProfile = await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        orgId: caller.orgId,
        ...dataToUpdate
      },
      update: dataToUpdate
    });

    await createAuditLog(prisma, {
      orgId: caller.orgId,
      userId: caller.id,
      action: 'profile.manual_update',
      category: 'user',
      severity: 'info',
      details: { targetUserId: userId },
      ipAddress: request.ip
    });

    return { success: true, profile: updatedProfile };
  });

  // ── 6. POST /api/profiles/user/:userId/reset — Admin reset AI-profiel volledig ──
  fastify.post('/user/:userId/reset', async (request, reply) => {
    const caller = request.user!;
    if (caller.role !== 'admin' && caller.role !== 'superadmin') {
      return reply.status(403).send({ error: 'Alleen beheerders kunnen profielen resetten.' });
    }

    const { userId } = request.params as { userId: string };
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.orgId !== caller.orgId) {
      return reply.status(404).send({ error: 'Gebruiker niet gevonden.' });
    }

    await prisma.userProfile.deleteMany({
      where: { userId }
    });

    await createAuditLog(prisma, {
      orgId: caller.orgId,
      userId: caller.id,
      action: 'profile.reset',
      category: 'user',
      severity: 'warning',
      details: { targetUserId: userId },
      ipAddress: request.ip
    });

    return { success: true, message: 'AI-profiel van deze gebruiker is succesvol gereset.' };
  });

  // ── 7. POST /api/profiles/user/:userId/analyze — Admin triggert directe AI-analyse op basis van recente chats ──
  fastify.post('/user/:userId/analyze', async (request, reply) => {
    const caller = request.user!;
    if (caller.role !== 'admin' && caller.role !== 'superadmin') {
      return reply.status(403).send({ error: 'Alleen beheerders kunnen profielanalyses forceren.' });
    }

    const { userId } = request.params as { userId: string };
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.orgId !== caller.orgId) {
      return reply.status(404).send({ error: 'Gebruiker niet gevonden.' });
    }

    try {
      const updatedProfile = await profileService.analyzeUserHistory(prisma, {
        userId,
        orgId: caller.orgId
      });

      if (!updatedProfile) {
        return reply.status(400).send({ error: 'Kon geen profiel genereren op basis van de huidige chats.' });
      }

      await createAuditLog(prisma, {
        orgId: caller.orgId,
        userId: caller.id,
        action: 'profile.force_analyze',
        category: 'user',
        severity: 'info',
        details: { targetUserId: userId },
        ipAddress: request.ip
      });

      return { success: true, profile: updatedProfile };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Analyse mislukt' });
    }
  });
}
