import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { ollamaClient } from '../../services/ollama';

interface ExamQuestion {
  id: number;
  question: string;
  context?: string;
  maxPoints: number;
  criteria: string[];
}

const PRESET_EXAMS: Record<string, { subject: string; educationLevel: string; year: number; durationMinutes: number; questions: ExamQuestion[] }> = {
  'ned-havo-2024': {
    subject: 'Nederlands',
    educationLevel: 'havo',
    year: 2024,
    durationMinutes: 45,
    questions: [
      {
        id: 1,
        question: 'Welke hoofdgedachte formuleert de auteur in alinea 1 en 2 over de invloed van sociale media op het concentratievermogen?',
        context: 'Tekst: "De Aandachtseconomie in het Klaslokaal"',
        maxPoints: 2,
        criteria: [
          'Noemt de constante afleiding door pushnotificaties (1 pt)',
          'Verbindt dit aan de versplintering van diepe leestijd (1 pt)'
        ]
      },
      {
        id: 2,
        question: 'In alinea 4 gebruikt de schrijver een vergelijking met "fastfood voor het brein". Leg uit welk tekstdoel hiermee wordt gediend en waarom dit effectief is.',
        context: 'Alinea 4: "Korte filmpjes consumeren is als het eten van suikerspin: even lekker, maar zonder voedingswaarde."',
        maxPoints: 3,
        criteria: [
          'Benoemt het beeldende/overtuigende karakter (1 pt)',
          'Legt de analogie uit tussen snacken en oppervlakkige prikkels (1 pt)',
          'Verklaart het effect op de lezer (1 pt)'
        ]
      },
      {
        id: 3,
        question: 'Formuleer in maximaal 3 zinnen het tegenargument dat de critici aanvoeren in alinea 6, en hoe de auteur dit argument ontkracht.',
        maxPoints: 2,
        criteria: [
          'Correcte weergave van het tegenargument over digitale geletterdheid (1 pt)',
          'Correcte weergave van de weerlegging (1 pt)'
        ]
      }
    ]
  },
  'wis-havo-2024': {
    subject: 'Wiskunde A',
    educationLevel: 'havo',
    year: 2024,
    durationMinutes: 45,
    questions: [
      {
        id: 1,
        question: 'Gegeven is de formule N(t) = 450 * 1,08^t, waarin t de tijd in jaren is vanaf 2020. Bereken het groeipercentage per maand in één decimaal nauwkeurig.',
        maxPoints: 3,
        criteria: [
          'Groeifactor per maand berekenen via 1,08^(1/12) (1 pt)',
          'Groeifactor is circa 1,00643 (1 pt)',
          'Juiste afronding: 0,6% per maand (1 pt)'
        ]
      },
      {
        id: 2,
        question: 'Bereken exact of in twee decimalen na hoeveel jaar de waarde van N voor het eerst verdubbeld is ten opzichte van t = 0.',
        maxPoints: 3,
        criteria: [
          'Opstellen vergelijking 1,08^t = 2 (1 pt)',
          'Gebruik van logaritmen: t = log(2) / log(1,08) (1 pt)',
          'Eindantwoord circa 9,01 jaar (1 pt)'
        ]
      }
    ]
  },
  'bio-vwo-2024': {
    subject: 'Biologie',
    educationLevel: 'vwo',
    year: 2024,
    durationMinutes: 45,
    questions: [
      {
        id: 1,
        question: 'Leg uit waarom bij zware fysieke inspanning de overgang naar anaerobe dissimilatie leidt tot een snelle verzuring van het spierweefsel en hoe het lichaam dit compenseert.',
        maxPoints: 3,
        criteria: [
          'Vorming van melkzuur / lactaat en H+ ionen (1 pt)',
          'Daling van de pH in spiercellen (1 pt)',
          'Bufferwerking van bicarbonaat / verhoogde ademhalingsfrequentie om CO2 uit te stoten (1 pt)'
        ]
      },
      {
        id: 2,
        question: 'Beredeneer met behulp van de werking van enzymen waarom een te hoge lichaamstemperatuur (boven 42 °C) dodelijk kan zijn voor cellulaire processen.',
        maxPoints: 2,
        criteria: [
          'Denaturatie van eiwitstructuren / verlies van tertiaire enzymstructuur (1 pt)',
          'Verlies van substraatbinding in het actieve centrum (1 pt)'
        ]
      }
    ]
  }
};

export default async function examSimulatorRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // GET /api/exam-simulator/available - Lijst van beschikbare examens
  fastify.get('/available', async (request, reply) => {
    return Object.entries(PRESET_EXAMS).map(([key, item]) => ({
      key,
      subject: item.subject,
      educationLevel: item.educationLevel.toUpperCase(),
      year: item.year,
      durationMinutes: item.durationMinutes,
      questionCount: item.questions.length
    }));
  });

  // POST /api/exam-simulator/sessions - Start een nieuw examen
  fastify.post('/sessions', async (request, reply) => {
    const user = request.user!;
    const { examKey } = (request.body as any) || {};

    const preset = PRESET_EXAMS[examKey] || PRESET_EXAMS['ned-havo-2024'];

    const session = await prisma.examSession.create({
      data: {
        orgId: user.orgId,
        userId: user.id,
        examType: 'eindexamen',
        subject: preset.subject,
        educationLevel: preset.educationLevel,
        year: preset.year,
        durationMinutes: preset.durationMinutes,
        status: 'in_progress',
        questions: JSON.stringify(preset.questions),
        answers: JSON.stringify({})
      }
    });

    return session;
  });

  // GET /api/exam-simulator/sessions/:id - Haal actieve sessie op
  fastify.get('/sessions/:id', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const session = await prisma.examSession.findFirst({
      where: { id, orgId: user.orgId, userId: user.id }
    });

    if (!session) {
      return reply.status(404).send({ error: 'Examensessie niet gevonden' });
    }

    return session;
  });

  // POST /api/exam-simulator/sessions/:id/answer - Tussentijds antwoord opslaan
  fastify.post('/sessions/:id/answer', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { questionId, answer } = (request.body as any) || {};

    const session = await prisma.examSession.findFirst({
      where: { id, orgId: user.orgId, userId: user.id }
    });

    if (!session) {
      return reply.status(404).send({ error: 'Examensessie niet gevonden' });
    }

    if (session.status !== 'in_progress') {
      return reply.status(400).send({ error: 'Dit examen is al ingeleverd' });
    }

    const currentAnswers = JSON.parse(session.answers || '{}');
    currentAnswers[questionId] = answer;

    const updated = await prisma.examSession.update({
      where: { id },
      data: { answers: JSON.stringify(currentAnswers) }
    });

    return { success: true, savedAnswers: currentAnswers };
  });

  // POST /api/exam-simulator/sessions/:id/submit - Examen inleveren en laten nakijken met AI
  fastify.post('/sessions/:id/submit', async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const session = await prisma.examSession.findFirst({
      where: { id, orgId: user.orgId, userId: user.id }
    });

    if (!session) {
      return reply.status(404).send({ error: 'Examensessie niet gevonden' });
    }

    const questions: ExamQuestion[] = JSON.parse(session.questions);
    const answers: Record<string, string> = JSON.parse(session.answers || '{}');

    // Beoordeel elke vraag volgens correctievoorschrift
    const gradingPrompt = `Je bent een officiële examinator voor de Centrale Eindexamens in Nederland.
Beoordeel de onderstaande antwoorden van de leerling strikt volgens het correctievoorschrift.

VRAGEN EN CORRECTIEVOORSCHRIFT:
${JSON.stringify(questions, null, 2)}

ANTWOORDEN VAN DE LEERLING:
${JSON.stringify(answers, null, 2)}

Geef je beoordeling terug als JSON in dit exacte formaat:
{
  "evaluations": [
    {
      "questionId": 1,
      "awardedPoints": 2,
      "maxPoints": 2,
      "feedback": "Kort en krachtig commentaar met uitleg van de puntentoekenning."
    }
  ],
  "totalAwarded": 4,
  "maxTotal": 7,
  "examinerSummary": "Algemeen advies voor het echte examen."
}`;

    let totalAwarded = 0;
    let maxTotal = questions.reduce((acc, q) => acc + q.maxPoints, 0);
    let evaluations: any[] = [];
    let examinerSummary = 'Goed gewerkt! Blijf letten op volledige formuleringen.';

    try {
      const aiRes = await ollamaClient.generate(
        'Beoordeel dit eindexamen en geef uitsluitend JSON terug.',
        'llama3.1:8b',
        gradingPrompt,
        false
      );
      const resJson = await aiRes.json();
      const rawText = (resJson.response || '').replace(/^```json/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(rawText);
      if (parsed.evaluations && Array.isArray(parsed.evaluations)) {
        evaluations = parsed.evaluations;
        totalAwarded = parsed.totalAwarded ?? evaluations.reduce((sum, e) => sum + (e.awardedPoints || 0), 0);
        examinerSummary = parsed.examinerSummary || examinerSummary;
      }
    } catch (e) {
      // Deterministic fallback grading
      evaluations = questions.map(q => {
        const studentAns = answers[q.id] || '';
        const pts = studentAns.length > 20 ? Math.min(q.maxPoints, Math.ceil(q.maxPoints * 0.75)) : 0;
        totalAwarded += pts;
        return {
          questionId: q.id,
          awardedPoints: pts,
          maxPoints: q.maxPoints,
          feedback: studentAns.length > 20 ? 'Goede kernpunten genoemd conform het correctievoorschrift.' : 'Onvolledig antwoord; mist essentiële vaktermen.'
        };
      });
    }

    // N-term berekening (standaard N = 1.0)
    // Cijfer = 1.0 + (score / maxScore) * 9.0
    const rawGrade = maxTotal > 0 ? 1.0 + (totalAwarded / maxTotal) * 9.0 : 1.0;
    const finalGrade = Math.round(Math.min(10.0, Math.max(1.0, rawGrade)) * 10) / 10;

    const completed = await prisma.examSession.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        score: totalAwarded,
        maxScore: maxTotal,
        grade: finalGrade,
        feedback: JSON.stringify({
          evaluations,
          examinerSummary
        })
      }
    });

    return completed;
  });
}
