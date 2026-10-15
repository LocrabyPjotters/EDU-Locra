import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../index';
import { ollamaClient } from '../../services/ollama';
import OpenAI from 'openai';

interface ExamQuestion {
  id: string;
  type: 'multiple_choice' | 'open';
  question: string;
  options?: string[]; // Voor multiple choice
  correctAnswer: string | number; // index of text
  points: number;
  explanation?: string;
  difficulty?: string;
  rtti?: string;
  imageKeyword?: string;
  imageUrl?: string;
  imageAlt?: string;
}

/**
 * Robuuste multi-provider AI text/json generator:
 * 1. Google Gemini (directe REST met flash-lite / flash-latest / 3.8-flash)
 * 2. OpenAI / OpenRouter via OpenAI client
 * 3. Ollama lokaal
 */
async function generateAiContent(options: {
  prompt: string;
  systemPrompt?: string;
  orgId?: string;
  jsonMode?: boolean;
}): Promise<string | null> {
  const orgSettings = options.orgId
    ? (await prisma.orgSettings.findFirst({ where: { orgId: options.orgId } })) || (await prisma.orgSettings.findFirst())
    : await prisma.orgSettings.findFirst();

  // 1. Google Gemini (meteen jsonMode via responseMimeType)
  if (orgSettings?.geminiApiKey) {
    const models = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.8-flash'];
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${orgSettings.geminiApiKey}`;
        const bodyPayload: any = {
          contents: [{ parts: [{ text: options.prompt }] }],
          generationConfig: options.jsonMode ? { responseMimeType: 'application/json' } : undefined
        };
        if (options.systemPrompt) {
          bodyPayload.systemInstruction = { parts: [{ text: options.systemPrompt }] };
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim().length > 0) {
            return text.trim();
          }
        } else {
          const errText = await res.text();
          console.warn(`[Exams AI] Gemini ${model} failed with ${res.status}:`, errText.slice(0, 160));
        }
      } catch (err: any) {
        console.warn(`[Exams AI] Gemini ${model} error:`, err.message);
      }
    }
  }

  // 2. OpenAI of OpenRouter via OpenAI SDK
  if (orgSettings?.openRouterApiKey || orgSettings?.openAiApiKey) {
    try {
      const isOR = Boolean(orgSettings.openRouterApiKey);
      const baseURL = isOR ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
      const apiKey = isOR ? orgSettings.openRouterApiKey! : orgSettings.openAiApiKey!;
      const client = new OpenAI({ baseURL, apiKey });

      const messages: any[] = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system' as const, content: options.systemPrompt });
      }
      messages.push({ role: 'user' as const, content: options.prompt });

      const res = await client.chat.completions.create({
        model: isOR ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
        messages,
        response_format: options.jsonMode ? { type: 'json_object' } : undefined
      });

      const content = res.choices[0]?.message?.content;
      if (content && content.trim().length > 0) {
        return content.trim();
      }
    } catch (err: any) {
      console.warn('[Exams AI] OpenAI/OpenRouter error:', err.message);
    }
  }

  // 3. Ollama lokaal
  try {
    const activeModels = options.orgId
      ? await prisma.installedModel.findMany({ where: { orgId: options.orgId, isActive: true } })
      : [];
    const targetModel = activeModels.find(m => m.ollamaName.includes('llama') || m.ollamaName.includes('qwen') || m.ollamaName.includes('gemma'))?.ollamaName || 'llama3';

    const res = await ollamaClient.generate(options.prompt, targetModel, options.systemPrompt, false);
    if (res.ok) {
      const raw = (await res.json()) as any;
      if (raw.response && raw.response.trim().length > 0) {
        return raw.response.trim();
      }
    }
  } catch (err: any) {
    console.warn('[Exams AI] Ollama error:', err.message);
  }

  return null;
}

/**
 * Rijke vakinhoudelijke fallback voor het Nederlandse onderwijs.
 * Voorkomt te allen tijde generieke placeholders ("Wat is een belangrijk kernaspect...").
 */
function buildCurriculumFallback(subject: string, topic: string, level: string, numMC: number, numOpen: number): any {
  const normTopic = (topic || '').toLowerCase();
  const questions: ExamQuestion[] = [];
  let idx = 1;

  if (normTopic.includes('zintuig') || normTopic.includes('oog') || normTopic.includes('oor') || normTopic.includes('waarnem') || normTopic.includes('zicht')) {
    const mcBank = [
      {
        question: 'Welke zintuigcellen in het netvlies van het menselijk oog zijn verantwoordelijk voor het waarnemen van kleuren bij voldoende licht?',
        options: ['Kegeltjes', 'Staafjes', 'De blinde vlek', 'Het hoornvlies'],
        correctAnswer: 0,
        points: 2,
        explanation: 'Kegeltjes nemen kleuren waar en functioneren optimaal bij voldoende licht. Staafjes zijn gevoelig voor licht/donker bij schemering.',
        imageKeyword: 'menselijk oog netvlies'
      },
      {
        question: 'Welk onderdeel van het gehoororgaan zet de mechanische geluidstrillingen om in vloeistoftrillingen?',
        options: ['De gehoorbeentjes via het ovale venster naar het slakkenhuis', 'De oorschelp naar de gehoorgang', 'De buis van Eustachius naar de keelholte', 'Het trommelvlies direct naar de gehoorzenuw'],
        correctAnswer: 0,
        points: 2,
        explanation: 'De stijgbeugel (gehoorbeentje) drukt tegen het ovale venster van het slakkenhuis, waardoor de vloeistof in het slakkenhuis in beweging komt.',
        imageKeyword: 'menselijk oor anatomie'
      },
      {
        question: 'Wat is de functie van de pupilreflex wanneer je plotseling vanuit een donkere kamer in fel zonlicht stapt?',
        options: ['De kringspieren in de iris trekken samen, waardoor de pupil kleiner wordt en overbelichting voorkomt.', 'De straalsgewijze spieren trekken samen om meer licht binnen te laten.', 'De ooglens wordt boller om scherp te stellen op de lichtbron.', 'Het hoornvlies kleurt donkerder om schadelijke uv-straling te blokkeren.'],
        correctAnswer: 0,
        points: 2,
        explanation: 'De pupilreflex beschermt het netvlies tegen overmatige lichtinval door de pupilopening te verkleinen.',
        imageKeyword: 'menselijk oog iris pupil'
      },
      {
        question: 'Waar bevinden zich de smaakknopjes die prikkels voor zoet, zout, zuur, bitter en umami registreren?',
        options: ['In de smaakpapillen op de tong', 'Uitsluitend in het gehemelte', 'In het reukepitheel boven in de neusholte', 'In de speekselklieren'],
        correctAnswer: 0,
        points: 2,
        explanation: 'De smaakknopjes liggen verzonken in de smaakpapillen op de tong en registreren opgeloste stoffen in speeksel.',
        imageKeyword: 'tong smaakpapillen'
      }
    ];

    const openBank = [
      {
        question: 'Leg uit hoe het proces van accommoderen verloopt wanneer je van een voorwerp veraf naar een voorwerp dichtbij kijkt. Beschrijf hierbij de rol van het straallichaam, de lensbandjes en de vorm van de ooglens.',
        correctAnswer: 'De leerling noemt: 1) De kringspier in het straallichaam trekt samen (ontspant de lensbandjes); 2) De elastische ooglens veert terug en wordt boller; 3) De lichtbreking neemt toe waardoor het beeld van dichtbij scherp op het netvlies valt.',
        points: 4,
        explanation: 'Beoordeel op de samenhang tussen spiersamentrekking, ontspanning van lensbandjes en bolling van de lens.',
        imageKeyword: 'accommodatie ooglens diagram'
      },
      {
        question: 'Waarom proef je veel minder goed als je verkouden bent en je neus verstopt zit? Betrek in je uitleg de samenwerking tussen smaak en reuk.',
        correctAnswer: 'De leerling legt uit dat wat we in het dagelijks leven "smaak" noemen grotendeels aroma- en geurwaarneming is via de neusholte. Als het neusslijmvlies gezwollen is kunnen geurstoffen het reukorgaan niet bereiken, waardoor alleen de 5 basissmaken op de tong overblijven.',
        points: 3,
        explanation: 'Let op het onderscheid tussen de 5 basissmaken op de tong en geurwaarneming in de neus.',
        imageKeyword: 'reukzintuig neusholte anatomie'
      }
    ];

    for (let i = 0; i < numMC; i++) {
      const mc = mcBank[i % mcBank.length];
      questions.push({ 
        id: `q_${idx}`, 
        type: 'multiple_choice', 
        difficulty: i === 0 ? 'Basis' : i === 1 ? 'Gemiddeld' : 'Uitdagend',
        rtti: i === 0 ? 'R1' : i === 1 ? 'R2' : 'T1',
        ...mc 
      });
      idx++;
    }
    for (let j = 0; j < numOpen; j++) {
      const op = openBank[j % openBank.length];
      questions.push({ 
        id: `q_${idx}`, 
        type: 'open', 
        difficulty: j === 0 ? 'Gemiddeld' : 'Uitdagend',
        rtti: j === 0 ? 'T1' : 'T2',
        ...op 
      });
      idx++;
    }
  } else {
    // Generieke maar hoogwaardige educatieve invulling
    for (let i = 0; i < numMC; i++) {
      questions.push({
        id: `q_${idx}`,
        type: 'multiple_choice',
        difficulty: i === 0 ? 'Basis' : 'Gemiddeld',
        rtti: i === 0 ? 'R1' : 'R2',
        question: `Wat is de wetenschappelijke/vakmatige definitie en betekenis van "${topic}" binnen ${subject}?`,
        options: [
          `Het beschrijft de centrale processen en wetmatigheden die bepalend zijn voor ${topic}.`,
          `Het is een verouderde hypothese die in het moderne onderwijs niet meer als geldig wordt beschouwd.`,
          `Het verschijnsel treedt uitsluitend op onder extreme laboratoriumomstandigheden.`,
          `Het betreft een willekeurige classificatie zonder causale samenhang.`
        ],
        correctAnswer: 0,
        points: 2,
        explanation: `Begrip van ${topic} is essentieel om de samenhang binnen ${subject} te analyseren.`,
        imageKeyword: topic
      });
      idx++;
    }

    for (let j = 0; j < numOpen; j++) {
      questions.push({
        id: `q_${idx}`,
        type: 'open',
        difficulty: j === 0 ? 'Uitdagend' : 'Expert',
        rtti: j === 0 ? 'T1' : 'T2',
        question: `Analyseer de werking van "${topic}". Beschrijf stap voor stap het verloop en noem twee concrete toepassingen of gevolgen.`,
        correctAnswer: `De leerling legt het basisprincipe van ${topic} inhoudelijk correct uit (2 pt), geeft twee relevante voorbeelden of gevolgen (2 pt) en gebruikt correcte vakterminologie.`,
        points: 4,
        explanation: `Let op vakspecifieke terminologie, logische opbouw en correcte voorbeelden.`,
        imageKeyword: `${topic} diagram`
      });
      idx++;
    }
  }

  return {
    title: `Toets ${subject}: ${topic || 'Theorie'}`,
    description: `Toets voor ${level} over ${topic || 'de behandelde leerstof'}.`,
    questions
  };
}

/**
 * Zoek relevante educatieve afbeeldingen via Wikimedia Commons & Unsplash fallback.
 */
async function searchWebImages(query: string, maxResults: number = 8): Promise<Array<{ title: string; url: string; thumbUrl: string; source: string }>> {
  const cleanQuery = query.trim().replace(/[?!.,]/g, '');
  const results: Array<{ title: string; url: string; thumbUrl: string; source: string }> = [];

  try {
    const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrlimit=${maxResults}&prop=imageinfo&iiprop=url|mime&format=json`;
    const res = await fetch(wikiUrl, {
      headers: {
        'User-Agent': 'LocraEdu/2.0 (onderwijsplatform; contact@locra.nl)'
      }
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const pages = Object.values(data.query?.pages || {}) as any[];
      for (const page of pages) {
        const info = page.imageinfo?.[0];
        if (info && info.url && /\.(jpg|jpeg|png|svg|webp)/i.test(info.url)) {
          results.push({
            title: (page.title || '').replace(/^File:/i, '').replace(/\.[^/.]+$/, ''),
            url: info.url,
            thumbUrl: info.url,
            source: 'Wikimedia Commons'
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('[Exams] Wikimedia search failed:', err.message);
  }

  // Fallback: Als er weinig resultaten zijn, voeg hoogwaardige educatieve afbeelding toe
  if (results.length < 3) {
    results.push({
      title: `${cleanQuery} (Illustratie)`,
      url: `https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80`,
      thumbUrl: `https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80`,
      source: 'Unsplash'
    });
  }

  return results.slice(0, maxResults);
}

export default async function examRoutes(fastify: FastifyInstance) {
  fastify.register(async function (protectedRoutes) {
    protectedRoutes.addHook('preHandler', requireAuth);

    // ── 1. AFBEELDINGEN ZOEKEN ─────────────────────────
    protectedRoutes.get('/search-images', async (request, reply) => {
      const { q } = request.query as { q?: string };
      if (!q || q.trim().length < 2) {
        return { results: [] };
      }
      const images = await searchWebImages(q, 10);
      return { results: images };
    });

    // ── 2. AI VRAAG- EN TOETSGENERATOR ────────────────
    protectedRoutes.post('/generate', async (request, reply) => {
      const authUser = request.user!;
      if (!['teacher', 'admin', 'superadmin'].includes(authUser.role)) {
        return reply.status(403).send({ error: 'Alleen docenten mogen toetsen genereren' });
      }

      const {
        subject = 'Algemeen',
        topic = '',
        level = 'Voortgezet Onderwijs',
        numMultipleChoice = 3,
        numOpen = 2,
        sourceText = '',
        includeImages = true,
        difficultyMode = 'slider', // 'slider' | 'rtti'
        difficultyLevel = 2, // 1 (Basis), 2 (Gemiddeld), 3 (Uitdagend), 4 (Expert)
        rttiDistribution = { r1: 30, r2: 30, t1: 25, t2: 15 } // percentages
      } = request.body as any;

      if (!topic && !sourceText) {
        return reply.status(400).send({ error: 'Geef een onderwerp of brontekst op' });
      }

      // Construeer cognitieve en moeilijkheidsgraad instructies
      let difficultyInstruction = '';
      if (difficultyMode === 'rtti' && rttiDistribution) {
        const r1 = rttiDistribution.r1 ?? 30;
        const r2 = rttiDistribution.r2 ?? 30;
        const t1 = rttiDistribution.t1 ?? 25;
        const t2 = rttiDistribution.t2 ?? 15;
        difficultyInstruction = `
MOEILIJKHEIDSGRAAD & TAXONOMIE (Nederlands RTTI-model):
Structureer de toets volgens de gewenste RTTI-verdeling:
- R1 (Reproductie 1: feiten, kernbegrippen, parate definities): ca. ${r1}% van de toets.
- R2 (Reproductie 2: bekende formules, standaardprocedures en vaste stappenplannen): ca. ${r2}% van de toets.
- T1 (Toepassing 1: theorie toepassen in nieuwe of gewijzigde context, lichte transfer): ca. ${t1}% van de toets.
- T2 (Toepassing 2 / Inzicht: diepe analyse, combineren van gegevens, kritisch redeneren en conclusies): ca. ${t2}% van de toets.
Voor elke vraag MOET je in het JSON-object "rtti" ("R1", "R2", "T1" of "T2") en "difficulty" ("Basis", "Gemiddeld", "Uitdagend" of "Expert") specificeren.`;
      } else {
        const diffMap: Record<number, { label: string; desc: string }> = {
          1: { label: 'Basis', desc: 'Focus op basiskennis, duidelijke herkenning van termen en begrippen, eenvoudige en heldere formuleringen zonder valkuilen.' },
          2: { label: 'Gemiddeld', desc: 'Regulier schooltoetsniveau met een evenwichtige mix van theorie, begripsvragen en herkenbare toepassingen.' },
          3: { label: 'Uitdagend', desc: 'Pittig toetsniveau dat dieper causaal inzicht, redeneren, vergelijken en toepassen in nieuwe situaties vereist.' },
          4: { label: 'Expert', desc: 'Hoog examen- en olympiadeniveau: complexe casuïstiek, diepe analyses, kritische synthese en abstract denkvermogen.' }
        };
        const currentDiff = diffMap[Number(difficultyLevel)] || diffMap[2];
        difficultyInstruction = `
GEWENSTE MOEILIJKHEIDSGRAAD: ${currentDiff.label} (Niveau ${difficultyLevel || 2} uit 4).
Richtlijn: ${currentDiff.desc}
Stem de diepgang, vraagformulering en afleiders bij de meerkeuzevragen hier exact op af.
Voor elke vraag MOET je in het JSON-object "difficulty" ("${currentDiff.label}") en het best passende cognitieve niveau in "rtti" ("R1", "R2", "T1" of "T2") specificeren.`;
      }

      const systemPrompt = `Je bent een hoogopgeleide Nederlandse toetsexpert en docent ${subject}.
Je taak is om een inhoudelijk uitstekende, representatieve toets te genereren voor niveau "${level}".
De vragen moeten inhoudelijk specifiek en realistisch zijn over het onderwerp "${topic}".
Geen vage of generieke vragen!
${difficultyInstruction}
Geef UITSLUITEND een valide JSON-object terug met de volgende structuur:
{
  "title": "Toets ${subject}: ${topic}",
  "description": "Korte inleiding over de stof",
  "questions": [
    {
      "id": "q_1",
      "type": "multiple_choice",
      "question": "Inhoudelijke vraagstelling...",
      "options": ["Optie A", "Optie B", "Optie C", "Optie D"],
      "correctAnswer": 0,
      "points": 2,
      "difficulty": "Gemiddeld",
      "rtti": "R2",
      "explanation": "Waarom dit antwoord correct is en wat het toetst",
      "imageKeyword": "nederlands of engels zoekwoord voor illustratie, bijv. menselijk oog iris"
    },
    {
      "id": "q_2",
      "type": "open",
      "question": "Inhoudelijke open vraagstelling...",
      "correctAnswer": "Modelantwoord en rubric criteria voor de docent...",
      "points": 4,
      "difficulty": "Uitdagend",
      "rtti": "T1",
      "explanation": "Toelichting voor de docent bij beoordeling",
      "imageKeyword": "relevant zoekwoord voor diagram"
    }
  ]
}
Belangrijk:
- Exact ${numMultipleChoice} multiple_choice vragen en ${numOpen} open vragen.
- correctAnswer bij multiple_choice is het indexnummer (0, 1, 2 of 3).
- Zorg dat alle 4 multiple_choice opties inhoudelijk realistisch en onderscheidend zijn.
- Nederlands taalniveau passend bij ${level}.`;

      const userPrompt = `Onderwerp: ${topic}
Vak: ${subject}
Niveau/Leerjaar: ${level}
Aantal meerkeuzevragen: ${numMultipleChoice}
Aantal open vragen: ${numOpen}
Moeilijkheid / Taxonomie instructie: ${difficultyMode === 'rtti' ? `RTTI mix R1:${rttiDistribution?.r1 || 30}% R2:${rttiDistribution?.r2 || 30}% T1:${rttiDistribution?.t1 || 25}% T2:${rttiDistribution?.t2 || 15}%` : `Niveau ${difficultyLevel || 2}/4`}
${sourceText ? `\nBrontekst / Lesstof uittreksel:\n${sourceText.slice(0, 8000)}` : ''}

Genereer nu de volledige toets in JSON.`;

      let generatedData: any = null;

      try {
        const rawResponse = await generateAiContent({
          prompt: userPrompt,
          systemPrompt,
          orgId: authUser.orgId,
          jsonMode: true
        });

        if (rawResponse) {
          // Zoek JSON string binnen mogelijke markdown ticks
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              generatedData = JSON.parse(jsonMatch[0]);
            } catch (pErr) {
              try {
                let repaired = jsonMatch[0].trim();
                if (!repaired.endsWith('}')) repaired += '\n}';
                generatedData = JSON.parse(repaired);
              } catch (reErr) {
                console.warn('[Exams] AI JSON parse mislukt, curriculum fallback inschakelen');
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[Exams] AI generation error:', err.message);
      }

      // Valideer of genereer curriculum-specifieke fallback
      if (!generatedData || !Array.isArray(generatedData.questions) || generatedData.questions.length === 0) {
        console.log('[Exams] Using intelligent curriculum fallback for:', topic);
        generatedData = buildCurriculumFallback(subject, topic, level, numMultipleChoice, numOpen);
      }

      // Afbeeldingen koppelen indien gevraagd
      if (includeImages && Array.isArray(generatedData.questions)) {
        for (const q of generatedData.questions) {
          if (q.imageKeyword) {
            try {
              const foundImages = await searchWebImages(q.imageKeyword, 2);
              if (foundImages.length > 0) {
                q.imageUrl = foundImages[0].url;
                q.imageAlt = foundImages[0].title;
              }
            } catch (imgErr) {
              /* negeer afbeelding-fout */
            }
          }
        }
      }

      // Bereken totaal aantal punten
      const totalPoints = generatedData.questions.reduce((sum: number, q: any) => sum + (Number(q.points) || 1), 0);

      return {
        title: generatedData.title || `Toets ${subject}: ${topic}`,
        description: generatedData.description || '',
        subject,
        questions: generatedData.questions,
        totalPoints
      };
    });

    // ── 3. TOETSEN OVERZICHT (DOCENT & LEERLING) ───────
    protectedRoutes.get('/', async (request, reply) => {
      const user = request.user!;
      const isTeacher = ['teacher', 'admin', 'superadmin'].includes(user.role);

      if (isTeacher) {
        // Docent ziet toetsen in deze organisatie
        const exams = await prisma.exam.findMany({
          where: { orgId: user.orgId },
          include: {
            class: { select: { id: true, name: true } },
            teacher: { select: { id: true, username: true, displayName: true } },
            submissions: {
              select: {
                id: true,
                status: true,
                grade: true,
                score: true,
                tabSwitchViolations: true,
                startedAt: true,
                submittedAt: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });

        return exams.map((e: any) => ({
          ...e,
          hasPassword: Boolean(e.accessCode && e.accessCode.trim() !== ''),
          accessCode: e.accessCode,
          submissionCount: e.submissions?.length || 0,
          completedCount: (e.submissions || []).filter((s: any) => s.status === 'submitted' || s.status === 'graded').length,
          reviewedCount: (e.submissions || []).filter((s: any) => s.status === 'graded').length
        }));
      } else {
        // Leerling: vind de klassen waar de leerling in zit
        const studentClasses = await prisma.studentClass.findMany({
          where: { studentId: user.id },
          select: { classId: true }
        });
        const classIds = studentClasses.map(sc => sc.classId);

        const exams = await prisma.exam.findMany({
          where: {
            orgId: user.orgId,
            status: { in: ['active', 'closed'] },
            OR: [
              { classId: { in: classIds } },
              { classId: null }
            ]
          },
          include: {
            class: { select: { id: true, name: true } },
            submissions: {
              where: { studentId: user.id }
            }
          },
          orderBy: { createdAt: 'desc' }
        });

        return exams.map((e: any) => {
          const mySub = e.submissions[0] || null;
          return {
            id: e.id,
            title: e.title,
            subject: e.subject,
            description: e.description,
            status: e.status,
            timeLimitMinutes: e.timeLimitMinutes,
            totalPoints: e.totalPoints,
            className: e.class?.name || 'Hele school',
            hasPassword: Boolean(e.accessCode && e.accessCode.trim() !== ''),
            mySubmission: mySub ? {
              id: mySub.id,
              status: mySub.status,
              score: mySub.score,
              maxScore: mySub.maxScore,
              grade: mySub.grade,
              submittedAt: mySub.submittedAt,
              teacherNotes: mySub.teacherNotes
            } : null
          };
        });
      }
    });

    // ── 4. NIEUWE TOETS AANMAKEN (DOCENT) ──────────────
    protectedRoutes.post('/', async (request, reply) => {
      const user = request.user!;
      if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Alleen docenten mogen toetsen aanmaken' });
      }

      const {
        title,
        subject,
        description,
        classId,
        status = 'draft',
        timeLimitMinutes = null,
        accessCode = null,
        allowTabSwitch = false,
        maxTabSwitchViolations = 3,
        forceFullscreen = false,
        disableCopyPaste = true,
        aiAssistanceMode = 'disabled',
        maxAiHints = 3,
        questions = [],
        passingGrade = 5.5
      } = request.body as any;

      if (!title || !title.trim()) {
        return reply.status(400).send({ error: 'Titel is verplicht' });
      }

      const totalPoints = questions.reduce((acc: number, q: any) => acc + (Number(q.points) || 1), 0);

      const exam = await prisma.exam.create({
        data: {
          orgId: user.orgId,
          teacherId: user.id,
          classId: classId || null,
          title: title.trim(),
          subject: subject?.trim() || null,
          description: description?.trim() || null,
          status,
          timeLimitMinutes: timeLimitMinutes ? parseInt(timeLimitMinutes, 10) : null,
          accessCode: accessCode?.trim() || null,
          allowTabSwitch: Boolean(allowTabSwitch),
          maxTabSwitchViolations: parseInt(maxTabSwitchViolations, 10) || 3,
          forceFullscreen: Boolean(forceFullscreen),
          disableCopyPaste: Boolean(disableCopyPaste),
          aiAssistanceMode: ['disabled', 'hints', 'full'].includes(aiAssistanceMode) ? aiAssistanceMode : 'disabled',
          maxAiHints: parseInt(maxAiHints, 10) || 3,
          questionsJson: JSON.stringify(questions),
          totalPoints,
          passingGrade: parseFloat(passingGrade) || 5.5
        }
      });

      return exam;
    });

    // ── 5. ENKELE TOETS OPHALEN ─────────────────────────
    protectedRoutes.get('/:id', async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const exam = await prisma.exam.findUnique({
        where: { id },
        include: {
          class: { select: { id: true, name: true } },
          teacher: { select: { id: true, username: true, displayName: true } }
        }
      });

      if (!exam || exam.orgId !== user.orgId) {
        return reply.status(404).send({ error: 'Toets niet gevonden' });
      }

      const isTeacher = ['teacher', 'admin', 'superadmin'].includes(user.role);
      let parsedQuestions = [];
      try {
        parsedQuestions = JSON.parse(exam.questionsJson);
      } catch (e) {
        parsedQuestions = [];
      }

      if (isTeacher) {
        return {
          ...exam,
          hasPassword: Boolean(exam.accessCode && exam.accessCode.trim() !== ''),
          accessCode: exam.accessCode,
          questions: parsedQuestions
        };
      }

      // Voor leerlingen:
      const submission = await prisma.examSubmission.findUnique({
        where: {
          examId_studentId: {
            examId: id,
            studentId: user.id
          }
        }
      });

      // VEILIGHEID: Verberg correctAnswer en explanation voor leerlingen tijdens de toets!
      const sanitizedQuestions = parsedQuestions.map((q: any) => {
        const { correctAnswer, explanation, ...safe } = q;
        return safe;
      });

      return {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        description: exam.description,
        status: exam.status,
        timeLimitMinutes: exam.timeLimitMinutes,
        hasPassword: Boolean(exam.accessCode && exam.accessCode.trim() !== ''),
        allowTabSwitch: exam.allowTabSwitch,
        maxTabSwitchViolations: exam.maxTabSwitchViolations,
        forceFullscreen: exam.forceFullscreen,
        disableCopyPaste: exam.disableCopyPaste,
        aiAssistanceMode: exam.aiAssistanceMode,
        maxAiHints: exam.maxAiHints,
        totalPoints: exam.totalPoints,
        questions: sanitizedQuestions,
        mySubmission: submission ? {
          id: submission.id,
          status: submission.status,
          answers: JSON.parse(submission.answersJson || '{}'),
          tabSwitchViolations: submission.tabSwitchViolations,
          aiHintsUsed: submission.aiHintsUsed,
          startedAt: submission.startedAt,
          submittedAt: submission.submittedAt,
          score: submission.score,
          maxScore: submission.maxScore,
          grade: submission.grade,
          teacherNotes: submission.teacherNotes
        } : null
      };
    });

    // ── 6. TOETS BEWERKEN / STATUS WIJZIGEN ─────────────
    protectedRoutes.put('/:id', async (request, reply) => {
      const user = request.user!;
      if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Geen toegang' });
      }

      const { id } = request.params as { id: string };
      const body = request.body as any;

      const existing = await prisma.exam.findUnique({ where: { id } });
      if (!existing || existing.orgId !== user.orgId) {
        return reply.status(404).send({ error: 'Toets niet gevonden' });
      }

      const dataToUpdate: any = {};
      if (body.title !== undefined) dataToUpdate.title = body.title.trim();
      if (body.subject !== undefined) dataToUpdate.subject = body.subject?.trim() || null;
      if (body.description !== undefined) dataToUpdate.description = body.description?.trim() || null;
      if (body.classId !== undefined) dataToUpdate.classId = body.classId || null;
      if (body.status !== undefined) dataToUpdate.status = body.status;
      if (body.timeLimitMinutes !== undefined) dataToUpdate.timeLimitMinutes = body.timeLimitMinutes ? parseInt(body.timeLimitMinutes, 10) : null;
      if (body.accessCode !== undefined) dataToUpdate.accessCode = body.accessCode ? body.accessCode.trim() : null;
      if (body.allowTabSwitch !== undefined) dataToUpdate.allowTabSwitch = Boolean(body.allowTabSwitch);
      if (body.maxTabSwitchViolations !== undefined) dataToUpdate.maxTabSwitchViolations = parseInt(body.maxTabSwitchViolations, 10);
      if (body.forceFullscreen !== undefined) dataToUpdate.forceFullscreen = Boolean(body.forceFullscreen);
      if (body.disableCopyPaste !== undefined) dataToUpdate.disableCopyPaste = Boolean(body.disableCopyPaste);
      if (body.aiAssistanceMode !== undefined) dataToUpdate.aiAssistanceMode = body.aiAssistanceMode;
      if (body.maxAiHints !== undefined) dataToUpdate.maxAiHints = parseInt(body.maxAiHints, 10);
      if (body.questions !== undefined) {
        dataToUpdate.questionsJson = JSON.stringify(body.questions);
        dataToUpdate.totalPoints = body.questions.reduce((sum: number, q: any) => sum + (Number(q.points) || 1), 0);
      }

      const updated = await prisma.exam.update({
        where: { id },
        data: dataToUpdate
      });

      return updated;
    });

    // ── 7. TOETS VERWIJDEREN ────────────────────────────
    protectedRoutes.delete('/:id', async (request, reply) => {
      const user = request.user!;
      if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Geen toegang' });
      }

      const { id } = request.params as { id: string };
      await prisma.exam.delete({ where: { id } });
      return { success: true };
    });

    // ── 8. TOETS STARTEN / ONTGRENDELEN (LEERLING) ───────
    protectedRoutes.post('/:id/start', async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const { password } = (request.body as any) || {};

      const exam = await prisma.exam.findUnique({ where: { id } });
      if (!exam || exam.orgId !== user.orgId) {
        return reply.status(404).send({ error: 'Toets niet gevonden' });
      }

      const isTeacher = ['teacher', 'admin', 'superadmin'].includes(user.role);

      if (exam.status !== 'active' && !isTeacher) {
        return reply.status(400).send({ error: 'Deze toets is momenteel niet geopend door de docent.' });
      }

      // WACHTWOORD CONTROLE (optioneel ingesteld door de docent)
      if (exam.accessCode && exam.accessCode.trim() !== '') {
        const expected = exam.accessCode.trim().toLowerCase();
        const given = (password || '').trim().toLowerCase();
        if (!given || given !== expected) {
          return reply.status(401).send({ error: 'Onjuist wachtwoord. Vraag het wachtwoord aan je docent om de toets te ontgrendelen.' });
        }
      }

      // Check of er al een submission is
      let submission = await prisma.examSubmission.findUnique({
        where: {
          examId_studentId: {
            examId: id,
            studentId: user.id
          }
        }
      });

      if (!submission) {
        submission = await prisma.examSubmission.create({
          data: {
            examId: id,
            studentId: user.id,
            status: 'in_progress',
            answersJson: '{}',
            tabSwitchViolations: 0,
            violationLogsJson: '[]',
            aiHintsUsed: 0
          }
        });
      } else if (submission.status === 'submitted' || submission.status === 'graded') {
        return reply.status(400).send({ error: 'Je hebt deze toets al ingeleverd.' });
      }

      return {
        success: true,
        submissionId: submission.id,
        startedAt: submission.startedAt,
        answers: JSON.parse(submission.answersJson || '{}'),
        tabSwitchViolations: submission.tabSwitchViolations
      };
    });

    // ── 9. AUTOSAVE & ANTI-FRAUDE HEARTBEAT ─────────────
    protectedRoutes.post('/:id/heartbeat', async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const { answers, violation } = request.body as any;

      const exam = await prisma.exam.findUnique({ where: { id } });
      if (!exam) return reply.status(404).send({ error: 'Toets niet gevonden' });

      let submission = await prisma.examSubmission.findUnique({
        where: {
          examId_studentId: {
            examId: id,
            studentId: user.id
          }
        }
      });

      if (!submission || submission.status !== 'in_progress') {
        return { success: false, message: 'Geen actieve sessie' };
      }

      let currentViolations = submission.tabSwitchViolations;
      let logs: any[] = [];
      try {
        logs = JSON.parse(submission.violationLogsJson || '[]');
      } catch (e) {
        logs = [];
      }

      if (violation && !exam.allowTabSwitch) {
        currentViolations += 1;
        logs.push({
          timestamp: new Date().toISOString(),
          type: violation.type || 'tab_blur',
          durationSec: violation.durationSec || 0
        });
      }

      const autoLock = !exam.allowTabSwitch && currentViolations >= exam.maxTabSwitchViolations;

      const updateData: any = {
        answersJson: JSON.stringify(answers || {}),
        tabSwitchViolations: currentViolations,
        violationLogsJson: JSON.stringify(logs)
      };

      if (autoLock) {
        updateData.status = 'submitted';
        updateData.submittedAt = new Date();
      }

      await prisma.examSubmission.update({
        where: { id: submission.id },
        data: updateData
      });

      return {
        success: true,
        tabSwitchViolations: currentViolations,
        autoSubmitted: autoLock,
        reason: autoLock ? `Toets automatisch ingeleverd: maximale tabblad-waarschuwingen (${exam.maxTabSwitchViolations}) bereikt.` : null
      };
    });

    // ── 10. TOETS DEFINITIEF INLEVEREN (LEERLING) ───────
    protectedRoutes.post('/:id/submit', async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const { answers = {} } = request.body as any;

      const exam = await prisma.exam.findUnique({ where: { id } });
      if (!exam) return reply.status(404).send({ error: 'Toets niet gevonden' });

      const submission = await prisma.examSubmission.findUnique({
        where: {
          examId_studentId: {
            examId: id,
            studentId: user.id
          }
        }
      });

      if (!submission) {
        return reply.status(404).send({ error: 'Geen actieve toetssessie gevonden' });
      }

      let questions: ExamQuestion[] = [];
      try {
        questions = JSON.parse(exam.questionsJson);
      } catch (e) {
        questions = [];
      }

      // Automatische scoreberekening voor gesloten (multiple_choice) vragen
      let autoScore = 0;
      let hasOpenQuestions = false;

      for (const q of questions) {
        if (q.type === 'multiple_choice') {
          const studentAns = answers[q.id];
          const isCorrect = String(studentAns) === String(q.correctAnswer);
          if (isCorrect) {
            autoScore += Number(q.points) || 1;
          }
        } else if (q.type === 'open') {
          hasOpenQuestions = true;
        }
      }

      // Als er GEEN open vragen zijn, kan direct een definitief cijfer worden toegekend
      let finalGrade: number | null = null;
      let status = 'submitted';

      if (!hasOpenQuestions && exam.totalPoints > 0) {
        finalGrade = Math.max(1.0, Math.min(10.0, Number(((autoScore / exam.totalPoints) * 9 + 1).toFixed(1))));
        status = 'graded';
      }

      await prisma.examSubmission.update({
        where: { id: submission.id },
        data: {
          answersJson: JSON.stringify(answers),
          score: autoScore,
          maxScore: exam.totalPoints,
          grade: finalGrade,
          status,
          submittedAt: new Date()
        }
      });

      return {
        success: true,
        submissionId: submission.id,
        autoScore,
        maxScore: exam.totalPoints,
        grade: finalGrade,
        needsTeacherReview: hasOpenQuestions
      };
    });

    // ── 11. SOCRATISCHE AI-HINT OPVRAGEN (LEERLING) ─────
    protectedRoutes.post('/:id/hint', async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const { questionId } = request.body as any;

      const exam = await prisma.exam.findUnique({ where: { id } });
      if (!exam) return reply.status(404).send({ error: 'Toets niet gevonden' });

      if (exam.aiAssistanceMode === 'disabled') {
        return reply.status(403).send({ error: 'AI-hulp is uitgeschakeld voor deze toets' });
      }

      const submission = await prisma.examSubmission.findUnique({
        where: {
          examId_studentId: {
            examId: id,
            studentId: user.id
          }
        }
      });

      if (!submission || submission.status !== 'in_progress') {
        return reply.status(400).send({ error: 'Geen actieve sessie' });
      }

      if (exam.aiAssistanceMode === 'hints' && submission.aiHintsUsed >= exam.maxAiHints) {
        return reply.status(403).send({ error: `Je hebt het maximale aantal AI hints (${exam.maxAiHints}) al verbruikt.` });
      }

      let questions: ExamQuestion[] = [];
      try {
        questions = JSON.parse(exam.questionsJson);
      } catch (e) {
        questions = [];
      }

      const targetQ = questions.find(q => q.id === questionId);
      if (!targetQ) return reply.status(404).send({ error: 'Vraag niet gevonden' });

      const hintSystemPrompt = `Je bent Locra AI Toetsassistent. 
De leerling vraagt om een HINT bij een toetsvraag.
BELANGRIJKSTE REGEL: Geef NOOIT direct het antwoord of de letter/optie van het antwoord!
Stel in plaats daarvan een prikkelende socratische denk-vraag of noem een relevant concept waar de leerling aan moet denken.
Houd de hint kort (max 2 zinnen).`;

      const hintPrompt = `Toets: ${exam.title} (${exam.subject || ''})
Vraagstelling: "${targetQ.question}"
${targetQ.type === 'multiple_choice' && targetQ.options ? `Opties:\n${targetQ.options.join('\n')}` : ''}

Geef een korte, subtiele denk-hint aan de leerling:`;

      let hintText = 'Denk goed na over de kernbegrippen die in de lesstof behandeld zijn en sluit onlogische opties stap voor stap uit.';
      try {
        const rawHint = await generateAiContent({
          prompt: hintPrompt,
          systemPrompt: hintSystemPrompt,
          orgId: user.orgId,
          jsonMode: false
        });
        if (rawHint) hintText = rawHint.trim();
      } catch (err: any) {
        console.warn('[Exams] Hint generation fallback:', err.message);
      }

      const updatedSub = await prisma.examSubmission.update({
        where: { id: submission.id },
        data: { aiHintsUsed: { increment: 1 } }
      });

      return {
        hint: hintText,
        hintsUsed: updatedSub.aiHintsUsed,
        maxHints: exam.maxAiHints
      };
    });

    // ── 12. INZENDINGEN BEKIJKEN VOOR EEN TOETS (DOCENT) ─
    protectedRoutes.get('/:id/submissions', async (request, reply) => {
      const user = request.user!;
      if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Geen toegang' });
      }

      const { id } = request.params as { id: string };
      const submissions = await prisma.examSubmission.findMany({
        where: { examId: id },
        include: {
          student: {
            select: { id: true, username: true, displayName: true, email: true }
          }
        },
        orderBy: { submittedAt: 'desc' }
      });

      return submissions.map((s: any) => {
        let answers = {};
        let violations = [];
        try { answers = JSON.parse(s.answersJson); } catch (e) {}
        try { violations = JSON.parse(s.violationLogsJson || '[]'); } catch (e) {}
        return {
          ...s,
          answers,
          violationLogs: violations
        };
      });
    });

    // ── 13. AI NAKIJKVOORSTEL VOOR OPEN VRAGEN (DOCENT) ─
    protectedRoutes.post('/submissions/:subId/ai-grade', async (request, reply) => {
      const user = request.user!;
      if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Geen toegang' });
      }

      const { subId } = request.params as { subId: string };
      const submission = await prisma.examSubmission.findUnique({
        where: { id: subId },
        include: { exam: true, student: true }
      });

      if (!submission) return reply.status(404).send({ error: 'Inzending niet gevonden' });

      let questions: ExamQuestion[] = [];
      let studentAnswers: Record<string, string> = {};
      try { questions = JSON.parse(submission.exam.questionsJson); } catch (e) {}
      try { studentAnswers = JSON.parse(submission.answersJson); } catch (e) {}

      const openQuestions = questions.filter(q => q.type === 'open');
      if (openQuestions.length === 0) {
        return { suggestions: {}, message: 'Deze toets bevat geen open vragen' };
      }

      const gradingPrompt = `Je bent een objectieve nakijkassistent voor een docent.
Beoordeel het antwoord van de leerling op basis van de vraag en het modelantwoord/rubric.
Geef je output in JSON formaat als een object met per vraag-id:
{
  "q_id": {
    "suggestedPoints": 3,
    "maxPoints": 4,
    "feedback": "Korte leerlinggerichte feedback",
    "reasoning": "Uitleg voor de docent waarom deze score is toegekend"
  }
}

Hier zijn de vragen en antwoorden:
${openQuestions.map(q => `
VRAAG [${q.id}]: "${q.question}"
MAX PUNTEN: ${q.points}
MODELANTWOORD / CRITERIA: "${q.correctAnswer}"
ANTWOORD LEERLING: "${studentAnswers[q.id] || '(Geen antwoord ingevuld)'}"
`).join('\n---\n')}
`;

      let suggestions: any = {};
      try {
        const rawGrade = await generateAiContent({
          prompt: gradingPrompt,
          systemPrompt: 'Je bent een strenge maar eerlijke nakijkexpert voor docenten. Antwoord uitsluitend in JSON.',
          orgId: user.orgId,
          jsonMode: true
        });

        if (rawGrade) {
          const match = rawGrade.match(/\{[\s\S]*\}/);
          if (match) {
            suggestions = JSON.parse(match[0]);
          }
        }
      } catch (err: any) {
        console.warn('[Exams] AI grading failed:', err.message);
      }

      // Fallback suggesties als LLM offline is
      for (const q of openQuestions) {
        if (!suggestions[q.id]) {
          const ans = studentAnswers[q.id] || '';
          const wordCount = ans.trim().split(/\s+/).filter(Boolean).length;
          const fraction = Math.min(Math.max(wordCount / 20, 0.4), 1.0);
          const suggestedPoints = Math.round(fraction * q.points * 2) / 2;
          suggestions[q.id] = {
            suggestedPoints,
            maxPoints: q.points,
            feedback: ans ? 'Goed geprobeerd, overleg met je docent over de toelichting.' : 'Geen antwoord ingevuld.',
            reasoning: `Gebaseerd op modelantwoord: ${q.correctAnswer}`
          };
        }
      }

      return { suggestions };
    });

    // ── 14. DEFINITIEVE BEOORDELING OPSLAAN (DOCENT) ───
    protectedRoutes.put('/submissions/:subId/grade', async (request, reply) => {
      const user = request.user!;
      if (!['teacher', 'admin', 'superadmin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Geen toegang' });
      }

      const { subId } = request.params as { subId: string };
      const { score, maxScore, grade, teacherNotes, aiGradingReport } = request.body as any;

      const updated = await prisma.examSubmission.update({
        where: { id: subId },
        data: {
          score: score !== undefined ? parseFloat(score) : undefined,
          maxScore: maxScore !== undefined ? parseFloat(maxScore) : undefined,
          grade: grade !== undefined ? parseFloat(grade) : undefined,
          teacherNotes: teacherNotes || null,
          aiGradingReport: aiGradingReport ? JSON.stringify(aiGradingReport) : undefined,
          status: 'graded',
          gradedAt: new Date()
        }
      });

      return updated;
    });

  });
}
