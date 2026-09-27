export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface AcademyModule {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  icon: string;
  badge: string;
  summary: string;
  studyText: string;
  questions: QuizQuestion[];
  assignment: {
    title: string;
    goal: string;
    description: string;
    samplePrompt: string;
    rubric: string[];
  };
}

// ────────────────────────────────────────────
// MODULES – Logische volgorde van beginner → gevorderd
// 1. Wat is AI? (introductie)
// 2. Prompt Engineering & CLEAR (hoe praat je met AI)
// 3. Betrouwbaarheid & Fact-checking (kritisch denken)
// 4. AI Metrics & Evaluatie (hoe beoordeel je AI)
// 5. Modelkeuze & Trade-offs (welk AI model gebruik je)
// 6. Groen AI & Duurzaamheid (milieu-impact)
// 7. Ethiek, Bias & Deepfakes (maatschappij & verantwoordelijkheid)
// ────────────────────────────────────────────

export const ACADEMY_MODULES: AcademyModule[] = [

  // ═══════════════════════════════════════════════
  // MODULE 1 – WAT IS AI?
  // ═══════════════════════════════════════════════
  {
    id: 'wat-is-ai',
    number: 1,
    title: 'Wat is AI? — Jouw Eerste Stappen',
    shortTitle: 'Wat is AI?',
    icon: '🧠',
    badge: 'AI Basis',
    summary: "Ontdek wat Kunstmatige Intelligentie écht is, hoe het werkt, en waarom het zo belangrijk is voor jouw toekomst. Van slimme chatbots tot zelfrijdende auto's!",
    studyText: `
### 🧠 Wat is Kunstmatige Intelligentie?

Heb je je weleens afgevraagd hoe Siri, Alexa of ChatGPT weten wat je bedoelt? Dat komt door **Kunstmatige Intelligentie** (AI). AI is een technologie waarmee computers taken kunnen doen die normaal menselijk denkvermogen vereisen: taal begrijpen, problemen oplossen, patronen herkennen en zelfs creatief schrijven.

> **Belangrijk om te weten:** AI "denkt" niet écht zoals jij. Een AI leest geen boeken en begrijpt de wereld niet. Het is een extreem geavanceerde patroonherkenner die voorspelt welk woord het meest waarschijnlijk als volgende komt.

---

### 🤖 Hoe werkt een AI-chatbot eigenlijk?

Stel je voor dat je een zin begint: *"De kat zit op de..."*

Jij weet dat "mat" of "bank" logische woorden zijn om deze zin af te maken. Een AI-taalmodel (LLM) doet precies hetzelfde, maar dan op basis van **miljarden teksten** die het eerder heeft gelezen.

Het werkt in drie stappen:

| Stap | Wat er gebeurt | Voorbeeld |
|------|---------------|-----------|
| 1. **Invoer (Input)** | Jouw tekst wordt omgezet in "tokens" | "Hallo wereld" → \`[Hal] [lo] [wer] [eld]\` |
| 2. **Verwerking** | Het model berekent welke tokens het meest waarschijnlijk volgen | Kans: "mat" = 35%, "bank" = 28%, "tafel" = 15% |
| 3. **Uitvoer (Output)** | Het meest waarschijnlijke woord wordt gekozen en toegevoegd | "De kat zit op de **mat**" |

> 💡 **Weetje:** Het woord "token" kom je overal tegen in AI. Een token is een klein stukje tekst — ongeveer ¾ van een woord. Het Nederlandse woord "onderwijs" bestaat uit 2 tokens: "onder" en "wijs".

---

### 📊 Soorten AI

Niet alle AI is hetzelfde! Er zijn verschillende niveaus:

| Type | Wat het kan | Voorbeeld |
|------|-----------|-----------|
| **Smalle AI (Narrow AI)** | Eén specifieke taak heel goed doen | Spotify aanbevelingen, spam-filter |
| **Generatieve AI (GenAI)** | Nieuwe tekst, plaatjes of code maken | ChatGPT, Midjourney, Locra |
| **Algemene AI (AGI)** | Alles wat een mens kan — bestaat nog NIET | Science fiction (voor nu!) |

<!-- 📸 AFBEELDING: Infographic met de 3 soorten AI naast elkaar -->

---

### 🏫 AI op School — Waar gebruik je het al?

Je gebruikt AI misschien al vaker dan je denkt:
- **Spellingcontrole** in Word of Google Docs → AI
- **Vertalen** met Google Translate of DeepL → AI
- **Samenvattingen maken** met Locra of ChatGPT → AI
- **Aanbevelingen** op YouTube ("Bekijk ook...") → AI

> ⚠️ **Let op:** AI is een hulpmiddel, geen vervanger van je eigen denkvermogen. Je moet altijd kritisch blijven over wat AI zegt!

---

### 🔑 Vijf Kernbegrippen om te Onthouden

1. **LLM (Large Language Model)** — Het "brein" achter chatbots. Een enorm neuraal netwerk getraind op miljarden teksten.
2. **Token** — Het kleinste stukje tekst dat een AI verwerkt (± ¾ woord).
3. **Prompt** — De opdracht die JIJ aan de AI geeft.
4. **Hallucinatie** — Wanneer AI iets verzint dat niet klopt, maar het heel overtuigend opschrijft.
5. **Training** — Het proces waarbij een AI patronen leert uit miljoenen voorbeelden.

<!-- 📸 AFBEELDING: Visueel schema van een LLM: input → verwerking → output -->
`,
    questions: [
      {
        id: 101,
        question: 'Wat doet een AI-taalmodel (LLM) in de basis?',
        options: [
          'Het begrijpt tekst op dezelfde manier als een mens.',
          'Het voorspelt steeds het meest waarschijnlijke volgende woord op basis van patronen.',
          'Het zoekt antwoorden op in een database, net als Google.',
          'Het kopieert letterlijk zinnen uit boeken die het heeft gelezen.'
        ],
        correctIndex: 1,
        explanation: 'Een LLM is een patroonherkenner die op basis van miljarden teksten voorspelt welk woord het meest waarschijnlijk als volgende komt.'
      },
      {
        id: 102,
        question: 'Wat is een "token" in AI?',
        options: [
          'Een muntstuk dat je betaalt om AI te gebruiken.',
          'Een heel woord in een zin.',
          'Een klein stukje tekst, ongeveer driekwart van een woord.',
          'Een geheime code die de AI ontgrendelt.'
        ],
        correctIndex: 2,
        explanation: 'Een token is de kleinste teksteenheid die een AI verwerkt. Gemiddeld is 1 token ongeveer 0,75 woord (± 4 tekens).'
      },
      {
        id: 103,
        question: 'Welk type AI bestaat er nog NIET?',
        options: [
          'Smalle AI (Narrow AI)',
          'Generatieve AI (GenAI)',
          'Algemene Kunstmatige Intelligentie (AGI)',
          'Alle drie bestaan al'
        ],
        correctIndex: 2,
        explanation: 'AGI — een AI die alles kan wat een mens kan — bestaat nog niet. Huidige AI is altijd "smal" of "generatief" voor specifieke taken.'
      },
      {
        id: 104,
        question: 'Wat is een "hallucinatie" bij AI?',
        options: [
          'Wanneer de AI crasht en een foutmelding geeft.',
          'Wanneer de AI iets verzint dat niet klopt, maar het heel overtuigend opschrijft.',
          'Wanneer de AI droomt, net zoals mensen.',
          'Een speciaal type prompt om creatieve teksten te genereren.'
        ],
        correctIndex: 1,
        explanation: 'Een hallucinatie is wanneer een AI vol zelfvertrouwen een feit verzint — zoals een niet-bestaand boek of een verkeerde datum — en het heel overtuigend presenteert.'
      },
      {
        id: 105,
        question: 'Waarom is AI een hulpmiddel en geen vervanging voor je eigen denken?',
        options: [
          'Omdat AI altijd gelijk heeft en je er dus niets van leert.',
          'Omdat AI geen emoties heeft.',
          'Omdat AI fouten kan maken, bevooroordeeld kan zijn, en jij de verantwoordelijkheid draagt voor je eigen werk.',
          'Omdat AI te duur is om vaak te gebruiken.'
        ],
        correctIndex: 2,
        explanation: 'AI kan hallucineren, bias bevatten en de context niet begrijpen. Jij bent altijd verantwoordelijk voor het controleren en evalueren van AI-output.'
      }
    ],
    assignment: {
      title: 'Ontdek AI om Je Heen',
      goal: 'Herken waar je in het dagelijks leven al met AI te maken hebt.',
      description: 'Maak een lijst van minstens 5 apps, websites of apparaten die je dagelijks gebruikt en die AI bevatten. Beschrijf per item welk TYPE AI het is (smal, generatief) en wat de AI precies doet. Bedenk ook: wat zou er gebeuren als de AI er niet was?',
      samplePrompt: 'Geef me 3 voorbeelden van AI die ik als scholier dagelijks gebruik, met een korte uitleg van hoe de AI daarin werkt.',
      rubric: [
        'De leerling identificeert minstens 5 AI-toepassingen uit het dagelijks leven.',
        'Per toepassing is het type AI (smal/generatief) correct benoemd.',
        'De leerling reflecteert op wat er anders zou zijn zonder deze AI.'
      ]
    }
  },

  // ═══════════════════════════════════════════════
  // MODULE 2 – PROMPT ENGINEERING & CLEAR
  // ═══════════════════════════════════════════════
  {
    id: 'prompt-engineering',
    number: 2,
    title: 'Prompt Engineering & het CLEAR Framework',
    shortTitle: 'Prompting',
    icon: '✍️',
    badge: 'Prompt Meester',
    summary: 'Leer hoe je AI de allerbeste opdrachten geeft. Met het CLEAR-framework schrijf je prompts als een pro en krijg je in één keer het perfecte antwoord!',
    studyText: `
### ✍️ De Kunst van het Vragen Stellen

Heb je weleens een slechte zoekopdracht op Google getypt en totaal verkeerde resultaten gekregen? Bij AI werkt het net zo: **de kwaliteit van je vraag bepaalt de kwaliteit van het antwoord.**

Een "prompt" is de opdracht die je aan een AI geeft. En net zoals een leraar een duidelijke opdracht moet geven zodat leerlingen weten wat ze moeten doen, moet jij een duidelijke prompt schrijven zodat de AI precies doet wat jij wilt.

> 💡 **Gouden Regel:** Hoe specifieker je prompt, hoe beter het antwoord. "Vertel me over geschiedenis" geeft rommel. "Schrijf een samenvatting van 100 woorden over de oorzaken van de Tweede Wereldoorlog, geschikt voor leerlingen van klas 3 havo" geeft goud.

---

### 🧩 Het CLEAR Framework — Jouw Geheime Wapen

**CLEAR** is een methode om altijd sterke prompts te schrijven. Elke letter staat voor een belangrijk onderdeel:

| Letter | Betekenis | Voorbeeld |
|--------|-----------|-----------|
| **C** — Context | Achtergrond & situatie | "Voor een biologiepresentatie over fotosynthese, klas 2" |
| **L** — Lengte & Vorm | Hoe lang en in welk formaat | "150 woorden, 3 alinea's met bulletpoints" |
| **E** — Examples | Voorbeelden meegeven | "Gebruik een vergelijking met zonnepanelen" |
| **A** — Actief werkwoord | Wat moet de AI DOEN | "Leg uit", "Vergelijk", "Analyseer", "Vat samen" |
| **R** — Rol | Wie speelt de AI | "Je bent een enthousiaste biologiedocent" |

<!-- 📸 AFBEELDING: Het CLEAR framework als kleurrijk infographic/poster -->

---

### 🔬 Voorbeeld: Van Slechte naar Perfecte Prompt

**❌ Slechte prompt:**
> "Vertel me over fotosynthese"

**✅ CLEAR prompt:**
> **R:** Je bent een enthousiaste biologiedocent voor klas 2.
> **C:** Ik moet een presentatie geven over fotosynthese.
> **A:** Leg stapsgewijs uit hoe fotosynthese werkt.
> **L:** Gebruik maximaal 150 woorden in 3 korte alinea's.
> **E:** Geef een alledaagse vergelijking, zoals hoe een zonnepaneel werkt.

Het verschil? De slechte prompt geeft je een Wikipedia-achtig verhaal. De CLEAR prompt geeft je precies wat je nodig hebt.

---

### 🧠 Geavanceerde Prompttechnieken

Als je het CLEAR-framework onder de knie hebt, kun je nog slimmer worden:

**1. Chain-of-Thought (CoT) — "Denk stap voor stap"**
> Door te vragen "Leg je denkstappen uit" dwingt je de AI om logisch te redeneren in plaats van maar wat te gokken.

**2. Few-Shot Prompting — "Hier zijn voorbeelden"**
> Geef de AI 2-3 voorbeelden van het gewenste resultaat, en het model volgt jouw patroon.

**3. Rolgebaseerd Prompten — "Je bent een..."**
> Geef de AI een specifieke rol. "Je bent een advocaat" levert formele taal op. "Je bent een YouTuber" levert informele, leuke taal op.

<!-- 📸 AFBEELDING: Vergelijking van output met/zonder Chain-of-Thought -->

---

### ⚡ Tips & Trucs

- **Itereer:** Je eerste prompt hoeft niet perfect te zijn. Verbeter stap voor stap.
- **Wees specifiek over format:** Wil je een tabel? Bulletpoints? Een gedicht? Zeg het!
- **Geef grenzen:** "Maximaal 200 woorden" voorkomt eindeloze lappen tekst.
- **Vraag om alternatieven:** "Geef me 3 verschillende versies" laat je kiezen.
`,
    questions: [
      {
        id: 201,
        question: 'Waar staat de "C" in het CLEAR-framework voor?',
        options: [
          'Correct antwoord',
          'Context — de achtergrond en situatie van je vraag',
          'Chatbot — welke AI je gebruikt',
          'Copyright — auteursrecht'
        ],
        correctIndex: 1,
        explanation: 'De C staat voor Context: je geeft de AI achtergrondinfo zodat het antwoord past bij jouw situatie (vak, niveau, onderwerp).'
      },
      {
        id: 202,
        question: 'Wat is het grootste verschil tussen een slechte en een goede prompt?',
        options: [
          'Een goede prompt is altijd langer dan 500 woorden.',
          'Een goede prompt is specifiek, gestructureerd en geeft duidelijke instructies.',
          'Een goede prompt begint altijd met "Alsjeblieft".',
          'Er is geen verschil — AI begrijpt alles.'
        ],
        correctIndex: 1,
        explanation: 'Een goede prompt is specifiek (wat, hoe lang, voor wie), gestructureerd (CLEAR) en bevat duidelijke instructies (actief werkwoord).'
      },
      {
        id: 203,
        question: 'Wat doet Chain-of-Thought (CoT) prompting?',
        options: [
          'Het laat de AI in meerdere talen antwoorden.',
          'Het dwingt de AI om zijn denkstappen stapsgewijs uit te schrijven.',
          'Het koppelt meerdere AI-modellen aan elkaar.',
          'Het maakt de AI sneller door stappen over te slaan.'
        ],
        correctIndex: 1,
        explanation: 'CoT vraagt het model expliciet om zijn redenering uit te schrijven ("denk stap voor stap"), waardoor het logischer en nauwkeuriger antwoordt.'
      },
      {
        id: 204,
        question: 'Wat is "Few-Shot Prompting"?',
        options: [
          'De AI maar een paar vragen stellen.',
          'De AI 2-3 voorbeelden van het gewenste resultaat meegeven zodat het jouw patroon volgt.',
          'De AI zo min mogelijk tokens laten gebruiken.',
          'Snel achter elkaar meerdere prompts sturen.'
        ],
        correctIndex: 1,
        explanation: 'Bij few-shot prompting geef je de AI een paar voorbeelden van wat je wilt, zodat het model het patroon herkent en volgt.'
      },
      {
        id: 205,
        question: 'Welke CLEAR-prompt is het meest effectief?',
        options: [
          '"Schrijf iets over het klimaat."',
          '"Je bent een klimaatwetenschapper. Schrijf een uitleg van 200 woorden over het broeikaseffect voor leerlingen van klas 3 vmbo. Gebruik een vergelijking met een warme auto in de zon."',
          '"Klimaat broeikaseffect uitleggen."',
          '"Wat is het broeikaseffect?"'
        ],
        correctIndex: 1,
        explanation: 'Deze prompt bevat alle CLEAR-elementen: Rol (klimaatwetenschapper), Context (klas 3 vmbo), Actief werkwoord (schrijf/leg uit), Lengte (200 woorden), Example (vergelijking met auto).'
      }
    ],
    assignment: {
      title: 'CLEAR Prompt Studio Uitdaging',
      goal: 'Pas het CLEAR-framework toe op een echt schoolonderwerp en vergelijk de resultaten.',
      description: 'Kies een onderwerp uit je eigen vak (bijv. geschiedenis, biologie, wiskunde). Schrijf EERST een korte, ongestructureerde prompt en noteer het AI-antwoord. Schrijf vervolgens een volledige CLEAR-prompt over hetzelfde onderwerp en vergelijk de twee antwoorden. Analyseer: welk antwoord is beter, en waarom?',
      samplePrompt: 'Rol: Je bent een geschiedenisdocent voor havo 4. Context: Een les over de Koude Oorlog. Actie: Leg de drie belangrijkste oorzaken uit. Lengte: 200 woorden, gebruik een tijdlijn. Voorbeeld: Vergelijk het met een ruzie tussen twee vriendengroepen op school.',
      rubric: [
        'De leerling heeft twee versies van dezelfde prompt geschreven (ongestructureerd vs. CLEAR).',
        'Alle vijf CLEAR-onderdelen zijn aanwezig in de gestructureerde prompt.',
        'De leerling analyseert waarom het CLEAR-antwoord beter of slechter is.'
      ]
    }
  },

  // ═══════════════════════════════════════════════
  // MODULE 3 – BETROUWBAARHEID & FACT-CHECKING
  // ═══════════════════════════════════════════════
  {
    id: 'betrouwbaarheid-factchecking',
    number: 3,
    title: 'Betrouwbaarheid & Fact-checking',
    shortTitle: 'Fact-check',
    icon: '🛡️',
    badge: 'Feitenridder',
    summary: 'AI klinkt altijd zelfverzekerd, maar klopt het ook? Leer hoe je AI-hallucinaties herkent, feiten checkt en nooit meer in de val trapt van overtuigend klinkende onzin.',
    studyText: `
### 🛡️ Waarom Je AI Nooit Blind Moet Vertrouwen

Stel je voor: je vraagt aan een AI wie de eerste president van Nederland was. De AI antwoordt vol zelfvertrouwen: *"De eerste president van Nederland was Johan de Witt, die in 1672 werd gekozen."*

Klinkt overtuigend, toch? Maar het is **100% verzonnen.** Nederland heeft nooit een president gehad — het is een koninkrijk. En Johan de Witt was raadpensionaris, niet president. Dit is een **hallucinatie**: de AI verzint iets dat niet klopt, maar schrijft het op alsof het een feit is.

> ⚠️ **Waarschuwing:** AI hallucineert het vaakst bij: jaartallen, namen van personen, citaten, wiskundige berekeningen, en wetenschappelijke bronnen. Dit zijn precies de dingen die je op school het meest nodig hebt!

---

### 🔍 Hoe Herken Je een AI-Hallucinatie?

Let op deze waarschuwingssignalen:

| Signaal | Voorbeeld | Wat te doen |
|---------|-----------|-------------|
| **Te specifiek** | "Volgens onderzoek van Dr. Van Dijk (2019)..." | Zoek het onderzoek op — bestaat het echt? |
| **Te perfect** | Perfecte datums en statistieken zonder bron | Check de getallen in je schoolboek |
| **Te zeker** | "Het is een feit dat..." zonder nuance | Wantrouw absolute uitspraken |
| **Onlogisch** | Tegenstrijdige informatie in hetzelfde antwoord | Lees het antwoord twee keer kritisch door |

<!-- 📸 AFBEELDING: "Spot de Hallucinatie" voorbeeld met een AI-antwoord vol fouten -->

---

### 📋 De 5-Stappen Fact-Check Methode

Gebruik dit stappenplan telkens als je AI-output gebruikt voor schoolwerk:

1. **Lees kritisch** — Klinkt het te mooi om waar te zijn?
2. **Trianguleer** — Check het feit via minstens 2 onafhankelijke bronnen (schoolboek, Wikipedia, Rijksmuseum.nl)
3. **Check bronnen** — Verwijst de AI naar een studie of boek? Zoek het op. Bestaat het?
4. **Reken na** — Bevat het antwoord berekeningen? Pak je rekenmachine erbij.
5. **Vraag door** — Stel de AI vervolgvragen: "Welke bron gebruik je hiervoor?" of "Kun je dit onderbouwen?"

---

### 🧪 Experiment: De Hallucinatie-Test

Probeer dit zelf:
1. Vraag de AI: *"Noem 3 boeken geschreven door [willekeurige Nederlandse auteur]"*
2. Zoek elk boek op bij bol.com of de bibliotheek
3. Grote kans dat minstens 1 boek **niet bestaat**!

Dit is waarom fact-checken zo belangrijk is. De AI klinkt alsof het 100% zeker is, maar het gokt gewoon welke boektitels "waarschijnlijk" bij die auteur passen.

<!-- 📸 AFBEELDING: Flowchart van de 5-stappen fact-check methode -->

---

### 💪 Gouden Regels voor Betrouwbaar AI-gebruik

- **Nooit** jaartallen, citaten of wiskundige uitkomsten overnemen zonder controle
- **Altijd** je bronnen vermelden (en controleren of ze bestaan!)
- **Gebruik** AI als startpunt, niet als eindpunt
- **Train** jezelf: hoe vaker je fact-checkt, hoe sneller je fouten herkent
`,
    questions: [
      {
        id: 301,
        question: 'Wat is een AI-hallucinatie?',
        options: [
          'Een technische storing waardoor de AI crasht.',
          'Wanneer de AI vol zelfvertrouwen iets verzint dat feitelijk onjuist is.',
          'Een speciaal type creatieve AI-output.',
          'Het verschijnsel dat AI steeds slimmer wordt.'
        ],
        correctIndex: 1,
        explanation: 'Een hallucinatie is wanneer AI overtuigend klinkende maar feitelijk onjuiste informatie genereert — bijvoorbeeld niet-bestaande boeken of foutieve datums.'
      },
      {
        id: 302,
        question: 'Bij welk type informatie hallucineert AI het vaakst?',
        options: [
          'Algemene kennis zoals "water kookt bij 100°C".',
          'Specifieke feiten: jaartallen, namen, citaten, bronverwijzingen en berekeningen.',
          'Eenvoudige ja/nee-vragen.',
          'Het vertalen van korte zinnen.'
        ],
        correctIndex: 1,
        explanation: 'AI hallucineert het vaakst bij specifieke feiten die het niet met zekerheid "weet" maar wel probeert in te vullen: datums, namen, citaten en berekeningen.'
      },
      {
        id: 303,
        question: 'Wat betekent "trianguleren" bij fact-checking?',
        options: [
          'Een driehoek tekenen om je antwoord te visualiseren.',
          'Dezelfde informatie controleren via minstens 2 onafhankelijke bronnen.',
          'De AI drie keer dezelfde vraag stellen.',
          'Een wiskunde-methode om hoeken te berekenen.'
        ],
        correctIndex: 1,
        explanation: 'Trianguleren betekent dat je een feit verifieert via meerdere onafhankelijke bronnen (schoolboek, encyclopedie, betrouwbare website) om zeker te zijn dat het klopt.'
      },
      {
        id: 304,
        question: 'Je vraagt de AI om "3 boeken van auteur X" en krijgt 3 titels. Wat moet je als eerste doen?',
        options: [
          'De titels overnemen in je werkstuk — de AI zal wel gelijk hebben.',
          'De boektitels opzoeken bij de bibliotheek of bol.com om te controleren of ze bestaan.',
          'De AI bedanken en verder gaan.',
          'Niets — het zijn maar boektitels.'
        ],
        correctIndex: 1,
        explanation: 'AI verzint regelmatig boektitels die niet bestaan! Controleer altijd of bronnen en titels echt bestaan voordat je ze in je werk opneemt.'
      },
      {
        id: 305,
        question: 'Waarom is "Welke bron gebruik je hiervoor?" een slimme vervolgvraag aan AI?',
        options: [
          'Omdat de AI dan altijd een correcte bron geeft.',
          'Omdat het de AI dwingt zijn antwoord te onderbouwen, en je kunt controleren of die bron echt bestaat.',
          'Omdat AI dan automatisch de fout corrigeert.',
          'Het heeft geen nut — AI geeft nooit bronnen.'
        ],
        correctIndex: 1,
        explanation: 'Door naar bronnen te vragen kun je controleren of de AI verwijst naar iets dat écht bestaat. Let op: de AI kan ook bij de bron hallucineren!'
      }
    ],
    assignment: {
      title: 'De Fact-Check Challenge',
      goal: 'Ontdek hoe vaak AI hallucineert en oefen met systematisch fact-checken.',
      description: 'Stel de AI 5 specifieke vragen over feiten uit je eigen schoolvak (bijv. "In welk jaar werd X uitgevonden?" of "Noem 3 boeken over Y"). Controleer elk antwoord via minstens 2 bronnen. Documenteer per vraag: wat de AI zei, of het klopte, en welke bronnen je gebruikte.',
      samplePrompt: 'Noem 5 belangrijke uitvindingen uit de 19e eeuw met het exacte jaar en de uitvinder.',
      rubric: [
        'De leerling heeft 5 feitelijke vragen gesteld en elk antwoord gecontroleerd.',
        'Per antwoord zijn minstens 2 onafhankelijke bronnen gebruikt ter verificatie.',
        'De leerling beschrijft helder welke antwoorden klopten en welke hallucinaties waren.'
      ]
    }
  },

  // ═══════════════════════════════════════════════
  // MODULE 4 – AI METRICS & EVALUATIE
  // ═══════════════════════════════════════════════
  {
    id: 'begrippen-metrics',
    number: 4,
    title: 'AI Metrics & Evaluatie',
    shortTitle: 'Metrics',
    icon: '📊',
    badge: 'Datawizard',
    summary: 'Hoe weet je of een AI goed is? Leer de meetlat waarmee AI-experts modellen beoordelen: accuracy, precision, recall en de beroemde confusion matrix.',
    studyText: `
### 📊 Hoe Meet Je of een AI "Goed" is?

Stel je voor: je school koopt een AI-systeem dat automatisch nakijkt of antwoorden goed of fout zijn. Maar hoe weet je of die AI zelf betrouwbaar genoeg is? Daarvoor heb je **metrics** nodig — meetinstrumenten om de prestaties van een AI te beoordelen.

---

### 🧮 De Confusion Matrix — Het Rapportcijfer van AI

De confusion matrix is een tabel die precies laat zien waar een AI goed en fout zit:

|  | AI zegt: ✅ Positief | AI zegt: ❌ Negatief |
|---|---|---|
| **Echt: ✅ Positief** | ✅ True Positive (TP) — Goed herkend! | ⚠️ False Negative (FN) — Gemist! |
| **Echt: ❌ Negatief** | ⚠️ False Positive (FP) — Vals alarm! | ✅ True Negative (TN) — Correct afgewezen! |

> 💡 **Ezelsbruggetje:** 
> - **TP** = De AI zegt JA en het IS ook JA → Perfect!
> - **FP** = De AI zegt JA maar het is eigenlijk NEE → Vals alarm!
> - **FN** = De AI zegt NEE maar het is eigenlijk JA → Gemist!
> - **TN** = De AI zegt NEE en het IS ook NEE → Perfect!

<!-- 📸 AFBEELDING: Kleurrijke confusion matrix met emoji's en een spamfilter-voorbeeld -->

---

### 📐 De Vier Belangrijkste Metrics

| Metric | Formule | Wat het meet | Voorbeeld |
|--------|---------|-------------|-----------|
| **Accuracy** | (TP + TN) / Totaal | Hoeveel procent van ALLE voorspellingen klopt | 85/100 goed = 85% |
| **Precision** | TP / (TP + FP) | Van alles wat de AI "positief" noemt, hoeveel is echt positief? | Spamfilter: 9 van 10 "spam" mails waren echt spam = 90% |
| **Recall** | TP / (TP + FN) | Van alle echte positieven, hoeveel heeft de AI gevonden? | Van 20 spammails werden er 18 gevonden = 90% |
| **F1-Score** | 2 × (P×R)/(P+R) | Het harmonische gemiddelde van Precision en Recall | Eerlijke score bij scheve data |

---

### 🎯 Wanneer Welke Metric Belangrijk Is

Het hangt af van de situatie welke metric het belangrijkst is:

| Situatie | Belangrijkste metric | Waarom |
|----------|---------------------|--------|
| **Medische diagnose** | Recall | Je wilt GEEN ziekte missen (FN is gevaarlijk!) |
| **Spamfilter** | Precision | Je wilt NIET dat belangrijke mail in spam belandt (FP is vervelend!) |
| **Examennakijkrobot** | F1-Score | Zowel valse positieven als gemiste antwoorden zijn problematisch |

<!-- 📸 AFBEELDING: Illustratie van wanneer precision vs. recall belangrijker is -->

---

### 🏆 Benchmarks — De Olympische Spelen van AI

AI-modellen worden ook onderling vergeleken via **benchmarks**: gestandaardiseerde tests.

| Benchmark | Wat het test |
|-----------|------------|
| **MMLU** | Algemene kennis (wiskunde, geschiedenis, wetenschap) |
| **HumanEval** | Kan de AI programmeercode schrijven die werkt? |
| **HellaSwag** | Begrijpt de AI de context van een verhaal? |

> 💡 **Vergelijk het met:** CITO-toetsen voor AI! Net zoals leerlingen een CITO-score krijgen, krijgen AI-modellen een benchmark-score.
`,
    questions: [
      {
        id: 401,
        question: 'Wat is een True Positive (TP)?',
        options: [
          'De AI voorspelt "positief" en het is daadwerkelijk positief — correct!',
          'De AI voorspelt "negatief" en het is daadwerkelijk negatief.',
          'De AI voorspelt "positief" maar het is eigenlijk negatief — vals alarm.',
          'De AI mist een positief geval.'
        ],
        correctIndex: 0,
        explanation: 'TP = de AI zegt JA en het IS ook JA. Dit is een correcte detectie.'
      },
      {
        id: 402,
        question: 'Een spamfilter markeert 10 mails als spam. 9 waren echt spam, 1 was een belangrijk bericht. Wat is de Precision?',
        options: [
          '100%',
          '90%',
          '80%',
          '50%'
        ],
        correctIndex: 1,
        explanation: 'Precision = TP / (TP + FP) = 9 / (9 + 1) = 90%. Van alles wat de AI als spam bestempelde, was 90% daadwerkelijk spam.'
      },
      {
        id: 403,
        question: 'Bij een medische AI die kanker detecteert is het CRUCAAL dat de Recall hoog is. Waarom?',
        options: [
          'Omdat het niet erg is als de AI kanker mist bij een patiënt.',
          'Omdat je geen enkel geval van kanker wilt missen — een False Negative kan dodelijk zijn.',
          'Omdat Precision bij medische AI niet uitmaakt.',
          'Omdat Recall goedkoper is om te berekenen.'
        ],
        correctIndex: 1,
        explanation: 'Bij medische diagnose wil je dat de AI ALLE echte gevallen vindt (hoge recall). Een gemist geval (FN) kan levensgevaarlijk zijn.'
      },
      {
        id: 404,
        question: 'Wat is het verschil tussen Accuracy en F1-Score?',
        options: [
          'Er is geen verschil — het zijn synoniemen.',
          'Accuracy kijkt naar het totaalpercentage correct; F1-Score weegt Precision en Recall eerlijk tegen elkaar af.',
          'F1-Score is altijd hoger dan Accuracy.',
          'Accuracy is alleen voor tekst, F1 alleen voor afbeeldingen.'
        ],
        correctIndex: 1,
        explanation: 'Accuracy = (TP+TN)/Totaal. F1 = harmonisch gemiddelde van Precision en Recall. Bij scheve data (bijv. 95% van de mails is geen spam) kan Accuracy misleidend zijn.'
      },
      {
        id: 405,
        question: 'Wat is een AI-benchmark?',
        options: [
          'Een fysiek apparaat om de snelheid van een computer te meten.',
          'Een gestandaardiseerde testset waarmee de prestaties van AI-modellen objectief vergeleken worden.',
          'Een type AI dat andere AI\'s beoordeelt.',
          'Een ranglijst van de duurste AI-modellen.'
        ],
        correctIndex: 1,
        explanation: 'Een benchmark is een gestandaardiseerde test (zoals MMLU of HumanEval) waarmee je de prestaties van verschillende AI-modellen eerlijk kunt vergelijken — vergelijkbaar met een CITO-toets voor AI.'
      }
    ],
    assignment: {
      title: 'Bouw Je Eigen Confusion Matrix',
      goal: 'Begrijp de confusion matrix door zelf een mini-experiment uit te voeren.',
      description: 'Verzamel 20 korte AI-antwoorden over een feitelijk onderwerp (bijv. hoofdsteden). Beoordeel elk antwoord als correct of incorrect. Vul een confusion matrix in en bereken Accuracy, Precision, Recall en F1-Score. Presenteer je resultaten in een overzichtelijke tabel.',
      samplePrompt: 'Geef me de hoofdsteden van 20 willekeurige landen ter wereld.',
      rubric: [
        'De leerling heeft minstens 20 AI-antwoorden gecontroleerd en gecategoriseerd als TP, FP, TN of FN.',
        'De confusion matrix is correct ingevuld met de juiste aantallen.',
        'Accuracy, Precision, Recall en F1-Score zijn correct berekend.'
      ]
    }
  },

  // ═══════════════════════════════════════════════
  // MODULE 5 – MODELKEUZE & TRADE-OFFS
  // ═══════════════════════════════════════════════
  {
    id: 'modelkeuze',
    number: 5,
    title: 'Modelkeuze & Trade-offs',
    shortTitle: 'Modellen',
    icon: '⚖️',
    badge: 'Model Architect',
    summary: 'Niet elke AI is hetzelfde! Leer het verschil tussen kleine en grote modellen, cloud vs. lokaal, en hoe je het juiste model kiest voor elke situatie.',
    studyText: `
### ⚖️ Niet Alle AI's Zijn Gelijk

Wist je dat er honderden verschillende AI-modellen bestaan? Net zoals je niet met een vrachtwagen naar de supermarkt rijdt, gebruik je ook niet altijd het grootste AI-model. De kunst is om het **juiste model voor de juiste taak** te kiezen.

---

### 🏗️ Klein vs. Groot: Modelparameters

De "grootte" van een AI-model wordt gemeten in **parameters** — de interne "draaien en knoppen" waarmee het model patronen herkent.

| Model | Parameters | Vergelijking |
|-------|-----------|------------|
| Klein model (bijv. Phi-3) | ~3,8 miljard | Een slimme zakrekenmachine |
| Middelgroot (bijv. LLaMA 3 8B) | ~8 miljard | Een goede laptop |
| Groot (bijv. GPT-4) | ~1.800 miljard | Een supercomputer |

> 💡 **Meer parameters ≠ altijd beter.** Een klein model dat gespecialiseerd is in jouw taak kan beter presteren dan een gigantisch model dat alles een beetje kan.

<!-- 📸 AFBEELDING: Vergelijking klein/middel/groot model met voertuig-analogie -->

---

### ☁️ Cloud vs. Lokaal: Waar Draait de AI?

| Eigenschap | Cloud AI | Lokaal AI |
|-----------|---------|----------|
| **Locatie** | In een datacenter ver weg | Op jouw eigen computer/schoolserver |
| **Privacy** | ⚠️ Je data gaat over internet | ✅ Je data blijft bij jou |
| **Snelheid** | Snel (krachtige servers) | Langzamer (afhankelijk van hardware) |
| **Kosten** | Betalen per gebruik (tokens) | Gratis na installatie |
| **Kwaliteit** | Meestal hoger (grotere modellen) | Lager maar verbetert snel |
| **Internet nodig?** | Ja, altijd | Nee |

---

### 🎯 De Drie Trade-offs bij Modelkeuze

Bij het kiezen van een AI-model moet je altijd drie dingen afwegen:

**1. Kwaliteit vs. Snelheid**
> Een groot model geeft betere antwoorden maar duurt langer. Voor een snel huiswerkantwoord is een klein model vaak prima.

**2. Privacy vs. Kwaliteit**
> Cloud-modellen zijn slimmer, maar je data verlaat je apparaat. Voor gevoelige schoolgegevens is lokaal veiliger.

**3. Kosten vs. Prestaties**
> De beste modellen kosten geld per token. Bedenk: is het het waard voor deze specifieke taak?

<!-- 📸 AFBEELDING: Driehoek-diagram met de drie trade-offs -->

---

### 📊 Welk Model voor Welke Taak?

| Taak | Aanbevolen model | Waarom |
|------|-----------------|--------|
| Snel een woord vertalen | Klein / lokaal | Eenvoudige taak, geen groot model nodig |
| Een heel werkstuk schrijven | Groot / cloud | Complexe taak die veel context vereist |
| Gevoelige leerlingdata verwerken | Lokaal | Privacy is cruciaal |
| Code schrijven | Middel-groot | Gespecialiseerde codemodellen zijn efficiënt |
| Brainstormen | Klein-middel | Snelle ideeën hoeven niet perfect te zijn |
`,
    questions: [
      {
        id: 501,
        question: 'Waarom is een groter AI-model niet altijd beter?',
        options: [
          'Omdat grote modellen altijd verkeerde antwoorden geven.',
          'Omdat een kleiner, gespecialiseerd model voor een specifieke taak beter kan presteren, sneller is en minder kost.',
          'Omdat grote modellen niet meer gemaakt worden.',
          'Omdat alle AI-modellen exact even groot zijn.'
        ],
        correctIndex: 1,
        explanation: 'Een gespecialiseerd klein model kan voor specifieke taken beter, sneller en goedkoper zijn dan een generalistisch groot model.'
      },
      {
        id: 502,
        question: 'Wat is het grootste voordeel van een LOKAAL AI-model?',
        options: [
          'Het geeft altijd betere antwoorden dan cloud-modellen.',
          'Je data blijft op je eigen apparaat — maximale privacy.',
          'Het is altijd sneller dan cloud-AI.',
          'Het heeft geen stroom nodig.'
        ],
        correctIndex: 1,
        explanation: 'Bij lokale AI verlaat je data nooit je eigen netwerk, wat ideaal is voor privacy-gevoelige schoolomgevingen.'
      },
      {
        id: 503,
        question: 'Een school wil leerlinggegevens laten beoordelen door AI. Welk type model is het verstandigst?',
        options: [
          'Het allergrootste cloud-model voor de beste kwaliteit.',
          'Een lokaal model zodat leerlingdata niet naar externe servers gaat.',
          'Helemaal geen AI — dat is altijd gevaarlijk.',
          'Een gratis online chatbot.'
        ],
        correctIndex: 1,
        explanation: 'Bij gevoelige persoonsgegevens (AVG/GDPR) is een lokaal model veruit het veiligst, omdat de data niet via internet naar externe servers wordt gestuurd.'
      },
      {
        id: 504,
        question: 'Wat zijn "parameters" in een AI-model?',
        options: [
          'De vragen die je aan de AI kunt stellen.',
          'De interne gewichten en waarden waarmee het model patronen herkent — hoe meer, hoe complexer het model.',
          'De maximale lengte van een antwoord.',
          'De programmeertaal waarin de AI is geschreven.'
        ],
        correctIndex: 1,
        explanation: 'Parameters zijn de miljoenen tot biljoenen getallen (gewichten) in het neurale netwerk die bepalen hoe het model tekst interpreteert en genereert.'
      },
      {
        id: 505,
        question: 'Welke trade-off is het MINST relevant bij het kiezen van een vertaal-app?',
        options: [
          'Snelheid vs. kwaliteit',
          'Privacy vs. kwaliteit',
          'De kleur van het logo van de AI-app',
          'Kosten vs. prestaties'
        ],
        correctIndex: 2,
        explanation: 'De kleur van het logo heeft niets te maken met de technische prestaties. De echte trade-offs zijn snelheid, privacy en kosten versus kwaliteit.'
      }
    ],
    assignment: {
      title: 'Model-vergelijkingsexperiment',
      goal: 'Ervaar zelf het verschil tussen een groot en een klein AI-model.',
      description: 'Stel exact dezelfde 5 vragen aan twee verschillende AI-modellen (bijv. een gratis ChatGPT-versie en Locra). Vergelijk de antwoorden op: kwaliteit, snelheid, hoeveelheid detail en eventuele fouten. Maak een overzichtelijke vergelijkingstabel en trek conclusies.',
      samplePrompt: 'Vraag beide modellen: "Leg het verschil uit tussen een meteoriet, een meteoor en een asteroïde in maximaal 100 woorden."',
      rubric: [
        'De leerling heeft dezelfde 5 vragen aan 2 verschillende modellen gesteld.',
        'Per vraag is een eerlijke vergelijking gemaakt op kwaliteit, snelheid en detail.',
        'De conclusie bevat een aanbeveling: welk model is wanneer het beste?'
      ]
    }
  },

  // ═══════════════════════════════════════════════
  // MODULE 6 – GROEN AI & DUURZAAMHEID
  // ═══════════════════════════════════════════════
  {
    id: 'groen-ai',
    number: 6,
    title: 'Groen AI & Duurzaamheid',
    shortTitle: 'Groen AI',
    icon: '🌱',
    badge: 'Eco AI-Expert',
    summary: 'Ontdek de verborgen milieu-impact van AI: hoeveel stroom, water en CO₂ kosten je prompts eigenlijk? En wat kun jij doen om slimmer en groener met AI om te gaan?',
    studyText: `
### 🌍 De Onzichtbare Kosten van AI

Elke keer dat je een vraag stelt aan ChatGPT, Locra of een andere AI, reist jouw tekst via internet naar een **datacenter** — een gigantische hal vol met duizenden krachtige computers (GPU-servers). Deze servers rekenen razendsnel een antwoord uit en sturen het terug.

Maar dat rekenen kost energie. **Veel** energie.

---

### ⚡ Hoeveel Energie Kost AI?

Laten we het concreet maken met een vergelijkingstabel:

| Activiteit | CO₂-uitstoot |
|---|---|
| Eén ChatGPT-vraag | ~2-3 gram CO₂ |
| Eén Google-zoekopdracht | ~0,2 gram CO₂ |
| Een AI-afbeelding genereren | ~10-20 gram CO₂ |
| Het *trainen* van GPT-3 | ~300.000 kg CO₂ |
| 125× retour vliegen New York–Peking | ~300.000 kg CO₂ |

> ⚠️ **Conclusie:** Eén enkele vraag kost weinig, maar het *trainen* van een AI-model is enorm belastend voor het milieu. En met miljoenen gebruikers per dag telt elke vraag op!

<!-- 📸 AFBEELDING: Vergelijking CO2-uitstoot per activiteit als staafdiagram -->

---

### 💧 Waterverbruik: De Vergeten Factor

Servers worden extreem heet tijdens het rekenen. Om ze koel te houden, gebruiken datacenters enorme hoeveelheden **koelwater**:

- Microsoft meldde dat hun AI-training in 2023 ongeveer **700.000 liter** extra water verbruikte
- Eén datacenter verbruikt evenveel water als een klein stadje
- In droge gebieden (zoals delen van de VS en Spanje) leidt dit tot waterschaarste

> 💡 **Vergelijk het met:** Elke keer dat je een AI-vraag stelt, drink je onzichtbaar een halve beker water op via het koelsysteem van het datacenter.

---

### 🔑 Drie Factoren die Jouw AI-voetafdruk Bepalen

| Factor | Meer impact | Minder impact |
|--------|-----------|--------------|
| **Modeltype** | Groot cloudmodel (GPT-4) | Klein lokaal model (LLaMA 8B) |
| **Promptlengte** | 500 woorden prompt → 2000 woorden output | 50 woorden prompt → 100 woorden output |
| **Mediatype** | Video/afbeelding genereren | Tekst genereren |

---

### 💰 Tokenkosten: Wat Kost AI in Euro's?

AI-bedrijven rekenen per **token** (± 0,75 woord):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| GPT-4o | ~€5 | ~€15 |
| Claude 3 Opus | ~€15 | ~€75 |
| Lokaal model | €0 (alleen stroomkosten) | €0 |

> 💡 **Tip voor scholen:** Door slim te prompten (CLEAR!) bespaar je tokens, energie én geld! Eén gerichte CLEAR-prompt is beter dan 5 vage pogingen.

<!-- 📸 AFBEELDING: Infographic "Jouw Digitale Voetafdruk" met concrete bespaartips -->

---

### 🌱 Wat Kun JIJ Doen?

1. **Schrijf gerichte prompts** — Eén CLEAR-prompt in plaats van 5 vage pogingen
2. **Kies het juiste model** — Niet altijd het grootste nodig
3. **Vermijd onnodige beeldgeneratie** — Eén afbeelding kost 10x zoveel als tekst
4. **Hergebruik antwoorden** — Sla goede antwoorden op in plaats van ze opnieuw te genereren
`,
    questions: [
      {
        id: 601,
        question: 'Waarom heeft het gebruik van AI een ecologische voetafdruk?',
        options: [
          'Omdat AI-servers uitsluitend op fossiele brandstoffen draaien.',
          'Door het zware rekenwerk van GPU-servers dat continu elektriciteit en waterkoeling vereist.',
          'Omdat het typen van prompts extra batterij van je telefoon kost.',
          'AI heeft geen enkele invloed op het milieu.'
        ],
        correctIndex: 1,
        explanation: 'Datacenters met GPU-clusters verbruiken continu stroom en miljoenen liters water voor koeling.'
      },
      {
        id: 602,
        question: 'Wat bespaar je door slim te prompten (CLEAR) in plaats van vage vragen te stellen?',
        options: [
          'Alleen tijd.',
          'Tokens, energie, CO₂ en geld — want je hebt minder pogingen nodig.',
          'Niets, want de AI verbruikt altijd evenveel.',
          'Alleen geld, geen energie.'
        ],
        correctIndex: 1,
        explanation: 'Eén gerichte CLEAR-prompt in plaats van 5 vage pogingen bespaart tokens (en dus energie, CO₂ en kosten).'
      },
      {
        id: 603,
        question: 'Een leerling stelt 20 AI-vragen per dag, 365 dagen lang, met gemiddeld 3 gram CO₂ per vraag. Hoeveel CO₂ is dit per jaar?',
        options: [
          'Ongeveer 2,19 kg CO₂',
          'Ongeveer 21,9 kg CO₂',
          'Ruim 219 kg CO₂',
          'Minder dan 100 gram CO₂'
        ],
        correctIndex: 1,
        explanation: '20 × 365 = 7.300 vragen. 7.300 × 3 gram = 21.900 gram ≈ 21,9 kg CO₂ per jaar.'
      },
      {
        id: 604,
        question: 'Welk mediatype kost de MEESTE energie om te genereren met AI?',
        options: [
          'Een korte tekst van 50 woorden',
          'Een vertaling van een zin',
          'Een AI-gegenereerde video',
          'Een lijst met bulletpoints'
        ],
        correctIndex: 2,
        explanation: 'Video genereren is extreem energie-intensief — veel meer dan tekst. Afbeeldingen zitten er tussenin.'
      },
      {
        id: 605,
        question: 'Wat is het voordeel van een lokaal AI-model qua duurzaamheid?',
        options: [
          'Lokale modellen gebruiken geen stroom.',
          'Lokale modellen vermijden het grote datacenter-transport via internet en zijn vaak kleiner en zuiniger.',
          'Lokale modellen zijn altijd beter dan cloud-modellen.',
          'Er is geen verschil in duurzaamheid.'
        ],
        correctIndex: 1,
        explanation: 'Lokale modellen zijn meestal kleiner (minder parameters = minder rekenwerk) en vermijden de extra energie van datatransport over internet.'
      }
    ],
    assignment: {
      title: 'Bereken Je AI Carbon Footprint',
      goal: 'Krijg praktisch inzicht in de CO₂-impact en tokenkosten van AI.',
      description: 'Houd een week lang bij hoeveel AI-prompts je stuurt en schat het gemiddelde aantal tokens per prompt. Bereken de totale CO₂-uitstoot en vergelijk twee scenario\'s: (1) met vage prompts en (2) met CLEAR-prompts. Hoeveel kun je besparen?',
      samplePrompt: 'Bereken: als je 15 prompts per dag stuurt van gemiddeld 800 tokens, met 0,0001 gram CO₂ per token, hoeveel kg CO₂ produceer je dan per jaar?',
      rubric: [
        'De leerling heeft zijn eigen AI-gebruik gedocumenteerd (aantal prompts, geschat tokenverbruik).',
        'De CO₂-schatting is nauwkeurig uitgevoerd voor beide scenario\'s.',
        'De leerling reflecteert op het verschil en doet concrete bespaarsuggesties.'
      ]
    }
  },

  // ═══════════════════════════════════════════════
  // MODULE 7 – ETHIEK, BIAS & DEEPFAKES
  // ═══════════════════════════════════════════════
  {
    id: 'ethiek-deepfakes',
    number: 7,
    title: 'Ethiek, Bias & Deepfakes',
    shortTitle: 'Ethiek',
    icon: '⚖️',
    badge: 'Digitaal Burger',
    summary: 'AI is krachtig, maar wie bepaalt wat eerlijk is? Leer over vooroordelen in AI, hoe deepfakes werken, en welke regels de EU heeft opgesteld om jou te beschermen.',
    studyText: `
### ⚖️ De Donkere Kant van AI

AI kan geweldige dingen doen: ziektes opsporen, talen vertalen, en je helpen met je huiswerk. Maar AI kan ook worden misbruikt, en het bevat onbewuste vooroordelen. In deze module leer je de **ethische kant** van AI — de dingen waar je als digitaal burger echt van moet weten.

---

### 🎭 Wat zijn Deepfakes?

Een **deepfake** is een door AI gemaakte video, foto of geluidsopname die er echt uitziet maar compleet nep is. De AI analyseert honderden foto's of video's van een persoon en kan vervolgens:

- Iemands gezicht in een andere video plakken
- Iemands stem perfect nadoen
- Woorden in iemands mond leggen die ze nooit gezegd hebben

> ⚠️ **Gevaar:** Deepfakes worden gebruikt voor: nepnieuws, cyberpesten, fraude en politieke manipulatie. In 2024 werd een financieel medewerker in Hong Kong opgelicht voor 25 miljoen dollar via een deepfake-videocall.

<!-- 📸 AFBEELDING: Illustratie van hoe een deepfake wordt gemaakt (stap voor stap) -->

---

### 🔍 Hoe Herken Je een Deepfake?

Let op deze tekenen:

| Teken | Wat je ziet | Waarom |
|-------|-----------|--------|
| **Onnatuurlijk knipperen** | De persoon knippert te weinig of juist gek | AI heeft moeite met oogbewegingen |
| **Vage randen** | Wazige overgangen rond gezicht en haar | Het "geplakte" gezicht past niet perfect |
| **Vreemde belichting** | Schaduwen kloppen niet met de lichtbron | AI vergeet soms fysica |
| **Lip-sync problemen** | Lippen bewegen niet helemaal synchroon met geluid | Audio en video zijn apart gegenereerd |
| **Te perfect** | De huid is onnatuurlijk glad en vlekkeloos | AI "poetst" gezichten op |

---

### 🤖 Bias in AI — Onbewuste Vooroordelen

AI leert van menselijke data, en mensen hebben vooroordelen. Dit betekent dat AI die vooroordelen **overneemt en versterkt**.

**Echte voorbeelden van AI-bias:**
- Een sollicitatie-AI die vrouwelijke kandidaten systematisch lager scoorde (Amazon, 2018)
- Gezichtsherkenning die mensen met een donkere huidskleur vaker verkeerd identificeert
- Een krediet-AI die mensen uit bepaalde wijken automatisch een hogere rente gaf

> 💡 **Waarom gebeurt dit?** Als de trainingsdata voornamelijk bestaat uit teksten/foto's van één groep mensen, "denkt" de AI dat die groep de norm is. Alles wat afwijkt wordt slechter beoordeeld.

<!-- 📸 AFBEELDING: Diagram van hoe bias in trainingsdata leidt tot bias in AI-output -->

---

### 📜 De Wet: EU AI Act & AVG

De Europese Unie heeft strenge regels opgesteld voor AI:

**EU AI Act (sinds 2024):**
| Risiconiveau | Voorbeeld | Regels |
|-------------|-----------|--------|
| **Verboden** | Emotieherkenning op scholen, social scoring | Mag NIET |
| **Hoog risico** | AI voor examens, sollicitaties, justitie | Strenge eisen, menselijk toezicht verplicht |
| **Beperkt risico** | Chatbots, deepfake-generators | Transparantie: de gebruiker moet weten dat het AI is |
| **Minimaal risico** | Spamfilters, spellingcontrole | Nauwelijks regels |

**AVG / GDPR:**
- Deel **NOOIT** persoonsgegevens in AI-prompts (namen, adressen, leerlingnummers)
- Scholen mogen niet zomaar AI inzetten voor leerlingbeoordeling
- Je hebt recht om te weten of een beslissing door AI is genomen

---

### 💪 Jouw Rechten als Digitaal Burger

1. **Recht op uitleg** — Als een AI een beslissing over jou neemt, mag je vragen waarom.
2. **Recht op menselijk contact** — Je mag altijd een mens spreken in plaats van een AI.
3. **Recht op privacy** — Je data mag niet zonder toestemming worden gebruikt om AI te trainen.
4. **Recht op correctie** — Als AI foute info over jou heeft, mag je dat laten corrigeren.
`,
    questions: [
      {
        id: 701,
        question: 'Wat is een deepfake?',
        options: [
          'Een satirisch nieuwsartikel op een website.',
          'Een door AI gegenereerde video, foto of geluidsopname die eruitziet als echt maar nep is.',
          'Een filter op Instagram of Snapchat.',
          'Een computervirus dat je webcam overneemt.'
        ],
        correctIndex: 1,
        explanation: 'Een deepfake is AI-gegenereerde media (video, audio, foto) die er overtuigend echt uitziet maar volledig gefabriceerd is.'
      },
      {
        id: 702,
        question: 'Waarom kan AI bevooroordeeld (biased) zijn?',
        options: [
          'Omdat AI zelf kwaadaardige bedoelingen heeft.',
          'Omdat AI leert van menselijke data die al vooroordelen bevat, en deze patronen overneemt en versterkt.',
          'Omdat programmeurs bewust racisme inbouwen.',
          'AI kan niet bevooroordeeld zijn — het is objectief.'
        ],
        correctIndex: 1,
        explanation: 'AI leert patronen uit trainingsdata. Als die data menselijke vooroordelen bevat (bijv. meer foto\'s van één groep), neemt de AI die bias over.'
      },
      {
        id: 703,
        question: 'Welk gebruik van AI is volgens de EU AI Act VERBODEN op scholen?',
        options: [
          'Een chatbot die leerlingen helpt met huiswerk.',
          'Emotieherkenning en social scoring van leerlingen.',
          'Een spellingcontrole in een teksteditor.',
          'Een AI die roosterconflicten oplost.'
        ],
        correctIndex: 1,
        explanation: 'De EU AI Act verbiedt het gebruik van emotieherkenning en social scoring in onderwijsinstellingen als "onaanvaardbaar risico".'
      },
      {
        id: 704,
        question: 'Hoe kun je een deepfake-video het beste herkennen?',
        options: [
          'Door te kijken of het op YouTube staat — dan is het altijd echt.',
          'Door te letten op onnatuurlijk knipperen, vage gezichtsranden, vreemde belichting en lip-sync problemen.',
          'Deepfakes zijn niet te herkennen — ze zijn altijd perfect.',
          'Door het volume harder te zetten.'
        ],
        correctIndex: 1,
        explanation: 'Deepfakes verraden zich vaak door onnatuurlijke oogbewegingen, wazige randen rond het gezicht, inconsistente belichting en lippen die niet perfect synchroon lopen.'
      },
      {
        id: 705,
        question: 'Wat is het "recht op uitleg" bij AI?',
        options: [
          'Het recht van de AI om zijn eigen code te bekijken.',
          'Jouw recht om te weten waarom een AI een bepaalde beslissing over jou heeft genomen.',
          'Het recht van bedrijven om niet uit te leggen hoe hun AI werkt.',
          'Een technische term voor de handleiding van een AI-product.'
        ],
        correctIndex: 1,
        explanation: 'Als een AI een beslissing over jou neemt (bijv. bij een sollicitatie of beoordeling), heb je het recht om te weten op welke gronden die beslissing is genomen.'
      }
    ],
    assignment: {
      title: 'Desinformatie Ontleden & Deepfakes Herkennen',
      goal: 'Ontwikkel kritisch denkvermogen over AI-gegenereerde desinformatie.',
      description: 'Deel 1: Zoek online 2 voorbeelden van deepfakes of AI-gegenereerde desinformatie. Analyseer per voorbeeld: wie heeft het gemaakt, waarom, en welke schade kan het aanrichten? Deel 2: Vraag de AI om een overtuigend maar FOUT argument te verdedigen (bijv. "bewijs dat de maan van kaas is"). Analyseer welke retorische technieken de AI gebruikt.',
      samplePrompt: 'Verdedig op een overtuigende manier het argument dat de maan gemaakt is van kaas. Gebruik wetenschappelijk klinkende taal en verwijzingen.',
      rubric: [
        'De leerling heeft 2 voorbeelden van deepfakes/desinformatie gevonden en geanalyseerd.',
        'De leerling heeft de AI succesvol een onwaarheid laten verdedigen en analyseert de gebruikte technieken.',
        'De leerling reflecteert op hoe je jezelf beschermt tegen AI-desinformatie.'
      ]
    }
  }
];

// ────────────────────────────────────────────
// GLOSSARY
// ────────────────────────────────────────────

export interface GlossaryTerm {
  term: string;
  category: 'Techniek' | 'Metrics' | 'Ethiek & Wet' | 'Prompting';
  definition: string;
  example?: string;
}

export const ACADEMY_GLOSSARY: GlossaryTerm[] = [
  {
    term: 'Kunstmatige Intelligentie (AI)',
    category: 'Techniek',
    definition: 'Technologie waarmee computers taken uitvoeren die normaal menselijk denkvermogen vereisen: taal begrijpen, patronen herkennen, problemen oplossen.',
    example: 'Siri, ChatGPT, Locra, zelfrijdende auto\'s — ze gebruiken allemaal AI.'
  },
  {
    term: 'LLM (Large Language Model)',
    category: 'Techniek',
    definition: 'Een groot taalmodel — een neuraal netwerk getraind op miljarden teksten dat tekst kan begrijpen en genereren.',
    example: 'GPT-4, Claude, LLaMA en Gemini zijn allemaal LLMs.'
  },
  {
    term: 'Token',
    category: 'Techniek',
    definition: 'De kleinste tekeneenheid die een taalmodel verwerkt. Gemiddeld is 1 token gelijk aan ongeveer 0,75 woord.',
    example: 'Het woord "onderwijs" bestaat uit 2 tokens: "onder" en "wijs".'
  },
  {
    term: 'Prompt',
    category: 'Prompting',
    definition: 'De opdracht of vraag die je aan een AI-model geeft. De kwaliteit van je prompt bepaalt de kwaliteit van het antwoord.',
    example: '"Schrijf een samenvatting van 100 woorden over fotosynthese voor klas 2 havo."'
  },
  {
    term: 'Hallucinatie',
    category: 'Techniek',
    definition: 'Wanneer een AI-model vol zelfvertrouwen een bewering doet die feitelijk onjuist of verzonnen is.',
    example: 'Een chatbot die een niet-bestaande wetenschappelijke studie citeert of een foutieve geboortedatum noemt.'
  },
  {
    term: 'CLEAR Framework',
    category: 'Prompting',
    definition: 'Een methode voor sterke prompts: Context, Lengte/Vorm, Examples, Actief werkwoord, en Rol.',
    example: 'Rol: leraar; Context: klas 2; Actie: leg uit; Lengte: 150 woorden; Voorbeeld: vergelijk met zonnepanelen.'
  },
  {
    term: 'Chain-of-Thought (CoT)',
    category: 'Prompting',
    definition: 'Een prompttechniek die het model dwingt zijn denkstappen stapsgewijs uit te schrijven voor betere redenering.',
    example: '"Denk stap voor stap na en bereken hoeveel euro overblijft na aankoop van..."'
  },
  {
    term: 'Few-Shot Prompting',
    category: 'Prompting',
    definition: 'Een prompttechniek waarbij je 2-3 voorbeelden meegeeft zodat de AI jouw gewenste patroon volgt.',
    example: 'Geef 2 voorbeeldzinnen in de stijl die je wilt, en de AI volgt dat patroon.'
  },
  {
    term: 'Accuracy (Nauwkeurigheid)',
    category: 'Metrics',
    definition: 'Het percentage correcte voorspellingen van alle voorspellingen: (TP + TN) / Totaal.',
    example: '85 van de 100 antwoorden goed = 85% accuracy.'
  },
  {
    term: 'Precisie (Precision)',
    category: 'Metrics',
    definition: 'Van alle positieve voorspellingen, hoeveel zijn echt positief? TP / (TP + FP).',
    example: 'Spamfilter: 9 van 10 als spam gemarkeerde mails waren echt spam = 90% precision.'
  },
  {
    term: 'Recall (Vangst)',
    category: 'Metrics',
    definition: 'Van alle echte positieven, hoeveel heeft het model gevonden? TP / (TP + FN).',
    example: 'Van 20 spammails werden er 18 gevonden = 90% recall.'
  },
  {
    term: 'F1-Score',
    category: 'Metrics',
    definition: 'Het harmonische gemiddelde van Precision en Recall. Geeft een eerlijke score bij ongebalanceerde data.',
    example: '2 × (Precision × Recall) / (Precision + Recall).'
  },
  {
    term: 'Confusion Matrix',
    category: 'Metrics',
    definition: 'Een tabel die laat zien waar een AI correct (TP, TN) en incorrect (FP, FN) voorspelt.',
    example: 'Een 2×2 tabel met True Positives, False Positives, False Negatives en True Negatives.'
  },
  {
    term: 'Benchmark',
    category: 'Metrics',
    definition: 'Een gestandaardiseerde testset waarmee AI-modellen objectief vergeleken worden — de CITO-toets van AI.',
    example: 'MMLU voor algemene kennis, HumanEval voor code, HellaSwag voor tekstbegrip.'
  },
  {
    term: 'Parameters',
    category: 'Techniek',
    definition: 'De interne gewichten in een neuraal netwerk. Meer parameters = complexer model.',
    example: 'GPT-4 heeft naar schatting 1.800 miljard parameters; een klein model als Phi-3 heeft 3,8 miljard.'
  },
  {
    term: 'Fine-tuning',
    category: 'Techniek',
    definition: 'Het verder trainen van een bestaand model op een specifieke, kleinere dataset voor een bepaald domein.',
    example: 'Een basismodel aanpassen zodat het de terminologie van Nederlandse examenstof biologie beheerst.'
  },
  {
    term: 'Edge AI (Lokaal Model)',
    category: 'Techniek',
    definition: 'AI draaien op lokale hardware (schoolserver/laptop) in plaats van in een extern cloud-datacenter.',
    example: 'Een LLaMA 8B model op een schoolserver, zonder internetverbinding.'
  },
  {
    term: 'Deepfake',
    category: 'Ethiek & Wet',
    definition: 'Door AI gegenereerde neppe video, foto of audio die er overtuigend echt uitziet.',
    example: 'Een nepvideo waarin een politicus iets zegt dat hij nooit gezegd heeft.'
  },
  {
    term: 'Bias (Vooringenomenheid)',
    category: 'Ethiek & Wet',
    definition: 'Systematische vooroordelen in AI die ontstaan doordat de trainingsdata menselijke vooroordelen bevat.',
    example: 'Een sollicitatie-AI die vrouwelijke kandidaten systematisch lager scoort.'
  },
  {
    term: 'AVG / GDPR',
    category: 'Ethiek & Wet',
    definition: 'De Europese privacywet die strenge eisen stelt aan het verwerken van persoonsgegevens.',
    example: 'Leerlingnamen en cijfers mogen niet zomaar in openbare AI-modellen worden geplakt.'
  },
  {
    term: 'EU AI Act',
    category: 'Ethiek & Wet',
    definition: 'Europese wetgeving die AI indeelt in risicocategorieën en emotieherkenning op scholen verbiedt.',
    example: 'Hoog-risico AI voor examens vereist menselijk toezicht en transparantie.'
  },
  {
    term: 'Groene AI (Green AI)',
    category: 'Ethiek & Wet',
    definition: 'Het streven om de ecologische voetafdruk (energie, water, CO₂) van AI zo klein mogelijk te houden.',
    example: 'Compacte lokale modellen gebruiken en gerichte prompts schrijven om tokenverbruik te minimaliseren.'
  },
  {
    term: 'Overfitting',
    category: 'Techniek',
    definition: 'Wanneer een AI de trainingsdata uit het hoofd leert inclusief ruis, waardoor het slecht werkt op nieuwe data.',
    example: 'Een model dat 100% scoort op oude examens maar zakt voor een nieuw examen.'
  }
];

// ────────────────────────────────────────────
// CHECKLISTS
// ────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  category: string;
  rule: string;
  tip: string;
}

export const ACADEMY_CHECKLISTS: ChecklistItem[] = [
  {
    id: 'c1',
    category: '✍️ Prompting (CLEAR)',
    rule: 'Gebruik het CLEAR-framework voor elke belangrijke prompt.',
    tip: 'Context, Lengte, Examples, Actief werkwoord, Rol. Eén goed gestructureerde prompt bespaart 5 vage pogingen.'
  },
  {
    id: 'c2',
    category: '✍️ Prompting (CLEAR)',
    rule: 'Vraag bij complexe taken om Chain-of-Thought ("Denk stap voor stap").',
    tip: 'Dit dwingt het model tussenstappen uit te schrijven en voorkomt domme rekenfouten.'
  },
  {
    id: 'c3',
    category: '🛡️ Betrouwbaarheid & Fact-checking',
    rule: 'Vertrouw nooit blind op jaartallen, citaten en berekeningen.',
    tip: 'AI hallucineert gemakkelijk feiten. Controleer altijd via een betrouwbare tweede bron (schoolboek of encyclopedie).'
  },
  {
    id: 'c4',
    category: '🛡️ Betrouwbaarheid & Fact-checking',
    rule: 'Trianguleer: check elk belangrijk feit via minstens 2 bronnen.',
    tip: 'Verwijst de AI naar een studie? Zoek die studie op. Bestaat hij? Staat het er echt zo in?'
  },
  {
    id: 'c5',
    category: '🔒 Privacy & AVG',
    rule: 'Deel NOOIT persoonsgegevens in AI-prompts.',
    tip: 'Geen achternamen, adressen, leerlingnummers, medische gegevens of vertrouwelijke documenten in publieke AI-tools.'
  },
  {
    id: 'c6',
    category: '🔒 Privacy & AVG',
    rule: 'Let op de EU AI Act richtlijnen.',
    tip: 'Emotieherkenning en automatische gedragsbeoordeling zijn verboden op scholen. Ken je rechten!'
  },
  {
    id: 'c7',
    category: '🌱 Duurzaamheid & Tokens',
    rule: 'Formuleer gericht, voorkom onnodige herhaling.',
    tip: 'Elke prompt verbruikt rekenkracht. Eén gerichte vraag is beter dan vijf vage pogingen.'
  },
  {
    id: 'c8',
    category: '🌱 Duurzaamheid & Tokens',
    rule: 'Gebruik het passende modelformaat.',
    tip: 'Voor simpele opzoek- of vertaalvragen is een compact model milieuvriendelijker dan een gigantisch cloudmodel.'
  }
];
