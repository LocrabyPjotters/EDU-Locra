import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';

export default async function quickActionRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // ── GET / — Haal actieve quick action cards op voor huidige org ──
  fastify.get('/', async (request) => {
    const user = request.user as any;
    
    // Default system quick actions if none are defined for the org
    const orgActions = await prisma.quickActionCard.findMany({
      where: { orgId: user.orgId, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    if (orgActions.length > 0) {
      return orgActions;
    }

    // Default suggested cards for classroom
    return [
      {
        id: 'default-1',
        title: 'Samenvatten',
        description: 'Vat een complexe tekst overzichtelijk samen in bullets',
        prompt: 'Vat de volgende tekst beknopt en overzichtelijk samen in 5 duidelijke bullets:\n\n',
        icon: '📝',
        color: '#6366f1',
        category: 'samenvatten'
      },
      {
        id: 'default-2',
        title: 'Hulp bij Huiswerk',
        description: 'Krijg hints en uitleg zonder direct het antwoord te verklappen',
        prompt: 'Help mij stap voor stap met deze opgave door mij vragen te stellen en hints te geven, zonder het directe antwoord te geven:\n\n',
        icon: '📚',
        color: '#10b981',
        category: 'huiswerk'
      },
      {
        id: 'default-3',
        title: 'Grammatica & Spelling',
        description: 'Verbeter je tekst en leer van je taalfouten',
        prompt: 'Verbeter de grammatica, spelling en zinsopbouw van deze tekst en leg kort uit wat er verbeterd is:\n\n',
        icon: '✍️',
        color: '#f59e0b',
        category: 'taal'
      },
      {
        id: 'default-4',
        title: 'Toets Overhoren',
        description: 'Laat je overhoren met meerkeuze- of open vragen',
        prompt: 'Overhoor mij over het volgende onderwerp met 3 meerkeuzevragen en wacht op mijn antwoord:\n\n',
        icon: '🎯',
        color: '#ec4899',
        category: 'toets'
      }
    ];
  });

  // ── POST / — Admin voegt nieuwe quick action card toe ──
  fastify.post('/', async (request, reply) => {
    const user = request.user as any;
    if (!['admin', 'superadmin', 'teacher'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen rechten om actiekaarten te beheren' });
    }

    const { title, description, prompt, icon, color, category, sortOrder } = request.body as any;

    if (!title || !prompt) {
      return reply.status(400).send({ error: 'Titel en prompt zijn verplicht' });
    }

    const card = await prisma.quickActionCard.create({
      data: {
        orgId: user.orgId,
        title,
        description: description || '',
        prompt,
        icon: icon || '💡',
        color: color || '#6366f1',
        category: category || 'algemeen',
        sortOrder: sortOrder || 0
      }
    });

    return { success: true, card };
  });

  // ── PUT /:id — Admin past quick action card aan ──
  fastify.put('/:id', async (request, reply) => {
    const user = request.user as any;
    if (!['admin', 'superadmin', 'teacher'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { id } = request.params as any;
    const updates = request.body as any;

    const existing = await prisma.quickActionCard.findUnique({ where: { id } });
    if (!existing || existing.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Kaart niet gevonden' });
    }

    const updated = await prisma.quickActionCard.update({
      where: { id },
      data: {
        ...(updates.title && { title: updates.title }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.prompt && { prompt: updates.prompt }),
        ...(updates.icon && { icon: updates.icon }),
        ...(updates.color && { color: updates.color }),
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.sortOrder !== undefined && { sortOrder: updates.sortOrder }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive })
      }
    });

    return { success: true, card: updated };
  });

  // ── DELETE /:id — Admin verwijdert kaart ──
  fastify.delete('/:id', async (request, reply) => {
    const user = request.user as any;
    if (!['admin', 'superadmin', 'teacher'].includes(user.role)) {
      return reply.status(403).send({ error: 'Geen toegang' });
    }

    const { id } = request.params as any;
    const existing = await prisma.quickActionCard.findUnique({ where: { id } });
    if (!existing || existing.orgId !== user.orgId) {
      return reply.status(404).send({ error: 'Kaart niet gevonden' });
    }

    await prisma.quickActionCard.delete({ where: { id } });
    return { success: true };
  });
}
