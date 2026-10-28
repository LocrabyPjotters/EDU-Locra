import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../index';
import { verifyToken } from '../../utils/crypto';
import crypto from 'crypto';
import OpenAI from 'openai';
import { ollamaClient } from '../../services/ollama';
import { cosineSimilarity, EMBEDDING_MODEL } from '../../services/rag';
import { performWebSearch } from '../../services/webSearch';
import { scrapeUrl, extractUrlsFromMessage } from '../../services/webScraper';
import { searchNews, formatNewsContext } from '../../services/newsSearch';
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

/**
 * Robustly parse title and tags from AI response.
 * Handles: plain JSON, ```json fenced JSON, and raw text fallback.
 */
function parseTitleTagsResponse(raw: string): { title: string; tags: string[] } {
  let str = (raw || '').trim();

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const fenceMatch = str.match(fenceRegex);
  if (fenceMatch) {
    str = fenceMatch[1].trim();
  }

  // Try to extract a JSON object from the string
  const jsonObjRegex = /\{[\s\S]*\}/;
  const jsonMatch = str.match(jsonObjRegex);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: (parsed.title || '').substring(0, 80),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean) : []
      };
    } catch (e) { /* continue to fallback */ }
  }

  // Fallback: use the first 60 chars as title, no tags
  // But only if it doesn't look like broken JSON
  const cleanStr = str.replace(/[{}[\]"]/g, '').trim();
  if (cleanStr.length > 2) {
    return { title: cleanStr.substring(0, 60), tags: [] };
  }

  return { title: '', tags: [] };
}

export default async function chatRoutes(fastify: FastifyInstance) {
  // --- REST ENDPOINTS ---
  fastify.register(async function (protectedRoutes) {
    protectedRoutes.addHook('preHandler', requireAuth);

    protectedRoutes.get('/conversations', async (request, reply) => {
      const { search, includeAssignments } = request.query as { search?: string; includeAssignments?: string };
      
      // Zoek conversation IDs die gekoppeld zijn aan een opdracht
      const assignmentSubmissions = await prisma.assignmentSubmission.findMany({
        where: { conversationId: { not: null } },
        select: { conversationId: true }
      });
      const assignmentConvIds = assignmentSubmissions
        .map(s => s.conversationId)
        .filter(Boolean) as string[];

      let whereClause: any = {
        OR: [
          { userId: request.user!.id },
          { participants: { some: { userId: request.user!.id } } }
        ]
      };

      // Tenzij expliciet gevraagd, sluiten we opdracht-chats uit van de normale chatgeschiedenis
      if (includeAssignments !== 'true') {
        const excludeConditions: any[] = [
          { NOT: { title: { startsWith: '[Opdracht]' } } }
        ];
        if (assignmentConvIds.length > 0) {
          excludeConditions.push({ id: { notIn: assignmentConvIds } });
        }
        whereClause.AND = excludeConditions;
      }
      
      if (search) {
        whereClause.AND = whereClause.AND || [];
        whereClause.AND.push({
          OR: [
            { title: { contains: search } },
            { tags: { contains: search } },
            { messages: { some: { content: { contains: search } } } }
          ]
        });
      }

      const conversations = await prisma.conversation.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        include: { 
          participants: true,
          labels: { include: { label: true } }
        }
      });
      return conversations.map((c: any) => ({
        ...c,
        isParticipantOnly: c.userId !== request.user!.id
      }));
    });

    protectedRoutes.get('/conversations/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.user!.id;

      const conv = await prisma.conversation.findUnique({
        where: { id },
        include: {
          participants: true,
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, username: true, displayName: true } },
              reactions: true,
              feedback: true
            }
          }
        }
      });

      if (!conv) {
        return reply.status(404).send({ error: 'Gesprek niet gevonden' });
      }

      const isOwner = conv.userId === userId;
      const isParticipant = conv.participants.some((p: any) => p.userId === userId);

      if (!isOwner && !isParticipant) {
        return reply.status(403).send({ error: 'Geen toegang tot dit gesprek' });
      }

      // Owner info
      const ownerUser = await prisma.user.findUnique({
        where: { id: conv.userId },
        select: { id: true, username: true, displayName: true, email: true }
      });

      // Enriched participants with user details
      const enrichedParticipants = await Promise.all((conv.participants || []).map(async (p: any) => {
        const u = await prisma.user.findUnique({
          where: { id: p.userId },
          select: { id: true, username: true, displayName: true, email: true, role: true }
        });
        return { ...p, user: u };
      }));

      // Ensure owner is represented in participants list
      if (ownerUser && !enrichedParticipants.some(p => p.userId === conv.userId)) {
        enrichedParticipants.unshift({
          id: `owner-${conv.userId}`,
          conversationId: conv.id,
          userId: conv.userId,
          role: 'owner',
          user: ownerUser
        });
      }

      // Collab code formatting
      let collabCode = conv.shareToken;
      if (conv.isCollab) {
        if (!collabCode || !collabCode.startsWith('COP-')) {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let codeSuffix = '';
          for (let i = 0; i < 4; i++) codeSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
          collabCode = `COP-${codeSuffix}`;
          try {
            await prisma.conversation.update({
              where: { id: conv.id },
              data: { shareToken: collabCode }
            });
          } catch {}
        }
      }

      // Decrypt messages
      const { decryptMessage } = require('../../utils/crypto');
      const decryptedMessages = (conv.messages || []).map((msg: any) => {
        const baseMsg = {
          ...msg,
          user: msg.user ? {
            id: msg.user.id,
            name: msg.user.displayName || msg.user.username,
            displayName: msg.user.displayName || msg.user.username
          } : undefined,
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

      return {
        ...conv,
        isOwner,
        owner: ownerUser,
        participants: enrichedParticipants,
        collabCode: collabCode || conv.shareToken,
        messages: decryptedMessages
      };
    });

    protectedRoutes.put('/conversations/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const { title, folder, tags } = request.body as { title?: string; folder?: string | null; tags?: string[] | null };

      const conv = await prisma.conversation.findUnique({ where: { id } });
      if (!conv || conv.userId !== request.user!.id) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const dataToUpdate: any = {};
      if (title !== undefined) {
        dataToUpdate.title = title;
        dataToUpdate.isCustomTitle = true;
      }
      if (folder !== undefined) dataToUpdate.folder = folder;
      if (tags !== undefined) dataToUpdate.tags = tags === null ? null : JSON.stringify(tags);

      const updated = await prisma.conversation.update({
        where: { id },
        data: dataToUpdate
      });
      return updated;
    });

    protectedRoutes.post('/conversations/organize', async (request, reply) => {
      const user = request.user!;
      
      const conversations = await prisma.conversation.findMany({
        where: { userId: user.id },
        select: { id: true, title: true, folder: true }
      });

      if (conversations.length === 0) return { success: true, count: 0 };

      const orgSettings = await prisma.orgSettings.findUnique({
        where: { orgId: user.orgId },
      }) as any;
      const helperModel = orgSettings?.orgHelperModel || 'qwen3.5:9b';

      // We only want to organize conversations that don't have a folder yet, 
      // or re-organize everything if requested. Let's organize everything for now.
      const convList = conversations.map(c => `- ID: ${c.id}, Titel: "${c.title}"`).join('\n');
      
      const prompt = `Je bent een AI die chatgeschiedenis organiseert. Hieronder is een lijst met gesprekken. 
Groepeer deze gesprekken in logische mappen (folders) gebaseerd op hun onderwerp (bijv. "Huiswerk", "Wiskunde", "Vragen", "Projecten"). 
Houd de mapnamen kort (1-3 woorden). Genereer voor elk gesprek ook 2-4 korte tags (steekwoorden).
Geef je antwoord ALTIJD als geldige JSON in dit exacte formaat:
[
  { "id": "gesprek-id", "folder": "Mapnaam", "tags": ["tag1", "tag2"] }
]

Lijst met gesprekken:
${convList}

Geef uitsluitend de JSON output. Geen markdown, geen extra tekst.`;

      try {
        const res = await ollamaClient.generate(prompt, helperModel, undefined, false);
        const data = await res.json();
        
        if (!data || !data.response) {
          console.error('Ollama gaf geen response terug. Data:', data);
          return reply.status(500).send({ error: 'AI gaf geen antwoord' });
        }

        let rawResponse = data.response;
        const startIdx = rawResponse.indexOf('[');
        const endIdx = rawResponse.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
          rawResponse = rawResponse.substring(startIdx, endIdx + 1);
        }

        let assignments: { id: string, folder: string, tags?: string[] }[] = [];
        try {
          assignments = JSON.parse(rawResponse);
        } catch (parseErr) {
          console.error('Fout bij het parsen van AI JSON:', rawResponse);
          return reply.status(500).send({ error: 'AI gaf geen geldige JSON' });
        }

        let updatedCount = 0;
        for (const assignment of assignments) {
          if (!assignment.id) continue;
          const conv = conversations.find(c => c.id === assignment.id);
          if (conv) {
            const dataToUpdate: any = {};
            if (assignment.folder) dataToUpdate.folder = assignment.folder;
            if (assignment.tags && Array.isArray(assignment.tags) && assignment.tags.length > 0) {
              dataToUpdate.tags = JSON.stringify(assignment.tags);
            }
            if (Object.keys(dataToUpdate).length > 0) {
              await prisma.conversation.update({
                where: { id: conv.id },
                data: dataToUpdate
              });
              updatedCount++;
            }
          }
        }
        return { success: true, count: updatedCount };
      } catch (err) {
        console.error('Fout bij AI organiseren:', err);
        return reply.status(500).send({ error: 'Fout bij communicatie met AI' });
      }
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
      const { title, modelId, isCollab } = request.body as any;
      const conversation = await prisma.conversation.create({
        data: {
          orgId: request.user!.orgId,
          userId: request.user!.id,
          title: title || 'Nieuw gesprek',
          modelId,
          isCollab: isCollab === true
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
      const isParticipant = conv?.participants.some((p: any) => p.userId === request.user!.id);
      
      if (!conv || (!isOwner && !isParticipant)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const messages = await prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, username: true, displayName: true } },
          reactions: true,
          feedback: true
        }
      });
      
      const { decryptMessage } = require('../../utils/crypto');
      const decryptedMessages = messages.map((msg: any) => {
        const baseMsg = {
          ...msg,
          user: msg.user ? {
            id: msg.user.id,
            name: msg.user.displayName || msg.user.username,
            displayName: msg.user.displayName || msg.user.username
          } : undefined,
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
        
        if (!conv.isCollab) {
          await prisma.conversation.update({
            where: { id },
            data: { isCollab: true }
          });
        }
        
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

      const conv = await prisma.conversation.findUnique({ 
        where: { id },
        include: { participants: true }
      });
      const isOwner = conv?.userId === request.user!.id;
      const isParticipant = conv?.participants.some((p: any) => p.userId === request.user!.id);
      if (!conv || (!isOwner && !isParticipant)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId: id }
      });

      // Enrich user info
      const enriched = await Promise.all(participants.map(async (p: any) => {
        if (p.user) return p;
        const user = await prisma.user.findUnique({
          where: { id: p.userId },
          select: { id: true, username: true, displayName: true, email: true, role: true }
        });
        return { ...p, user };
      }));

      return enriched;
    });

    // Remove a participant from a conversation
    protectedRoutes.delete('/conversations/:id/participants/:userId', async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };

      const conv = await prisma.conversation.findUnique({ 
        where: { id },
        include: { participants: true }
      });
      const isOwner = conv?.userId === request.user!.id;
      const isSelf = userId === request.user!.id;
      if (!conv || (!isOwner && !isSelf)) {
        return reply.status(403).send({ error: 'Alleen de eigenaar of de deelnemer zelf kan de kamer verlaten' });
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

    // ── CO-OP WORKSPACE: ROOM MANAGEMENT & JOIN BY CODE ──────────────────────
    protectedRoutes.get('/coop/rooms', async (request, reply) => {
      const userId = request.user!.id;
      const rooms = await prisma.conversation.findMany({
        where: {
          isCollab: true,
          OR: [
            { userId },
            { participants: { some: { userId } } }
          ]
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          participants: true,
          _count: { select: { messages: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { id: true, content: true, role: true, createdAt: true, userId: true }
          }
        }
      });

      const enrichedRooms = await Promise.all(rooms.map(async (r: any) => {
        const enrichedParticipants = await Promise.all((r.participants || []).map(async (p: any) => {
          const u = await prisma.user.findUnique({
            where: { id: p.userId },
            select: { id: true, username: true, displayName: true, email: true, role: true }
          });
          return { ...p, user: u };
        }));

        const ownerUser = await prisma.user.findUnique({
          where: { id: r.userId },
          select: { id: true, username: true, displayName: true, email: true }
        });

        if (ownerUser && !enrichedParticipants.some((p: any) => p.userId === r.userId)) {
          enrichedParticipants.unshift({
            id: `owner-${r.userId}`,
            conversationId: r.id,
            userId: r.userId,
            role: 'owner',
            user: ownerUser
          });
        }

        // Ensure a clean 6-digit room code exists
        let collabCode = r.shareToken;
        if (!collabCode || !collabCode.startsWith('COP-')) {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let codeSuffix = '';
          for (let i = 0; i < 4; i++) codeSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
          collabCode = `COP-${codeSuffix}`;
          try {
            await prisma.conversation.update({
              where: { id: r.id },
              data: { shareToken: collabCode }
            });
          } catch {}
        }

        return {
          ...r,
          owner: ownerUser,
          isOwner: r.userId === userId,
          participants: enrichedParticipants,
          collabCode
        };
      }));

      return enrichedRooms;
    });

    protectedRoutes.post('/coop/rooms', async (request, reply) => {
      const { title, subject, modelId, initialDoc } = request.body as {
        title: string;
        subject?: string;
        modelId?: string;
        initialDoc?: string;
      };

      const userId = request.user!.id;
      const orgId = request.user!.orgId;

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let codeSuffix = '';
      for (let i = 0; i < 4; i++) codeSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
      const collabCode = `COP-${codeSuffix}`;

      const room = await prisma.conversation.create({
        data: {
          title: title?.trim() || 'Nieuwe Projectkamer',
          folder: subject?.trim() || 'Algemeen Project',
          userId,
          orgId,
          isCollab: true,
          shareToken: collabCode,
          modelId: modelId || 'auto',
          summary: initialDoc || undefined
        }
      });

      // Add creator as owner participant
      await prisma.conversationParticipant.create({
        data: {
          conversationId: room.id,
          userId,
          role: 'owner'
        }
      });

      return {
        ...room,
        collabCode,
        isOwner: true
      };
    });

    protectedRoutes.post('/coop/join', async (request, reply) => {
      const { code } = request.body as { code: string };
      if (!code || !code.trim()) {
        return reply.status(400).send({ error: 'Voer een geldige kamercode in (bijv. COP-9482)' });
      }

      let cleanCode = code.trim().toUpperCase();
      if (!cleanCode.startsWith('COP-') && cleanCode.length === 4) {
        cleanCode = `COP-${cleanCode}`;
      }

      const room = await prisma.conversation.findFirst({
        where: {
          isCollab: true,
          shareToken: { equals: cleanCode }
        },
        include: {
          participants: true
        }
      });

      if (!room) {
        return reply.status(404).send({ error: 'Geen actieve projectkamer gevonden met deze code' });
      }

      const userId = request.user!.id;
      // Add or update participant
      await prisma.conversationParticipant.upsert({
        where: { conversationId_userId: { conversationId: room.id, userId } },
        update: { role: room.userId === userId ? 'owner' : 'editor' },
        create: { conversationId: room.id, userId, role: room.userId === userId ? 'owner' : 'editor' }
      });

      return {
        success: true,
        conversationId: room.id,
        title: room.title,
        folder: room.folder,
        collabCode: room.shareToken
      };
    });

    protectedRoutes.put('/coop/rooms/:id/doc', async (request, reply) => {
      const { id } = request.params as { id: string };
      const { docContent } = request.body as { docContent: string };
      const userId = request.user!.id;

      const conv = await prisma.conversation.findUnique({
        where: { id },
        include: { participants: true }
      });

      if (!conv || (conv.userId !== userId && !conv.participants.some(p => p.userId === userId))) {
        return reply.status(403).send({ error: 'Geen toegang tot deze kamer' });
      }

      const updated = await prisma.conversation.update({
        where: { id },
        data: { summary: docContent }
      });

      return { success: true, docContent: updated.summary };
    });

    protectedRoutes.post('/coop/rooms/:id/code', async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.user!.id;

      const conv = await prisma.conversation.findUnique({ where: { id } });
      if (!conv || conv.userId !== userId) {
        return reply.status(403).send({ error: 'Alleen de eigenaar kan de code vernieuwen' });
      }

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let codeSuffix = '';
      for (let i = 0; i < 4; i++) codeSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
      const newCode = `COP-${codeSuffix}`;

      await prisma.conversation.update({
        where: { id },
        data: { shareToken: newCode }
      });

      return { success: true, collabCode: newCode };
    });

    // ── LOCRA DOCS: DIRECT AI BEWERKING & ACTIES ────────────────────────────
    protectedRoutes.post('/docs/ai-edit', async (request, reply) => {
      const { docContent, action = 'improve', customInstruction, model } = request.body as {
        docContent: string;
        action?: 'improve' | 'formal' | 'shorten' | 'expand' | 'b1' | 'custom';
        customInstruction?: string;
        model?: string;
      };

      if (!docContent || !docContent.trim()) {
        return reply.status(400).send({ error: 'Geen documenttekst aangeleverd' });
      }

      const instructionsMap: Record<string, string> = {
        improve: 'Verbeter de spelling, grammatica, interpunctie en zinsbouw van de documenttekst. Behoud de kernboodschap en inhoud, maar maak de tekst vloeiend en foutloos.',
        formal: 'Herschrijf de tekst in een formele, professionele en zakelijke toon geschikt voor school of werk. Vermijd spreektaal en zorg voor nette academische bewoordingen.',
        shorten: 'Kort de tekst in. Verwijder herhalingen en stopwoorden, behoud de belangrijkste kernpunten en maak het geheel beknopt, to-the-point en krachtig.',
        expand: 'Breid de tekst uit. Voeg relevante toelichtingen, concrete voorbeelden en verhelderende details toe die perfect aansluiten bij de strekking van het document.',
        b1: 'Herschrijf de tekst naar eenvoudig en helder Nederlands op B1-taalniveau. Gebruik korte, actieve zinnen en vermijd nodeloos ingewikkelde vaktermen.',
        custom: customInstruction || 'Verbeter het document.'
      };

      const selectedInstruction = instructionsMap[action] || customInstruction || 'Verbeter de documenttekst.';

      const systemPrompt = `Je bent een ervaren onderwijsredacteur en schrijfcoach.
Jouw taak is om de aangeleverde documenttekst direct aan te passen volgens de opdracht.

OPDRACHT:
${selectedInstruction}

CRUCIALE REGELS:
1. Geef UITSLUITEND de bewerkte documenttekst terug.
2. Schrijf GEEN inleidingen (zoals "Hier is de bewerkte tekst:").
3. Schrijf GEEN afsluitingen of beleefdheidsfrasen.
4. Plaats de tekst NIET binnen markdown codeblocks (\`\`\` of \`\`\`markdown).
5. Behoud bestaande structuur en kopjes indien van toepassing.`;

      const userPrompt = `DOCUMENT OM TE BEWERKEN:\n${docContent}`;

      try {
        const user = request.user!;
        const orgSettings = await prisma.orgSettings.findUnique({
          where: { orgId: user.orgId }
        });

        // 1. Probeer Gemini indien geconfigureerd
        if (orgSettings?.geminiApiKey) {
          try {
            const geminiModel = 'gemini-2.5-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${orgSettings.geminiApiKey}`;
            const gRes = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: userPrompt }] }],
                generationConfig: { temperature: 0.3 }
              })
            });
            if (gRes.ok) {
              const gData = await gRes.json();
              let text = gData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                text = text.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim();
                return { success: true, updatedContent: text };
              }
            }
          } catch (gErr) {
            console.warn('[Docs AI] Gemini call mislukt, fallback naar Ollama:', (gErr as any).message);
          }
        }

        // 2. Fallback naar lokaal Ollama model
        const targetModel = model && model !== 'auto' ? model : (orgSettings?.orgHelperModel || 'qwen3.5:9b');
        const ollamaRes = await ollamaClient.generate(userPrompt, targetModel, systemPrompt, false);
        const ollamaData = await ollamaRes.json();
        let cleaned = (ollamaData.response || '').replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim();
        return { success: true, updatedContent: cleaned };
      } catch (err: any) {
        return reply.status(500).send({ error: 'AI bewerking mislukt: ' + err.message });
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
      const messages = conv.messages.map((m: any) => {
        if (m.content === '[Versleuteld Bericht]' && m.contentEncrypted) {
          return { ...m, content: decryptMessage(m.contentEncrypted) };
        }
        return m;
      });

      if (format === 'json') {
        reply.header('Content-Disposition', `attachment; filename="chat-${id}.json"`);
        return { title: conv.title, messages: messages.map((m: any) => ({ role: m.role, content: m.content, createdAt: m.createdAt })) };
      } else if (format === 'markdown') {
        let md = `# ${conv.title}\n\n`;
        messages.forEach((m: any) => {
          md += `### ${m.role === 'user' ? 'Jij' : 'Locra AI'}\n${m.content}\n\n---\n\n`;
        });
        reply.header('Content-Disposition', `attachment; filename="chat-${id}.md"`);
        reply.type('text/markdown');
        return md;
      }
      return reply.status(400).send({ error: 'Unsupported format' });
    });

    // ── HTTP POST /api/chat/send — Direct Chat Endpoint for Mobile App & External Integrations ──
    protectedRoutes.post('/send', async (request, reply) => {
      const { conversationId, prompt, model, useThinkMode } = request.body as {
        conversationId?: string;
        prompt: string;
        model?: string;
        useThinkMode?: boolean;
      };

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return reply.status(400).send({ error: 'Bericht mag niet leeg zijn.' });
      }

      const authUser = request.user!;
      const startTime = Date.now();

      // 1. Resolve or create conversation
      let convId = conversationId;
      let conv: any = null;

      if (convId) {
        conv = await prisma.conversation.findUnique({
          where: { id: convId },
          include: { participants: true }
        });
        const isOwner = conv?.userId === authUser.id;
        const isParticipant = conv?.participants?.some((p: any) => p.userId === authUser.id);
        if (!conv || (!isOwner && !isParticipant)) {
          return reply.status(403).send({ error: 'Geen toegang tot dit gesprek.' });
        }
      } else {
        const cleanTitle = prompt.trim().slice(0, 36) || 'Nieuw gesprek';
        conv = await prisma.conversation.create({
          data: {
            orgId: authUser.orgId,
            userId: authUser.id,
            title: cleanTitle,
            modelId: null
          }
        });
        convId = conv.id;
      }

      // 2. Save user message
      const savedUserMsg = await prisma.message.create({
        data: {
          conversationId: convId!,
          userId: authUser.id,
          role: 'user',
          content: prompt.trim()
        }
      });

      // 3. Fetch past messages for context
      const rawHistory = await prisma.message.findMany({
        where: { conversationId: convId! },
        orderBy: { createdAt: 'desc' },
        take: 12
      });
      rawHistory.reverse();
      const { decryptMessage } = require('../../utils/crypto');
      const history = rawHistory.map((m: any) => ({
        role: m.role,
        content: m.content === '[Versleuteld Bericht]' && m.contentEncrypted ? decryptMessage(m.contentEncrypted) : m.content
      }));

      // 4. Resolve Target Model
      const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId: authUser.orgId } }) as any;
      const activeModels = await prisma.installedModel.findMany({
        where: { orgId: authUser.orgId, isActive: true }
      });

      let targetModel = model && model !== 'auto' ? model : 'auto';
      let targetModelRecord = null;

      if (targetModel === 'auto' || !targetModel) {
        const targetTier = useThinkMode ? 'heavy' : 'standard';
        targetModelRecord = activeModels.find((m: any) => m.routingTier === targetTier) || activeModels[0];
        targetModel = targetModelRecord ? targetModelRecord.ollamaName : (orgSettings?.defaultModel || 'llama3.2');
      } else {
        targetModelRecord = activeModels.find((m: any) => m.ollamaName === targetModel || m.name === targetModel);
      }

      // 5. System Prompt
      const org = await prisma.organization.findUnique({ where: { id: authUser.orgId } });
      const aiName = org?.aiName || 'Locra AI';
      let systemPrompt = `Je bent ${aiName}, een vriendelijke en intelligente onderwijsassistent voor scholen in Nederland. Antwoord behulpzaam, duidelijk en pedagogisch verantwoord in het Nederlands.`;
      if (useThinkMode) {
        systemPrompt += ` Neem de tijd om diep na te denken en stap voor stap te redeneren.`;
      }

      // 6. Generate Response (Cloud LLM or Local Ollama)
      let assistantReply = '';
      try {
        if (targetModelRecord && (targetModelRecord.provider === 'openrouter' || targetModelRecord.provider === 'openai' || targetModelRecord.provider === 'anthropic' || targetModelRecord.provider === 'gemini')) {
          const provider = targetModelRecord.provider;
          let apiKey: string | undefined;
          let baseURL: string | undefined;

          if (provider === 'openrouter') {
            apiKey = orgSettings?.openRouterApiKey || undefined;
            baseURL = 'https://openrouter.ai/api/v1';
          } else if (provider === 'openai') {
            apiKey = orgSettings?.openAiApiKey || undefined;
            baseURL = 'https://api.openai.com/v1';
          } else if (provider === 'anthropic') {
            apiKey = orgSettings?.anthropicApiKey || undefined;
            baseURL = 'https://api.anthropic.com';
          } else if (provider === 'gemini') {
            apiKey = orgSettings?.geminiApiKey || undefined;
            baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
          }

          if (apiKey) {
            const client = new OpenAI({ baseURL, apiKey });
            const messages: any[] = history.map(m => ({ role: m.role, content: m.content }));
            messages.unshift({ role: 'system', content: systemPrompt });

            const completion = await client.chat.completions.create({
              model: targetModel,
              messages,
              ...(useThinkMode && provider === 'openrouter' ? { reasoning: { enabled: true } } : {})
            });
            assistantReply = completion.choices[0]?.message?.content || '';
          }
        }

        if (!assistantReply) {
          // Ollama local fallback
          const chatContext = history.slice(0, -1).map(m => `${m.role === 'user' ? 'Gebruiker' : aiName}: ${m.content}`).join('\n');
          const fullPrompt = chatContext ? `${chatContext}\nGebruiker: ${prompt.trim()}\n${aiName}:` : prompt.trim();
          const res = await ollamaClient.generate(fullPrompt, targetModel, systemPrompt, false);
          const d = await res.json() as any;
          assistantReply = d.response || d.content || '';
        }
      } catch (err: any) {
        fastify.log.error(`Chat error in /send: ${err.message}`);
        try {
          const fallbackRes = await ollamaClient.generate(prompt.trim(), orgSettings?.defaultModel || 'llama3.2', systemPrompt, false);
          const fallbackData = await fallbackRes.json() as any;
          assistantReply = fallbackData.response || 'Excuses, ik kon momenteel geen antwoord genereren.';
        } catch {
          return reply.status(500).send({ error: 'Fout bij het genereren van een AI-antwoord: ' + err.message });
        }
      }

      const responseTimeMs = Date.now() - startTime;

      // 7. Save Assistant Message
      const savedAssistantMsg = await prisma.message.create({
        data: {
          conversationId: convId!,
          userId: null,
          role: 'assistant',
          content: assistantReply,
          modelUsed: targetModel,
          responseTimeMs
        }
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: convId! },
        data: { updatedAt: new Date() }
      });

      return {
        success: true,
        conversationId: convId,
        userMessageId: savedUserMsg.id,
        messageId: savedAssistantMsg.id,
        reply: assistantReply,
        content: assistantReply,
        response: assistantReply,
        model: targetModel
      };
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
    conv.messages = conv.messages.map((msg: any) => {
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

  // Active websocket connections mapped by userId for real-time broadcasting
  const activeWsConnections = new Map<string, any[]>();

  // --- WEBSOCKET ENDPOINT ---
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    let authUser: any = null;

    connection.on('close', () => {
      if (authUser) {
        const conns = activeWsConnections.get(authUser.id);
        if (conns) {
          const newConns = conns.filter((c: any) => c !== connection);
          if (newConns.length > 0) activeWsConnections.set(authUser.id, newConns);
          else activeWsConnections.delete(authUser.id);
        }
      }
    });

    connection.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        // 1. Authenticate first message
        if (data.type === 'auth') {
          try {
            const decoded = verifyToken(data.token);
            authUser = decoded;
            
            // Register connection
            const userConns = activeWsConnections.get(authUser.id) || [];
            userConns.push(connection);
            activeWsConnections.set(authUser.id, userConns);

            connection.send(JSON.stringify({ type: 'auth_success' }));
          } catch (e) {
            connection.send(JSON.stringify({ type: 'auth_error', message: 'Token expired or invalid' }));
            connection.close();
          }
          return;
        }

        if (!authUser) {
          connection.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
          return;
        }

        // ── 1B. CO-OP Room Presence & Typing Handlers ──
        if (data.type === 'coop_join') {
          const { conversationId } = data;
          if (conversationId) {
            (connection as any).currentCoopRoomId = conversationId;
            const conv = await prisma.conversation.findUnique({
              where: { id: conversationId },
              include: { participants: true }
            });
            if (conv) {
              const participantIds = conv.participants.map((p: any) => p.userId);
              if (conv.userId && !participantIds.includes(conv.userId)) participantIds.push(conv.userId);

              const onlineUserIds = participantIds.filter(pid => {
                const conns = activeWsConnections.get(pid);
                return conns && conns.some((c: any) => c.readyState === 1);
              });

              const presenceMsg = JSON.stringify({
                type: 'coop_presence',
                conversationId,
                onlineUserIds
              });

              participantIds.forEach(pid => {
                const conns = activeWsConnections.get(pid);
                if (conns) conns.forEach((c: any) => { try { if (c.readyState === 1) c.send(presenceMsg); } catch (_) {} });
              });
            }
          }
          return;
        }

        if (data.type === 'coop_typing') {
          const { conversationId, isTyping } = data;
          if (conversationId) {
            const conv = await prisma.conversation.findUnique({
              where: { id: conversationId },
              include: { participants: true }
            });
            if (conv) {
              const participantIds = conv.participants.map((p: any) => p.userId);
              if (conv.userId && !participantIds.includes(conv.userId)) participantIds.push(conv.userId);

              const typingMsg = JSON.stringify({
                type: 'coop_typing',
                conversationId,
                userId: authUser.id,
                userName: authUser.name || authUser.displayName || 'Groepslid',
                isTyping: !!isTyping
              });

              participantIds.forEach(pid => {
                if (pid === authUser.id) return;
                const conns = activeWsConnections.get(pid);
                if (conns) conns.forEach((c: any) => { try { if (c.readyState === 1) c.send(typingMsg); } catch (_) {} });
              });
            }
          }
          return;
        }

        // 2. Handle Chat Message
        if (data.type === 'chat') {
          const { conversationId, prompt, model, knowledgeBaseId, persona } = data;
          
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
          const isParticipant = conv?.participants.some((p: any) => p.userId === authUser.id);

          if (!conv || (!isOwner && !isParticipant)) {
            connection.send(JSON.stringify({ type: 'error', message: 'Access denied to this conversation' }));
            return;
          }

          // Handle Encryption
          let finalContent = prompt;
          let finalContentEncrypted = null;
          
          const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId: authUser.orgId } }) as any;
          
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

          // ── Tijdslot check ──
          if (orgSettings?.activeTimeStart && orgSettings?.activeTimeEnd && !['admin', 'superadmin', 'teacher'].includes(authUser.role)) {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            const [startH, startM] = orgSettings.activeTimeStart.split(':').map(Number);
            const [endH, endM] = orgSettings.activeTimeEnd.split(':').map(Number);
            const startMinutes = startH * 60 + (startM || 0);
            const endMinutes = endH * 60 + (endM || 0);

            if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
              connection.send(JSON.stringify({ type: 'error', message: `Locra is alleen beschikbaar van ${orgSettings.activeTimeStart} tot ${orgSettings.activeTimeEnd}. Probeer het later opnieuw.` }));
              return;
            }

            // Check active days (1=Ma ... 7=Zo)
            if (orgSettings.activeDays) {
              try {
                const allowedDays: number[] = JSON.parse(orgSettings.activeDays);
                const jsDay = now.getDay(); // 0=Sun
                const isoDay = jsDay === 0 ? 7 : jsDay; // Convert to 1=Ma ... 7=Zo
                if (!allowedDays.includes(isoDay)) {
                  connection.send(JSON.stringify({ type: 'error', message: 'Locra is vandaag niet beschikbaar. Het systeem is alleen actief op schooldagen.' }));
                  return;
                }
              } catch (e) { /* invalid JSON, skip check */ }
            }
          }

          // ── Trefwoordfilter ──
          if (orgSettings?.blockedKeywords && !['admin', 'superadmin'].includes(authUser.role)) {
            try {
              const blocked: string[] = typeof orgSettings.blockedKeywords === 'string'
                ? orgSettings.blockedKeywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)
                : [];
              const promptLower = prompt.toLowerCase();
              const matchedWord = blocked.find(word => promptLower.includes(word));
              if (matchedWord) {
                connection.send(JSON.stringify({ type: 'error', message: 'Je bericht bevat een geblokkeerd trefwoord. Dit onderwerp is door de beheerder uitgeschakeld.' }));
                return;
              }
            } catch (e) { /* invalid format, skip */ }
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
          let savedMsgId = '';
          if (data.saveToServer !== false) {
            const savedMsg = await prisma.message.create({
              data: {
                conversationId,
                userId: authUser.id,
                role: 'user',
                content: finalContent,
                contentEncrypted: finalContentEncrypted,
                attachments: data.images ? JSON.stringify(data.images) : null,
              }
            });
            savedMsgId = savedMsg.id;
          }

          // Multiplayer / Group Chat Logic
          const isCollabChat = conv.isCollab || conv.participants.length > 0;
          if (isCollabChat) {
            // Broadcast the human message to all other participants
            const participantIds = conv.participants.map((p: any) => p.userId);
            if (conv.userId !== authUser.id) participantIds.push(conv.userId);
            
            const broadcastMsg = JSON.stringify({
              type: 'coop_message',
              message: {
                id: savedMsgId,
                conversationId: conv.id,
                role: 'user',
                content: prompt, // Deliver plain content to authorized live participants
                createdAt: new Date(),
                userId: authUser.id,
                user: {
                  id: authUser.id,
                  name: authUser.name || authUser.displayName || authUser.username || 'Groepslid',
                  displayName: authUser.displayName || authUser.name || authUser.username || 'Groepslid'
                }
              }
            });

            participantIds.forEach((pid: string) => {
              if (pid === authUser.id) return;
              const conns = activeWsConnections.get(pid);
              if (conns) {
                conns.forEach((c: any) => {
                  try { c.send(broadcastMsg); } catch(e){}
                });
              }
            });

            const org = await prisma.organization.findUnique({ where: { id: authUser.orgId } });
            const aiName = (org?.aiName?.trim() || "Locra").toLowerCase();
            const promptLower = prompt.toLowerCase();
            const aiMentioned = data.forceAi === true ||
                                promptLower.includes('@locra') || 
                                promptLower.includes('@locraai') || 
                                promptLower.includes('@locra-ai') || 
                                promptLower.includes('@ai') ||
                                promptLower.includes('@assistent') ||
                                promptLower.includes(`@${aiName}`);
            
            if (!aiMentioned) {
              // Just a human-to-human message, skip AI processing
              connection.send(JSON.stringify({ 
                type: 'done', 
                messageId: savedMsgId, 
                finalContent: '',
                isHumanOnly: true 
              }));
              return; // Stop processing
            }
          }


          // Fetch history for context (take last 20 messages in chronological order)
          let history: any[] = [];
          if (data.saveToServer !== false) {
            const rawHistory = await prisma.message.findMany({
              where: { conversationId },
              orderBy: { createdAt: 'desc' },
              take: 20
            });
            rawHistory.reverse();
            // Decrypt history if needed
            const { decryptMessage } = require('../../utils/crypto');
            history = rawHistory.map((m: any) => ({
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
            
            targetModelRecord = activeModels.find((m: any) => m.routingTier === targetTier) || activeModels[0];
            if (targetModelRecord) {
              targetModel = targetModelRecord.ollamaName;
            } else {
              targetModel = 'llama3';
            }
          } else {
            targetModelRecord = await prisma.installedModel.findFirst({
              where: {
                orgId: authUser.orgId,
                OR: [
                  { ollamaName: model },
                  { id: model }
                ]
              }
            });
            if (targetModelRecord) {
              targetModel = targetModelRecord.ollamaName;
            }
          }

          // ── MODEL TOEGANG CHECK ──
          if (targetModelRecord && !['admin', 'superadmin'].includes(authUser.role)) {
            const accessMode = (targetModelRecord as any).accessMode || 'all';
            const teacherOnly = (targetModelRecord as any).teacherOnly || false;

            if (teacherOnly || accessMode === 'teachers-only') {
              if (authUser.role !== 'teacher') {
                connection.send(JSON.stringify({ type: 'error', message: `Dit model is alleen beschikbaar voor docenten.` }));
                return;
              }
            } else if (accessMode === 'restricted') {
              // Check of de user in een toegestane klas of groep zit
              const allowedClassIds: string[] = (targetModelRecord as any).allowedClassIds
                ? JSON.parse((targetModelRecord as any).allowedClassIds) : [];
              const allowedGroupIds: string[] = (targetModelRecord as any).allowedGroupIds
                ? JSON.parse((targetModelRecord as any).allowedGroupIds) : [];

              let hasAccess = false;
              if (allowedClassIds.length > 0) {
                const inClass = await prisma.studentClass.findFirst({
                  where: { studentId: authUser.id, classId: { in: allowedClassIds } }
                });
                if (inClass) hasAccess = true;
              }
              if (!hasAccess && allowedGroupIds.length > 0) {
                const inGroup = await prisma.groupMember.findFirst({
                  where: { userId: authUser.id, groupId: { in: allowedGroupIds } }
                });
                if (inGroup) hasAccess = true;
              }
              if (!hasAccess && authUser.role === 'teacher') hasAccess = true; // docenten altijd toegang

              if (!hasAccess) {
                connection.send(JSON.stringify({ type: 'error', message: `Je hebt geen toegang tot dit model. Neem contact op met je beheerder.` }));
                return;
              }
            }
          }

          // ── CREDIT CHECK (hoogste limiet wint) ──
          let creditCost = 0;
          if (orgSettings?.enableCredits && data.saveToServer !== false && !['admin', 'superadmin'].includes(authUser.role)) {
            const userRecord = await prisma.user.findUnique({
              where: { id: authUser.id },
              include: { studentClasses: { include: { class: true } } }
            });

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

            // ── Hoogste limiet wint ──
            // Org default
            let effectiveLimit = orgSettings.defaultCreditsPerUser || 100;

            // Klassen: neem de hoogste klassen-limiet van alle klassen waar de user in zit
            const userClasses = (userRecord as any)?.studentClasses?.map((sc: any) => sc.class) || [];
            for (const cls of userClasses) {
              if (cls.customQuotaEnabled && cls.maxPromptsPerMonth && cls.maxPromptsPerMonth > effectiveLimit) {
                effectiveLimit = cls.maxPromptsPerMonth;
              }
            }

            // Gebruiker eigen override (hoogste wint)
            if (userRecord?.customQuotaEnabled && userRecord?.maxPromptsPerMonth && userRecord.maxPromptsPerMonth > effectiveLimit) {
              effectiveLimit = userRecord.maxPromptsPerMonth;
            }

            if (currentUsed + creditCost > effectiveLimit) {
              connection.send(JSON.stringify({ type: 'error', message: `Onvoldoende credits. Je hebt ${creditCost} credits nodig maar je limiet van ${effectiveLimit} is bereikt.` }));
              return;
            }

            // Deduct credits
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
            if (orgSettings && orgSettings.enableWebSearch === false) {
              connection.send(JSON.stringify({ type: 'thinking', message: '⚠️ Live internet zoeken is uitgeschakeld door de schoolbeheerder.' }));
              ragContext = '\n\n[SYSTEEM]: Live internet zoeken is uitgeschakeld door de beheerder.';
            } else {
              try {
                connection.send(JSON.stringify({ type: 'thinking', message: '🌐 Zoeken op het internet...' }));
                let smartQuery = await reformulateQuery(prompt, history, targetModel || 'llama3');
                
                // Privacy / PII filter check
                const { filterSearchQueryPII } = require('../../services/webSearch');
                if (orgSettings?.enableWebSearchPiiFilter !== false) {
                  smartQuery = filterSearchQueryPII(smartQuery);
                }
                
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
          }

          // ── WEBSITE SCRAPING FLOW ──
          const urlsToScrape = extractUrlsFromMessage(prompt);
          if (urlsToScrape.length > 0) {
            try {
              connection.send(JSON.stringify({ type: 'thinking', message: '📄 Webpagina(s) inlezen...' }));
              let scrapeContext = '';
              for (const u of urlsToScrape) {
                const scrapeRes = await scrapeUrl(u);
                if (scrapeRes.text) {
                  ragUsed = true;
                  uniqueSources.set(u, { id: u, title: scrapeRes.title || u, type: 'web', url: u });
                  scrapeContext += `\n[Pagina: ${scrapeRes.title || u}]\nURL: ${u}\nInhoud:\n${scrapeRes.text}\n`;
                } else if (scrapeRes.error) {
                  fastify.log.warn(`Scraping failed for ${u}: ${scrapeRes.error}`);
                  scrapeContext += `\n[Fout bij inlezen van ${u}]: ${scrapeRes.error}\n`;
                }
              }
              if (scrapeContext) {
                ragContext += (ragContext ? '\n' : '') + '=== INGELEZEN WEBPAGINA\'S ===\n' + scrapeContext;
              }
            } catch (err: any) {
              fastify.log.warn(`Website scraping unexpected error: ${err.message}`);
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
                const documentMap = new Map();
                relevantChunks.forEach((c: any) => {
                  if (c.documentId && c.filename && !documentMap.has(c.documentId)) {
                    const sourceObj = { id: c.documentId, title: c.filename, type: 'document' };
                    documentMap.set(c.documentId, sourceObj);
                  }
                });

                const avgScore = (relevantChunks.reduce((sum: number, c: any) => sum + c.score, 0) / relevantChunks.length).toFixed(2);
                console.log(`[RAG] Found ${relevantChunks.length} relevant chunks (avg score: ${avgScore}) for query: "${smartQuery.substring(0, 80)}"`);
                
                ragContext = '\n\n=== BIJGEVOEGDE DOCUMENTATIE (KENNISBANK) ===\n' +
                  relevantChunks.map((c: any) => {
                    const sourceKeys = Array.from(documentMap.keys());
                    const idx = sourceKeys.indexOf(c.documentId) + 1;
                    return `[Bron ${idx}] (document: ${c.filename}, relevantie: ${(c.score * 100).toFixed(0)}%):\n${c.content}`;
                  }).join('\n\n') +
                  '\n=== EINDE DOCUMENTATIE ===\n\n' +
                  'KRITIEKE INSTRUCTIE VOOR DOCUMENTATIE:\n' +
                  '- Je MOET bovenstaande documentatie gebruiken om de vraag te beantwoorden.\n' +
                  '- Baseer je antwoord UITSLUITEND op de bijgevoegde bronnen.\n' +
                  '- Citeer je bronnen door een markdown link te gebruiken met het format `[Naam van document](rag-source:INDEX)`. Bijvoorbeeld, als je Bron 1 gebruikt (welke "verslag.pdf" heet), citeer je dit met `[verslag.pdf](rag-source:1)`.\n' +
                  '- Zet deze citaties INLINE aan het einde van de relevante zin.\n' +
                  '- Gebruik NIET de platte tekst `[Bron X]`, je MOET de markdown link `[titel](rag-source:X)` gebruiken.\n' +
                  '- Haal passages EXACT aan door ze **dikgedrukt** te maken.';
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
          
          let personaPrompt = '';
          if (persona === 'yoda') personaPrompt = '\n\nPERSONAGE ACTIEF: Speel de rol van Yoda uit Star Wars. Praat als Yoda (werkwoorden achteraan, wijs en mysterieus) maar zorg dat de feitelijke informatie klopt.';
          else if (persona === 'professor') personaPrompt = '\n\nPERSONAGE ACTIEF: Speel de rol van een zeer strenge, formele en academische professor. Spreek de leerling aan met "U" en leg sterk de nadruk op argumentatie, grammatica en feitelijkheden. Corrigeer taalfouten.';
          else if (persona === 'socrates') personaPrompt = '\n\nPERSONAGE ACTIEF: Speel de rol van Socrates. Geef NOOIT direct het volledige antwoord. Stel in plaats daarvan diepgaande en kritische wedervragen (Socratische methode) zodat de leerling zelf moet nadenken en het antwoord zelf ontdekt.';
          
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

          let liveDocContext = '';
          if (data.docContent && typeof data.docContent === 'string' && data.docContent.trim()) {
            liveDocContext = `\n\n=== LIVE LOCRA DOCS INHOUD (HUIDIGE DOCUMENT VAN DE GEBRUIKER) ===\n${data.docContent.substring(0, 30000)}\n=================================================================\nAls de gebruiker vraagt om wijzigingen, correcties of aanvullingen op dit document, plaats dan de VOLLEDIG bijgewerkte documenttekst tussen <docs> en </docs> tags!`;
          }

          const canvasPrompt = '\n\nLOCRA DOCS & CANVAS FEATURE:\nAls de gebruiker vraagt om een opstel, verslag, artikel, document of code te schrijven of bij te werken, plaats jouw volledige uitwerking dan ALTIJD tussen <docs> en </docs> tags (of <canvas> en </canvas>). Dit zorgt ervoor dat het document in de speciale ingebouwde tekstverwerker (Locra Docs) direct live wordt geopend en bijgewerkt. Buiten de tags geef je een korte toelichting of introductie.';
          
          let quizPrompt = '';
          if (data.quizMode) {
            quizPrompt = `\n\nQUIZ MODUS ACTIEF: Je bent nu een interactieve quizmaster. Wanneer de gebruiker om een quiz, toets, of kennistest vraagt, genereer dan een interactief quizblok in het volgende formaat:

:::quiz
{
  "title": "Quiz Titel",
  "topic": "Onderwerp",
  "questions": [
    {
      "id": 1,
      "question": "De vraagtekst hier",
      "options": ["Optie A", "Optie B", "Optie C", "Optie D"],
      "correctAnswer": 0,
      "explanation": "Uitleg waarom dit het juiste antwoord is"
    }
  ]
}
:::

REGELS:
- Genereer altijd 4-8 meerkeuzevragen.
- correctAnswer is de 0-gebaseerde index van het juiste antwoord.
- Geef ALTIJD een duidelijke uitleg bij elk antwoord.
- Je mag voor en na het :::quiz blok gewone tekst zetten als introductie of afsluitende opmerking.
- Baseer de vragen op het onderwerp dat de gebruiker noemt of op de gespreksgeschiedenis.
- Maak de vragen uitdagend maar eerlijk, passend bij een leerling.`;
          }

          let essayPrompt = '';
          if (data.essayCoach) {
            essayPrompt = '\n\nOPSTEL COACH ACTIEF: De gebruiker heeft een opstel, verslag of tekst ingezonden of gaat dit doen. Jij bent de essay-coach. Geef gestructureerde en kritische, maar opbouwende feedback. Verdeel je feedback in: Structuur, Taalgebruik, Argumentatie en geef een indicatieve score of cijfer. Wees grondig in je spellings- en grammaticacontrole.';
          }

          let toetsPrompt = '';
          if (data.toetsMode) {
            toetsPrompt = `\n\nPROEFWERK / TOETS MODUS ACTIEF (RTTI-METHODIEK):
Genereer een compleet, gebalanceerd en professioneel proefwerk op basis van het opgegeven onderwerp of de leermiddelen.
Pas strikt de officiële Nederlandse RTTI-taxonomie toe:
- [R] Reproductie: Kennisvragen naar feiten, begripsdefinities, formules, jaartallen en regels (direct herinneren uit het hoofd).
- [T1] Toepassing (Bekende context): Toepassen van standaard methodes, procedures en theorie in herkenbare oefeningen.
- [T2] Toepassing (Nieuwe context): Transfer-opgaven waarbij theorie wordt toegepast in een nieuwe, onbekende casus of praktijksituatie.
- [I] Inzicht: Complexe analyse, synthese, redeneren, probleemoplossing of het kritisch evalueren/beargumenteren van hypotheses.

STRUCTUUR VAN JE ANTWOORD:
1. 📝 **Proefwerk Vragen**: Nummer alle vragen duidelijk en vermeld per vraag het RTTI-niveau en te behalen punten (bijv: Vraag 1 [R, 2 pt]). Zorg voor een evenwichtige mix van R, T1, T2 en I.
2. 🔑 **Uitgewerkt Nakijkmodel & Antwoordsleutel**: Volledige, puntsgewijze uitwerkingen met exacte toekenning van de punten en aftrekcriteria.
3. 📊 **RTTI-Normering & Cijfertabel**: Overzichtstabel met puntentelling per RTTI-domein en de cijfernormering (bijv. Normeringsformule of tabel voor cijfer 1 t/m 10).`;
          }

          let uitlegPrompt = '';
          if (data.uitlegMode) {
            uitlegPrompt = `\n\nUITLEG MODUS ACTIEF (B1-TAALNIVEAU & METAFOREN):
Leg het gevraagde onderwerp zo eenvoudig, kristalhelder en beeldend mogelijk uit voor een leerling.
REGELS:
- Schrijf in natuurlijk, vriendelijk en toegankelijk Nederlands op B1-taalniveau (korte zinnen, actieve werkwoorden, vermijd onnodig abstract jargon).
- Als een vakterm noodzakelijk is, leg deze dan direct tussen haakjes uit in gewone mensentaal.
- Gebruik herkenbare, alledaagse metaforen en analogieën (uit sport, gaming, koken, smartphones of dagelijks leven) om abstracte concepten tastbaar te maken.
- Geef minimaal 1 concreet, praktisch voorbeeld dat direct tot de verbeelding spreekt.
- Sluit af met een korte, bemoedigende begripscheck (1 simpele vraag om te testen of de leerling het snapt) of een krachtige 1-zin samenvatting.`;
          }

          let samenvatPrompt = '';
          if (data.samenvatMode) {
            samenvatPrompt = `\n\nSAMENVATTING MODUS ACTIEF:
Extraheer de absolute essentie uit de ingevoerde tekst of het onderwerp. Zorg voor een overzichtelijke, gestructureerde en doelgerichte samenvatting:
1. 📌 **Kernpunten & Hoofdlijnen**: De belangrijkste feiten, stellingen en conclusies in duidelijke opsommingstekens.
2. ⏳ **Tijdlijn & Jaartallen**: Belangrijke data, jaartallen en chronologische stappen (indien van toepassing in de tekst).
3. 📖 **Begrippenlijst & Definities**: Alle essentiële vaktermen dikgedrukt met een beknopte, glasheldere betekenis.
4. 🎯 **Kern in 2 Zinnen**: De absolute kernboodschap die een leerling moet onthouden voor een proefwerk of examen.`;
          }

          const systemPrompt = basePrompt + nameInstruction + behaviorPrompt + personaPrompt + ragContext + somtodayContext + googleDocsContext + liveDocContext + modeInstructions + canvasPrompt + quizPrompt + essayPrompt + toetsPrompt + uitlegPrompt + samenvatPrompt;
          
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
          } else if (data.toetsMode) {
            connection.send(JSON.stringify({ type: 'thinking', message: '📝 Proefwerkvragen op RTTI-niveau opstellen...', model: targetModel }));
          } else if (data.uitlegMode) {
            connection.send(JSON.stringify({ type: 'thinking', message: '💡 Eenvoudige uitleg in B1-taal met metaforen formuleren...', model: targetModel }));
          } else if (data.samenvatMode) {
            connection.send(JSON.stringify({ type: 'thinking', message: '📋 Kernpunten, jaartallen en definities extraheren...', model: targetModel }));
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

          // ── Image Generation Intercept (DALL-E) ──
          const promptLowerTrim = prompt.trim().toLowerCase();
          if (promptLowerTrim.startsWith('/image ') || promptLowerTrim.startsWith('/afbeelding ')) {
            const imagePrompt = prompt.trim().substring(prompt.indexOf(' ') + 1);
            if (orgSettings?.imageGenApiKey) {
              try {
                connection.send(JSON.stringify({ type: 'thinking', message: '🎨 Afbeelding wordt gegenereerd (DALL-E)...', model: 'dall-e-3' }));
                const { OpenAI } = require('openai');
                const openai = new OpenAI({ apiKey: orgSettings.imageGenApiKey });
                const imageResponse = await openai.images.generate({
                  model: 'dall-e-3',
                  prompt: imagePrompt,
                  n: 1,
                  size: '1024x1024'
                });
                
                const imageUrl = imageResponse.data[0]?.url;
                if (imageUrl) {
                  const finalImgContent = `Hier is je afbeelding voor "${imagePrompt}":\n\n![Gegenereerde Afbeelding](${imageUrl})`;
                  
                  // Save assistant message
                  if (data.saveToServer !== false) {
                    await prisma.message.create({
                      data: {
                        conversationId,
                        userId: authUser.id,
                        role: 'assistant',
                        content: finalImgContent,
                        modelUsed: 'dall-e-3'
                      }
                    });
                  }
                  
                  connection.send(JSON.stringify({ type: 'done', messageId: savedMsgId, model: 'dall-e-3', finalContent: finalImgContent }));
                  return; // Stop further processing
                }
              } catch (e: any) {
                connection.send(JSON.stringify({ type: 'error', message: `Fout bij genereren afbeelding: ${e.message}` }));
                return;
              }
            } else {
              connection.send(JSON.stringify({ type: 'error', message: 'Afbeeldingen genereren is niet geconfigureerd. Beheerder moet een Image Gen API Key instellen.' }));
              return;
            }
          }

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

                if (isCollabChat) {
                  const participantIds = conv.participants.map((p: any) => p.userId);
                  if (conv.userId !== authUser.id && !participantIds.includes(conv.userId)) participantIds.push(conv.userId);
                  const chunkMsg = JSON.stringify({
                    type: 'coop_ai_chunk',
                    conversationId: conv.id,
                    content: streamedChunk,
                    model: targetModel
                  });
                  participantIds.forEach((pid: string) => {
                    if (pid === authUser.id) return;
                    const conns = activeWsConnections.get(pid);
                    if (conns) conns.forEach((c: any) => { try { if (c.readyState === 1) c.send(chunkMsg); } catch (_) {} });
                  });
                }
              }
            };

            if (targetModelRecord && (targetModelRecord.provider === 'openrouter' || targetModelRecord.provider === 'openai' || targetModelRecord.provider === 'anthropic' || targetModelRecord.provider === 'gemini')) {
              // Reload fresh orgSettings to get the latest API keys (in case they were just saved)
              const freshOrgSettings = await prisma.orgSettings.findUnique({ where: { orgId: authUser.orgId } });

              const provider = targetModelRecord.provider;

              let apiKey: string | undefined;
              let baseURL = 'https://api.openai.com/v1';

              if (provider === 'openrouter') {
                apiKey = freshOrgSettings?.openRouterApiKey || undefined;
                baseURL = 'https://openrouter.ai/api/v1';
                if (!apiKey) throw new Error(`OpenRouter API key is niet ingevuld. Voer je OpenRouter API key in via Beheerder → AI Modellen & API's.`);
              } else if (provider === 'openai') {
                apiKey = freshOrgSettings?.openAiApiKey || undefined;
                baseURL = 'https://api.openai.com/v1';
                if (!apiKey) throw new Error(`OpenAI API key is niet ingevuld. Voer je OpenAI API key in via Beheerder → AI Modellen & API's.`);
              } else if (provider === 'anthropic') {
                apiKey = freshOrgSettings?.anthropicApiKey || undefined;
                baseURL = 'https://api.anthropic.com';
                if (!apiKey) throw new Error(`Anthropic API key is niet ingevuld. Voer je Anthropic API key in via Beheerder → AI Modellen & API's.`);
              } else if (provider === 'gemini') {
                apiKey = freshOrgSettings?.geminiApiKey || undefined;
                baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
                if (!apiKey) throw new Error(`Google Gemini API key is niet ingevuld. Voer je Gemini API key in via Beheerder → AI Modellen & API's.`);
              }
              
              const client = new OpenAI({ baseURL, apiKey });

              const messages = chatMsgs.map(m => ({ role: m.role as any, content: m.content }));
              messages.push({ role: 'user', content: prompt });
              messages.unshift({ role: 'system', content: finalSystemPrompt });

              const stream = await client.chat.completions.create({
                model: targetModel,
                messages,
                stream: true,
                ...(useThinking && provider === 'openrouter' ? { reasoning: { enabled: true } } : {})
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
              let streamBuffer = '';
              
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  if (streamBuffer.trim()) {
                    try {
                      const parsed = JSON.parse(streamBuffer.trim());
                      if (parsed.response) handleChunk(parsed.response);
                    } catch (e) {
                      /* negeer resterende fragmenten */
                    }
                  }
                  break;
                }
                
                streamBuffer += decoder.decode(value, { stream: true });
                const lines = streamBuffer.split('\n');
                // Houd de laatste (mogelijke onvolledige regel) in de buffer
                streamBuffer = lines.pop() || '';
                
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed) continue;
                  
                  let parsed: any;
                  try {
                    parsed = JSON.parse(trimmed);
                  } catch (jsonErr) {
                    // Fragment was niet complete JSON; sla veilig over ipv stream te laten crashen
                    continue;
                  }
                  
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

              if (isCollabChat) {
                const participantIds = conv.participants.map((p: any) => p.userId);
                if (conv.userId !== authUser.id && !participantIds.includes(conv.userId)) participantIds.push(conv.userId);
                const doneMsg = JSON.stringify({
                  type: 'coop_ai_done',
                  conversationId: conv.id,
                  messageId: savedMsg.id,
                  finalContent: assistantResponse,
                  model: targetModel
                });
                participantIds.forEach((pid: string) => {
                  if (pid === authUser.id) return;
                  const conns = activeWsConnections.get(pid);
                  if (conns) conns.forEach((c: any) => { try { if (c.readyState === 1) c.send(doneMsg); } catch (_) {} });
                });
              }

              const currentConv = await prisma.conversation.findUnique({ where: { id: conversationId } });
              const msgCount = await prisma.message.count({ where: { conversationId } });

              if (currentConv) {
                try {
                  // Determine helper model and client
                  const helperModel = orgSettings?.orgHelperModel || targetModel || 'llama3';
                  
                  // Helper function for quick LLM completion
                  const askHelperAI = async (sysPrompt: string, userPrompt: string, jsonMode: boolean = false): Promise<string> => {
                    if (targetModelRecord && (targetModelRecord.provider === 'openrouter' || targetModelRecord.provider === 'openai' || targetModelRecord.provider === 'anthropic' || targetModelRecord.provider === 'gemini')) {
                      const freshSettings = await prisma.orgSettings.findUnique({ where: { orgId: authUser.orgId } });
                      const apiKey = targetModelRecord.provider === 'openrouter' 
                        ? freshSettings?.openRouterApiKey 
                        : targetModelRecord.provider === 'openai'
                        ? freshSettings?.openAiApiKey
                        : targetModelRecord.provider === 'gemini'
                        ? freshSettings?.geminiApiKey
                        : freshSettings?.anthropicApiKey;
                      const baseURL = targetModelRecord.provider === 'openrouter'
                        ? 'https://openrouter.ai/api/v1'
                        : targetModelRecord.provider === 'gemini'
                        ? 'https://generativelanguage.googleapis.com/v1beta/openai/'
                        : 'https://api.openai.com/v1';
                      if (apiKey) {
                        const client = new OpenAI({ baseURL, apiKey });
                        const completion = await client.chat.completions.create({
                          model: targetModel,
                          messages: [
                            { role: 'system', content: sysPrompt },
                            { role: 'user', content: userPrompt }
                          ],
                          ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
                        });
                        return completion.choices[0]?.message?.content || '';
                      }
                    }
                    const res = await ollamaClient.generate(userPrompt, helperModel, sysPrompt, false);
                    const d = await res.json() as any;
                    return d.response || '';
                  };

                  // 1. CUMULATIVE TAGS GENERATION (ON EVERY MESSAGE)
                  let existingTags: string[] = [];
                  try {
                    if (currentConv.tags) existingTags = JSON.parse(currentConv.tags);
                  } catch (e) {}

                  const tagPrompt = `Bedenk 2 of 3 specifieke zoektermen/trefwoorden (zonder '#' ervoor, max 2 woorden per tag) voor deze vraag: "${prompt.substring(0, 250)}". Geef ALLEEN JSON terug in de vorm: { "tags": ["tag1", "tag2"] }`;
                  const tagResRaw = await askHelperAI('Je bent een slimme zoektermen-extractor. Antwoord uitsluitend met geldige JSON.', tagPrompt, true);
                  const parsedTagsObj = parseTitleTagsResponse(tagResRaw);
                  const newTagsClean = (parsedTagsObj.tags || [])
                    .map((t: string) => t.replace(/^#+/, '').trim().toLowerCase())
                    .filter(Boolean);
                  
                  const mergedTags = Array.from(new Set([
                    ...existingTags.map((t: string) => t.replace(/^#+/, '').trim().toLowerCase()),
                    ...newTagsClean
                  ])).filter(Boolean);

                  let updatedTitle = currentConv.title;
                  let updatedSummary: string | null = (currentConv as any).summary || null;
                  let shouldBroadcastTitle = false;

                  // 2. TITLE & ROLLING SUMMARY UPDATE (FIRST MESSAGE OR EVERY 5 MESSAGES)
                  const isFirstMessage = currentConv.title === 'Nieuw gesprek';
                  const isEvery5th = msgCount % 5 === 0;

                  if ((isFirstMessage || isEvery5th) && !(currentConv as any).isCustomTitle) {
                    // Generate rolling short summary of the conversation
                    const summaryPrompt = `Vat de kern van dit gesprek samen in maximaal 2 korte, krachtige zinnen. Huidige vraag: "${prompt.substring(0, 300)}". Laatste antwoord: "${assistantResponse.substring(0, 300)}".${updatedSummary ? ` Eerdere samenvatting: ${updatedSummary}` : ''}`;
                    const generatedSummary = (await askHelperAI('Je bent een samenvatter. Geef een beknopte samenvatting van maximaal 2 zinnen, direct to-the-point.', summaryPrompt)).trim();
                    if (generatedSummary && generatedSummary.length > 5) {
                      updatedSummary = generatedSummary;
                    }

                    // Generate short crisp title based on the rolling summary
                    const titlePrompt = `Bedenk op basis van deze samenvatting: "${updatedSummary || prompt.substring(0, 200)}" een korte, pakkende titel van maximaal 5 woorden. Geef ALLEEN de titel terug, geen aanhalingstekens, geen leestekens aan het einde.`;
                    const generatedTitleRaw = (await askHelperAI('Geef alleen een korte titel terug van maximaal 5 woorden, niets anders.', titlePrompt)).trim();
                    const cleanTitle = generatedTitleRaw.replace(/^["'«]+|["'»]+$/g, '').trim();

                    if (cleanTitle && cleanTitle.length >= 2 && cleanTitle.length <= 80) {
                      updatedTitle = cleanTitle;
                      shouldBroadcastTitle = true;
                    }
                  }

                  // Save updates to conversation in database
                  await prisma.conversation.update({
                    where: { id: conversationId },
                    data: {
                      title: updatedTitle,
                      summary: updatedSummary,
                      tags: mergedTags.length > 0 ? JSON.stringify(mergedTags) : null
                    } as any
                  });

                  if (shouldBroadcastTitle) {
                    connection.send(JSON.stringify({
                      type: 'title_update',
                      conversationId,
                      title: updatedTitle,
                      tags: mergedTags
                    }));
                  }
                } catch (titleErr: any) {
                  fastify.log.warn(`Auto-title/tag/summary generation error: ${titleErr.message}`);
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
