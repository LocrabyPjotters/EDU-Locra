import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { createAuditLog } from '../../services/auditService';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { processDocument } from '../../services/rag';

export default async function knowledgeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Hook to check license feature
  fastify.addHook('preHandler', async (request, reply) => {
    const { canAccessFeature } = await import('../../services/license');
    const orgSettings = await prisma.orgSettings.findUnique({
      where: { orgId: request.user!.orgId }
    });
    if (!canAccessFeature(orgSettings?.licenseTier, 'ragKnowledgeBases')) {
      return reply.status(403).send({
        error: 'feature_not_licensed',
        feature: 'ragKnowledgeBases',
        requiredTier: 'edu-plus',
        message: 'RAG Kennisbanken zijn beschikbaar vanaf de EDU-Plus licentie. Upgrade om documenten en lesmateriaal te koppelen.'
      });
    }
  });

  // List all knowledge bases for the org (with optional subject sandbox filter)
  fastify.get('/', async (request, reply) => {
    const query = request.query as { subject?: string };
    const where: any = { orgId: request.user!.orgId };
    if (query.subject && query.subject !== 'alle') {
      where.subject = query.subject;
    }

    const kbs = await prisma.knowledgeBase.findMany({
      where,
      include: {
        _count: {
          select: { documents: true }
        }
      }
    });
    
    const userRole = request.user!.role;
    if (userRole === 'admin' || userRole === 'superadmin') {
      return kbs;
    }
    
    // Filter by role for non-admins
    return kbs.filter(kb => {
      try {
        if (!kb.allowedRoles) return true; // fallback if null
        const allowed = JSON.parse(kb.allowedRoles);
        return allowed.includes(userRole);
      } catch (e) {
        return true;
      }
    });
  });

  // Create a new knowledge base
  fastify.post('/', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { name, description, subject, allowedRoles } = request.body as any;
    if (!name) return reply.status(400).send({ error: 'Name required' });

    const kb = await prisma.knowledgeBase.create({
      data: {
        orgId: request.user!.orgId,
        name,
        description,
        subject: subject || 'algemeen',
        allowedRoles: allowedRoles ? JSON.stringify(allowedRoles) : '["admin", "teacher", "student"]'
      }
    });

    await createAuditLog(prisma, {
      orgId: request.user!.orgId,
      userId: request.user!.id,
      action: 'kb.create',
      category: 'data',
      severity: 'info',
      details: { name, kbId: kb.id },
      ipAddress: request.ip,
    });

    return kb;
  });

  // Update a knowledge base
  fastify.put('/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, description, subject, allowedRoles, isActive } = request.body as any;
    
    const kb = await prisma.knowledgeBase.findUnique({ where: { id } });
    if (!kb || kb.orgId !== request.user!.orgId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const updated = await prisma.knowledgeBase.update({
      where: { id },
      data: {
        name,
        description,
        subject: subject !== undefined ? subject : (kb as any).subject,
        isActive,
        allowedRoles: allowedRoles ? JSON.stringify(allowedRoles) : undefined
      }
    });

    await createAuditLog(prisma, {
      orgId: request.user!.orgId,
      userId: request.user!.id,
      action: 'kb.update',
      category: 'data',
      severity: 'info',
      details: { name: updated.name, kbId: id },
      ipAddress: request.ip,
    });

    return updated;
  });

  // Get documents for a specific knowledge base
  fastify.get('/:id/documents', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // verify org access
    const kb = await prisma.knowledgeBase.findUnique({ where: { id } });
    if (!kb || kb.orgId !== request.user!.orgId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const docs = await prisma.document.findMany({
      where: { knowledgeBaseId: id },
      include: {
        _count: {
          select: { chunks: true }
        }
      }
    });
    return docs;
  });

  // Upload a document to a knowledge base
  fastify.post('/:id/documents', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const kb = await prisma.knowledgeBase.findUnique({ where: { id } });
    if (!kb || kb.orgId !== request.user!.orgId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const uploadDir = path.resolve(process.cwd(), 'uploads', kb.orgId, id);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const cleanBasename = path.basename(data.filename).replace(/[^a-zA-Z0-9.-]/g, '_');
    const crypto = await import('crypto');
    const storedFilename = `${crypto.randomUUID()}_${cleanBasename}`;
    const filePath = path.resolve(uploadDir, storedFilename);

    if (!filePath.startsWith(uploadDir)) {
      return reply.status(400).send({ error: 'Ongeldige bestandsnaam of pad' });
    }
    
    await pipeline(data.file, fs.createWriteStream(filePath));
    const stats = fs.statSync(filePath);

    // Save to DB
    const doc = await prisma.document.create({
      data: {
        knowledgeBaseId: id,
        filename: data.filename,
        filePath: filePath,
        fileType: path.extname(data.filename).replace('.', ''),
        fileSize: stats.size,
        status: 'processing' // Will be processed by RAG worker
      }
    });
    
    // Process asynchronously without blocking the response
    fastify.log.info(`Document uploaded: ${data.filename} for KB ${id}`);
    
    processDocument(doc.id).catch(err => {
      fastify.log.error(`Error processing document ${doc.id}: ${err.message}`);
    });

    return doc;
  });


  // PREVIEW DOCUMENT FILE (Supports inline viewing in iframe or new tab)
  fastify.get('/documents/:id/preview', async (request, reply) => {
    const { id } = request.params as { id: string };

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { knowledgeBase: true }
    });

    if (!doc) {
      return reply.code(404).send({ error: 'Document niet gevonden' });
    }

    if (doc.knowledgeBase && doc.knowledgeBase.orgId !== request.user!.orgId) {
      return reply.code(403).send({ error: 'Geen toegang tot dit document' });
    }

    if (!fs.existsSync(doc.filePath)) {
      return reply.code(404).send({ error: 'Bestand bestaat niet meer op de server' });
    }

    const ext = doc.fileType.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (ext === 'txt') contentType = 'text/plain; charset=utf-8';
    else if (ext === 'md') contentType = 'text/markdown; charset=utf-8';
    else if (ext === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === 'doc') contentType = 'application/msword';

    const safeFilename = encodeURIComponent(doc.filename);
    reply.header('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
    reply.header('Cache-Control', 'private, max-age=3600');

    const stream = fs.createReadStream(doc.filePath);
    return reply.type(contentType).send(stream);
  });

  // DOWNLOAD ORIGINAL DOCUMENT FILE
  fastify.get('/documents/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { knowledgeBase: true }
    });

    if (!doc) {
      return reply.code(404).send({ error: 'Document niet gevonden' });
    }

    if (doc.knowledgeBase && doc.knowledgeBase.orgId !== request.user!.orgId) {
      return reply.code(403).send({ error: 'Geen toegang tot dit document' });
    }

    if (!fs.existsSync(doc.filePath)) {
      return reply.code(404).send({ error: 'Bestand bestaat niet meer op de server' });
    }

    const safeFilename = encodeURIComponent(doc.filename);
    reply.header('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);

    const stream = fs.createReadStream(doc.filePath);
    return reply.type('application/octet-stream').send(stream);
  });

  // GET DOCUMENT TEXT CONTENT & RAG CHUNKS (For in-app text preview of any document type)
  fastify.get('/documents/:id/content', async (request, reply) => {
    const { id } = request.params as { id: string };

    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        knowledgeBase: true,
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
            content: true
          },
          orderBy: { chunkIndex: 'asc' }
        }
      }
    });

    if (!doc) {
      return reply.code(404).send({ error: 'Document niet gevonden' });
    }

    if (doc.knowledgeBase && doc.knowledgeBase.orgId !== request.user!.orgId) {
      return reply.code(403).send({ error: 'Geen toegang tot dit document' });
    }

    // Combine chunks into full text or read file directly if txt/md
    let fullText = '';
    if (doc.chunks && doc.chunks.length > 0) {
      fullText = doc.chunks.map(c => c.content).join('\n\n');
    } else if (fs.existsSync(doc.filePath)) {
      try {
        const ext = doc.fileType.toLowerCase();
        if (ext === 'txt' || ext === 'md') {
          fullText = fs.readFileSync(doc.filePath, 'utf-8');
        }
      } catch (e) {}
    }

    return {
      id: doc.id,
      filename: doc.filename,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      status: doc.status,
      createdAt: doc.createdAt,
      knowledgeBaseName: doc.knowledgeBase?.name || 'Kennisbank',
      knowledgeBaseSubject: doc.knowledgeBase?.subject || 'algemeen',
      chunksCount: doc.chunks?.length || 0,
      fullText,
      chunks: doc.chunks || []
    };
  });

  // Get chunks for a specific document (admin inspection)
  fastify.get('/documents/:docId/chunks', async (request, reply) => {
    const { docId } = request.params as { docId: string };
    
    // verify org access
    const doc = await prisma.document.findUnique({ 
      where: { id: docId },
      include: { knowledgeBase: true }
    });
    if (!doc || doc.knowledgeBase.orgId !== request.user!.orgId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: docId },
      select: {
        id: true,
        content: true,
        chunkIndex: true
      },
      orderBy: { chunkIndex: 'asc' }
    });
    return chunks;
  });
}
