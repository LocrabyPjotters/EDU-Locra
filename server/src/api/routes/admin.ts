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

  // Get reporting data (classes & groups) — Enhanced Analytics
  fastify.get('/reporting', async (request, reply) => {
    try {
      const orgId = request.user!.orgId;

      const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId } });
      const isFreeEdu = orgSettings?.licenseTier === 'free';

      // ── Shared aggregation state ──
      let sumLatency = 0;
      let countLatency = 0;
      const globalModelCounts: Record<string, number> = {};
      const globalModelLatency: Record<string, { sum: number; count: number }> = {};
      const globalTopicWords: Record<string, number> = {};
      const dailyUsage: Record<string, number> = {};
      let totalPromptsGlobal = 0;
      let totalTokensGlobal = 0;
      let totalConversationsGlobal = 0;

      const stopWords = new Set(['een','de','het','en','van','ik','te','dat','die','in','is','op','tegen','met','voor','wat','zijn','er','maar','om','aan','als','dit','dan','nog','door','naar','uit','we','je','wel','niet','of','ook','hier','omdat','al','daar','geen','bij','tot','kan','hoe','waar','deze','mijn','kun','zou','moeten','over','meer','graag','help','vraag','geef','schrijf','maak','wil','moet','laat','goed','welke','welk','nieuwe','heeft','hebben','wordt','worden','kunnen','zouden','willen','gaan','heel','echt','best','even','alle','alles']);

      // Category keywords for smart topic analysis
      const categories: Record<string, string[]> = {
        'Wiskunde': ['wiskunde','algebra','geometrie','berekening','vergelijking','formule','rekenen','breuk','procent','grafiek','statistiek','functie','derivaat','integraal','sinus','cosinus','pythagoras','oppervlakte','omtrek','driehoek','kwadratisch','matrix','getal','optellen','aftrekken','vermenigvuldig'],
        'Taal & Literatuur': ['taal','grammatica','spelling','werkwoord','zelfstandig','bijvoeglijk','zinsbouw','interpunctie','essay','boekverslag','gedicht','literatuur','samenvatting','stijlfiguur','metafoor','nederlands','werkstuk','opstel'],
        'Programmeren': ['code','python','javascript','html','css','java','programmeren','variabele','array','loop','debugging','algoritme','api','database','react','typescript','github','terminal','functie','class','object','error','bug','script'],
        'Wetenschap': ['scheikunde','natuurkunde','biologie','chemie','atoom','molecuul','cel','dna','evolutie','ecosysteem','elektriciteit','kracht','snelheid','energie','fysica','experiment','wetenschap','formule','reactie'],
        'Geschiedenis': ['geschiedenis','oorlog','eeuw','koning','revolutie','middeleeuwen','koloniaal','democratie','grondwet','tijdlijn','beschaving','wereldoorlog','koude'],
        'Aardrijkskunde': ['aardrijkskunde','klimaat','continent','bevolking','topografie','kaart','rivieren','gebergte','weer','vulkaan','aardbeving'],
        'Engels': ['english','translate','translation','grammar','vocabulary','reading','comprehension','vertaal','vertaling','engelse','woordenschat'],
        'Creatief': ['tekenen','muziek','kunst','ontwerp','design','creatief','schilderen','compositie','kleur','beeldend']
      };

      function categorizeTitle(title: string): string[] {
        const lower = title.toLowerCase();
        const found: string[] = [];
        for (const [cat, keywords] of Object.entries(categories)) {
          for (const kw of keywords) {
            if (lower.includes(kw)) { found.push(cat); break; }
          }
        }
        return found.length > 0 ? found : ['Overig'];
      }
      const globalCategories: Record<string, number> = {};

      function processConversations(conversations: any[]) {
        conversations.forEach((conv: any) => {
          totalConversationsGlobal++;
          if (conv.model) {
            globalModelCounts[conv.model] = (globalModelCounts[conv.model] || 0) + 1;
          }
          if (conv.title && conv.title !== 'Nieuw gesprek') {
            const words = conv.title.toLowerCase().split(/\W+/);
            for (const w of words) {
              if (w.length > 3 && !stopWords.has(w)) {
                globalTopicWords[w] = (globalTopicWords[w] || 0) + 1;
              }
            }
            const cats = categorizeTitle(conv.title);
            for (const c of cats) {
              globalCategories[c] = (globalCategories[c] || 0) + 1;
            }
          }
          conv.messages?.forEach((msg: any) => {
            if (msg.role === 'user') {
              totalPromptsGlobal++;
              const day = new Date(msg.createdAt).toISOString().split('T')[0];
              dailyUsage[day] = (dailyUsage[day] || 0) + 1;
            }
            if (msg.promptTokens) totalTokensGlobal += msg.promptTokens;
            if (msg.completionTokens) totalTokensGlobal += msg.completionTokens;
            if (msg.responseTimeMs) {
              sumLatency += msg.responseTimeMs;
              countLatency++;
              if (conv.model) {
                if (!globalModelLatency[conv.model]) globalModelLatency[conv.model] = { sum: 0, count: 0 };
                globalModelLatency[conv.model].sum += msg.responseTimeMs;
                globalModelLatency[conv.model].count++;
              }
            }
          });
        });
      }

      function buildGroupOrClassStats(members: any[], getUser: (m: any) => any) {
        let totalPrompts = 0;
        let totalTokens = 0;
        const modelCounts: Record<string, number> = {};
        const wordCounts: Record<string, number> = {};

        members.forEach(member => {
          const user = getUser(member);
          if (!user) return;
          user.conversations.forEach((conv: any) => {
            if (conv.model) modelCounts[conv.model] = (modelCounts[conv.model] || 0) + 1;
            conv.messages?.forEach((msg: any) => {
              if (msg.role === 'user') totalPrompts++;
              if (msg.promptTokens) totalTokens += msg.promptTokens;
              if (msg.completionTokens) totalTokens += msg.completionTokens;
            });
            if (conv.title && conv.title !== 'Nieuw gesprek') {
              const words = conv.title.toLowerCase().split(/\W+/);
              for (const w of words) {
                if (w.length > 3 && !stopWords.has(w)) wordCounts[w] = (wordCounts[w] || 0) + 1;
              }
            }
          });
          processConversations(user.conversations);
        });

        let primaryModel = 'N/A';
        let maxCount = 0;
        for (const [m, c] of Object.entries(modelCounts)) {
          if (c > maxCount) { maxCount = c; primaryModel = m; }
        }
        const topTopics = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic, count]) => ({ topic, count }));
        return { totalPrompts, totalTokens, primaryModel, topTopics };
      }

      // ── Groups ──
      const groups = await prisma.group.findMany({
        where: { orgId },
        include: {
          _count: { select: { members: true } },
          members: { include: { user: { include: { conversations: { include: { messages: true } } } } } }
        }
      });
      const groupData = groups.map((group: any) => {
        const stats = buildGroupOrClassStats(group.members, m => m.user);
        const mc = group._count.members;
        return {
          name: group.name, members: mc, totalPrompts: stats.totalPrompts,
          avgPrompts: mc > 0 ? Math.round(stats.totalPrompts / mc) : 0,
          totalTokens: stats.totalTokens > 1000000 ? (stats.totalTokens/1000000).toFixed(1)+'M' : stats.totalTokens > 1000 ? (stats.totalTokens/1000).toFixed(1)+'K' : stats.totalTokens.toString(),
          primaryModel: stats.primaryModel, topTopics: stats.topTopics
        };
      });

      // ── Classes ──
      const classes = await prisma.class.findMany({
        where: { orgId },
        include: {
          _count: { select: { studentMembers: true } },
          studentMembers: { include: { student: { include: { conversations: { include: { messages: true } } } } } }
        }
      });
      const classData = classes.map((c: any) => {
        const stats = buildGroupOrClassStats(c.studentMembers, m => m.student);
        const sc = c._count.studentMembers;
        return {
          name: c.name, students: sc, totalPrompts: stats.totalPrompts,
          avgPrompts: sc > 0 ? Math.round(stats.totalPrompts / sc) : 0,
          totalTokens: stats.totalTokens > 1000000 ? (stats.totalTokens/1000000).toFixed(1)+'M' : stats.totalTokens > 1000 ? (stats.totalTokens/1000).toFixed(1)+'K' : stats.totalTokens.toString(),
          primaryModel: stats.primaryModel, topTopics: stats.topTopics
        };
      });

      // ── Build global analytics ──
      const avgLatencyMs = countLatency > 0 ? Math.round(sumLatency / countLatency) : 0;

      const modelDistribution = Object.entries(globalModelCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([model, count]) => ({
          model: model.length > 25 ? model.substring(0, 22) + '...' : model,
          fullModel: model,
          count,
          percentage: totalConversationsGlobal > 0 ? Math.round((count / totalConversationsGlobal) * 100) : 0,
          avgLatency: globalModelLatency[model] ? Math.round(globalModelLatency[model].sum / globalModelLatency[model].count) : null
        }));

      const topicCategories = Object.entries(globalCategories)
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => ({ category, count }));

      const topTopicsGlobal = Object.entries(globalTopicWords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([topic, count]) => ({ topic, count }));

      // Daily timeline (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dailyTimeline = [];
      for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0];
        dailyTimeline.push({ date: key, label: `${d.getDate()}/${d.getMonth()+1}`, prompts: dailyUsage[key] || 0 });
      }

      const hardware = {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        totalMemGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(1),
        freeMemGB: (os.freemem() / 1024 / 1024 / 1024).toFixed(1),
        memUsagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
        loadAvg: os.loadavg().map(l => l.toFixed(2)),
        uptimeDays: (os.uptime() / 86400).toFixed(1)
      };

      // Telemetry: only shared for free edu accounts
      if (isFreeEdu) {
        const telemetryPayload = {
          orgId,
          timestamp: new Date().toISOString(),
          avgLatencyMs,
          totalPrompts: totalPromptsGlobal,
          totalConversations: totalConversationsGlobal,
          totalTokens: totalTokensGlobal,
          modelDistribution: modelDistribution.map(m => ({ model: m.fullModel, count: m.count, avgLatency: m.avgLatency })),
          topicCategories,
          hardware: { platform: hardware.platform, arch: hardware.arch, cpus: hardware.cpus, cpuModel: hardware.cpuModel, totalMemGB: hardware.totalMemGB }
        };
        // Fire-and-forget — uncomment when https://telemetry.locra.app is live:
        // fetch('https://telemetry.locra.app/v1/ingest', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json', 'X-Locra-Source': 'edu-free' },
        //   body: JSON.stringify(telemetryPayload)
        // }).catch(() => {});
        console.log('[Telemetry] Free edu data prepared:', JSON.stringify({ orgId, totalPrompts: totalPromptsGlobal, avgLatencyMs }));
      }

      return {
        groups: groupData,
        classes: classData,
        analytics: {
          totalPrompts: totalPromptsGlobal,
          totalConversations: totalConversationsGlobal,
          totalTokens: totalTokensGlobal,
          avgLatencyMs,
          modelDistribution,
          topicCategories,
          topTopicsGlobal,
          dailyTimeline
        },
        telemetry: {
          shared: isFreeEdu,
          licenseTier: orgSettings?.licenseTier || 'free',
          hardware
        }
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

      const mappedClasses = classes.map((c: any) => ({
        id: c.id,
        name: c.name,
        customQuotaEnabled: c.customQuotaEnabled,
        daily: c.maxPromptsPerDay || 0,
        monthly: c.maxPromptsPerMonth || 0,
        models: c.allowedModels ? JSON.parse(c.allowedModels) : []
      }));

      const mappedUsers = users.map((u: any) => ({
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

  // ── Backup: Download SQLite database ──────────────────────────────────────
  fastify.get('/backup/download', async (request, reply) => {
    const fs = await import('fs');
    const path = await import('path');
    const dbPath = path.resolve(process.env.DATABASE_URL?.replace('file:', '') || './prisma/locra.db');
    if (!fs.existsSync(dbPath)) {
      return reply.status(404).send({ error: 'Database bestand niet gevonden' });
    }
    const filename = `locra-backup-${new Date().toISOString().slice(0, 10)}.db`;
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.header('Content-Type', 'application/octet-stream');
    return reply.send(fs.createReadStream(dbPath));
  });

  // ── Backup: Export JSON ────────────────────────────────────────────────────
  fastify.get('/backup/export-json', async (request, reply) => {
    const orgId = request.user!.orgId;
    const [users, conversations, classes, knowledgeBases, settings] = await Promise.all([
      prisma.user.findMany({ where: { orgId }, select: { id: true, displayName: true, username: true, email: true, role: true, createdAt: true } }),
      prisma.conversation.findMany({ where: { orgId }, include: { messages: { select: { role: true, content: true, createdAt: true } } } }),
      prisma.class.findMany({ where: { orgId } }),
      prisma.knowledgeBase.findMany({ where: { orgId }, select: { id: true, name: true, description: true, createdAt: true } }),
      prisma.orgSettings.findUnique({ where: { orgId } })
    ]);
    const exportData = { exportedAt: new Date().toISOString(), orgId, users, conversations, classes, knowledgeBases, settingsSnapshot: { licenseTier: settings?.licenseTier, enabledFeatures: { webSearch: settings?.enableWebSearch, e2e: settings?.enableE2EEncryption, kennisnet: settings?.enableKennisnet } } };
    const filename = `locra-export-${new Date().toISOString().slice(0, 10)}.json`;
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.header('Content-Type', 'application/json');
    return reply.send(JSON.stringify(exportData, null, 2));
  });

  // ── SMTP Test ──────────────────────────────────────────────────────────────
  fastify.post('/smtp/test', async (request, reply) => {
    const { to } = request.body as { to?: string };
    const orgId = request.user!.orgId;
    try {
      const { sendEmail } = await import('../../utils/mailer');
      const adminUser = await prisma.user.findUnique({ where: { id: request.user!.id }, select: { email: true } });
      const targetEmail = to || adminUser?.email;
      if (!targetEmail) return reply.status(400).send({ error: 'Geen e-mailadres opgegeven' });
      await sendEmail(orgId, targetEmail, '✅ Locra SMTP Test Geslaagd!',
        `<div style="font-family:sans-serif;padding:2rem;background:#0f172a;color:#e2e8f0;border-radius:12px">
          <h2 style="color:#6366f1">✅ SMTP Configuratie Werkt!</h2>
          <p>Deze testmail is verstuurd vanuit je Locra installatie.</p>
          <p style="color:#94a3b8;font-size:0.85rem">Verstuurd op: ${new Date().toLocaleString('nl-NL')}</p>
        </div>`
      );
      return { success: true, message: `Testmail verstuurd naar ${targetEmail}` };
    } catch (e: any) {
      return reply.status(500).send({ error: 'SMTP test mislukt: ' + e.message });
    }
  });

  // ── User: Update email ─────────────────────────────────────────────────────
  fastify.put('/users/:id/email', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { email } = request.body as { email: string };
    const orgId = request.user!.orgId;
    if (!email || !email.includes('@')) return reply.status(400).send({ error: 'Ongeldig e-mailadres' });
    const existing = await prisma.user.findFirst({ where: { email, orgId, NOT: { id } } });
    if (existing) return reply.status(409).send({ error: 'Dit e-mailadres is al in gebruik' });
    const updated = await prisma.user.update({ where: { id }, data: { email } });
    await prisma.auditLog.create({ data: { orgId, userId: request.user!.id, action: 'user.email-changed', details: `E-mail gewijzigd voor ${updated.displayName}` } }).catch(() => {});
    return { success: true, message: 'E-mailadres bijgewerkt' };
  });

  // ── User: Force password reset ─────────────────────────────────────────────
  fastify.post('/users/:id/reset-password', async (request, reply) => {
    const { id } = request.params as { id: string };
    const orgId = request.user!.orgId;
    const { newPassword } = request.body as { newPassword?: string };
    const target = await prisma.user.findFirst({ where: { id, orgId } });
    if (!target) return reply.status(404).send({ error: 'Gebruiker niet gevonden' });
    try {
      const { hashPassword } = await import('../../utils/crypto');
      const password = newPassword || Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-2).toUpperCase();
      const hashed = await hashPassword(password);
      await prisma.user.update({ where: { id }, data: { password: hashed } });
      await prisma.auditLog.create({ data: { orgId, userId: request.user!.id, action: 'user.password-reset', details: `Wachtwoord gereset voor ${target.displayName}` } }).catch(() => {});
      // Send mail if configured
      if (target.email) {
        try {
          const { sendEmail } = await import('../../utils/mailer');
          await sendEmail(orgId, target.email, 'Nieuw wachtwoord - Locra',
            `<div style="font-family:sans-serif;padding:2rem"><h2>Wachtwoord gereset</h2><p>Je wachtwoord is gereset door een beheerder.</p><p><strong>Nieuw wachtwoord:</strong> <code style="background:#f1f5f9;padding:4px 8px;border-radius:4px">${password}</code></p><p>Wijzig dit wachtwoord na het inloggen.</p></div>`
          );
          return { success: true, message: 'Wachtwoord gereset en mail verstuurd', emailSent: true };
        } catch {
          return { success: true, message: `Wachtwoord gereset: ${password}`, emailSent: false, tempPassword: password };
        }
      }
      return { success: true, message: 'Wachtwoord gereset', tempPassword: password, emailSent: false };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });
}

