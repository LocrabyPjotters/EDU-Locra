import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { processDocument } from '../../services/rag';

export default async function knowledgeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // List all knowledge bases for the org
  fastify.get('/', async (request, reply) => {
    const kbs = await prisma.knowledgeBase.findMany({
      where: { orgId: request.user!.orgId },
      include: {
        _count: {
          select: { documents: true }
        }
      }
    });
    return kbs;
  });

  // Create a new knowledge base
  fastify.post('/', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { name, description } = request.body as any;
    if (!name) return reply.status(400).send({ error: 'Name required' });

    const kb = await prisma.knowledgeBase.create({
      data: {
        orgId: request.user!.orgId,
        name,
        description
      }
    });
    return kb;
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
      where: { knowledgeBaseId: id }
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

    const uploadDir = path.join(process.cwd(), 'uploads', kb.orgId, id);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeFilename = data.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = path.join(uploadDir, safeFilename);
    
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

  // PREVIEW DOCUMENT FILE
  fastify.get('/documents/:id/preview', async (request, reply) => {
    const { id } = request.params as { id: string };

    const doc = await prisma.document.findUnique({
      where: { id }
    });

    if (!doc) {
      return reply.code(404).send({ error: 'Document niet gevonden' });
    }

    if (!fs.existsSync(doc.filePath)) {
      return reply.code(404).send({ error: 'Bestand bestaat niet meer op de server' });
    }

    // Set appropriate content type based on extension
    const ext = doc.fileType.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (ext === 'txt') contentType = 'text/plain';
    else if (ext === 'md') contentType = 'text/markdown';
    else if (ext === 'doc' || ext === 'docx') contentType = 'application/msword';

    const stream = fs.createReadStream(doc.filePath);
    return reply.type(contentType).send(stream);
  });
}
