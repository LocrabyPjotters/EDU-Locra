import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { createAuditLog, exportAuditLogs } from '../../services/auditService';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { exec, execSync } from 'child_process';

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

  // Get system update status & changelog
  fastify.get('/system/update-status', async (request, reply) => {
    try {
      let repoRoot = path.resolve(__dirname, '../../../..');
      if (!fs.existsSync(path.join(repoRoot, 'package.json'))) {
        repoRoot = path.resolve(__dirname, '../../..');
      }

      let currentCommit = '';
      let currentBranch = 'main';
      let latestCommit = '';
      let hasUpdate = false;
      let behindCount = 0;

      try {
        const branchOut = execSync('git branch --show-current', { cwd: repoRoot, timeout: 3000 }).toString().trim();
        if (branchOut) currentBranch = branchOut;
      } catch (e) {}

      try {
        const commitOut = execSync('git rev-parse --short HEAD', { cwd: repoRoot, timeout: 3000 }).toString().trim();
        if (commitOut) currentCommit = commitOut;
      } catch (e) {}

      // Check remote commits via git ls-remote or GitHub API
      try {
        const remoteOut = execSync('git ls-remote origin -h refs/heads/main', { cwd: repoRoot, timeout: 5000 }).toString().trim();
        if (remoteOut) {
          const parts = remoteOut.split(/\s+/);
          if (parts[0]) {
            latestCommit = parts[0].substring(0, 7);
            if (currentCommit && latestCommit && currentCommit !== latestCommit) {
              hasUpdate = true;
            }
          }
        }
      } catch (e) {
        try {
          const ghRes = await fetch('https://api.github.com/repos/LocrabyPjotters/EDU-Locra/commits/main', {
            headers: { 'User-Agent': 'Locra-EDU-Server' }
          });
          if (ghRes.ok) {
            const ghData: any = await ghRes.json();
            if (ghData.sha) {
              latestCommit = ghData.sha.substring(0, 7);
              if (currentCommit && latestCommit && currentCommit !== latestCommit) {
                hasUpdate = true;
              }
            }
          }
        } catch (ghErr) {}
      }

      const changelog = [
        {
          version: 'v2.5.2',
          title: 'Locra Docs Live AI-Workspace, Verborgen Opdrachten & Resilient Streaming',
          date: '15 oktober 2026',
          badge: 'Nieuwste Update',
          isCurrent: true,
          highlights: [
            '📝 Locra Docs: Interactieve document-omgeving waarin AI direct verbeteringen aanbrengt (spelling, formeler, B1, inkorten, uitbreiden, prompt op maat en undo).',
            '🚫 Opdrachten 100% verborgen: Chatgeschiedenis filtert alle opdrachten uit de linker navigatie.',
            '⚡ Streaming Regel-buffer: "Unexpected end of JSON" definitief verholpen bij live streams.',
            '🧠 / en @ Autocomplete Menu: Volledig hersteld boven het invoervak met directe leertools.',
            '🎓 Toetsen Generator Moeilijkheid & RTTI: Eenvoudige schuifregelaar of RTTI-taxonomieverdeling voor docenten.',
            '🔐 Wachtwoord Reset: Veilige resetlink via e-mail met SMTP-ondersteuning.',
            '⚙️ Functiebeheer Paneel: Nieuw tabblad in het beheerpaneel voor het beheren van leertools.'
          ]
        },
        {
          version: 'v2.5.0',
          title: 'Interactieve Quizzen, Examenbeveiliging & Inklapbare Navigatie',
          date: '14 oktober 2026',
          highlights: [
            '🎯 Interactieve Quiz in Chat: Speelbare quizkaarten met directe score en toelichting.',
            '📌 Inklapbare Sidebar: 56px icoon-modus of 260px volledige balk met soepele animaties.',
            '🛡️ ExamRoom: Beveiligde toetsafname met tab-switch detectie en tijdsloten.',
            '🔍 SlimCheck AI: Detectie van AI-geschreven teksten en broncontrole.'
          ]
        },
        {
          version: 'v2.4.0',
          title: 'AI Samenvattingen, Web Search & SOMtoday',
          date: '4 oktober 2026',
          highlights: [
            '💬 Rollende Samenvattingen: Automatische chat-samenvatting na elke 5 berichten.',
            '🌐 Web Search: DuckDuckGo RAG integratie voor realtime internetbronnen.',
            '📚 SOMtoday Koppeling: Lesroosters, cijfers en huiswerk direct inzichtelijk.',
            '🏷️ Slimme Tags: Automatische trefwoorden per chat om snel terug te vinden.'
          ]
        }
      ];

      return {
        currentVersion: 'v2.5.2',
        currentCommit: currentCommit || 'latest',
        currentBranch,
        latestCommit: latestCommit || currentCommit,
        hasUpdate,
        behindCount,
        lastChecked: new Date().toISOString(),
        platform: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux',
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        repoRoot,
        changelog
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij controleren van update status: ' + e.message });
    }
  });

  // Trigger system update
  fastify.post('/system/update', async (request, reply) => {
    try {
      let repoRoot = path.resolve(__dirname, '../../../..');
      if (!fs.existsSync(path.join(repoRoot, 'package.json'))) {
        repoRoot = path.resolve(__dirname, '../../..');
      }
      fastify.log.info(`[Update] Starting system update in: ${repoRoot}`);

      const updateCmd = process.platform === 'win32'
        ? 'if exist update.bat (call update.bat) else (git fetch origin main && git reset --hard origin/main && call npm install && call npm install --prefix server && call npm install --prefix client && (cd server && call npx prisma generate && call npx prisma db push --accept-data-loss) && call npm run build --prefix server && call npm run build --prefix client && call pm2 restart all)'
        : 'git fetch origin main && git reset --hard origin/main && npm install && npm install --prefix server && npm install --prefix client && (cd server && npx prisma generate && npx prisma db push --accept-data-loss) && npm run build --prefix server && npm run build --prefix client && (pm2 restart all || true)';

      exec(updateCmd, { cwd: repoRoot }, (err, stdout) => {
        if (err) {
          fastify.log.error(`[Update] Error during update: ${err.message}`);
          return;
        }
        fastify.log.info(`[Update] Output: ${stdout}`);
      });

      return {
        status: 'updating',
        message: 'Locra update is succesvol gestart op de achtergrond. De server en frontend worden bijgewerkt en herstarten over circa 1-2 minuten.'
      };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Fout bij starten update: ' + e.message });
    }
  });

  // Get reporting data (classes & groups) — Enhanced Analytics Mode
  fastify.get('/reporting', async (request, reply) => {
    try {
      const orgId = request.user!.orgId;
      const { period = '30d' } = (request.query as any) || {};

      const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId } });
      const isFreeEdu = orgSettings?.licenseTier === 'free';

      const now = new Date();
      let startDate: Date | null = null;
      if (period === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (period === 'schoolyear') {
        const currentYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
        startDate = new Date(currentYear, 7, 1); // 1 augustus/september
      }

      // ── Shared aggregation state ──
      let sumLatency = 0;
      let countLatency = 0;
      const globalModelCounts: Record<string, number> = {};
      const globalModelTokens: Record<string, { prompts: number; tokens: number }> = {};
      const globalModelLatency: Record<string, { sum: number; count: number }> = {};
      const globalTopicWords: Record<string, number> = {};
      const dailyUsage: Record<string, number> = {};
      let totalPromptsGlobal = 0;
      let totalTokensGlobal = 0;
      let totalConversationsGlobal = 0;

      const hourlyUsage = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        label: `${i.toString().padStart(2, '0')}:00`,
        prompts: 0,
        tokens: 0
      }));

      // 7 dagen (0: Maandag t/m 6: Zondag) x 24 uur
      const heatmap7x24: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

      const timeSlotBreakdown = {
        schoolHours: 0,   // Ma-Vr 08:30 - 16:30
        homeworkHours: 0, // Ma-Vr 16:30 - 22:00 & Weekend 08:00 - 22:00
        nightHours: 0     // Overige uren
      };

      const roleUsage = {
        student: { prompts: 0, tokens: 0, conversations: 0, activeUsers: 0 },
        teacher: { prompts: 0, tokens: 0, conversations: 0, activeUsers: 0 },
        admin: { prompts: 0, tokens: 0, conversations: 0, activeUsers: 0 }
      };
      const roleUsers = {
        student: new Set<string>(),
        teacher: new Set<string>(),
        admin: new Set<string>()
      };

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
      const globalSubjectTrends: Record<string, Record<string, number>> = {};
      
      function getWeekString(d: Date): string {
        const target = new Date(d.valueOf());
        const dayNr = (d.getDay() + 6) % 7;
        target.setDate(target.getDate() - dayNr + 3);
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
          target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
        return `${target.getFullYear()}-W${week.toString().padStart(2, '0')}`;
      }

      // ── Process all org conversations directly ──
      const allOrgConversations = await prisma.conversation.findMany({
        where: {
          OR: [{ orgId }, { user: { orgId } }],
          ...(startDate ? { createdAt: { gte: startDate } } : {})
        },
        include: {
          user: { select: { id: true, displayName: true, username: true, role: true } },
          messages: {
            where: startDate ? { createdAt: { gte: startDate } } : undefined,
            select: {
              id: true,
              role: true,
              tokensUsed: true,
              responseTimeMs: true,
              modelUsed: true,
              createdAt: true
            }
          }
        }
      });

      for (const conv of allOrgConversations) {
        totalConversationsGlobal++;
        const rawRole = (conv.user?.role || 'student').toLowerCase();
        const normalizedRole: 'student' | 'teacher' | 'admin' = 
          (rawRole === 'admin' || rawRole === 'superadmin') ? 'admin' : (rawRole === 'teacher' ? 'teacher' : 'student');
        
        roleUsage[normalizedRole].conversations++;
        if (conv.user?.id) {
          roleUsers[normalizedRole].add(conv.user.id);
        }

        const convModel = conv.modelId;
        if (convModel) {
          globalModelCounts[convModel] = (globalModelCounts[convModel] || 0) + 1;
        }

        if (conv.title && conv.title !== 'Nieuw gesprek') {
          const words = conv.title.toLowerCase().split(/\W+/);
          for (const w of words) {
            if (w.length > 3 && !stopWords.has(w)) {
              globalTopicWords[w] = (globalTopicWords[w] || 0) + 1;
            }
          }
          const cats = categorizeTitle(conv.title);
          const weekStr = getWeekString(new Date(conv.createdAt));
          if (!globalSubjectTrends[weekStr]) globalSubjectTrends[weekStr] = {};

          for (const c of cats) {
            globalCategories[c] = (globalCategories[c] || 0) + 1;
            globalSubjectTrends[weekStr][c] = (globalSubjectTrends[weekStr][c] || 0) + 1;
          }
        }

        for (const msg of conv.messages) {
          const tokens = msg.tokensUsed || 0;
          totalTokensGlobal += tokens;
          roleUsage[normalizedRole].tokens += tokens;

          const modelKey = msg.modelUsed || conv.modelId || 'Standaard LLM';
          if (!globalModelTokens[modelKey]) {
            globalModelTokens[modelKey] = { prompts: 0, tokens: 0 };
          }
          globalModelTokens[modelKey].tokens += tokens;

          if (msg.role === 'user') {
            totalPromptsGlobal++;
            roleUsage[normalizedRole].prompts++;
            globalModelTokens[modelKey].prompts++;

            const d = new Date(msg.createdAt);
            const day = d.toISOString().split('T')[0];
            dailyUsage[day] = (dailyUsage[day] || 0) + 1;

            const hr = d.getHours();
            hourlyUsage[hr].prompts++;
            hourlyUsage[hr].tokens += tokens;

            const dayOfWeek = (d.getDay() + 6) % 7; // 0 = Maandag, 6 = Zondag
            heatmap7x24[dayOfWeek][hr]++;

            const minutesOfDay = hr * 60 + d.getMinutes();
            if (dayOfWeek < 5 && minutesOfDay >= 510 && minutesOfDay < 990) { // 08:30 - 16:30
              timeSlotBreakdown.schoolHours++;
            } else if ((dayOfWeek < 5 && minutesOfDay >= 990 && minutesOfDay < 1320) || (dayOfWeek >= 5 && minutesOfDay >= 480 && minutesOfDay < 1320)) { // 16:30-22:00 / weekend
              timeSlotBreakdown.homeworkHours++;
            } else {
              timeSlotBreakdown.nightHours++;
            }
          }

          if (msg.responseTimeMs) {
            sumLatency += msg.responseTimeMs;
            countLatency++;
            if (!globalModelLatency[modelKey]) globalModelLatency[modelKey] = { sum: 0, count: 0 };
            globalModelLatency[modelKey].sum += msg.responseTimeMs;
            globalModelLatency[modelKey].count++;
          }
        }
      }

      roleUsage.student.activeUsers = roleUsers.student.size;
      roleUsage.teacher.activeUsers = roleUsers.teacher.size;
      roleUsage.admin.activeUsers = roleUsers.admin.size;

      // Piekuren & Rustigste uren
      let maxHourPrompts = -1;
      let peakHour = { hour: 11, label: '11:00 - 12:00', prompts: 0 };
      let minHourPrompts = Infinity;
      let quietestHour = { hour: 4, label: '04:00 - 05:00', prompts: 0 };

      hourlyUsage.forEach(h => {
        if (h.prompts > maxHourPrompts) {
          maxHourPrompts = h.prompts;
          peakHour = { hour: h.hour, label: `${h.label} - ${((h.hour + 1) % 24).toString().padStart(2, '0')}:00`, prompts: h.prompts };
        }
        if (h.prompts < minHourPrompts) {
          minHourPrompts = h.prompts;
          quietestHour = { hour: h.hour, label: `${h.label} - ${((h.hour + 1) % 24).toString().padStart(2, '0')}:00`, prompts: h.prompts };
        }
      });

      // ── SlimCheck Analytics ──
      const slimCheckSessions = await prisma.slimCheckSession.findMany({
        where: {
          orgId,
          ...(startDate ? { createdAt: { gte: startDate } } : {})
        },
        include: {
          scans: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              responses: {
                select: {
                  id: true,
                  confidence: true,
                  needsReview: true,
                  aiPoints: true,
                  finalPoints: true,
                  createdAt: true
                }
              }
            }
          },
          questions: {
            select: { id: true, maxPoints: true }
          }
        }
      });

      let slimCheckTotalScans = 0;
      let slimCheckTotalResponses = 0;
      let slimCheckAutoMatched = 0;
      let slimCheckManualReviewed = 0;
      let totalPointsEarned = 0;
      let totalPointsPossible = 0;

      for (const session of slimCheckSessions) {
        slimCheckTotalScans += session.scans.length;
        const sessionMaxScore = session.questions.reduce((sum, q) => sum + (q.maxPoints || 0), 0);

        for (const scan of session.scans) {
          for (const r of scan.responses) {
            slimCheckTotalResponses++;
            if (r.needsReview || (r.confidence !== null && r.confidence < 0.8)) {
              slimCheckManualReviewed++;
            } else {
              slimCheckAutoMatched++;
            }
            const pts = r.finalPoints !== null && r.finalPoints !== undefined ? r.finalPoints : (r.aiPoints || 0);
            totalPointsEarned += pts;
          }
          if (sessionMaxScore > 0 && scan.responses.length > 0) {
            totalPointsPossible += sessionMaxScore;
          }
        }
      }

      const slimCheckStats = {
        totalSessions: slimCheckSessions.length,
        totalScans: slimCheckTotalScans,
        totalResponses: slimCheckTotalResponses,
        autoMatchedCount: slimCheckAutoMatched,
        manualReviewCount: slimCheckManualReviewed,
        autoMatchRate: slimCheckTotalResponses > 0 ? Math.round((slimCheckAutoMatched / slimCheckTotalResponses) * 100) : 0,
        manualReviewRate: slimCheckTotalResponses > 0 ? Math.round((slimCheckManualReviewed / slimCheckTotalResponses) * 100) : 0,
        estimatedHoursSaved: Number(((slimCheckTotalResponses * 1.5) / 60).toFixed(1)),
        averageGrade: (totalPointsPossible > 0 && totalPointsEarned > 0)
          ? Number(Math.min(10, Math.max(1, (totalPointsEarned / totalPointsPossible) * 9 + 1)).toFixed(1))
          : null
      };

      // ── Groups & Classes breakdown ──
      function buildGroupOrClassStats(members: any[], getUser: (m: any) => any) {
        let totalPrompts = 0;
        let totalTokens = 0;
        const modelCounts: Record<string, number> = {};
        const wordCounts: Record<string, number> = {};

        members.forEach(member => {
          const user = getUser(member);
          if (!user) return;
          user.conversations.forEach((conv: any) => {
            if (conv.modelId) modelCounts[conv.modelId] = (modelCounts[conv.modelId] || 0) + 1;
            conv.messages?.forEach((msg: any) => {
              if (msg.role === 'user') totalPrompts++;
              if (msg.tokensUsed) totalTokens += msg.tokensUsed;
            });
            if (conv.title && conv.title !== 'Nieuw gesprek') {
              const words = conv.title.toLowerCase().split(/\W+/);
              for (const w of words) {
                if (w.length > 3 && !stopWords.has(w)) wordCounts[w] = (wordCounts[w] || 0) + 1;
              }
            }
          });
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
          members: {
            include: {
              user: {
                include: {
                  conversations: {
                    where: startDate ? { createdAt: { gte: startDate } } : undefined,
                    include: {
                      messages: {
                        where: startDate ? { createdAt: { gte: startDate } } : undefined
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
      const groupData = groups.map((group: any) => {
        const stats = buildGroupOrClassStats(group.members, m => m.user);
        const mc = group._count.members;
        return {
          id: group.id,
          name: group.name,
          members: mc,
          totalPrompts: stats.totalPrompts,
          avgPrompts: mc > 0 ? Math.round(stats.totalPrompts / mc) : 0,
          totalTokens: stats.totalTokens > 1000000 ? (stats.totalTokens/1000000).toFixed(1)+'M' : stats.totalTokens > 1000 ? (stats.totalTokens/1000).toFixed(1)+'K' : stats.totalTokens.toString(),
          primaryModel: stats.primaryModel,
          topTopics: stats.topTopics
        };
      });

      // ── Classes ──
      const classes = await prisma.class.findMany({
        where: { orgId },
        include: {
          _count: { select: { studentMembers: true } },
          studentMembers: {
            include: {
              student: {
                include: {
                  conversations: {
                    where: startDate ? { createdAt: { gte: startDate } } : undefined,
                    include: {
                      messages: {
                        where: startDate ? { createdAt: { gte: startDate } } : undefined
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
      const classData = classes.map((c: any) => {
        const stats = buildGroupOrClassStats(c.studentMembers, m => m.student);
        const sc = c._count.studentMembers;
        return {
          id: c.id,
          name: c.name,
          students: sc,
          totalPrompts: stats.totalPrompts,
          avgPrompts: sc > 0 ? Math.round(stats.totalPrompts / sc) : 0,
          totalTokens: stats.totalTokens > 1000000 ? (stats.totalTokens/1000000).toFixed(1)+'M' : stats.totalTokens > 1000 ? (stats.totalTokens/1000).toFixed(1)+'K' : stats.totalTokens.toString(),
          primaryModel: stats.primaryModel,
          topTopics: stats.topTopics
        };
      });

      // ── Build global analytics ──
      const avgLatencyMs = countLatency > 0 ? Math.round(sumLatency / countLatency) : 0;

      const modelDistribution = Object.entries(globalModelTokens)
        .sort((a, b) => b[1].prompts - a[1].prompts)
        .map(([model, data]) => ({
          model: model.length > 25 ? model.substring(0, 22) + '...' : model,
          fullModel: model,
          count: data.prompts,
          tokens: data.tokens,
          percentage: totalPromptsGlobal > 0 ? Math.round((data.prompts / totalPromptsGlobal) * 100) : 0,
          avgLatency: globalModelLatency[model] ? Math.round(globalModelLatency[model].sum / globalModelLatency[model].count) : null
        }));

      const topicCategories = Object.entries(globalCategories)
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => ({ category, count }));

      const topTopicsGlobal = Object.entries(globalTopicWords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([topic, count]) => ({ topic, count }));

      // Daily timeline
      const timelineDays = period === 'today' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 60;
      const timelineStart = new Date();
      timelineStart.setDate(timelineStart.getDate() - timelineDays + 1);
      const dailyTimeline = [];
      for (let d = new Date(timelineStart); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0];
        dailyTimeline.push({
          date: key,
          label: `${d.getDate()}/${d.getMonth()+1}`,
          prompts: dailyUsage[key] || 0
        });
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
        console.log('[Telemetry] Free edu data prepared:', JSON.stringify({ orgId, totalPrompts: totalPromptsGlobal, avgLatencyMs }));
      }

      return {
        groups: groupData,
        classes: classData,
        analytics: {
          period,
          totalPrompts: totalPromptsGlobal,
          totalConversations: totalConversationsGlobal,
          totalTokens: totalTokensGlobal,
          avgLatencyMs,
          hourlyUsage,
          peakHour,
          quietestHour,
          timeSlotBreakdown,
          heatmap7x24,
          roleUsage,
          slimCheckStats,
          modelDistribution,
          topicCategories,
          subjectTrends: globalSubjectTrends,
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

  // ── Admin alias: list classes (for QuotasPanel + model access) ──────────
  fastify.get('/classes', async (request, reply) => {
    const orgId = request.user!.orgId;
    const classes = await prisma.class.findMany({ where: { orgId }, orderBy: { name: 'asc' } });
    return classes.map((c: any) => ({ id: c.id, name: c.name }));
  });

  // ── Admin alias: list groups (for QuotasPanel + model access) ──────────
  fastify.get('/groups', async (request, reply) => {
    const orgId = request.user!.orgId;
    const groups = await prisma.group.findMany({ where: { orgId }, orderBy: { name: 'asc' } });
    return groups.map((g: any) => ({ id: g.id, name: g.name }));
  });

  // Get quotas data
  fastify.get('/quotas', async (request, reply) => {
    try {
      const orgId = request.user!.orgId;

      const classes = await prisma.class.findMany({ where: { orgId } });
      const users = await prisma.user.findMany({ where: { orgId } });

      const mappedClasses = classes.map((c: any) => ({
        id: c.id,
        name: c.name,
        customQuotaEnabled: c.customQuotaEnabled,
        daily: c.maxPromptsPerDay || 0,
        monthly: c.maxPromptsPerMonth || 0,
        creditLimit: c.maxPromptsPerMonth || 0, // alias voor credits UI
        models: c.allowedModels ? JSON.parse(c.allowedModels) : []
      }));

      const mappedUsers = users.map((u: any) => ({
        id: u.id,
        name: u.displayName + (u.role === 'teacher' ? ' (Docent)' : u.role === 'student' ? ' (Leerling)' : ' (Admin)'),
        role: u.role,
        customQuotaEnabled: u.customQuotaEnabled,
        daily: u.maxPromptsPerDay || 0,
        monthly: u.maxPromptsPerMonth || 0,
        creditLimit: u.maxPromptsPerMonth || 0,
        creditsUsed: u.creditsUsed || 0,
        models: u.allowedModels ? JSON.parse(u.allowedModels) : []
      }));

      return { classes: mappedClasses, users: mappedUsers };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to fetch quotas: ' + e.message });
    }
  });

  // Update class quota
  fastify.put('/quotas/class/:classId', async (request, reply) => {
    try {
      const { classId } = request.params as { classId: string };
      const orgId = request.user!.orgId;
      const { customQuotaEnabled, maxPromptsPerDay, maxPromptsPerMonth, allowedModels } = request.body as any;

      const cls = await prisma.class.findFirst({ where: { id: classId, orgId } });
      if (!cls) return reply.status(404).send({ error: 'Klas niet gevonden' });

      const enabled = Boolean(customQuotaEnabled);
      await prisma.class.update({
        where: { id: classId },
        data: {
          customQuotaEnabled: enabled,
          // Als disabled → altijd null zodat de org-standaard geldt
          maxPromptsPerDay: enabled ? (Number(maxPromptsPerDay) || null) : null,
          maxPromptsPerMonth: enabled ? (Number(maxPromptsPerMonth) || null) : null,
          allowedModels: allowedModels !== undefined ? JSON.stringify(allowedModels) : undefined
        }
      });
      return { ok: true };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Opslaan mislukt: ' + e.message });
    }
  });

  // Update user quota
  fastify.put('/quotas/user/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const orgId = request.user!.orgId;
      const { customQuotaEnabled, maxPromptsPerDay, maxPromptsPerMonth, allowedModels } = request.body as any;

      const user = await prisma.user.findFirst({ where: { id: userId, orgId } });
      if (!user) return reply.status(404).send({ error: 'Gebruiker niet gevonden' });

      const enabled = Boolean(customQuotaEnabled);
      await prisma.user.update({
        where: { id: userId },
        data: {
          customQuotaEnabled: enabled,
          // Als disabled → altijd null zodat de org-standaard geldt
          maxPromptsPerDay: enabled ? (Number(maxPromptsPerDay) || null) : null,
          maxPromptsPerMonth: enabled ? (Number(maxPromptsPerMonth) || null) : null,
          allowedModels: allowedModels !== undefined ? JSON.stringify(allowedModels) : undefined
        }
      });
      return { ok: true };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Opslaan mislukt: ' + e.message });
    }
  });

  // Update model access restrictions
  fastify.put('/models/:modelId/access', async (request, reply) => {
    try {
      const { modelId } = request.params as { modelId: string };
      const orgId = request.user!.orgId;
      const { accessMode, allowedClassIds, allowedGroupIds, teacherOnly } = request.body as any;

      const model = await prisma.installedModel.findFirst({ where: { id: modelId, orgId } });
      if (!model) return reply.status(404).send({ error: 'Model niet gevonden' });

      await prisma.installedModel.update({
        where: { id: modelId },
        data: {
          accessMode: accessMode || 'all',
          allowedClassIds: allowedClassIds ? JSON.stringify(allowedClassIds) : null,
          allowedGroupIds: allowedGroupIds ? JSON.stringify(allowedGroupIds) : null,
          teacherOnly: Boolean(teacherOnly)
        }
      });
      return { ok: true };
    } catch (e: any) {
      return reply.status(500).send({ error: 'Opslaan mislukt: ' + e.message });
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
    const body = request.body as any;
    const orgId = request.user!.orgId;
    try {
      const adminUser = await prisma.user.findUnique({ where: { id: request.user!.id }, select: { email: true } });
      const targetEmail = body.to || adminUser?.email;
      if (!targetEmail) return reply.status(400).send({ error: 'Geen e-mailadres opgegeven' });

      let host = body.smtpHost;
      let port = parseInt(body.smtpPort);
      let user = body.smtpUser;
      let pass = body.smtpPass;
      let from = body.smtpFromEmail;

      if (!host || !port || !user || !pass || !from) {
        const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId } });
        host = host || orgSettings?.smtpHost;
        port = port || (orgSettings?.smtpPort as number);
        user = user || orgSettings?.smtpUser;
        pass = pass || orgSettings?.smtpPass;
        from = from || orgSettings?.smtpFromEmail;
      }

      if (!host || !port || !user || !pass || !from) {
        return reply.status(400).send({ error: 'SMTP instellingen zijn niet (volledig) geconfigureerd.' });
      }

      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });

      await transporter.sendMail({
        from,
        to: targetEmail,
        subject: '✅ Locra SMTP Test Geslaagd!',
        html: `<div style="font-family:sans-serif;padding:2rem;background:#0f172a;color:#e2e8f0;border-radius:12px">
          <h2 style="color:#6366f1">✅ SMTP Configuratie Werkt!</h2>
          <p>Deze testmail is verstuurd vanuit je Locra installatie.</p>
          <p style="color:#94a3b8;font-size:0.85rem">Verstuurd op: ${new Date().toLocaleString('nl-NL')}</p>
        </div>`
      });

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
    await createAuditLog(prisma, {
      orgId,
      userId: request.user!.id,
      action: 'user.email-changed',
      category: 'user',
      severity: 'warning',
      details: { updatedUserId: id, displayName: updated.displayName, newEmail: email }
    });
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
      await prisma.user.update({ where: { id }, data: { passwordHash: hashed } });
      await createAuditLog(prisma, {
        orgId,
        userId: request.user!.id,
        action: 'user.password-reset',
        category: 'user',
        severity: 'critical',
        details: { targetUserId: id, targetDisplayName: target.displayName }
      });
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
  // GitHub backup push
  fastify.post('/backup/push-github', async (request, reply) => {
    const orgId = request.user!.orgId;
    const { repoOwner, repoName, ghToken, branch = 'main' } = request.body as { repoOwner: string; repoName: string; ghToken: string; branch?: string; };
    if (!repoOwner || !repoName || !ghToken) return reply.status(400).send({ error: 'repoOwner, repoName en ghToken zijn verplicht' });
    try {
      const [users, conversations, classes, kbs, settings, auditLogsExport] = await Promise.all([
        prisma.user.findMany({ where: { orgId }, select: { id: true, displayName: true, username: true, email: true, role: true, createdAt: true } }),
        prisma.conversation.findMany({ where: { orgId }, include: { messages: { select: { role: true, content: true, createdAt: true } } } }),
        prisma.class.findMany({ where: { orgId } }),
        prisma.knowledgeBase.findMany({ where: { orgId }, select: { id: true, name: true, description: true, createdAt: true } }),
        prisma.orgSettings.findUnique({ where: { orgId } }),
        exportAuditLogs(prisma, orgId)
      ]);
      const exportData = { 
        exportedAt: new Date().toISOString(), 
        orgId, 
        users, 
        conversations, 
        classes, 
        knowledgeBases: kbs, 
        settingsSnapshot: { licenseTier: settings?.licenseTier },
        auditLogs: auditLogsExport 
      };
      const fileContent = Buffer.from(JSON.stringify(exportData, null, 2)).toString('base64');
      const filePath2 = 'locra-backups/backup-' + new Date().toISOString().slice(0, 10) + '.json';
      const apiBase = 'https://api.github.com/repos/' + repoOwner + '/' + repoName + '/contents/' + filePath2;
      const ghH = { 'Authorization': 'token ' + ghToken, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'Locra-Backup/1.0' };
      let sha: string | undefined;
      try { const ex = await fetch(apiBase + '?ref=' + branch, { headers: ghH }); if (ex.ok) { const d = await ex.json() as {sha:string}; sha = d.sha; } } catch {}
      const body: Record<string,unknown> = { message: 'Locra backup ' + new Date().toLocaleDateString('nl-NL'), content: fileContent, branch };
      if (sha) body.sha = sha;
      const pr = await fetch(apiBase, { method: 'PUT', headers: ghH, body: JSON.stringify(body) });
      if (!pr.ok) { const e2 = await pr.json() as {message:string}; return reply.status(502).send({ error: 'GitHub API: ' + e2.message }); }
      
      await createAuditLog(prisma, {
        orgId,
        userId: request.user!.id,
        action: 'backup.github-push',
        category: 'system',
        severity: 'info',
        details: { repoOwner, repoName, branch }
      });
      
      return { success: true, message: 'Backup gepushed naar github.com/' + repoOwner + '/' + repoName };
    } catch (e: any) { return reply.status(500).send({ error: 'GitHub backup mislukt: ' + e.message }); }
  });

  // --- Federation & Load Balancing ---
  fastify.get('/ollama-nodes', async (request, reply) => {
    const nodes = await prisma.ollamaNode.findMany({ where: { orgId: request.user!.orgId } });
    return nodes;
  });

  fastify.post('/ollama-nodes', async (request, reply) => {
    const { url, isActive, priority } = request.body as any;
    const node = await prisma.ollamaNode.create({
      data: { orgId: request.user!.orgId, url, isActive: isActive ?? true, priority: priority ?? 1 }
    });
    return node;
  });

  fastify.delete('/ollama-nodes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.ollamaNode.deleteMany({ where: { id, orgId: request.user!.orgId } });
    return { success: true };
  });

  fastify.get('/locra-nodes', async (request, reply) => {
    const nodes = await prisma.locraNode.findMany({ where: { orgId: request.user!.orgId } });
    return nodes;
  });

  fastify.post('/locra-nodes', async (request, reply) => {
    const { name, url, apiKey, isActive } = request.body as any;
    const node = await prisma.locraNode.create({
      data: { orgId: request.user!.orgId, name, url, apiKey, isActive: isActive ?? true }
    });
    return node;
  });

  fastify.delete('/locra-nodes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.locraNode.deleteMany({ where: { id, orgId: request.user!.orgId } });
    return { success: true };
  });
}

