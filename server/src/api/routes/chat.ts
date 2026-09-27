import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../index';
import { verifyToken } from '../../utils/crypto';
import crypto from 'crypto';
import OpenAI from 'openai';
import { ollamaClient } from '../../services/ollama';
import { cosineSimilarity, EMBEDDING_MODEL } from '../../services/rag';
import { performWebSearch } from '../../services/webSearch';
import { getSchedule, getGrades, getHomework, formatSomtodayContext, refreshSomtodayToken } from '../../services/somtoday';
import { concurrencyQueue } from '../../services/concurrencyQueue';
import { watermarkService, SENTENCE_SIGNATURE } from '../../services/watermarkService';

/**
 * Retrieve the top-N most relevant document chunks for a given query.
 * Uses Ollama embeddings + cosine similarity (in-memory, zero external deps).
 * 
 * IMPORTANT: Always uses the org's configured embeddingModel (or the default EMBEDDING_MODEL)
 * to ensure vector dimensions match those created during document ingestion.
 */
async function retrieveContext(
  knowledgeBaseId: string, 
  query: string, 
  embeddingModel: string = EMBEDDING_MODEL,
  topN: number = 5,
  minScore: number = 0.25
): Promise<{ content: string; score: number; documentId?: string; filename?: string }[]> {
  // 1. Get query embedding using the SAME model used for document ingestion
  const queryEmbedding = await ollamaClient.getEmbedding(query, embeddingModel);
  if (!queryEmbedding.length) return [];

  // 2. Fetch all chunks for this knowledge base
  const chunks = await prisma.documentChunk.findMany({
    where: { knowledgeBaseId },
    select: { 
      content: true, 
      embedding: true,
      document: { select: { id: true, filename: true } }
    }
  });

  if (!chunks.length) return [];

  // 3. Score each chunk by cosine similarity
  const scored = chunks.map((chunk: any) => {
    const chunkEmbedding: number[] = JSON.parse(chunk.embedding);
    const score = cosineSimilarity(queryEmbedding, chunkEmbedding);
    return { 
      content: chunk.content, 
      score,
      documentId: chunk.document?.id,
      filename: chunk.document?.filename
    };
  });

  // 4. Sort descending, filter by minimum score, and take top-N
  scored.sort((a: any, b: any) => b.score - a.score);
  return scored
    .filter((s: any) => s.score >= minScore)
    .slice(0, topN);
}

/**
 * Smart Query Reformulation: 
 * Uses the AI to rewrite a vague user question into a clear, context-aware 
 * search query based on conversation history. This dramatically improves 
 * RAG retrieval for follow-up questions like "En dat tweede punt?"
 */
async function reformulateQuery(
  prompt: string, 
  history: { role: string; content: string }[], 
  model: string
): Promise<string> {
  // If no history or the prompt is already long and detailed, skip reformulation
  if (history.length <= 1 || prompt.length > 200) return prompt;
  
  // Build a condensed version of the last few messages for context
  const recentHistory = history.slice(-6).map(m => 
    `${m.role === 'user' ? 'Gebruiker' : 'AI'}: ${m.content.substring(0, 200)}`
  ).join('\n');

  const reformulationPrompt = 
    `Je bent een zoekopdracht-herschrijver. Herschrijf de laatste vraag van de gebruiker tot een zelfstandige, uitgebreide zoekopdracht voor een document-database.\n\n` +
    `Gespreksgeschiedenis:\n${recentHistory}\n\n` +
    `Laatste vraag: "${prompt}"\n\n` +
    `Herschrijf dit tot EEN duidelijke zoekopdracht (1-2 zinnen). Antwoord ALLEEN met de herschreven zoekopdracht, niets anders.`;

  try {
    const res = await ollamaClient.generate(reformulationPrompt, model, undefined, false);
    const data = await res.json();
    let reformulated = (data.response || '').trim();
    // Strip <think> tags that might have leaked into the response
    reformulated = reformulated.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    if (reformulated && reformulated.length > 5 && reformulated.length < 500) {
      console.log(`[RAG] Query reformulated: "${prompt}" → "${reformulated}"`);
      return reformulated;
    }
  } catch (err: any) {
    console.warn(`[RAG] Query reformulation failed, using original: ${err.message}`);
  }
  
  return prompt;
}

export default async function chatRoutes(fastify: FastifyInstance) {
  // --- REST ENDPOINTS ---
  fastify.register(async function (protectedRoutes) {
    protectedRoutes.addHook('preHandler', requireAuth);

    protectedRoutes.get('/conversations', async (request, reply) => {
      const { search } = request.query as { search?: string };
      
      let whereClause: any = {
        OR: [
          { userId: request.user!.id },
          { participants: { some: { userId: request.user!.id } } }
        ]
      };
      
      if (search) {
        whereClause.OR = [
          { title: { contains: search } },
          { messages: { some: { content: { contains: search } } } }
        ];
      }

      const conversations = await prisma.conversation.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        include: { 
          participants: true,
          labels: { include: { label: true } }
        }
      });
      return conversations.map(c => ({
        ...c,
        isParticipantOnly: c.userId !== request.user!.id
      }));
    });

    protectedRoutes.put('/conversations/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const { title } = request.body as { title: string };

      const conv = await prisma.conversation.findUnique({ where: { id } });
      if (!conv || conv.userId !== request.user!.id) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const updated = await prisma.conversation.update({
        where: { id },
        data: { title }
      });
      return updated;
    });

    protectedRoutes.delete('/conversations/:id', async (request, reply) => {
      const { id } = request.params as { id: string };

      const conv = await prisma.conversation.findUnique({ where: { id } });
      if (!conv || conv.userId !== request.user!.id) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Cascade delete manually if schema doesn't do it
      await prisma.feedback.deleteMany({ where: { message: { conversationId: id } } });
      await prisma.message.deleteMany({ where: { conversationId: id } });
      await prisma.conversationParticipant.deleteMany({ where: { conversationId: id } });
      await prisma.conversation.delete({ where: { id } });

      return { success: true };
    });

    protectedRoutes.post('/conversations', async (request, reply) => {
      const { title, modelId } = request.body as any;
      const conversation = await prisma.conversation.create({
        data: {
          userId: request.user!.id,
          title: title || 'Nieuw gesprek',
          modelId
        }
      });
      return conversation;
    });

    protectedRoutes.get('/conversations/:id/messages', async (request, reply) => {
      const { id } = request.params as { id: string };
      
      // Verify ownership or participation
      const conv = await prisma.conversation.findUnique({ 
        where: { id },
        include: { participants: true }
      });
      const isOwner = conv?.userId === request.user!.id;
      const isParticipant = conv?.participants.some(p => p.userId === request.user!.id);
      
      if (!conv || (!isOwner && !isParticipant)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const messages = await prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        include: {
          reactions: true,
          feedback: true
        }
      });
      
      const { decryptMessage } = require('../../utils/crypto');
      const decryptedMessages = messages.map(msg => {
        const baseMsg = {
          ...msg,
          teacherFeedback: msg.feedback?.[0]?.reason || null
        };
        if (msg.content === '[Versleuteld Bericht]' && msg.contentEncrypted) {
          return {
            ...baseMsg,
            content: decryptMessage(msg.contentEncrypted)
          };
        }
        return baseMsg;
      });
      
      return decryptedMessages;
    });

    // Share/unshare conversation (public link)
    protectedRoutes.put('/conversations/:id/share', async (request, reply) => {
      const { id } = request.params as { id: string };
      const { isShared } = request.body as { isShared: boolean };

      const conv = await prisma.conversation.findUnique({ where: { id } });
      if (!conv || conv.userId !== request.user!.id) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      let shareToken = conv.shareToken;
      if (isShared && !shareToken) {
        shareToken = crypto.randomBytes(16).toString('hex');
      } else if (!isShared) {
        shareToken = null;
      }

      const updated = await prisma.conversation.update({
        where: { id },
        data: { isShared, shareToken }
      });
      return updated;
    });

    // Add a specific user to a conversation
    protectedRoutes.post('/conversations/:id/participants', async (request, reply) => {
      const { id } = request.params as { id: string };
      const { userId, role } = request.body as { userId: string; role: 'viewer' | 'editor' };

      const conv = await prisma.conversation.findUnique({ where: { id } });
      if (!conv || conv.userId !== request.user!.id) {
        return reply.status(403).send({ error: 'Alleen de eigenaar kan mensen toevoegen' });
      }

      if (!['viewer', 'editor'].includes(role)) {
        return reply.status(400).send({ error: 'Rol moet "viewer" of "editor" zijn' });
      }

      try {
        const participant = await prisma.conversationParticipant.upsert({
          where: { conversationId_userId: { conversationId: id, userId } },
          update: { role },
          create: { conversationId: id, userId, role }
        });
        return participant;
      } catch (e: any) {
        return reply.status(400).send({ error: 'Kon gebruiker niet toevoegen' });
      }
    });

    // Add or update feedback on a message
    protectedRoutes.put('/messages/:id/feedback', async (request, reply) => {
      if (!['teacher', 'admin', 'superadmin'].includes(request.user!.role)) {
        return reply.status(403).send({ error: 'Geen toegang' });
      }

      const { id } = request.params as { id: string };
      const { feedback } = request.body as { feedback: string };

      const message = await prisma.message.findUnique({ where: { id } });
      if (!message) return reply.status(404).send({ error: 'Message not found' });

      // Upsert feedback
      const existing = await prisma.feedback.findFirst({
        where: { messageId: id, userId: request.user!.id }
      });

      if (existing) {
        return await prisma.feedback.update({
          where: { id: existing.id },
          data: { reason: feedback, rating: 'up' }
        });
      } else {
        return await prisma.feedback.create({
          data: {
            messageId: id,
            userId: request.user!.id,
            rating: 'up',
            reason: feedback
          }
        });
      }
    });

    // List participants of a conversation
    protectedRoutes.get('/conversations/:id/participants', async (request, reply) => {
      const { id } = request.params as { id: string };

      const conv = await prisma.conversation.findUnique({ where: { id } });
      if (!conv || conv.userId !== request.user!.id) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId: id }
      });

      // Manually fetch user info if include didn't work (no relation defined)
      const enriched = await Promise.all(participants.map(async (p: any) => {
        if (p.user) return p;
        const user = await prisma.user.findUnique({
          where: { id: p.userId },
          select: { id: true, username: true, displayName: true, email: true }
        });
        return { ...p, user };
      }));

      return enriched;
    });

    // Remove a participant from a conversation
    protectedRoutes.delete('/conversations/:id/participants/:userId', async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };

      const conv = await prisma.conversation.findUnique({ where: { id } });
      if (!conv || conv.userId !== request.user!.id) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      try {
        await prisma.conversationParticipant.delete({
          where: { conversationId_userId: { conversationId: id, userId } }
        });
        return { success: true };
      } catch {
        return reply.status(404).send({ error: 'Deelnemer niet gevonden' });
      }
    });
    
    // Export conversation
    protectedRoutes.get('/conversations/:id/export/:format', async (request, reply) => {
      const { id, format } = request.params as { id: string, format: string };
      
      const conv = await prisma.conversation.findUnique({
        where: { id },
        include: { messages: { orderBy: { createdAt: 'asc' } } }
      });

      if (!conv || conv.userId !== request.user!.id) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { decryptMessage } = require('../../utils/crypto');
      const messages = conv.messages.map(m => {
        if (m.content === '[Versleuteld Bericht]' && m.contentEncrypted) {
          return { ...m, content: decryptMessage(m.contentEncrypted) };
        }
        return m;
      });

      if (format === 'json') {
        reply.header('Content-Disposition', `attachment; filename="chat-${id}.json"`);
        return { title: conv.title, messages: messages.map(m => ({ role: m.role, content: m.content, createdAt: m.createdAt })) };
      } else if (format === 'markdown') {
        let md = `# ${conv.title}\n\n`;
        messages.forEach(m => {
          md += `### ${m.role === 'user' ? 'Jij' : 'Locra AI'}\n${m.content}\n\n---\n\n`;
        });
        reply.header('Content-Disposition', `attachment; filename="chat-${id}.md"`);
        reply.type('text/markdown');
        return md;
      }
      return reply.status(400).send({ error: 'Unsupported format' });
    });
  });

  // Public endpoint for shared conversations
  fastify.get('/shared/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const conv = await prisma.conversation.findUnique({
      where: { shareToken: token },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        user: { select: { displayName: true } }
      }
    });

    if (!conv || !conv.isShared) {
      return reply.status(404).send({ error: 'Shared conversation not found' });
    }

    const { decryptMessage } = require('../../utils/crypto');
    conv.messages = conv.messages.map(msg => {
      if (msg.content === '[Versleuteld Bericht]' && msg.contentEncrypted) {
        return {
          ...msg,
          content: decryptMessage(msg.contentEncrypted)
        };
      }
      return msg;
    });

    return conv;
  });

  // --- WEBSOCKET ENDPOINT ---
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    let authUser: any = null;

    connection.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        // 1. Authenticate first message
        if (data.type === 'auth') {
          const decoded = verifyToken(data.token);
          authUser = decoded;
          connection.send(JSON.stringify({ type: 'auth_success' }));
          return;
        }

        if (!authUser) {
          connection.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
          return;
        }

        // 2. Handle Chat Message
        if (data.type === 'chat') {
          const { conversationId, prompt, model, knowledgeBaseId } = data;
          
          if (!conversationId || !prompt || !model) {
            connection.send(JSON.stringify({ type: 'error', message: 'Missing required fields' }));
            return;
          }

          // Verify conversation ownership or participation
          const conv = await prisma.conversation.findUnique({ 
            where: { id: conversationId },
            include: { participants: true }
          });
          const isOwner = conv?.userId === authUser.id;
          const isParticipant = conv?.participants.some(p => p.userId === authUser.id);

          if (!conv || (!isOwner && !isParticipant)) {
            connection.send(JSON.stringify({ type: 'error', message: 'Access denied to this conversation' }));
            return;
          }

          // Handle Encryption
          let finalContent = prompt;
          let finalContentEncrypted = null;
          
          const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId: authUser.orgId } });
          
          // Rate Limiting check
          if (orgSettings?.enableRateLimiting && data.saveToServer !== false) {
            // Admins & superadmins are exempt
            if (!['admin', 'superadmin'].includes(authUser.role)) {
              const startOfDay = new Date();
              startOfDay.setHours(0, 0, 0, 0);
              
              const startOfMonth = new Date();
              startOfMonth.setDate(1);
              startOfMonth.setHours(0, 0, 0, 0);

              let effectiveMaxPromptsPerDay = orgSettings.maxPromptsPerDay;
              let effectiveMaxPromptsPerMonth = orgSettings.maxPromptsPerMonth;

              // If user is a student, fetch their classes to check for custom quotas
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

              if (effectiveMaxPromptsPerDay !== null) {
                const todayPrompts = await prisma.message.count({
                  where: { userId: authUser.id, role: 'user', createdAt: { gte: startOfDay } }
                });
                if (todayPrompts >= effectiveMaxPromptsPerDay) {
                  connection.send(JSON.stringify({ type: 'error', message: `Dagelijkse limiet bereikt (${effectiveMaxPromptsPerDay} prompts). Vraag je docent om meer limiet of wacht tot morgen.` }));
                  return;
                }
              }

              if (effectiveMaxPromptsPerMonth !== null) {
                const monthPrompts = await prisma.message.count({
                  where: { userId: authUser.id, role: 'user', createdAt: { gte: startOfMonth } }
                });
                if (monthPrompts >= effectiveMaxPromptsPerMonth) {
                  connection.send(JSON.stringify({ type: 'error', message: `Maandelijkse limiet bereikt (${effectiveMaxPromptsPerMonth} prompts). Vraag je docent om meer limiet of wacht tot volgende maand.` }));
                  return;
                }
              }
            }
          }
          
          if (data.saveToServer !== false) {
            // Retrieve settings to check if encryption is enabled
            if (orgSettings?.enableE2EEncryption) {
              const { encryptMessage } = require('../../utils/crypto');
              finalContentEncrypted = encryptMessage(prompt);
              finalContent = '[Versleuteld Bericht]';
            }
          }

          // Save user message to DB if allowed
          if (data.saveToServer !== false) {
            await prisma.message.create({
              data: {
                conversationId,
                userId: authUser.id,
                role: 'user',
                content: finalContent,
                contentEncrypted: finalContentEncrypted,
                attachments: data.images ? JSON.stringify(data.images) : null,
              }
            });
          }

          // Fetch history for context
          let history: any[] = [];
          if (data.saveToServer !== false) {
            const rawHistory = await prisma.message.findMany({
              where: { conversationId },
              orderBy: { createdAt: 'asc' },
              take: 10
            });
            // Decrypt history if needed
            const { decryptMessage } = require('../../utils/crypto');
            history = rawHistory.map(m => ({
              ...m,
              content: m.contentEncrypted ? decryptMessage(m.contentEncrypted) : m.content
            }));
          } else if (data.localHistory) {
            history = data.localHistory;
          }

          // ── SMART MODEL ROUTING (moved before RAG so we can use targetModel) ──
          let targetModel = model;
          let targetModelRecord = null;
          
            if (model === 'auto' || !model) {
            const p = prompt.toLowerCase();
            let targetTier = 'standard';
            
            // Criteria for HEAVY (complex reasoning, coding, long context, math)
            const isMath = p.match(/\b(bereken|wiskunde|formule|vergelijking|integraal|afgeleide)\b/) || p.match(/[=+\-*/\^]/);
            const isCode = p.match(/\b(code|programmeer|script|html|css|js|python|java|c\+\+|foutmelding|debug)\b/) || p.includes('```');
            const isDeepReasoning = p.match(/\b(analyseer|waarom|leg uit|vergelijk|oorzaken|gevolgen|samenvatting van|filosofie|betoog)\b/);
            const hasAttachments = data.fileContexts && data.fileContexts.length > 0;
            const hasWebSearch = data.webSearch;
            
            if (data.thinkMode || data.deepResearch || prompt.length > 800 || isCode || isMath || isDeepReasoning || hasAttachments || hasWebSearch) {
              targetTier = 'heavy';
            } 
            // Criteria for LIGHT (simple chit-chat, quick questions, greetings)
            else if (prompt.length < 60 && !p.includes('waarom') && !p.includes('hoe') && !p.includes('wat is') && p.match(/\b(hallo|hoi|hey|doei|bedankt|ja|nee|ok|oke)\b/)) {
              targetTier = 'light';
            }

            const activeModels = await prisma.installedModel.findMany({
              where: { orgId: authUser.orgId, isActive: true }
            });
            
            targetModelRecord = activeModels.find(m => m.routingTier === targetTier) || activeModels[0];
            if (targetModelRecord) {
              targetModel = targetModelRecord.ollamaName;
            } else {
              targetModel = 'llama3';
            }
          } else {
            targetModelRecord = await prisma.installedModel.findFirst({
              where: { orgId: authUser.orgId, ollamaName: model, isActive: true }
            });
          }

          // ── CREDIT CHECK ──
          let creditCost = 0;
          if (orgSettings?.enableCredits && data.saveToServer !== false && !['admin', 'superadmin'].includes(authUser.role)) {
            const userRecord = await prisma.user.findUnique({ where: { id: authUser.id } });
            
            // Check if reset needed
            let currentUsed = userRecord?.creditsUsed || 0;
            if (userRecord?.creditsResetAt && orgSettings.creditResetInterval !== 'never') {
              const now = new Date();
              const resetDate = new Date(userRecord.creditsResetAt);
              let needsReset = false;
              if (orgSettings.creditResetInterval === 'daily' && now.getDate() !== resetDate.getDate()) needsReset = true;
              if (orgSettings.creditResetInterval === 'monthly' && now.getMonth() !== resetDate.getMonth()) needsReset = true;
              
              if (needsReset) {
                currentUsed = 0;
                await prisma.user.update({
                  where: { id: authUser.id },
                  data: { creditsUsed: 0, creditsResetAt: now }
                });
              }
            } else if (!userRecord?.creditsResetAt) {
              await prisma.user.update({
                where: { id: authUser.id },
                data: { creditsResetAt: new Date() }
              });
            }

            if (targetModelRecord) {
              creditCost = data.thinkMode ? targetModelRecord.thinkingCreditCost : targetModelRecord.creditCost;
            } else {
              creditCost = data.thinkMode ? 3 : 1;
            }

            if (currentUsed + creditCost > (orgSettings.defaultCreditsPerUser || 100)) {
              connection.send(JSON.stringify({ type: 'error', message: `Onvoldoende credits. Je hebt ${creditCost} nodig, maar je hebt je limiet van ${orgSettings.defaultCreditsPerUser} bereikt.` }));
              return;
            }
            
            // Deduct credits immediately
            await prisma.user.update({
              where: { id: authUser.id },
              data: { creditsUsed: { increment: creditCost } }
            });
          }

          // Notify client which model is answering
          connection.send(JSON.stringify({ 
            type: 'start', 
            model: targetModel 
          }));

          // ── SOURCE TRACKING ──
          const uniqueSources = new Map<string, { id: string, title: string, type: 'document' | 'web', url?: string }>();
          let ragContext = '';
          let somtodayContext = '';
          let ragUsed = false;
          
          // ── SOMTODAY CONTEXT RETRIEVAL ──
          if (data.useSomtoday) {
            try {
              const fullUser = await prisma.user.findUnique({ where: { id: authUser.id } });
              
              if (fullUser?.somtodayToken && fullUser?.somtodayApiUrl && fullUser?.somtodayStudentId) {
                connection.send(JSON.stringify({ type: 'thinking', message: '🎓 SOMtoday gegevens ophalen...' }));
                
                let token = fullUser.somtodayToken;
                
                // Fetch current week data
                const startDate = new Date().toISOString().split('T')[0];
                const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                
                try {
                  const [schedule, grades, homework] = await Promise.all([
                    getSchedule(token, fullUser.somtodayApiUrl, fullUser.somtodayStudentId, startDate, endDate),
                    getGrades(token, fullUser.somtodayApiUrl, fullUser.somtodayStudentId),
                    getHomework(token, fullUser.somtodayApiUrl, startDate, endDate)
                  ]);
                  somtodayContext = '\n\n' + formatSomtodayContext(schedule, grades, homework);
                  
                } catch (err) {
                  // Try refresh once
                  if (fullUser.somtodayRefreshToken) {
                    const newToken = await refreshSomtodayToken(fullUser.somtodayRefreshToken);
                    if (newToken) {
                      await prisma.user.update({
                        where: { id: fullUser.id },
                        data: { somtodayToken: newToken.access_token, somtodayRefreshToken: newToken.refresh_token }
                      });
                      token = newToken.access_token;
                      
                      const [schedule, grades, homework] = await Promise.all([
                        getSchedule(token, fullUser.somtodayApiUrl, fullUser.somtodayStudentId, startDate, endDate),
                        getGrades(token, fullUser.somtodayApiUrl, fullUser.somtodayStudentId),
                        getHomework(token, fullUser.somtodayApiUrl, startDate, endDate)
                      ]);
                      somtodayContext = '\n\n' + formatSomtodayContext(schedule, grades, homework);
                    }
                  }
                }
              }
            } catch (err: any) {
              fastify.log.warn(`SOMtoday retrieval failed: ${err.message}`);
            }
          }

          // ── WEB SEARCH FLOW ──
          if (data.internetSearch) {
            try {
              connection.send(JSON.stringify({ type: 'thinking', message: '🌐 Zoeken op het internet...' }));
              const smartQuery = await reformulateQuery(prompt, history, targetModel || 'llama3');
              
              const webResults = await performWebSearch(smartQuery);
              if (webResults.length > 0) {
                ragUsed = true;
                
                ragContext = '=== INTERNET ZOEKBESTANDEN ===\n\n' + webResults.map((r, i) => {
                  uniqueSources.set(r.url, { id: r.url, title: r.title, type: 'web', url: r.url });
                  return `[Bron ${i + 1}] Titel: ${r.title}\nURL: ${r.url}\nInhoud: ${r.snippet}\n`;
                }).join('\n');
              } else {
                console.log(`[WebSearch] No results found for: "${smartQuery}"`);
                ragContext = '\n\n[INTERNET]: Er konden helaas geen relevante online resultaten gevonden worden voor deze vraag.';
              }
            } catch (webErr: any) {
              fastify.log.warn(`Web search failed: ${webErr.message}`);
              ragContext = '\n\n[INTERNET FOUT]: Het ophalen van webresultaten is mislukt.';
            }
          }

          // ── RAG CONTEXT RETRIEVAL (IMPROVED) ──
          if (knowledgeBaseId && !data.internetSearch) {
            try {
              // RBAC Check for KnowledgeBase
              const kbCheck = await prisma.knowledgeBase.findUnique({ where: { id: knowledgeBaseId } });
              if (!kbCheck || kbCheck.orgId !== authUser.orgId) {
                 connection.send(JSON.stringify({ type: 'error', message: 'Toegang tot deze kennisbank is geweigerd.' }));
                 return;
              }
              if (authUser.role !== 'admin' && authUser.role !== 'superadmin') {
                 if (kbCheck.allowedRoles) {
                   try {
                     const allowed = JSON.parse(kbCheck.allowedRoles);
                     if (!allowed.includes(authUser.role)) {
                       connection.send(JSON.stringify({ type: 'error', message: 'Je rol heeft geen toegang tot de geselecteerde kennisbank. Vraag je docent om toegang.' }));
                       return;
                     }
                   } catch(e) {}
                 }
              }

              // Get the org's configured embedding model (admin can change this in the dashboard)
              const orgSettingsForRag = await prisma.orgSettings.findUnique({ where: { orgId: authUser.orgId } });
              const embeddingModel = orgSettingsForRag?.embeddingModel || EMBEDDING_MODEL;
              const topN = orgSettingsForRag?.ragTopN ?? 5;
              const minScore = orgSettingsForRag?.ragMinScore ?? 0.25;

              connection.send(JSON.stringify({ type: 'thinking', message: '📚 Kennisbank wordt doorzocht...' }));

              // Smart Query Reformulation: rewrite vague questions using conversation context
              const smartQuery = await reformulateQuery(prompt, history, targetModel || 'llama3');
              
              // Retrieve relevant chunks using the CORRECT embedding model and dynamic settings
              const relevantChunks = await retrieveContext(knowledgeBaseId, smartQuery, embeddingModel, topN, minScore);
              
              if (relevantChunks.length > 0) {
                ragUsed = true;
                
                // Track unique documents for frontend preview
                relevantChunks.forEach((c: any) => {
                  if (c.documentId && c.filename && !uniqueSources.has(c.documentId)) {
                    uniqueSources.set(c.documentId, { id: c.documentId, title: c.filename, type: 'document' });
                  }
                });

                const avgScore = (relevantChunks.reduce((sum: number, c: any) => sum + c.score, 0) / relevantChunks.length).toFixed(2);
                console.log(`[RAG] Found ${relevantChunks.length} relevant chunks (avg score: ${avgScore}) for query: "${smartQuery.substring(0, 80)}"`);
                
                ragContext = '\n\n=== BIJGEVOEGDE DOCUMENTATIE (KENNISBANK) ===\n' +
                  relevantChunks.map((c: any, i: number) => `[Bron ${i + 1}] (relevantie: ${(c.score * 100).toFixed(0)}%):\n${c.content}`).join('\n\n') +
                  '\n=== EINDE DOCUMENTATIE ===\n\n' +
                  'KRITIEKE INSTRUCTIE VOOR DOCUMENTATIE:\n' +
                  '- Je MOET bovenstaande documentatie gebruiken om de vraag te beantwoorden.\n' +
                  '- Baseer je antwoord UITSLUITEND op de bijgevoegde bronnen.\n' +
                  '- Citeer je bronnen door [Bron X] te gebruiken in je antwoord waar mogelijk.\n' +
                  '- Als het antwoord NIET in de documentatie staat, mag je je eigen kennis gebruiken, maar meld dan duidelijk dat de informatie niet uit de kennisbank komt.\n' +
                  '- Verzin NOOIT informatie over de documenten zelf.';
              } else {
                console.log(`[RAG] No relevant chunks found above threshold for: "${smartQuery.substring(0, 80)}"`);
                ragContext = '\n\n[KENNISBANK]: Er zijn geen relevante documenten gevonden voor deze vraag. ' +
                  'Beantwoord de vraag op basis van je eigen kennis, maar vermeld dat er geen documenten beschikbaar waren.';
              }
            } catch (ragErr: any) {
              fastify.log.warn(`RAG retrieval failed: ${ragErr.message}`);
              ragContext = '\n\n[KENNISBANK FOUT]: Het ophalen van documenten is mislukt. Beantwoord de vraag op basis van je eigen kennis.';
            }
          }
          
          // ── SYSTEM PROMPTS (CUSTOMIZATION) ──
          const org = await prisma.organization.findUnique({ where: { id: authUser.orgId } });
          const aiName = org?.aiName?.trim() || "Locra";
          const basePrompt = org?.systemPrompt || `Je bent ${aiName}, een behulpzame AI assistent van Pjotters voor het onderwijs. Antwoord altijd in de gevraagde taal.`;
          const nameInstruction = `\n\nIDENTITEIT:\nJouw naam is ${aiName}. Als de gebruiker vraagt wie je bent of hoe je heet, noem jezelf ${aiName}.`;
          const behaviorPrompt = org?.behaviorPrompt ? `\n\nGEDRAGSREGELS:\n${org.behaviorPrompt}` : '';
          
          // Inject special mode instructions
          let modeInstructions = '';
          if (data.internetSearch) {
            modeInstructions += '\n[MODUS ACTIEF: INTERNET ZOEKEN] Je hebt live toegang tot het internet. Beantwoord de vraag op basis van de onderstaande webresultaten.';
            modeInstructions += '\n\nKRITIEKE INSTRUCTIE VOOR INTERNET ZOEKEN:\n' +
              '- Gebruik de bovenstaande zoekresultaten.\n' +
              '- Citeer ALTIJD de gebruikte webpagina als een link: [Bronnaam](URL).\n' +
              '- Verzin geen informatie die niet in de zoekresultaten staat.';
          }
          if (data.deepResearch) modeInstructions += '\n[MODUS ACTIEF: DIEPGAAND ONDERZOEK] Voer een zeer grondige analyse uit en leg al je denkstappen gedetailleerd uit.';
          if (data.thinkMode) {
            modeInstructions += '\n[MODUS ACTIEF: DENK NA] Gebruik je uitgebreide redeneervermogen (thinking) voordat je antwoordt. Start je antwoord ALTIJD met <think> en eindig met </think>.';
          } else {
            modeInstructions += '\n[BELANGRIJK] Geef direct antwoord. Gebruik GEEN <think> blokken en toon GEEN intern denkproces. Reageer direct op de leerling.';
          }

          // ── GOOGLE DOCS EXTRACTION ──
          let googleDocsContext = '';
          const gdocsMatch = prompt.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/);
          if (gdocsMatch) {
            try {
              connection.send(JSON.stringify({ type: 'thinking', message: '📄 Google Doc inlezen...' }));
              const docId = gdocsMatch[1];
              const docRes = await fetch(`https://docs.google.com/document/d/${docId}/export?format=txt`);
              if (docRes.ok) {
                const docText = await docRes.text();
                googleDocsContext = `\n\n=== INHOUD VAN GOOGLE DOC ===\n${docText.substring(0, 25000)}\n=============================\n`;
              }
            } catch (err) {
              fastify.log.warn('Google Docs fetch failed');
            }
          }

          const systemPrompt = basePrompt + nameInstruction + behaviorPrompt + ragContext + somtodayContext + googleDocsContext + modeInstructions;
          
          // Extract system messages from history and inject into system prompt
          const systemMsgs = history.filter(m => m.role === 'system');
          const chatMsgs = history.filter(m => m.role !== 'system');
          
          let assignmentContext = '';
          if (systemMsgs.length > 0) {
            assignmentContext = '\n\n=== OPDRACHT/SYSTEEM CONTEXT ===\n' + systemMsgs.map(m => m.content).join('\n') + '\n=== EINDE CONTEXT ===';
          }
          
          const finalSystemPrompt = systemPrompt + assignmentContext;
          
          const fullContext = chatMsgs.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + `\nUser: ${prompt}`;


          // Generate response with ollama (using targetModel)
          let assistantResponse = '';
          const streamStartTime = Date.now();
          
          // Send dynamic thinking status messages
          const thinkingMessages = [
            'Locra is aan het nadenken...',
            'AI analyseert je vraag...',
            'Bezig met verwerken...',
            'Antwoord wordt opgesteld...'
          ];
          let thinkingPhase = 0;
          
          if (data.deepResearch) {
            connection.send(JSON.stringify({ type: 'thinking', message: '🔬 Diepgaand onderzoek wordt gestart...', model: targetModel }));
          } else if (data.thinkMode) {
            connection.send(JSON.stringify({ type: 'thinking', message: '🧠 Locra denkt uitgebreid na...', model: targetModel }));
          } else if (data.internetSearch) {
            connection.send(JSON.stringify({ type: 'thinking', message: '🌐 Bronnen worden doorzocht...', model: targetModel }));
          } else if (data.useSomtoday) {
            connection.send(JSON.stringify({ type: 'thinking', message: '🎓 Gegevens verwerken...', model: targetModel }));
          } else if (knowledgeBaseId) {
            connection.send(JSON.stringify({ type: 'thinking', message: '📚 Kennisbank wordt geraadpleegd...', model: targetModel }));
          } else {
            connection.send(JSON.stringify({ type: 'thinking', message: thinkingMessages[0], model: targetModel }));
          }

          // If any sources were collected (Web or Document), send them to the frontend
          if (uniqueSources.size > 0) {
            const sourcesArray = Array.from(uniqueSources.values());
            console.log(`[SOURCES] Sending ${sourcesArray.length} sources to frontend:`, sourcesArray.map(s => `${s.type}: ${s.title}`));
            connection.send(JSON.stringify({ 
              type: 'rag_sources', 
              sources: sourcesArray 
            }));
          } else {
            console.log(`[SOURCES] No sources collected to send`);
          }
          
          let releaseSlot: (() => void) | null = null;
          let thinkingInterval: any = null;

          try {
            // Hardware concurrency limiter (Queueing if server is under heavy classroom load)
            const maxConcurrency = orgSettings?.maxConcurrency || 6;
            const queueTimeoutSec = orgSettings?.queueTimeoutSec || 45;

            releaseSlot = await concurrencyQueue.acquireSlot(
              authUser.orgId,
              maxConcurrency,
              queueTimeoutSec,
              (position) => {
                connection.send(JSON.stringify({ 
                  type: 'thinking', 
                  message: `⏳ Even geduld... Andere leerlingen zijn momenteel aan de beurt (Wachtrij positie: #${position})`,
                  model: targetModel
                }));
              }
            );

            // Rotate thinking messages every 3 seconds
            thinkingInterval = setInterval(() => {
              thinkingPhase = (thinkingPhase + 1) % thinkingMessages.length;
              try {
                connection.send(JSON.stringify({ type: 'thinking', message: thinkingMessages[thinkingPhase], model: targetModel }));
              } catch (_) {}
            }, 3000);

            const useThinking = Boolean(data.thinkMode || data.deepResearch);
            
            let isThinkingPhase = false;
            let evalCount = 0;

            const handleChunk = (chunkContent: string) => {
              if (chunkContent) {
                if (assistantResponse === '') {
                  clearInterval(thinkingInterval);
                  connection.send(JSON.stringify({ type: 'thinking', message: null }));
                }

                const isWatermarkActive = Boolean(
                  orgSettings?.enableWatermark && 
                  orgSettings?.licenseTier && 
                  ['edu-plus', 'enterprise'].includes(orgSettings.licenseTier)
                );

                let streamedChunk = chunkContent;
                if (isWatermarkActive && /[.!?]\s*$/.test(chunkContent)) {
                  streamedChunk += SENTENCE_SIGNATURE;
                }

                assistantResponse += streamedChunk;
                connection.send(JSON.stringify({ type: 'chunk', content: streamedChunk }));
              }
            };

            if (targetModelRecord && targetModelRecord.provider === 'openrouter') {
              if (!orgSettings?.openRouterApiKey) throw new Error("OpenRouter API key is niet geconfigureerd in de instellingen.");
              
              const client = new OpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: orgSettings.openRouterApiKey,
              });

              const messages = chatMsgs.map(m => ({ role: m.role as any, content: m.content }));
              messages.push({ role: 'user', content: prompt });
              messages.unshift({ role: 'system', content: finalSystemPrompt });

              const stream = await client.chat.completions.create({
                model: targetModel,
                messages,
                stream: true,
                ...(useThinking ? { reasoning: { enabled: true } } : {})
              } as any);

              for await (const chunk of stream as any) {
                let chunkContent = '';
                const delta = chunk.choices[0]?.delta as any;
                if (!delta) continue;
                
                if (delta.reasoning_details || delta.reasoning) {
                  if (!isThinkingPhase) {
                    chunkContent += '<think>\n';
                    isThinkingPhase = true;
                  }
                  chunkContent += (delta.reasoning_details || delta.reasoning);
                }
                
                if (delta.content) {
                  if (isThinkingPhase) {
                    chunkContent += '\n</think>\n';
                    isThinkingPhase = false;
                  }
                  chunkContent += delta.content;
                }
                
                handleChunk(chunkContent);
              }
            } else {
              const res = await ollamaClient.generate(fullContext, targetModel, finalSystemPrompt, true, data.images, useThinking);
              if (!res.body) throw new Error('No response body from AI');
              
              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const chunkLines = chunk.split('\n').filter(Boolean);
                
                for (const line of chunkLines) {
                  const parsed = JSON.parse(line);
                  let chunkContent = '';
                  
                  if (parsed.thinking) {
                    if (!isThinkingPhase) {
                      chunkContent += '<think>\n';
                      isThinkingPhase = true;
                    }
                    chunkContent += parsed.thinking;
                  }
                  
                  if (parsed.response) {
                    if (isThinkingPhase) {
                      chunkContent += '\n</think>\n';
                      isThinkingPhase = false;
                    }
                    chunkContent += parsed.response;
                  }
                  
                  handleChunk(chunkContent);
                  
                  if (parsed.done) {
                    evalCount = parsed.eval_count || 0;
                  }
                }
              }
            }

            // --- END OF STREAM LOGIC ---
            const responseTimeMs = Date.now() - streamStartTime;
            const metadata = {
              model: targetModel,
              responseTimeMs,
              tokensUsed: evalCount,
              tokensPerSecond: evalCount && responseTimeMs > 0 ? Math.round((evalCount / responseTimeMs) * 1000) : 0,
              storage: data.saveToServer !== false ? 'server' : 'local',
              ragUsed: ragUsed,
              routingMode: model === 'auto' ? 'auto' : 'manual'
            };

            if (orgSettings?.enableWatermark && orgSettings?.licenseTier && ['edu-plus', 'enterprise'].includes(orgSettings.licenseTier)) {
              assistantResponse = watermarkService.injectWatermark(
                assistantResponse,
                authUser.orgId,
                'Locra EDU'
              );
            }

            if (data.saveToServer !== false) {
              let finalAssContent = assistantResponse;
              let finalAssContentEncrypted = null;
              
              if (orgSettings?.enableE2EEncryption) {
                const { encryptMessage } = require('../../utils/crypto');
                finalAssContentEncrypted = encryptMessage(assistantResponse);
                finalAssContent = '[Versleuteld Bericht]';
              }

              const savedMsg = await prisma.message.create({
                data: {
                  conversationId,
                  userId: null,
                  role: 'assistant',
                  content: finalAssContent,
                  contentEncrypted: finalAssContentEncrypted,
                  modelUsed: targetModel,
                  responseTimeMs,
                  tokensUsed: evalCount
                }
              });
              connection.send(JSON.stringify({ type: 'done', messageId: savedMsg.id, metadata, model: targetModel, finalContent: assistantResponse }));

              const currentConv = await prisma.conversation.findUnique({ where: { id: conversationId } });
              const msgCount = await prisma.message.count({ where: { conversationId } });
              
              if (currentConv && (currentConv.title === 'Nieuw gesprek' || msgCount <= 3)) {
                try {
                  connection.send(JSON.stringify({ type: 'status', message: 'Titel wordt gegenereerd...' }));
                  const titlePrompt = `Geef een korte, beschrijvende titel (max 6 woorden, GEEN aanhalingstekens) voor dit gesprek. Gebruiker vroeg: "${prompt.substring(0, 200)}". Antwoord ALLEEN met de titel, niets anders.`;
                  
                  // Auto title using the same target model
                  if (targetModelRecord && targetModelRecord.provider === 'openrouter') {
                    const client = new OpenAI({
                      baseURL: 'https://openrouter.ai/api/v1',
                      apiKey: orgSettings?.openRouterApiKey || '',
                    });
                    const titleRes = await client.chat.completions.create({
                      model: targetModel,
                      messages: [{ role: 'user', content: titlePrompt }]
                    });
                    let generatedTitle = (titleRes.choices[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '').substring(0, 60);
                    if (generatedTitle && generatedTitle.length > 2) {
                      await prisma.conversation.update({
                        where: { id: conversationId },
                        data: { title: generatedTitle }
                      });
                      connection.send(JSON.stringify({ type: 'title_update', conversationId, title: generatedTitle }));
                    }
                  } else {
                    const titleRes = await ollamaClient.generate(titlePrompt, targetModel, undefined, false);
                    const titleData = await titleRes.json();
                    let generatedTitle = (titleData.response || '').trim().replace(/^["']|["']$/g, '').substring(0, 60);
                    
                    if (generatedTitle && generatedTitle.length > 2) {
                      await prisma.conversation.update({
                        where: { id: conversationId },
                        data: { title: generatedTitle }
                      });
                      connection.send(JSON.stringify({ type: 'title_update', conversationId, title: generatedTitle }));
                    }
                  }
                } catch (titleErr: any) {
                  fastify.log.warn(`Auto-title generation failed: ${titleErr.message}`);
                }
              }
            } else {
              connection.send(JSON.stringify({ type: 'done', metadata }));
            }
          } catch (aiError: any) {
            connection.send(JSON.stringify({ type: 'error', message: 'AI Engine error: ' + aiError.message }));
          } finally {
            if (thinkingInterval) {
              clearInterval(thinkingInterval);
            }
            if (releaseSlot) {
              releaseSlot();
            }
          }
        }

      } catch (err: any) {
        connection.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });
  });
}
