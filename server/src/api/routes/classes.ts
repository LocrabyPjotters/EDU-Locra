import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { createAuditLog } from '../../services/auditService';

export default async function classRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // List all classes for the org
  fastify.get('/', async (request, reply) => {
    const user = request.user as any;
    
    let whereClause: any = { orgId: user.orgId };

    if (user.role === 'teacher') {
      whereClause.teacherMembers = { some: { teacherId: user.id } };
    } else if (user.role === 'student') {
      whereClause.studentMembers = { some: { studentId: user.id } };
    }

    const classes = await prisma.class.findMany({
      where: whereClause,
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

    await createAuditLog(prisma, {
      orgId: request.user!.orgId,
      userId: request.user!.id,
      action: 'class.create',
      category: 'class',
      severity: 'info',
      details: { className: name, classId: newClass.id },
      ipAddress: request.ip,
    });

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

    await createAuditLog(prisma, {
      orgId: request.user!.orgId,
      userId: request.user!.id,
      action: 'class.update',
      category: 'class',
      severity: 'info',
      details: { className: updated.name, classId: id },
      ipAddress: request.ip,
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

    await createAuditLog(prisma, {
      orgId: request.user!.orgId,
      userId: request.user!.id,
      action: 'class.delete',
      category: 'class',
      severity: 'warning',
      details: { className: cls.name, classId: id },
      ipAddress: request.ip,
    });

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

  // ══════════════════════════════════════════
  // ── Lesmateriaal (Google Classroom stijl) ─
  // ══════════════════════════════════════════

  // List materials for a class
  fastify.get('/:id/materials', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as any;

    const classData = await prisma.class.findUnique({ where: { id } });
    if (!classData || classData.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Klas niet gevonden' });
    }

    // Students must be enrolled in the class
    if (user.role === 'student') {
      const enrolled = await prisma.studentClass.findFirst({ where: { classId: id, studentId: user.id } });
      if (!enrolled) return reply.status(403).send({ error: 'Je bent niet ingeschreven voor deze klas' });
    }

    const materials = await prisma.classMaterial.findMany({
      where: { classId: id },
      include: { teacher: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' }
    });

    return materials;
  });

  // Upload material to a class (teachers only)
  fastify.post('/:id/materials', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as any;

    if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return reply.status(403).send({ error: 'Alleen docenten kunnen materiaal uploaden' });
    }

    const classData = await prisma.class.findUnique({ where: { id } });
    if (!classData || classData.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Klas niet gevonden' });
    }

    // Teacher must be assigned to this class (or be admin)
    if (user.role === 'teacher') {
      const isTeacher = await prisma.teacherClass.findFirst({ where: { classId: id, teacherId: user.id } });
      if (!isTeacher) return reply.status(403).send({ error: 'Je bent niet gekoppeld aan deze klas' });
    }

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'Geen bestand geüpload' });

    // Parse optional fields from multipart
    const fields = data.fields as any;
    const title = fields?.title?.value || data.filename;
    const description = fields?.description?.value || null;
    const addToRag = fields?.addToRag?.value === 'true';
    const ragKbId = fields?.ragKbId?.value;

    const fs = await import('fs');
    const path = await import('path');
    const uploadDir = path.join(process.cwd(), 'uploads', 'materials', id);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Create safe, unique filename
    const ext = path.extname(data.filename);
    const safeFilename = `${Date.now()}_${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadDir, safeFilename);

    // Write file to disk
    const fileBuffer = await data.toBuffer();
    fs.writeFileSync(filePath, fileBuffer);

    const material = await prisma.classMaterial.create({
      data: {
        classId: id,
        title,
        description,
        filename: data.filename,
        fileUrl: `uploads/materials/${id}/${safeFilename}`,
        fileSize: fileBuffer.length,
        mimeType: data.mimetype,
        teacherId: user.id
      }
    });

    if (addToRag && ragKbId) {
      // Verify teacher has access to this org
      const kb = await prisma.knowledgeBase.findUnique({ where: { id: ragKbId } });
      if (kb && kb.orgId === user.orgId) {
        await prisma.document.create({
          data: {
            knowledgeBaseId: ragKbId,
            filename: data.filename,
            filePath: filePath,
            fileType: path.extname(data.filename).replace('.', ''),
            fileSize: fileBuffer.length,
            status: 'processing'
          }
        });
      }
    }

    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'material.upload',
      category: 'class',
      severity: 'info',
      details: { classId: id, materialId: material.id, filename: data.filename }
    });

    return { success: true, material };
  });

  // Secure download/view endpoint for a material
  fastify.get('/materials/:materialId/download', async (request, reply) => {
    const { materialId } = request.params as { materialId: string };
    const { action } = request.query as { action?: string };
    const user = request.user as any;

    const material = await prisma.classMaterial.findUnique({
      where: { id: materialId },
      include: { class: true }
    });

    if (!material || material.class.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Materiaal niet gevonden' });
    }

    // Students must be enrolled
    if (user.role === 'student') {
      const enrolled = await prisma.studentClass.findFirst({ where: { classId: material.classId, studentId: user.id } });
      if (!enrolled) return reply.status(403).send({ error: 'Geen toegang tot dit materiaal' });
    }

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), material.fileUrl);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'Bestand niet gevonden op server' });
    }

    const stream = fs.createReadStream(filePath);
    const disposition = action === 'view' ? 'inline' : 'attachment';
    
    return reply
      .header('Content-Disposition', `${disposition}; filename="${material.filename}"`)
      .header('Content-Type', material.mimeType || 'application/octet-stream')
      .send(stream);
  });

  // Delete a material (teacher who uploaded or admin)
  fastify.delete('/materials/:materialId', async (request, reply) => {
    const { materialId } = request.params as { materialId: string };
    const user = request.user as any;

    const material = await prisma.classMaterial.findUnique({
      where: { id: materialId },
      include: { class: true }
    });

    if (!material || material.class.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Materiaal niet gevonden' });
    }

    // Only the teacher who uploaded it or an admin can delete
    if (user.role === 'teacher' && material.teacherId !== user.id) {
      return reply.status(403).send({ error: 'Alleen de docent die dit materiaal heeft geüpload kan het verwijderen' });
    }

    // Delete file from disk
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), material.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.classMaterial.delete({ where: { id: materialId } });

    await createAuditLog(prisma, {
      orgId: user.orgId,
      userId: user.id,
      action: 'material.delete',
      category: 'class',
      severity: 'warning',
      details: { classId: material.classId, materialId, filename: material.filename }
    });

    return { success: true };
  });
}
