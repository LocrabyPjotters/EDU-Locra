"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMBEDDING_MODEL = void 0;
exports.processDocument = processDocument;
exports.cosineSimilarity = cosineSimilarity;
const fs_1 = __importDefault(require("fs"));
// pdf-parse is CJS-only, use require
const pdfParse = require('pdf-parse');
const mammoth_1 = __importDefault(require("mammoth"));
const index_1 = require("../index");
const ollama_1 = require("./ollama");
/**
 * The SINGLE embedding model used for ALL vector operations.
 * Both document ingestion AND query embedding MUST use this same model
 * to ensure vector dimensions match for cosine similarity.
 */
exports.EMBEDDING_MODEL = 'llama3';
/**
 * Chunk text into segments of roughly `maxWords` words,
 * with an overlap of `overlapWords` to preserve context across boundaries.
 */
function chunkText(text, maxWords = 250, overlapWords = 60) {
    // Clean up excessive whitespace
    const cleanedText = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    const words = cleanedText.split(/\s+/);
    const chunks = [];
    let start = 0;
    while (start < words.length) {
        const end = Math.min(start + maxWords, words.length);
        const chunk = words.slice(start, end).join(' ').trim();
        if (chunk.length > 20) { // Skip tiny chunks
            chunks.push(chunk);
        }
        // Move forward by (maxWords - overlap), so there's always context overlap
        start += maxWords - overlapWords;
    }
    return chunks;
}
async function processDocument(documentId) {
    const doc = await index_1.prisma.document.findUnique({
        where: { id: documentId },
        include: { knowledgeBase: true }
    });
    if (!doc || !doc.knowledgeBase)
        throw new Error('Document or KnowledgeBase not found');
    // Fetch dynamic embedding model for this org
    const orgSettings = await index_1.prisma.orgSettings.findUnique({ where: { orgId: doc.knowledgeBase.orgId } });
    const activeEmbeddingModel = orgSettings?.embeddingModel || exports.EMBEDDING_MODEL;
    try {
        let rawText = '';
        const fileBuffer = fs_1.default.readFileSync(doc.filePath);
        if (doc.fileType === 'pdf') {
            const parsed = await pdfParse(fileBuffer);
            rawText = parsed.text;
        }
        else if (doc.fileType === 'docx' || doc.fileType === 'doc') {
            const result = await mammoth_1.default.extractRawText({ buffer: fileBuffer });
            rawText = result.value;
        }
        else if (doc.fileType === 'txt' || doc.fileType === 'md') {
            rawText = fileBuffer.toString('utf-8');
        }
        else {
            throw new Error(`Unsupported file type: ${doc.fileType}`);
        }
        if (!rawText.trim()) {
            throw new Error('Document bevat geen leesbare tekst');
        }
        const chunkSize = orgSettings?.ragChunkSize ?? 250;
        const chunkOverlap = orgSettings?.ragChunkOverlap ?? 60;
        const chunks = chunkText(rawText, chunkSize, chunkOverlap);
        console.log(`[RAG] Processing ${chunks.length} chunks for document ${doc.filename} using model ${activeEmbeddingModel} (Size: ${chunkSize}, Overlap: ${chunkOverlap})`);
        // Clear old chunks in case of re-processing
        // @ts-ignore
        await index_1.prisma.documentChunk.deleteMany({ where: { documentId: doc.id } });
        for (let i = 0; i < chunks.length; i++) {
            const content = chunks[i].trim();
            if (!content)
                continue;
            // Use the dynamically configured model!
            const embeddingArray = await ollama_1.ollamaClient.getEmbedding(content, activeEmbeddingModel);
            if (!embeddingArray || embeddingArray.length === 0) {
                console.warn(`[RAG] Warning: Empty embedding for chunk ${i}, skipping`);
                continue;
            }
            const embeddingJson = JSON.stringify(embeddingArray);
            // @ts-ignore - Ignore Prisma cache sync issue
            await index_1.prisma.documentChunk.create({
                data: {
                    knowledgeBaseId: doc.knowledgeBaseId,
                    documentId: doc.id,
                    content: content,
                    embedding: embeddingJson,
                    chunkIndex: i
                }
            });
        }
        await index_1.prisma.document.update({
            where: { id: doc.id },
            data: { status: 'active' }
        });
        console.log(`[RAG] Successfully processed document ${doc.filename}: ${chunks.length} chunks embedded`);
    }
    catch (err) {
        console.error(`[RAG] Failed to process document ${documentId}:`, err?.message || err);
        await index_1.prisma.document.update({
            where: { id: doc.id },
            data: { status: 'error' }
        });
    }
}
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length || vecA.length === 0)
        return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
