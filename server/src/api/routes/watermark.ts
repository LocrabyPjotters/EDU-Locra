import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

import { requireAuth } from '../../middleware/auth';
import { watermarkService } from '../../services/watermarkService';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const prisma = new PrismaClient();

export default async function watermarkRoutes(fastify: FastifyInstance) {
  fastify.register(async function (protectedRoutes) {
    protectedRoutes.addHook('preHandler', requireAuth);

    protectedRoutes.post('/verify', async (request, reply) => {
    const { text } = request.body as { text: string };

    if (!text) {
      return reply.status(400).send({ error: 'Tekst is verplicht.' });
    }

    const authUser = request.user as any;
    
    // Alleen docenten, admins, of superadmins mogen dit gebruiken
    if (!['teacher', 'admin', 'superadmin'].includes(authUser.role)) {
      return reply.status(403).send({ error: 'Geen toegang. Alleen voor docenten en admins.' });
    }

    // Controleer org license
    const orgSettings = await prisma.orgSettings.findUnique({
      where: { orgId: authUser.orgId }
    });

    if (!orgSettings || !['edu-plus', 'enterprise'].includes(orgSettings.licenseTier)) {
      return reply.status(403).send({ 
        error: 'Premium Licentie Vereist', 
        message: 'Watermerk detectie is alleen beschikbaar voor organisaties met een EDU Plus of Enterprise licentie. Neem contact op met beheer om te upgraden.'
      });
    }

    // Geavanceerde forensische watermerkanalyse via watermarkService
    const analysis = watermarkService.detectWatermark(text);

    return { 
      success: true, 
      ...analysis
    };
  });

  protectedRoutes.post('/verify/upload', async (request, reply) => {
    const authUser = request.user as any;
    
    // Alleen docenten, admins, of superadmins mogen dit gebruiken
    if (!['teacher', 'admin', 'superadmin'].includes(authUser.role)) {
      return reply.status(403).send({ error: 'Geen toegang. Alleen voor docenten en admins.' });
    }

    // Controleer org license
    const orgSettings = await prisma.orgSettings.findUnique({
      where: { orgId: authUser.orgId }
    });

    if (!orgSettings || !['edu-plus', 'enterprise'].includes(orgSettings.licenseTier)) {
      return reply.status(403).send({ 
        error: 'Premium Licentie Vereist', 
        message: 'Watermerk detectie is alleen beschikbaar voor organisaties met een EDU Plus of Enterprise licentie. Neem contact op met beheer om te upgraden.'
      });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Geen bestand geüpload.' });
    }

    const buffer = await data.toBuffer();
    let extractedText = '';

    try {
      if (data.mimetype === 'application/pdf' || data.filename.endsWith('.pdf')) {
        const render_page = function(pageData: any) {
          return pageData.getTextContent({
            normalizeWhitespace: false, // Prevents stripping zero-width characters
            disableCombineTextItems: true // Must be true to keep zero-width characters!
          }).then(function(textContent: any) {
            let lastY, text = '';
            for (let item of textContent.items) {
              if (lastY == item.transform[5] || !lastY){
                text += item.str;
              } else{
                text += '\n' + item.str;
              }    
              lastY = item.transform[5];
            }
            return text;
          });
        };
        const pdfData = await pdf(buffer, { pagerender: render_page });
        extractedText = pdfData.text;
      } else if (data.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } else {
        return reply.status(400).send({ error: 'Ondersteunt alleen PDF (.pdf) of Word (.docx) bestanden.' });
      }
    } catch (e) {
      request.log.error(e);
      return reply.status(500).send({ error: 'Fout bij het uitlezen van het bestand.' });
    }

    if (!extractedText.trim()) {
      return reply.status(400).send({ error: 'Kon geen tekst extraheren uit dit bestand.' });
    }

    // Geavanceerde forensische watermerkanalyse via watermarkService
    const analysis = watermarkService.detectWatermark(extractedText);

    return { 
      success: true, 
      ...analysis
    };
  });
  });
}
