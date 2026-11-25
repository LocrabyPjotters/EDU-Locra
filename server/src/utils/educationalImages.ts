/**
 * Educational Image Catalog & Resolver voor Locra Live.
 * Combineert live Wikipedia/Wikimedia Commons zoekopdrachten met een gecureerde
 * offline catalogus van rechtenvrije, schoolveilige onderwijsafbeeldingen.
 */

export interface ImageEntry {
  keywords: string[];
  url: string;
  alt: string;
  caption?: string;
}

const CURRICULUM_IMAGE_CATALOG: ImageEntry[] = [
  // ── GESCHIEDENIS ──
  {
    keywords: ['bastille', '14 juli', 'parijs', 'bestorming'],
    url: 'https://images.unsplash.com/photo-1549144511-f099e773c147?auto=format&fit=crop&w=1200&q=80',
    alt: 'Parijs — Franse Revolutie',
    caption: 'Parijs tijdens de revolutionaire gebeurtenissen'
  },
  {
    keywords: ['frans', 'revolutie', 'lodewijk', 'standen', 'versailles', 'absolutisme'],
    url: 'https://images.unsplash.com/photo-1551887373-6edba6dacbb1?auto=format&fit=crop&w=1200&q=80',
    alt: 'Kasteel van Versailles en Franse geschiedenis',
    caption: 'Het koninklijke hof en de standenmaatschappij in Frankrijk'
  },
  {
    keywords: ['robespierre', 'terreur', 'guillotine', 'grondwet', 'rechten van de mens'],
    url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80',
    alt: 'Rechtspraak, grondwet en burgerrechten',
    caption: 'Van absolutisme naar rechtsstaat en mensenrechten'
  },
  {
    keywords: ['romein', 'rome', 'caesar', 'colosseum', 'legioen', 'aquaduct', 'gladiator', 'oudheid'],
    url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80',
    alt: 'Colosseum in Rome',
    caption: 'Het Romeinse Rijk en de klassieke bouwkunst'
  },
  {
    keywords: ['griek', 'athene', 'filosof', 'parthenon', 'sparta', 'democratie', 'mythologie'],
    url: 'https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=1200&q=80',
    alt: 'Parthenon op de Akropolis in Athene',
    caption: 'Het oude Griekenland: geboorteplaats van filosofie en democratie'
  },
  {
    keywords: ['middeleeuw', 'kasteel', 'ridder', 'monnik', 'klooster', 'leenstelsel', 'horige'],
    url: 'https://images.unsplash.com/photo-1585543805890-6051f7829f98?auto=format&fit=crop&w=1200&q=80',
    alt: 'Middeleeuws Kasteel',
    caption: 'Tijd van ridders, kloosters en het feodale stelsel'
  },
  {
    keywords: ['gouden eeuw', 'voc', 'rembrandt', 'amsterdam', 'grachtengordel', 'specerij', '17e eeuw'],
    url: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=1200&q=80',
    alt: 'Historische Hollandse Grachten',
    caption: 'De Nederlandse Republiek en internationale handel in de 17e eeuw'
  },
  {
    keywords: ['industrie', 'stoom', 'fabriek', 'spoorlijn', 'stoommachine', 'kinderarbeid'],
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80',
    alt: 'Industriële Revolutie en Technologie',
    caption: 'Mechanisatie en de opkomst van de fabrieksindustrie'
  },
  {
    keywords: ['wo1', 'wereldoorlog 1', 'loopgraaf', 'sarajevo', 'somme', 'verdun', '1914'],
    url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
    alt: 'Herdenking Eerste Wereldoorlog',
    caption: 'De Grote Oorlog (1914-1918)'
  },
  {
    keywords: ['wo2', 'wereldoorlog 2', 'bezetting', 'd-day', 'holocaust', 'anne frank', 'bevrijding', '1940', '1945'],
    url: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=80',
    alt: 'Historisch archief Tweede Wereldoorlog',
    caption: 'De Tweede Wereldoorlog (1939-1945) en de weg naar vrijheid'
  },
  {
    keywords: ['koude oorlog', 'berlijn', 'muur', 'sovjet', 'amerika', 'ijzeren gordijn', 'kernwapen', 'cuba'],
    url: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=1200&q=80',
    alt: 'Berlijn en de Koude Oorlog',
    caption: 'Verdeeldheid tussen Oost en West tijdens de Koude Oorlog'
  },

  // ── BIOLOGIE ──
  {
    keywords: ['foto', 'synthese', 'blad', 'chloroplast', 'plant', 'bladgroen', 'glucose', 'zonlicht'],
    url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1200&q=80',
    alt: 'Groen blad met zonlicht',
    caption: 'Fotosynthese: omzetting van zonlicht in glucose en zuurstof'
  },
  {
    keywords: ['cel', 'microscop', 'celkern', 'organel', 'mitochondri', 'vacuole', 'membraan', 'enzym'],
    url: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=1200&q=80',
    alt: 'Cellen en organellen onder de microscoop',
    caption: 'Celbiologie en microscopische structuren'
  },
  {
    keywords: ['dna', 'gen', 'genetica', 'chromosoom', 'erfelijk', 'mutatie', 'helix', 'mendel'],
    url: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=1200&q=80',
    alt: 'DNA-structuur en genetisch onderzoek',
    caption: 'Genetica: erfelijkheid en de opbouw van DNA'
  },
  {
    keywords: ['hart', 'bloed', 'bloedsomloop', 'ader', 'slagader', 'long', 'orgaan', 'lichaam'],
    url: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=1200&q=80',
    alt: 'Menselijke anatomie en fysiologie',
    caption: 'Bloedsomloop, longen en vitale organen'
  },
  {
    keywords: ['brein', 'hersen', 'zenuw', 'neuron', 'gedrag', 'geheugen', 'psychologie'],
    url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=1200&q=80',
    alt: 'Menselijk brein en zenuwnetwerken',
    caption: 'Werking van het zenuwstelsel en neuronen'
  },
  {
    keywords: ['ecologie', 'ecosysteem', 'voedselweb', 'biodiversiteit', 'dier', 'bos', 'symbiose', 'kas'],
    url: 'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=1200&q=80',
    alt: 'Ecosysteem en plantenwereld',
    caption: 'Relaties tussen organismen, licht, water en leefomgeving'
  },

  // ── AARDRIJKSKUNDE ──
  {
    keywords: ['vulkaan', 'eruptie', 'lava', 'magma', 'krater', 'etna', 'vesuvius'],
    url: 'https://images.unsplash.com/photo-1508873696983-2df57036476b?auto=format&fit=crop&w=1200&q=80',
    alt: 'Actieve vulkaan en lava',
    caption: 'Vulkanisme: opstijgend magma en krateruitbarstingen'
  },
  {
    keywords: ['aardbeving', 'plaat', 'tektoniek', 'aardkorst', 'breuklijn', 'tsunami', 'subductie'],
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    alt: 'De aarde vanuit de ruimte',
    caption: 'Platentektoniek: aardkorstplaten en breukzones'
  },
  {
    keywords: ['klimaat', 'opwarming', 'broeikas', 'ijskap', 'co2', 'duurzaam', 'temperatuur', 'weer'],
    url: 'https://images.unsplash.com/photo-1569163139599-0f4517e36f51?auto=format&fit=crop&w=1200&q=80',
    alt: 'Klimaat en smeltende gletsjers',
    caption: 'Klimaatverandering, broeikaseffect en zeespiegelstijging'
  },
  {
    keywords: ['rivier', 'water', 'dijk', 'delta', 'overstroming', 'duin', 'zee', 'watermanagement'],
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    alt: 'Kustlijn en waterbeheer',
    caption: 'Rivierdelta’s, kustbescherming en waterbeheer'
  },
  {
    keywords: ['stad', 'verstedelijking', 'metropool', 'infrastructuur', 'bevolking', 'migratie'],
    url: 'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?auto=format&fit=crop&w=1200&q=80',
    alt: 'Verstedelijking en wereldsteden',
    caption: 'Sociale geografie: megasteden en ruimtelijke inrichting'
  },

  // ── NATUURKUNDE & SCHEIKUNDE ──
  {
    keywords: ['atoom', 'molecuul', 'elektron', 'proton', 'kern', 'scheikunde', 'reactie', 'periodiek'],
    url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
    alt: 'Laboratorium en scheikundige reacties',
    caption: 'Stofeigenschappen, moleculen en chemische reacties'
  },
  {
    keywords: ['elektriciteit', 'stroom', 'spanning', 'circuit', 'magnetisme', 'weerstand', 'batterij'],
    url: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&w=1200&q=80',
    alt: 'Elektrische schakelingen en energie',
    caption: 'Elektriciteitsleer: spanning, stroomsterkte en vermogen'
  },
  {
    keywords: ['ruimte', 'planeet', 'zwaartekracht', 'sterren', 'universum', 'telescoop', 'zon', 'maan'],
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1200&q=80',
    alt: 'Sterrennevel in het heelal',
    caption: 'Astronomie, zwaartekracht en het zonnestelsel'
  },
  {
    keywords: ['kracht', 'beweging', 'newton', 'versnelling', 'massa', 'hefboom', 'energie'],
    url: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=1200&q=80',
    alt: 'Natuurkundige experimenten',
    caption: 'Mechanica, krachten en energietransformaties'
  },

  // ── WISKUNDE & ECONOMIE ──
  {
    keywords: ['wiskunde', 'formule', 'pythagoras', 'driehoek', 'geometrie', 'grafiek', 'lineair', 'functie'],
    url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
    alt: 'Wiskundige berekeningen en grafieken',
    caption: 'Algebra, lineaire verbanden en meetkunde'
  },
  {
    keywords: ['assenstelsel', 'helling', 'snijpunt', 'vergelijking', 'bereken'],
    url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1200&q=80',
    alt: 'Wiskundige notaties',
    caption: 'Functieanalyse en grafische weergaven'
  },
  {
    keywords: ['economie', 'geld', 'inflatie', 'beurs', 'markt', 'vraag', 'aanbod', 'prijs', 'handel'],
    url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    alt: 'Economische grafieken en marktwerking',
    caption: 'Marktevenwicht, inflatie en macro-economie'
  },

  // ── NEDERLANDS & TALEN ──
  {
    keywords: ['nederlands', 'literatuur', 'boek', 'gedicht', 'argumentatie', 'schrijven', 'betoog', 'taal'],
    url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80',
    alt: 'Boeken en literatuurstudie',
    caption: 'Taalvaardigheid, argumentatieleer en literatuurgeschiedenis'
  }
];

const GENERAL_FALLBACK_POOL: ImageEntry[] = [
  {
    keywords: [],
    url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80',
    alt: 'Studieboeken en onderwijs',
    caption: 'Klassikale instructie en leerstof'
  },
  {
    keywords: [],
    url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80',
    alt: 'Leren en wetenschap',
    caption: 'Interactieve verdieping en kennisdeling'
  },
  {
    keywords: [],
    url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
    alt: 'Aantekeningen en studeren',
    caption: 'Begrippen, samenvattingen en verwerking'
  },
  {
    keywords: [],
    url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    alt: 'Samenwerkend leren in de klas',
    caption: 'Klassikale discussie en samenwerking'
  }
];

const SUBJECT_FALLBACK_IMAGES: Record<string, ImageEntry[]> = {
  geschiedenis: [
    {
      keywords: ['geschiedenis'],
      url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1200&q=80',
      alt: 'Historische bronnen en kaarten',
      caption: 'Historisch bronnenonderzoek'
    },
    {
      keywords: ['geschiedenis'],
      url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=80',
      alt: 'Historische archieven en literatuur',
      caption: 'Geschiedkundige context'
    }
  ],
  biologie: [
    {
      keywords: ['biologie'],
      url: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=1200&q=80',
      alt: 'Biologische structuren',
      caption: 'Levende natuur, cellen en organismen'
    },
    {
      keywords: ['biologie'],
      url: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=1200&q=80',
      alt: 'Biologisch laboratoriumonderzoek',
      caption: 'Onderzoek naar biologische processen'
    }
  ],
  aardrijkskunde: [
    {
      keywords: ['aardrijkskunde'],
      url: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1200&q=80',
      alt: 'Wereldkaart en geografie',
      caption: 'Fysische en sociale geografie'
    },
    {
      keywords: ['aardrijkskunde'],
      url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
      alt: 'Gebergte en landschappen',
      caption: 'Landschapsvorming en natuurlijke systemen'
    }
  ],
  natuurkunde: [
    {
      keywords: ['natuurkunde'],
      url: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=1200&q=80',
      alt: 'Natuurkundige experimenten',
      caption: 'Natuurwetenschappelijke wetmatigheden'
    }
  ],
  scheikunde: [
    {
      keywords: ['scheikunde'],
      url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
      alt: 'Chemische reacties in laboratorium',
      caption: 'Stoffen, reacties en moleculaire eigenschappen'
    }
  ],
  wiskunde: [
    {
      keywords: ['wiskunde'],
      url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1200&q=80',
      alt: 'Wiskundige formules',
      caption: 'Wiskundige logica en probleemoplossend denken'
    },
    {
      keywords: ['wiskunde'],
      url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
      alt: 'Geometrie en wiskunde',
      caption: 'Meetkunde en algebra'
    }
  ],
  economie: [
    {
      keywords: ['economie'],
      url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80',
      alt: 'Economische cijfers en analyse',
      caption: 'Economische trends en marktanalyse'
    }
  ],
  nederlands: [
    {
      keywords: ['nederlands'],
      url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80',
      alt: 'Boeken en taalstudie',
      caption: 'Taal, tekstbegrip en literatuur'
    }
  ]
};

const WIKI_SKIP_PATTERNS = [
  'ambox', 'commons-logo', 'padlock', 'flag_of', 'disambig', 'question_book',
  'symbol_', 'folder', 'edit-clear', 'crystal_clear', 'icon', 'stub', 'nuvola',
  'gnome-', 'wiki_letter', 'merge', 'split', 'redirect'
];

function isValidEducationalWikiImage(url: string): boolean {
  if (!url || !url.startsWith('https://')) return false;
  const lower = url.toLowerCase();
  if (WIKI_SKIP_PATTERNS.some(pat => lower.includes(pat))) return false;
  // Sta gangbare foto's en schone PNG/WEBP/JPG diagrammen toe (skip ruwe .svg meta-icoontjes)
  return /\.(jpg|jpeg|png|webp)(\?|$)/i.test(lower);
}

/**
 * Zoekt live een authentieke didactische afbeelding of illustratie via Wikipedia MediaWiki API.
 */
async function searchWikipediaImage(
  query: string,
  lang: 'nl' | 'en' = 'nl',
  excludeUrls: string[] = []
): Promise<{ url: string; caption?: string } | null> {
  const cleaned = (query || '')
    .replace(/\*\*/g, '')
    .replace(/[#>*_`[\]()]/g, ' ')
    .replace(/\b(theorie|vraag|stelling|introductie|uitleg|begripstoets|opdracht|over|voor|van|een|het|de|met|bij|en)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  if (cleaned.length < 3) return null;

  const endpoint = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    cleaned
  )}&gsrlimit=6&prop=pageimages|extracts&exintro=1&explaintext=1&exsentences=1&piprop=thumbnail&pithumbsize=1200&format=json&origin=*`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'LocraEducationApp/2.0 (Educational Slide Builder)'
      }
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const pages = data?.query?.pages ? Object.values(data.query.pages) as any[] : [];
    // Sorteer op zoekrelevantie (index)
    pages.sort((a, b) => (a.index || 999) - (b.index || 999));

    for (const p of pages) {
      const thumbUrl = p?.thumbnail?.source;
      if (thumbUrl && isValidEducationalWikiImage(thumbUrl) && !excludeUrls.includes(thumbUrl)) {
        return {
          url: thumbUrl,
          caption: p.title ? `${p.title} (Bron: Wikipedia)` : undefined
        };
      }
    }
  } catch (_) {
    // Netwerk uit of timeout -> stil terugvallen op lokale gecureerde catalogus
  }
  return null;
}

/**
 * Snelle synchrone fallback-oplossing uit onze gecureerde curriculumcatalogus.
 */
export function resolveEducationalImage(
  queryText: string,
  subject?: string,
  topic?: string,
  excludeUrls: string[] = []
): { url: string; caption?: string } {
  const combined = `${queryText || ''} ${topic || ''} ${subject || ''}`.toLowerCase();

  // 1. Zoek eerst op specifieke trefwoorden (prefer niet eerder gebruikte URL)
  const matchingEntries: { entry: ImageEntry; score: number }[] = [];
  for (const entry of CURRICULUM_IMAGE_CATALOG) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (combined.includes(kw)) score += 1;
    }
    if (score > 0) {
      matchingEntries.push({ entry, score });
    }
  }
  matchingEntries.sort((a, b) => b.score - a.score);

  const unusedMatch = matchingEntries.find(m => !excludeUrls.includes(m.entry.url));
  if (unusedMatch) {
    return { url: unusedMatch.entry.url, caption: unusedMatch.entry.caption };
  }

  // 2. Zoek in de vak-specifieke fallbacks (probeer een ongebruikte afbeelding)
  const normSubject = (subject || '').toLowerCase().trim();
  for (const [subjKey, entries] of Object.entries(SUBJECT_FALLBACK_IMAGES)) {
    if (normSubject.includes(subjKey)) {
      const unusedSubj = entries.find(e => !excludeUrls.includes(e.url));
      if (unusedSubj) {
        return { url: unusedSubj.url, caption: unusedSubj.caption };
      }
    }
  }

  // 3. Als er wél een match was maar hij was al gebruikt, en er geen andere is: hergebruik pas in tweede instantie
  if (matchingEntries.length > 0 && excludeUrls.length < 2) {
    return { url: matchingEntries[0].entry.url, caption: matchingEntries[0].entry.caption };
  }

  // 4. Algemene didactische pool (zoveel mogelijk variëren)
  const unusedPool = GENERAL_FALLBACK_POOL.find(e => !excludeUrls.includes(e.url)) || GENERAL_FALLBACK_POOL[0];
  return {
    url: unusedPool.url,
    caption: unusedPool.caption
  };
}

/**
 * Intelligente asynchrone afbeeldingszoeker voor AI-lessen en 1-klik afbeeldingsuggesties.
 * Zoekt live via Wikipedia (NL & EN) naar exact passende illustraties/foto's bij de specifieke dia,
 * en valt naadloos terug op de gecureerde curriculumcatalogus indien offline of zonder resultaat.
 */
export async function findEducationalImage(
  queryText: string,
  subject?: string,
  topic?: string,
  excludeUrls: string[] = []
): Promise<{ url: string; caption?: string }> {
  // Probeer eerst NL Wikipedia op specifieke zoekterm + onderwerp
  const nlHit = await searchWikipediaImage(`${queryText} ${topic || ''}`, 'nl', excludeUrls);
  if (nlHit) return nlHit;

  // Probeer daarna EN Wikipedia (vaak meer historische/wetenschappelijke illustraties)
  const enHit = await searchWikipediaImage(queryText, 'en', excludeUrls);
  if (enHit) return enHit;

  // Val terug op gecureerde catalogus met deduplicatie
  return resolveEducationalImage(queryText, subject, topic, excludeUrls);
}
