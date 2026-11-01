import { PrismaClient } from '@prisma/client';

export interface CareSupportHotline {
  name: string;
  phone?: string;
  chatUrl?: string;
  description: string;
  isPrimary?: boolean;
  isSchool?: boolean;
}

export interface CareSupportData {
  mode: 'crisis' | 'info';
  title: string;
  subtitle: string;
  hotlines: CareSupportHotline[];
}

export interface SafetyCheckResult {
  isCrisis: boolean;
  isInformationalMatch: boolean;
  category?: 'suicide_risk' | 'self_harm' | 'acute_distress' | 'informational';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  escalationLevel?: 1 | 2 | 3; // 1 = Info/Laag, 2 = Persoonlijke lijdensdruk, 3 = Acute crisis
  matchedKeywords?: string[];
  systemIntervention?: string;
  appendSupportBanner?: string;
}

// ── Indicatoren voor 1e persoon / Persoonlijke lijdensdruk ──
const FIRST_PERSON_PRONOUNS = ['ik', 'me', 'mij', 'mijn', "m'n", 'mezelf'];

// ── Woorden die wijzen op biologische, historische of informatieve context ──
const ACADEMIC_SUBJECTS = [
  'zwaan', 'zwanen', 'dier', 'dieren', 'hond', 'honden', 'kat', 'katten',
  'walvis', 'walvissen', 'dolfijn', 'dolfijnen', 'lemming', 'lemmingen',
  'paard', 'paarden', 'vogel', 'vogels', 'insect', 'insecten', 'schorpioen', 'schorpioenen',
  'aap', 'apen', 'chimpansee', 'biologie', 'dierenrijk',
  'romeo', 'julia', 'seneca', 'hitler', 'cleopatra', 'socrates', 'werther',
  'anna karenina', 'seppuku', 'kamikaze', 'harakiri', 'geschiedenis',
  'mythologie', 'oudheid', 'romeinen', 'grieken', 'middeleeuwen', 'oorlog',
  'statistiek', 'statistieken', 'definitie', 'cijfers', 'wetgeving', 'strafbaar',
  'waarom pleegde', 'waarom deden', 'waarom plegen dieren', 'waarom plegen zwanen'
];

// ── Regex patronen voor Huiselijk geweld / Kindermishandeling / Onveilig thuis ──
const ABUSE_PATTERNS: RegExp[] = [
  /(?:word|wordt|ben)\s+(?:thuis\s+)?(?:geslagen|mishandeld|misbruikt|geschopt|uitgescholden)/i,
  /thuis\s+(?:word|wordt|ben)\s+(?:ik\s+)?(?:geslagen|mishandeld|misbruikt|geschopt)/i,
  /(?:thuis|ouders)\s+(?:slaan|slaat|mishandelen|mishandelt)/i,
  /(?:vader|moeder|stiefvader|stiefmoeder|ouders|verzorger|opa|oom|broer)\s+(?:slaat|schopt|mishandelt|misbruikt|doet\s+me\s+pijn)/i,
  /(?:iemand|hij|zij)\s+(?:doet|doen)\s+(?:me|mij)\s+pijn\s+thuis/i,
  /doodsbang\s+thuis/i,
  /onveilig\s+thuis/i,
  /thuis\s+is\s+het\s+onveilig/i,
  /huiselijk\s+geweld/i,
  /kindermishandeling/i,
  /(?:word|wordt)\s+seksueel\s+misbruikt/i,
  /ongewenst\s+aangeraakt/i,
  /iemand\s+raakt\s+me\s+aan\s+waar\s+het\s+niet\s+mag/i,
  /thuis\s+geslagen/i
];

// ── Regex patronen voor Acute Zelfmoordgedachten & Wanhoop ──
const SUICIDE_INTENT_PATTERNS: RegExp[] = [
  /ik\s+wil\s+(?:niet\s+meer\s+leven|dood|sterven|verdwijnen|er\s+een\s+einde\s+aan\s+maken)/i,
  /geen\s+zin\s+meer\s+in\s+het\s+leven/i,
  /zie\s+het\s+leven\s+niet\s+meer\s+zitten/i,
  /kan\s+niet\s+meer\s+verder/i,
  /beter\s+af\s+zonder\s+mij/i,
  /einde\s+aan\s+m(?:ijn)?\s+leven/i,
  /uit\s+het\s+leven\s+stappen/i,
  /(?:van\s+de\s+brug|voor\s+de\s+trein)\s+springen/i,
  /(?:nooit|niet)\s+meer\s+wakker\s+worden/i,
  /pil(?:len)?\s+(?:innemen|slikken)\s+om\s+te\s+sterven/i,
  /pil(?:len)?\s+(?:innemen|slikken)\s+om\s+dood\s+te\s+gaan/i,
  /ik\s+ga\s+mezelf\s+van\s+kant\s+maken/i,
  /ik\s+denk\s+aan\s+zelfmoord/i,
  /ik\s+overweeg\s+zelfmoord/i,
  /ik\s+ga\s+zelfmoord\s+plegen/i,
  /wil\s+zelfmoord\s+plegen/i,
  /hoe\s+(?:kan\s+ik|pleeg\s+ik|pleeg\s+je|moet\s+ik)\s+zelfmoord/i,
  /pijnloos\s+(?:doodgaan|sterven)/i,
  /beste\s+manier\s+om\s+zelfmoord/i,
  /hoeveel\s+pillen\s+om\s+dood/i,
  /hoe\s+hang\s+je\s+jezelf\s+op/i,
  /hoe\s+maak\s+ik\s+een\s+strop/i
];

// ── Regex patronen voor Zelfbeschadiging ──
const SELF_HARM_PATTERNS: RegExp[] = [
  /(?:snij|snijd|krassen|kras|verbrand|verbranden)\s+(?:in\s+)?(?:mezelf|m(?:ijn)?\s+(?:arm|armen|benen|lichaam))/i,
  /(?:mezelf|m(?:ijn)?\s+(?:arm|armen|benen))\s+(?:snijden|krassen|verbranden|beschadigen|pijn\s+doen)/i,
  /(?:doe|doet)\s+mezelf\s+pijn/i,
  /automutilatie/i,
  /(?:verwond|verwonden)\s+mezelf/i
];

// ── Algemene suïcide-termen (kan informatief óf persoonlijk zijn) ──
const GENERAL_SUICIDE_TERMS = [
  'zelfmoord',
  'suicide',
  'suïcide',
  'zelfdoding',
  'levensbeëindiging'
];

/**
 * Genereer het gestructureerde :::care_support { JSON } ::: block
 */
export function buildCareSupportBlock(
  mode: 'crisis' | 'info',
  options?: {
    category?: 'suicide_risk' | 'self_harm' | 'acute_distress' | 'informational';
    title?: string;
    subtitle?: string;
  }
): string {
  const isCrisis = mode === 'crisis';
  const category = options?.category || (isCrisis ? 'suicide_risk' : 'informational');

  // Specifieke kaarten per categorie:
  if (category === 'acute_distress') {
    const data: CareSupportData = {
      mode: 'crisis',
      title: options?.title || 'Je staat er niet alleen voor — Zoek veilige hulp',
      subtitle: options?.subtitle || 'Niemand mag jou thuis pijn doen, slaan of onveilig laten voelen. Wat er gebeurt is NIET jouw schuld. Er zijn officiële organisaties die je direct en gratis helpen en beschermen.',
      hotlines: [
        {
          name: 'Veilig Thuis',
          phone: '0800-2000',
          chatUrl: 'https://www.veiligthuis.nl',
          description: 'Dag en nacht 24/7 gratis en anoniem advies en hulp bij huiselijk geweld of onveilige thuissituaties.',
          isPrimary: true
        },
        {
          name: 'De Kindertelefoon',
          phone: '0800-0432',
          chatUrl: 'https://www.kindertelefoon.nl',
          description: 'Voor alle jongeren tot 18 jaar. Je kunt gratis en anoniem praten over problemen thuis (elke dag 11:00 - 21:00).',
          isPrimary: false
        },
        {
          name: 'Direct gevaar? Bel 112',
          phone: '112',
          description: 'Als je nu in direct gevaar bent, bel dan direct het alarmnummer 112 van de politie.',
          isPrimary: false
        },
        {
          name: 'Vertrouwenspersoon op jouw school',
          description: 'Stap naar je mentor, vertrouwenspersoon of een docent op school. Scholen zijn wettelijk verplicht je te beschermen en te helpen via een veilige meldcode.',
          isSchool: true
        }
      ]
    };
    return `:::care_support\n${JSON.stringify(data, null, 2)}\n:::`;
  }

  // Zelfmoord / Zelfbeschadiging / Algemeen
  const data: CareSupportData = {
    mode,
    title: options?.title || (isCrisis ? 'We zijn er voor je — Praat erover' : 'Hulp & Ondersteuning — Altijd Bereikbaar'),
    subtitle: options?.subtitle || (
      isCrisis
        ? 'Het klinkt alsof je door een hele zware periode gaat. Je staat er niet alleen voor. Er zijn altijd mensen die anoniem en zonder oordeel naar je willen luisteren.'
        : 'Heb jij of iemand in je omgeving te maken met moeilijke gevoelens of donkere gedachten? Er zijn altijd deskundige mensen die gratis en anoniem naar je luisteren.'
    ),
    hotlines: [
      {
        name: '113 Zelfmoordpreventie',
        phone: '0800-0113',
        chatUrl: 'https://www.113.nl',
        description: 'Dag en nacht 24/7 gratis & anoniem bellen of chatten via 113.nl.',
        isPrimary: true
      },
      {
        name: 'De Kindertelefoon',
        phone: '0800-0432',
        chatUrl: 'https://www.kindertelefoon.nl',
        description: 'Voor jongeren tot 18 jaar. Elke dag gratis en vertrouwelijk bellen of chatten (11:00 - 21:00).',
        isPrimary: false
      },
      {
        name: 'Alles Oké? Supportlijn',
        phone: '0800-0450',
        chatUrl: 'https://www.allesoke.nl',
        description: 'Voor jongvolwassenen van 18 t/m 24 jaar. Dagelijks tussen 14:00 en 22:00 bereikbaar.',
        isPrimary: false
      },
      {
        name: 'Vertrouwenspersoon op jouw school',
        description: 'Je kunt altijd terecht bij de zorgcoördinator, mentor of vertrouwenspersoon op school voor een discreet en veilig gesprek.',
        isSchool: true
      }
    ]
  };

  return `:::care_support\n${JSON.stringify(data, null, 2)}\n:::`;
}

/**
 * Analyseer een bericht op veiligheid en context.
 * Voorkomt false positives bij academische vragen (zoals "waarom plegen zwanen zelfmoord"),
 * maar grijpt direct en deterministisch in bij huiselijk geweld of persoonlijke crisis.
 */
export function analyzeMessageSafety(content: string): SafetyCheckResult {
  if (!content || typeof content !== 'string') {
    return { isCrisis: false, isInformationalMatch: false };
  }

  const normalized = content.toLowerCase();

  // 1. Check op Huiselijk geweld / Kindermishandeling / Onveilig thuis (CRISIS)
  for (const pattern of ABUSE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isCrisis: true,
        isInformationalMatch: false,
        category: 'acute_distress',
        severity: 'high',
        escalationLevel: 3,
        matchedKeywords: [pattern.source],
        systemIntervention: buildCareSupportBlock('crisis', { category: 'acute_distress' })
      };
    }
  }

  // 2. Check op Zelfbeschadiging (CRISIS)
  for (const pattern of SELF_HARM_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isCrisis: true,
        isInformationalMatch: false,
        category: 'self_harm',
        severity: 'high',
        escalationLevel: 3,
        matchedKeywords: [pattern.source],
        systemIntervention: buildCareSupportBlock('crisis', {
          category: 'self_harm',
          title: 'We maken ons zorgen om je — Zoek steun',
          subtitle: 'Jezelf pijn doen is vaak een reactie op emoties die te zwaar voelen om alleen te dragen. Praat erover met iemand die luistert zonder oordeel.'
        })
      };
    }
  }

  // 3. Check op Acute Zelfmoordgedachten & Wanhoop (CRISIS)
  for (const pattern of SUICIDE_INTENT_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isCrisis: true,
        isInformationalMatch: false,
        category: 'suicide_risk',
        severity: 'critical',
        escalationLevel: 3,
        matchedKeywords: [pattern.source],
        systemIntervention: buildCareSupportBlock('crisis', { category: 'suicide_risk' })
      };
    }
  }

  // 4. Check op algemene suïcide-termen (bijv. "zelfmoord", "suicide", "zelfdoding")
  const matchedGeneralTerms = GENERAL_SUICIDE_TERMS.filter(t => normalized.includes(t));
  if (matchedGeneralTerms.length > 0) {
    // Bevat het academische / biologische / historische termen? (Bijv. "waarom plegen zwanen zelfmoord")
    const isAcademic = ACADEMIC_SUBJECTS.some(sub => normalized.includes(sub));
    
    // Bevat het eerste-persoons voornaamwoorden? ("ik", "mij", "mijn", etc.)
    const words = normalized.split(/[\s,?.!;:()]+/);
    const hasFirstPerson = words.some(w => FIRST_PERSON_PRONOUNS.includes(w));

    // Als er wél eerste persoon is en géén duidelijke puur academische context:
    if (hasFirstPerson && !isAcademic) {
      return {
        isCrisis: true,
        isInformationalMatch: false,
        category: 'suicide_risk',
        severity: 'high',
        escalationLevel: 2,
        matchedKeywords: matchedGeneralTerms,
        systemIntervention: buildCareSupportBlock('crisis', { category: 'suicide_risk' })
      };
    }

    // In alle andere gevallen (bijv. "waarom plegen zwanen zelfmoord", "geschiedenis van zelfdoding", "plegen dieren zelfmoord"):
    // -> GEEF HET NORMALE AI-ANTWOORD!
    // -> MAAR VOEG EEN COMPACTE 113 VANGNET-CARD TOE ONDERAAN VOOR DE VEILIGHEID!
    return {
      isCrisis: false,
      isInformationalMatch: true,
      category: 'informational',
      severity: 'low',
      escalationLevel: 1,
      matchedKeywords: matchedGeneralTerms,
      appendSupportBanner: buildCareSupportBlock('info')
    };
  }

  return { isCrisis: false, isInformationalMatch: false };
}

export async function recordStudentCareFlag(
  prisma: PrismaClient,
  params: {
    orgId: string;
    userId: string;
    conversationId?: string;
    category: string;
    severity: string;
    escalationLevel?: number;
    snippet?: string;
  }
) {
  try {
    const escLevel = params.escalationLevel ?? 2;
    let initialGuide: string | undefined = undefined;

    if (escLevel === 3) {
      initialGuide = `### 📋 Vertrouwelijke Gespreksleidraad (Niveau 3 - Acuut)\n\n` +
        `**Status:** Directe opvolging gewenst.\n\n` +
        `**Pedagogisch advies:**\n` +
        `1. Ga niet direct de confrontatie aan over AI-chats, maar nodig de leerling uit voor een rustig 1-op-1 mentorgesprek.\n` +
        `2. Vraag open: *"Hoe zit je deze week in je vel op school en thuis?"*\n` +
        `3. Luister zonder oordeel, erken de emoties en raadpleeg direct de zorgcoördinator of het ondersteuningsteam.`;
    }

    return await prisma.studentCareFlag.create({
      data: {
        orgId: params.orgId,
        userId: params.userId,
        conversationId: params.conversationId,
        category: params.category,
        severity: params.severity,
        escalationLevel: escLevel,
        conversationGuide: initialGuide,
        snippet: params.snippet ? params.snippet.slice(0, 500) : null,
        status: 'open'
      }
    });
  } catch (e) {
    console.error('Failed to create student care flag:', e);
    return null;
  }
}

// ── Anti-Cyberpesten & Toxisch Groepsgedrag Sentinel ──
const BULLYING_EXCLUSION_PATTERNS = [
  /niemand\s+(?:mag|wil)\s+jou/i,
  /rot\s+(?:eens\s+)?op\s+uit\s+(?:deze\s+|onze\s+)?groep/i,
  /je\s+hoort\s+er\s+niet\s+bij/i,
  /we\s+willen\s+jou\s+(?:hier\s+)?niet/i,
  /praat\s+niet\s+tegen\s+ons/i,
  /jij\s+bent\s+niet\s+welkom/i,
  /iedereen\s+haat\s+jou/i
];

const BULLYING_INTIMIDATION_PATTERNS = [
  /(?:ik|we)\s+sla(?:an)?\s+je\s+(?:in\s+elkaar|kapot|rot)/i,
  /(?:ik|we)\s+pak(?:ken)?\s+je\s+(?:wel\s+)?(?:na\s+school|morgen)/i,
  /wacht\s+maar\s+(?:tot\s+)?(?:morgen|straks)/i,
  /(?:ik|we)\s+sloop\s+je/i,
  /maak\s+je\s+dood/i,
  /val\s+dood/i
];

const BULLYING_INSULT_PATTERNS = [
  /\b(kankerlijer|teringlijer|teringdebiel|kankerhoer|kankerhond)\b/i,
  /\b(vuile\s+dikzak|lelijke\s+kop|waardeloze\s+hond)\b/i
];

export interface BullyingCheckResult {
  isBlocked: boolean;
  toxicityType?: 'exclusion' | 'intimidation' | 'insult' | 'slur';
  severityScore?: number;
  reason?: string;
  reflectionPrompt?: string;
}

export async function checkBullyingOrToxicity(
  prisma: PrismaClient,
  params: {
    text: string;
    senderId: string;
    orgId: string;
    classId?: string;
    conversationId?: string;
  }
): Promise<BullyingCheckResult> {
  const text = params.text.trim();
  if (!text) return { isBlocked: false };

  let toxicityType: 'exclusion' | 'intimidation' | 'insult' | 'slur' | null = null;
  let severityScore = 0.0;
  let reason = '';

  for (const pattern of BULLYING_INTIMIDATION_PATTERNS) {
    if (pattern.test(text)) {
      toxicityType = 'intimidation';
      severityScore = 0.95;
      reason = 'Bedreiging of fysieke intimidatie gesignaleerd';
      break;
    }
  }

  if (!toxicityType) {
    for (const pattern of BULLYING_INSULT_PATTERNS) {
      if (pattern.test(text)) {
        toxicityType = 'insult';
        severityScore = 0.85;
        reason = 'Zwaar beledigende of kwetsende taal gesignaleerd';
        break;
      }
    }
  }

  if (!toxicityType) {
    for (const pattern of BULLYING_EXCLUSION_PATTERNS) {
      if (pattern.test(text)) {
        toxicityType = 'exclusion';
        severityScore = 0.75;
        reason = 'Buitensluiten of uitsluiting van klasgenoot gesignaleerd';
        break;
      }
    }
  }

  if (toxicityType) {
    // Bewaar incident in de database
    try {
      await prisma.bullyingIncident.create({
        data: {
          orgId: params.orgId,
          senderId: params.senderId,
          classId: params.classId,
          conversationId: params.conversationId,
          messageSnippet: text.slice(0, 200),
          toxicityType,
          severityScore,
          wasBlocked: true
        }
      });
    } catch (err) {
      console.error('Failed to log bullying incident:', err);
    }

    return {
      isBlocked: true,
      toxicityType,
      severityScore,
      reason,
      reflectionPrompt:
        'Denk even na: hoe komt dit bericht over op je klasgenoot? ' +
        'Binnen Locra behandelen we elkaar met respect. ' +
        'Pas je formulering aan voordat je het bericht verstuurt.'
    };
  }

  return { isBlocked: false };
}
