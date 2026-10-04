import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { hashPassword } from '../../utils/crypto';

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Get current user profile
  fastify.get('/me', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id }
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    
    // Remove sensitive data before returning
    const { passwordHash, totpSecret, ...safeUser } = user;
    return safeUser;
  });

  // Update current user settings
  fastify.put('/me/settings', async (request, reply) => {
    const { language, darkMode, storagePreference, password } = request.body as any;
    
    let updateData: any = {};
    if (language !== undefined) updateData.language = language;
    if (darkMode !== undefined) updateData.darkMode = darkMode;
    if (storagePreference !== undefined) updateData.storagePreference = storagePreference;
    if (password) updateData.passwordHash = hashPassword(password);

    const user = await prisma.user.update({
      where: { id: request.user!.id },
      data: updateData
    });
    
    const { passwordHash, totpSecret, ...safeUser } = user;
    return safeUser;
  });

  // Update current user academy progress
  fastify.put('/me/academy', async (request, reply) => {
    const { academyXp, academyLevel, academyProgress } = request.body as any;
    
    let updateData: any = {};
    if (academyXp !== undefined) updateData.academyXp = academyXp;
    if (academyLevel !== undefined) updateData.academyLevel = academyLevel;
    if (academyProgress !== undefined) updateData.academyProgress = academyProgress;

    const user = await prisma.user.update({
      where: { id: request.user!.id },
      data: updateData
    });
    
    const { passwordHash, totpSecret, ...safeUser } = user;
    return safeUser;
  });

  // Get current user quota
  fastify.get('/me/quota', async (request, reply) => {
    const authUser = request.user!;
    const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId: authUser.orgId } });
    if (!orgSettings) return reply.status(404).send({ error: 'Org settings not found' });

    let effectiveMaxPromptsPerDay = orgSettings.maxPromptsPerDay;
    let effectiveMaxPromptsPerMonth = orgSettings.maxPromptsPerMonth;

    if (authUser.role === 'student') {
      const userClasses = await prisma.studentClass.findMany({
        where: { studentId: authUser.id },
        include: { class: true }
      });
      for (const uc of userClasses) {
        if (uc.class.customQuotaEnabled) {
          if (uc.class.maxPromptsPerDay !== null) {
            if (effectiveMaxPromptsPerDay === null || uc.class.maxPromptsPerDay > effectiveMaxPromptsPerDay) {
              effectiveMaxPromptsPerDay = uc.class.maxPromptsPerDay;
            }
          }
          if (uc.class.maxPromptsPerMonth !== null) {
            if (effectiveMaxPromptsPerMonth === null || uc.class.maxPromptsPerMonth > effectiveMaxPromptsPerMonth) {
              effectiveMaxPromptsPerMonth = uc.class.maxPromptsPerMonth;
            }
          }
        }
      }
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const promptsToday = await prisma.message.count({
      where: { userId: authUser.id, role: 'user', createdAt: { gte: startOfDay } }
    });
    const promptsThisMonth = await prisma.message.count({
      where: { userId: authUser.id, role: 'user', createdAt: { gte: startOfMonth } }
    });

    const userRecord = await prisma.user.findUnique({ where: { id: authUser.id } });

    return {
      enableRateLimiting: orgSettings.enableRateLimiting,
      promptsToday,
      maxPromptsPerDay: effectiveMaxPromptsPerDay,
      promptsThisMonth,
      maxPromptsPerMonth: effectiveMaxPromptsPerMonth,
      
      enableCredits: orgSettings.enableCredits,
      creditsUsed: userRecord?.creditsUsed || 0,
      totalCredits: orgSettings.defaultCreditsPerUser
    };
  });

  // Search users in own org (for sharing)
  fastify.get('/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.length < 2) return reply.status(400).send({ error: 'Minimaal 2 tekens nodig' });

    const users = await prisma.user.findMany({
      where: {
        orgId: request.user!.orgId,
        id: { not: request.user!.id }, // Exclude self
        OR: [
          { username: { contains: q } },
          { displayName: { contains: q } },
          { email: { contains: q } }
        ]
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true
      },
      take: 10
    });
    return users;
  });

  // Admin: list users
  fastify.get('/', { preHandler: requireRole('admin') }, async (request, reply) => {
    const users = await prisma.user.findMany({
      where: { orgId: request.user!.orgId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });
    return users;
  });

  // Admin: create user
  fastify.post('/', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { username, email, displayName, password, role } = request.body as any;
    
    if (!username || !email || !password || !role) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    const hashedPassword = await hashPassword(password);
    
    try {
      const newUser = await prisma.user.create({
        data: {
          orgId: request.user!.orgId,
          username,
          email,
          displayName: displayName || username,
          passwordHash: hashedPassword,
          role
        }
      });
      
      const { passwordHash, totpSecret, ...safeUser } = newUser;
      return reply.status(201).send(safeUser);
    } catch (e: any) {
      return reply.status(400).send({ error: 'User creation failed. Username or email may already exist.' });
    }
  });

  // Admin: bulk import users from CSV
  fastify.post('/import', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { csvData } = request.body as { csvData: string };
    
    if (!csvData) {
      return reply.status(400).send({ error: 'Missing CSV data' });
    }

    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return reply.status(400).send({ error: 'CSV moet minimaal een header-rij en één data-rij bevatten' });
    }

    // Parse header (first line)
    const headerLine = lines[0].toLowerCase().replace(/"/g, '').trim();
    const sep = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(sep).map(h => h.trim());
    
    // Map headers to field names
    const fieldMap: Record<string, string> = {};
    const aliases: Record<string, string[]> = {
      username: ['username', 'gebruikersnaam', 'user', 'login', 'leerlingnummer'],
      email: ['email', 'e-mail', 'mail', 'emailadres'],
      displayName: ['displayname', 'naam', 'name', 'weergavenaam', 'voornaam', 'achternaam', 'volledige naam'],
      password: ['password', 'wachtwoord', 'pass', 'pw'],
      role: ['role', 'rol', 'type']
    };

    for (const [field, aliasList] of Object.entries(aliases)) {
      const idx = headers.findIndex(h => aliasList.includes(h));
      if (idx !== -1) fieldMap[field] = headers[idx];
    }

    if (!fieldMap.username && !fieldMap.email) {
      return reply.status(400).send({ error: 'CSV moet minimaal een "username" of "email" kolom bevatten' });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(sep).map(v => v.replace(/"/g, '').trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      const username = row[fieldMap.username || ''] || row[fieldMap.email || '']?.split('@')[0] || '';
      const email = row[fieldMap.email || ''] || `${username}@locra.local`;
      const displayName = row[fieldMap.displayName || ''] || username;
      const password = row[fieldMap.password || ''] || Math.random().toString(36).slice(-8) + 'A1!';
      const role = row[fieldMap.role || ''] || 'student';

      if (!username) {
        errors.push(`Rij ${i + 1}: Geen gebruikersnaam gevonden`);
        skipped++;
        continue;
      }

      try {
        const hashedPw = await hashPassword(password);
        await prisma.user.create({
          data: {
            orgId: request.user!.orgId,
            username,
            email,
            displayName,
            passwordHash: hashedPw,
            role: ['student', 'teacher', 'admin'].includes(role) ? role : 'student'
          }
        });
        created++;
      } catch (e: any) {
        errors.push(`Rij ${i + 1} (${username}): ${e.message?.includes('Unique') ? 'Bestaat al' : 'Fout'}`);
        skipped++;
      }
    }

    return { 
      success: true, 
      created, 
      skipped, 
      total: lines.length - 1,
      errors: errors.slice(0, 20) // Max 20 foutmeldingen
    };
  });

  // Admin: update user
  fastify.put('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { displayName, role, isActive, password } = request.body as any;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.orgId !== request.user!.orgId) {
      return reply.status(404).send({ error: 'Gebruiker niet gevonden' });
    }

    const dataToUpdate: any = {};
    if (displayName !== undefined) dataToUpdate.displayName = displayName;
    if (role !== undefined) dataToUpdate.role = role;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    
    if (password) {
      dataToUpdate.passwordHash = await hashPassword(password);
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { id },
        data: dataToUpdate
      });
      const { passwordHash, totpSecret, ...safeUser } = updatedUser;
      return safeUser;
    } catch (e: any) {
      return reply.status(400).send({ error: 'Update failed' });
    }
  });

  // Admin: delete or deactivate user
  fastify.delete('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.orgId !== request.user!.orgId) {
      return reply.status(404).send({ error: 'Gebruiker niet gevonden' });
    }
    
    // By default, just deactivate to keep audit logs and chat history intact
    await prisma.user.update({
      where: { id },
      data: { isActive: false }
    });

    return { success: true, message: 'Gebruiker gedeactiveerd' };
  });

  // GDPR: Export user data (Admin only for now, could be self-service)
  fastify.get('/:id/export', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        conversations: {
          include: {
            messages: true
          }
        },
        feedback: true
      }
    });

    if (!user || user.orgId !== request.user!.orgId) {
      return reply.status(404).send({ error: 'Gebruiker niet gevonden' });
    }

    const { passwordHash, totpSecret, ...safeData } = user;
    
    // Set headers for file download
    reply.header('Content-Disposition', `attachment; filename="gdpr_export_${user.username}.json"`);
    reply.type('application/json');
    
    return safeData;
  });

  // GDPR: Delete all user data ("Right to be forgotten")
  fastify.delete('/:id/data', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.orgId !== request.user!.orgId) {
      return reply.status(404).send({ error: 'Gebruiker niet gevonden' });
    }

    // Must delete in order to respect foreign key constraints (or rely on Cascade if configured)
    await prisma.feedback.deleteMany({ where: { userId: id } });
    
    // Find all conversations owned by user
    const conversations = await prisma.conversation.findMany({ where: { userId: id } });
    const convIds = conversations.map(c => c.id);

    await prisma.message.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.conversationParticipant.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.conversation.deleteMany({ where: { userId: id } });

    // Remove from group memberships
    await prisma.groupMember.deleteMany({ where: { userId: id } });

    // Finally delete user
    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        orgId: request.user!.orgId,
        userId: request.user!.id,
        action: 'user.gdpr_delete',
        details: JSON.stringify({ deletedUserId: id, username: user.username })
      }
    });

    return { success: true, message: 'Alle data van gebruiker is permanent verwijderd' };
  });
}
