import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import os from 'os';
import { exec } from 'child_process';

export default async function adminRoutes(fastify: FastifyInstance) {
  // All routes require superadmin or admin
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', requireRole('admin'));

  // Get all chats in the organization for moderation
  fastify.get('/chats', async (request, reply) => {
    const user = request.user!;
    const { page = 1, limit = 50, search = '' } = request.query as any;

    const skip = (Number(page) - 1) * Number(limit);

    let whereClause: any = { orgId: user.orgId };

    if (search) {
      whereClause.OR = [
        { title: { contains: search } },
        { 
          messages: {
            some: {
              content: { contains: search }
            }
          }
        },
        {
          user: {
            username: { contains: search }
          }
        }
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          participants: true,
          _count: {
            select: { messages: true }
          }
        }
      }),
      prisma.conversation.count({ where: whereClause })
    ]);

    return {
      data: conversations,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    };
  });

  // Get system health (Memory, CPU, Ollama connection)
  fastify.get('/system', async (request, reply) => {
    try {
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      const usedMem = totalMem - freeMem;
      const memUsagePerc = ((usedMem / totalMem) * 100).toFixed(2);
      
      const cpus = os.cpus();
      const loadAvg = os.loadavg();

      return {
        status: 'online',
        memory: {
          free: freeMem,
          total: totalMem,
          used: usedMem,
          usagePercentage: memUsagePerc
        },
        cpu: {
          cores: cpus.length,
          model: cpus[0].model,
          loadAverage: loadAvg // [1, 5, 15] minute load averages
        },
        uptime: os.uptime()
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to fetch system stats: ' + e.message });
    }
  });

  // Trigger system update
  fastify.post('/system/update', async (request, reply) => {
    try {
      // The git repo root IS the locra-server directory (where .git lives)
      // __dirname = .../locra-server/server/src/api/routes  →  4 levels up = locra-server
      const repoRoot = require('path').resolve(__dirname, '../../../..');
      fastify.log.info(`[Update] Using repo root: ${repoRoot}`);

      exec('git pull --rebase', { cwd: repoRoot }, (pullError, pullOut, pullErr) => {
        if (pullError) {
          fastify.log.error(`[Update] git pull failed: ${pullError.message}`);
          return;
        }
        fastify.log.info(`[Update] git pull: ${pullOut}`);

        // Run npm install & build in this same directory
        exec('npm install && npm run build', { cwd: repoRoot }, (buildError, buildOut) => {
          if (buildError) {
            fastify.log.error(`[Update] Build failed: ${buildError.message}`);
            return;
          }
          fastify.log.info(`[Update] Build: ${buildOut}`);

          // Try PM2 first (for Linux servers), fall back to nodemon signal for dev
          exec('pm2 restart all 2>/dev/null || true', () => {
            fastify.log.info('[Update] Restart signal sent.');
          });
        });
      });

      return { status: 'updating', message: 'Update is gestart op de achtergrond. De server zal binnen enkele minuten herstarten.' };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij starten update: ' + e.message });
    }
  });

  // Get reporting data (classes & groups)
  fastify.get('/reporting', async (request, reply) => {
    try {
      const orgId = request.user!.orgId;

      // Real data query for groups
      const groups = await prisma.group.findMany({
        where: { orgId },
        include: {
          _count: { select: { members: true } },
          members: {
            include: {
              user: {
                include: {
                  conversations: {
                    include: {
                      messages: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      const groupData = groups.map(group => {
        let totalPrompts = 0;
        let totalTokens = 0;
        let modelCounts: Record<string, number> = {};

        group.members.forEach(member => {
          if (!member.user) return;
          member.user.conversations.forEach((conv: any) => {
            if (conv.model) {
              modelCounts[conv.model] = (modelCounts[conv.model] || 0) + 1;
            }
            conv.messages.forEach((msg: any) => {
              if (msg.role === 'user') totalPrompts++;
              if (msg.promptTokens) totalTokens += msg.promptTokens;
              if (msg.completionTokens) totalTokens += msg.completionTokens;
            });
          });
        });

        // Determine primary model
        let primaryModel = 'N/A';
        let maxCount = 0;
        for (const [m, c] of Object.entries(modelCounts)) {
          if (c > maxCount) {
            maxCount = c;
            primaryModel = m;
          }
        }

        const membersCount = group._count.members;

        // Simple topic extraction from titles
        const wordCounts: Record<string, number> = {};
        const stopWords = new Set(['een','de','het','en','van','ik','te','dat','die','in','is','op','tegen','met','voor','wat','zijn','er','maar','om','aan','als','dit','dan','nog','door','naar','uit','we','je','wel','niet','of','ook','hier','omdat','al','daar','geen','bij','tot']);
        group.members.forEach(member => {
          if (!member.user) return;
          member.user.conversations.forEach((conv: any) => {
            if (conv.title && conv.title !== 'Nieuw gesprek') {
              const words = conv.title.toLowerCase().split(/\W+/);
              for (const w of words) {
                if (w.length > 3 && !stopWords.has(w)) {
                  wordCounts[w] = (wordCounts[w] || 0) + 1;
                }
              }
            }
          });
        });

        const topTopics = Object.entries(wordCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([topic, count]) => ({ topic, count }));

        return {
          name: group.name,
          members: membersCount,
          totalPrompts,
          avgPrompts: membersCount > 0 ? Math.round(totalPrompts / membersCount) : 0,
          totalTokens: totalTokens > 1000000 ? (totalTokens/1000000).toFixed(1) + 'M' : totalTokens > 1000 ? (totalTokens/1000).toFixed(1) + 'K' : totalTokens.toString(),
          primaryModel,
          topTopics
        };
      });

      // Real data query for classes
      const classes = await prisma.class.findMany({
        where: { orgId },
        include: {
          _count: { select: { studentMembers: true } },
          studentMembers: {
            include: {
              student: {
                include: {
                  conversations: {
                    include: {
                      messages: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      const classData = classes.map(c => {
        let totalPrompts = 0;
        let totalTokens = 0;
        let modelCounts: Record<string, number> = {};

        c.studentMembers.forEach(member => {
          if (!member.student) return;
          member.student.conversations.forEach((conv: any) => {
            if (conv.model) {
              modelCounts[conv.model] = (modelCounts[conv.model] || 0) + 1;
            }
            conv.messages.forEach((msg: any) => {
              if (msg.role === 'user') totalPrompts++;
              if (msg.promptTokens) totalTokens += msg.promptTokens;
              if (msg.completionTokens) totalTokens += msg.completionTokens;
            });
          });
        });

        let primaryModel = 'N/A';
        let maxCount = 0;
        for (const [m, cnt] of Object.entries(modelCounts)) {
          if (cnt > maxCount) {
            maxCount = cnt;
            primaryModel = m;
          }
        }

        const studentsCount = c._count.studentMembers;

        const wordCounts: Record<string, number> = {};
        const stopWords = new Set(['een','de','het','en','van','ik','te','dat','die','in','is','op','tegen','met','voor','wat','zijn','er','maar','om','aan','als','dit','dan','nog','door','naar','uit','we','je','wel','niet','of','ook','hier','omdat','al','daar','geen','bij','tot']);
        c.studentMembers.forEach(member => {
          if (!member.student) return;
          member.student.conversations.forEach((conv: any) => {
            if (conv.title && conv.title !== 'Nieuw gesprek') {
              const words = conv.title.toLowerCase().split(/\W+/);
              for (const w of words) {
                if (w.length > 3 && !stopWords.has(w)) {
                  wordCounts[w] = (wordCounts[w] || 0) + 1;
                }
              }
            }
          });
        });

        const topTopics = Object.entries(wordCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([topic, count]) => ({ topic, count }));

        return {
          name: c.name,
          students: studentsCount,
          totalPrompts,
          avgPrompts: studentsCount > 0 ? Math.round(totalPrompts / studentsCount) : 0,
          totalTokens: totalTokens > 1000000 ? (totalTokens/1000000).toFixed(1) + 'M' : totalTokens > 1000 ? (totalTokens/1000).toFixed(1) + 'K' : totalTokens.toString(),
          primaryModel,
          topTopics
        };
      });

      return {
        groups: groupData,
        classes: classData
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to fetch reporting stats: ' + e.message });
    }
  });

  // Get quotas data
  fastify.get('/quotas', async (request, reply) => {
    try {
      const orgId = request.user!.orgId;

      const classes = await prisma.class.findMany({
        where: { orgId }
      });

      const users = await prisma.user.findMany({
        where: { orgId }
      });

      const mappedClasses = classes.map(c => ({
        id: c.id,
        name: c.name,
        customQuotaEnabled: c.customQuotaEnabled,
        daily: c.maxPromptsPerDay || 0,
        monthly: c.maxPromptsPerMonth || 0,
        models: c.allowedModels ? JSON.parse(c.allowedModels) : []
      }));

      const mappedUsers = users.map(u => ({
        id: u.id,
        name: u.displayName + (u.role === 'teacher' ? ' (Docent)' : u.role === 'student' ? ' (Leerling)' : ' (Admin)'),
        customQuotaEnabled: u.customQuotaEnabled,
        daily: u.maxPromptsPerDay || 0,
        monthly: u.maxPromptsPerMonth || 0,
        models: u.allowedModels ? JSON.parse(u.allowedModels) : []
      }));

      return {
        classes: mappedClasses,
        users: mappedUsers
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to fetch quotas: ' + e.message });
    }
  });
}
