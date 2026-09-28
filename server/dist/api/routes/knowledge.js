"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = knowledgeRoutes;
const index_1 = require("../../index");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promises_1 = require("stream/promises");
const rag_1 = require("../../services/rag");
async function knowledgeRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.requireAuth);
    // List all knowledge bases for the org
    fastify.get('/', async (request, reply) => {
        const kbs = await index_1.prisma.knowledgeBase.findMany({
            where: { orgId: request.user.orgId },
            include: {
                _count: {
                    select: { documents: true }
                }
            }
        });
        const userRole = request.user.role;
        if (userRole === 'admin' || userRole === 'superadmin') {
            return kbs;
        }
        // Filter by role for non-admins
        return kbs.filter(kb => {
            try {
                if (!kb.allowedRoles)
                    return true; // fallback if null
                const allowed = JSON.parse(kb.allowedRoles);
                return allowed.includes(userRole);
            }
            catch (e) {
                return true;
            }
        });
    });
    // Create a new knowledge base
    fastify.post('/', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { name, description, allowedRoles } = request.body;
        if (!name)
            return reply.status(400).send({ error: 'Name required' });
        const kb = await index_1.prisma.knowledgeBase.create({
            data: {
                orgId: request.user.orgId,
                name,
                description,
                allowedRoles: allowedRoles ? JSON.stringify(allowedRoles) : '["admin", "teacher", "student"]'
            }
        });
        return kb;
    });
    // Update a knowledge base
    fastify.put('/:id', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { id } = request.params;
        const { name, description, allowedRoles, isActive } = request.body;
        const kb = await index_1.prisma.knowledgeBase.findUnique({ where: { id } });
        if (!kb || kb.orgId !== request.user.orgId) {
            return reply.status(403).send({ error: 'Access denied' });
        }
        const updated = await index_1.prisma.knowledgeBase.update({
            where: { id },
            data: {
                name,
                description,
                isActive,
                allowedRoles: allowedRoles ? JSON.stringify(allowedRoles) : undefined
            }
        });
        return updated;
    });
    // Get documents for a specific knowledge base
    fastify.get('/:id/documents', async (request, reply) => {
        const { id } = request.params;
        // verify org access
        const kb = await index_1.prisma.knowledgeBase.findUnique({ where: { id } });
        if (!kb || kb.orgId !== request.user.orgId) {
            return reply.status(403).send({ error: 'Access denied' });
        }
        const docs = await index_1.prisma.document.findMany({
            where: { knowledgeBaseId: id }
        });
        return docs;
    });
    // Upload a document to a knowledge base
    fastify.post('/:id/documents', { preHandler: (0, rbac_1.requireRole)('admin') }, async (request, reply) => {
        const { id } = request.params;
        const kb = await index_1.prisma.knowledgeBase.findUnique({ where: { id } });
        if (!kb || kb.orgId !== request.user.orgId) {
            return reply.status(403).send({ error: 'Access denied' });
        }
        const data = await request.file();
        if (!data)
            return reply.status(400).send({ error: 'No file uploaded' });
        const uploadDir = path_1.default.join(process.cwd(), 'uploads', kb.orgId, id);
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        const safeFilename = data.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = path_1.default.join(uploadDir, safeFilename);
        await (0, promises_1.pipeline)(data.file, fs_1.default.createWriteStream(filePath));
        const stats = fs_1.default.statSync(filePath);
        // Save to DB
        const doc = await index_1.prisma.document.create({
            data: {
                knowledgeBaseId: id,
                filename: data.filename,
                filePath: filePath,
                fileType: path_1.default.extname(data.filename).replace('.', ''),
                fileSize: stats.size,
                status: 'processing' // Will be processed by RAG worker
            }
        });
        // Process asynchronously without blocking the response
        fastify.log.info(`Document uploaded: ${data.filename} for KB ${id}`);
        (0, rag_1.processDocument)(doc.id).catch(err => {
            fastify.log.error(`Error processing document ${doc.id}: ${err.message}`);
        });
        return doc;
    });
    // PREVIEW DOCUMENT FILE
    fastify.get('/documents/:id/preview', async (request, reply) => {
        const { id } = request.params;
        const doc = await index_1.prisma.document.findUnique({
            where: { id }
        });
        if (!doc) {
            return reply.code(404).send({ error: 'Document niet gevonden' });
        }
        if (!fs_1.default.existsSync(doc.filePath)) {
            return reply.code(404).send({ error: 'Bestand bestaat niet meer op de server' });
        }
        // Set appropriate content type based on extension
        const ext = doc.fileType.toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === 'pdf')
            contentType = 'application/pdf';
        else if (ext === 'txt')
            contentType = 'text/plain';
        else if (ext === 'md')
            contentType = 'text/markdown';
        else if (ext === 'doc' || ext === 'docx')
            contentType = 'application/msword';
        const stream = fs_1.default.createReadStream(doc.filePath);
        return reply.type(contentType).send(stream);
    });
}
