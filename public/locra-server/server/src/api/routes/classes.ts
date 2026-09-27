import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';

export default async function classRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // List all classes for the org
  fastify.get('/', async (request, reply) => {
    const classes = await prisma.class.findMany({
      where: { orgId: request.user!.orgId },
      include: {
        _count: {
          select: { studentMembers: true, teacherMembers: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return classes;
  });

  // Get quota settings for UI
  fastify.get('/quota-settings', async (request, reply) => {
    const settings = await prisma.orgSettings.findUnique({
      where: { orgId: request.user!.orgId },
      select: {
        allowTeachersToOverrideQuota: true,
        maxTeacherOverrideQuota: true
      }
    });
    return settings || { allowTeachersToOverrideQuota: false, maxTeacherOverrideQuota: null };
  });

  // Get a single class with members
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        studentMembers: {
          include: {
            student: {
              select: { id: true, username: true, displayName: true, email: true, role: true }
            }
          }
        },
        teacherMembers: {
          include: {
            teacher: {
              select: { id: true, username: true, displayName: true, email: true, role: true }
            }
          }
        }
      }
    });

    if (!classData || classData.orgId !== request.user!.orgId) {
      return reply.status(404).send({ error: 'Klas niet gevonden' });
    }

    return classData;
  });

  // Create a new class
  fastify.post('/', async (request, reply) => {
    // Only teachers, admins and superadmins can create classes
    if (!['teacher', 'admin', 'superadmin'].includes(request.user!.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { name, description, customQuotaEnabled, maxPromptsPerDay, maxPromptsPerMonth } = request.body as any;
    
    if (!name) {
      return reply.status(400).send({ error: 'Naam is verplicht' });
    }

    // Check if class with same name exists in org
    const existing = await prisma.class.findUnique({
      where: {
        orgId_name: { orgId: request.user!.orgId, name }
      }
    });

    if (existing) {
      return reply.status(400).send({ error: 'Een klas met deze naam bestaat al' });
    }

    const newClass = await prisma.class.create({
      data: {
        orgId: request.user!.orgId,
        name,
        description,
        customQuotaEnabled: customQuotaEnabled || false,
        maxPromptsPerDay: maxPromptsPerDay ? parseInt(maxPromptsPerDay) : null,
        maxPromptsPerMonth: maxPromptsPerMonth ? parseInt(maxPromptsPerMonth) : null
      }
    });

    // Sync: Create a corresponding Group
    const newGroup = await prisma.group.create({
      data: {
        orgId: request.user!.orgId,
        name,
        description
      }
    });

    // Add the creator as a teacher in the class and owner in the group if they are a teacher
    if (request.user!.role === 'teacher') {
      await prisma.teacherClass.create({
        data: {
          classId: newClass.id,
          teacherId: request.user!.id
        }
      });
      await prisma.groupMember.create({
        data: {
          groupId: newGroup.id,
          userId: request.user!.id,
          role: 'owner'
        }
      });
    }

    return newClass;
  });

  // Update a class
  fastify.put('/:id', async (request, reply) => {
    if (!['teacher', 'admin', 'superadmin'].includes(request.user!.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { id } = request.params as { id: string };
    const { name, description, customQuotaEnabled, maxPromptsPerDay, maxPromptsPerMonth } = request.body as any;

    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls || cls.orgId !== request.user!.orgId) {
      return reply.status(404).send({ error: 'Klas niet gevonden' });
    }

    const updated = await prisma.class.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(customQuotaEnabled !== undefined && { customQuotaEnabled }),
        ...(maxPromptsPerDay !== undefined && { maxPromptsPerDay: maxPromptsPerDay === '' ? null : parseInt(maxPromptsPerDay) }),
        ...(maxPromptsPerMonth !== undefined && { maxPromptsPerMonth: maxPromptsPerMonth === '' ? null : parseInt(maxPromptsPerMonth) })
      }
    });

    return updated;
  });

  // Delete a class
  fastify.delete('/:id', async (request, reply) => {
    if (!['teacher', 'admin', 'superadmin'].includes(request.user!.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { id } = request.params as { id: string };
    const cls = await prisma.class.findUnique({ where: { id } });
    
    if (!cls || cls.orgId !== request.user!.orgId) {
      return reply.status(404).send({ error: 'Klas niet gevonden' });
    }

    await prisma.class.delete({ where: { id } });
    return { success: true };
  });

  // Get members of a class
  fastify.get('/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls || cls.orgId !== request.user!.orgId) {
      return reply.status(404).send({ error: 'Klas niet gevonden' });
    }

    const studentMembers = await prisma.studentClass.findMany({
      where: { classId: id },
      include: {
        student: { select: { id: true, username: true, displayName: true, email: true, role: true } }
      }
    });

    const teacherMembers = await prisma.teacherClass.findMany({
      where: { classId: id },
      include: {
        teacher: { select: { id: true, username: true, displayName: true, email: true, role: true } }
      }
    });

    return { studentMembers, teacherMembers };
  });

  // Add a member to a class
  fastify.post('/:id/members', async (request, reply) => {
    if (!['teacher', 'admin', 'superadmin'].includes(request.user!.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { id } = request.params as { id: string };
    const { userId, role } = request.body as { userId: string; role?: 'student' | 'teacher' };
    
    if (!userId) {
      return reply.status(400).send({ error: 'userId is verplicht' });
    }

    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls || cls.orgId !== request.user!.orgId) {
      return reply.status(404).send({ error: 'Klas niet gevonden' });
    }

    const userToAdd = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToAdd || userToAdd.orgId !== request.user!.orgId) {
      return reply.status(404).send({ error: 'Gebruiker niet gevonden in deze organisatie' });
    }

    // Determine the exact role if not provided
    const targetRole = role || (['teacher', 'admin', 'superadmin'].includes(userToAdd.role) ? 'teacher' : 'student');

    // Find the corresponding Group to sync the member
    const group = await prisma.group.findUnique({
      where: { orgId_name: { orgId: request.user!.orgId, name: cls.name } }
    });

    if (targetRole === 'teacher') {
      const existing = await prisma.teacherClass.findUnique({
        where: { classId_teacherId: { classId: id, teacherId: userId } }
      });
      if (existing) return reply.status(400).send({ error: 'Docent is al lid van deze klas' });
      
      const teacherMember = await prisma.teacherClass.create({
        data: { classId: id, teacherId: userId }
      });

      if (group) {
        try {
          await prisma.groupMember.create({
            data: { groupId: group.id, userId, role: 'member' }
          });
        } catch (e) {
          // Ignore duplicate
        }
      }

      return teacherMember;
    } else {
      const existing = await prisma.studentClass.findUnique({
        where: { classId_studentId: { classId: id, studentId: userId } }
      });
      if (existing) return reply.status(400).send({ error: 'Leerling is al lid van deze klas' });

      const studentMember = await prisma.studentClass.create({
        data: { classId: id, studentId: userId }
      });

      if (group) {
        try {
          await prisma.groupMember.create({
            data: { groupId: group.id, userId, role: 'member' }
          });
        } catch (e) {
          // Ignore duplicate
        }
      }

      return studentMember;
    }
  });

  // Remove a member from a class
  fastify.delete('/:id/members/:userId', async (request, reply) => {
    if (!['teacher', 'admin', 'superadmin'].includes(request.user!.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { id, userId } = request.params as { id: string; userId: string };
    
    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls || cls.orgId !== request.user!.orgId) {
      return reply.status(404).send({ error: 'Klas niet gevonden' });
    }

    // Try deleting from teacherClass first
    try {
      await prisma.teacherClass.delete({
        where: { classId_teacherId: { classId: id, teacherId: userId } }
      });
      // Sync remove from group
      const group = await prisma.group.findUnique({ where: { orgId_name: { orgId: request.user!.orgId, name: cls.name } } });
      if (group) await prisma.groupMember.deleteMany({ where: { groupId: group.id, userId } });
      
      return { success: true, removedFrom: 'teacher' };
    } catch (e) {
      // If not a teacher, try deleting from studentClass
      try {
        await prisma.studentClass.delete({
          where: { classId_studentId: { classId: id, studentId: userId } }
        });
        // Sync remove from group
        const group = await prisma.group.findUnique({ where: { orgId_name: { orgId: request.user!.orgId, name: cls.name } } });
        if (group) await prisma.groupMember.deleteMany({ where: { groupId: group.id, userId } });

        return { success: true, removedFrom: 'student' };
      } catch (e2) {
        return reply.status(404).send({ error: 'Lid niet gevonden in deze klas' });
      }
    }
  });
}
