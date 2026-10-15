import { ACADEMY_MODULES, ACADEMY_PRESENTATIONS } from '../academy/academyData';
import type { AcademyPresentationSlide } from '../academy/academyData';

export interface TeacherLessonGuide {
  moduleId: string;
  recommendedMinutes: number;
  teacherFocus: string;
  openingQuestion: string;
  coreMessage: string;
  liveDemo: string;
  classDiscussion: string;
  commonMisconceptions: string[];
  teacherPrep: string[];
  exitTicket: string;
  extension: string;
}

export const TEACHER_LESSON_GUIDES: Record<string, TeacherLessonGuide> = {
  'wat-is-ai': {
    moduleId: 'wat-is-ai', recommendedMinutes: 45,
    teacherFocus: 'Geef leerlingen een correct mentaal model van AI: data, training, model, inference en output. Vermijd de voorstelling dat een chatbot simpelweg “het internet zoekt” of op dezelfde manier denkt als een mens.',
    openingQuestion: 'Welke AI heb je vandaag gebruikt, en waar denk je dat die AI precies voor wordt ingezet?',
    coreMessage: 'AI is geen enkelvoudige technologie. Verschillende systemen leren patronen uit data en gebruiken die modellen voor nieuwe input; de uitkomst is niet automatisch waar of verstandig.',
    liveDemo: 'Laat een chatbot dezelfde eenvoudige vraag beantwoorden met minimale context en daarna met extra context. Bespreek wat veranderde en wat dat zegt over context en modelgedrag.',
    classDiscussion: 'Laat leerlingen AI, machine learning, deep learning en generatieve AI als een begrippenladder uitleggen.',
    commonMisconceptions: ['“AI denkt precies zoals een mens.”', '“Een taalmodel haalt een kant-en-klaar antwoord uit een database.”', '“Als een antwoord vloeiend klinkt, is het waarschijnlijk waar.”'],
    teacherPrep: ['Kies één herkenbare AI-toepassing uit de schoolcontext.', 'Open een veilige chatdemo voor live gebruik.', 'Bedenk één bewust foutgevoelige feitvraag voor de betrouwbaarheidsbrug naar module 3.'],
    exitTicket: 'Leg in drie zinnen het verschil uit tussen training en inference, en noem één reden waarom goede formuleringen nog geen garantie op waarheid geven.',
    extension: 'Laat leerlingen een AI-systeem tekenen als input → model → output en benoemen waar menselijke controle nodig is.'
  },
  'prompt-engineering': {
    moduleId: 'prompt-engineering', recommendedMinutes: 45,
    teacherFocus: 'Leer leerlingen prompts zien als een briefing. Het doel is niet “magische woorden” vinden, maar de taak, context, vorm, voorbeelden en grenzen helder maken en daarna itereren.',
    openingQuestion: 'Wanneer krijg je van een ander mens meestal een beter antwoord: bij een vage vraag of bij een duidelijke opdracht? Waarom?',
    coreMessage: 'Een sterke prompt maakt het gewenste resultaat concreet en controleerbaar. Een eerste output is een startpunt; verbeteren hoort bij het proces.',
    liveDemo: 'Doe live een A/B-test: “Leg klimaat uit” tegenover een CLEAR-prompt met doelgroep, vorm, voorbeeld en lengte. Laat de klas de verschillen in output benoemen.',
    classDiscussion: 'Laat groepjes één schoolprompt verbeteren en aanwijzen welk CLEAR-element zij hebben toegevoegd.',
    commonMisconceptions: ['“Een langere prompt is altijd beter.”', '“Een rolprompt maakt het model automatisch een echte expert.”', '“De eerste output is de definitieve output.”'],
    teacherPrep: ['Neem één echte opdracht uit een vak mee.', 'Maak vooraf een slechte en een verbeterde prompt.', 'Kies een korte, veilige live-demo zodat vergelijken centraal staat.'],
    exitTicket: 'Schrijf een verbeterde prompt met doel, context en gewenste vorm. Benoem welk onderdeel van CLEAR nog het meest zou kunnen worden aangescherpt.',
    extension: 'Laat leerlingen twee iteraties bewaren en kort noteren welk verschil elke wijziging in de output veroorzaakte.'
  },
  'betrouwbaarheid-factchecking': {
    moduleId: 'betrouwbaarheid-factchecking', recommendedMinutes: 45,
    teacherFocus: 'Maak het verschil zichtbaar tussen overtuigend taalgebruik en betrouwbare informatie. Leer een bron niet alleen te citeren, maar ook te controleren.',
    openingQuestion: 'Waarom geloven mensen soms een fout antwoord als het heel zelfverzekerd wordt gebracht?',
    coreMessage: 'Generatieve AI optimaliseert op bruikbare output, niet op een automatische waarheidscheck. Belangrijke claims vragen verificatie met passende bronnen.',
    liveDemo: 'Gebruik een korte feitvraag en laat leerlingen één claim van het antwoord verifiëren met twee onafhankelijke bronnen. Bespreek bronkwaliteit en wat er gebeurt wanneer bronnen elkaar tegenspreken.',
    classDiscussion: 'Laat de klas onderscheid maken tussen een feit, een interpretatie, een bronclaim en een onzekerheid.',
    commonMisconceptions: ['“Een bronverwijzing van AI is automatisch echt.”', '“Twee websites die hetzelfde zeggen zijn altijd twee onafhankelijke bronnen.”', '“Fact-checking is alleen nodig bij politieke onderwerpen.”'],
    teacherPrep: ['Selecteer één controleerbare claim.', 'Kies twee betrouwbare bronnen die leerlingen kunnen openen.', 'Gebruik geen persoonlijke of gevoelige data in de demo.'],
    exitTicket: 'Geef één AI-claim die je niet blind zou overnemen en beschrijf hoe je die zou controleren.',
    extension: 'Laat leerlingen een eenvoudige broncheck-rubric maken met herkomst, actualiteit, onafhankelijkheid en bewijs.'
  },
  'begrippen-metrics': {
    moduleId: 'begrippen-metrics', recommendedMinutes: 50,
    teacherFocus: 'Maak evaluatie concreet: een model is pas te beoordelen wanneer de taak, testset en meetlat duidelijk zijn. Laat leerlingen voelen waarom één metric onvoldoende kan zijn.',
    openingQuestion: 'Kan een AI 95% goed hebben en tóch onbruikbaar zijn? Bedenk een situatie.',
    coreMessage: 'Evaluatie begint bij een representatieve testset en een passende metric. Accuracy, precision, recall en F1 beantwoorden verschillende vragen.',
    liveDemo: 'Gebruik de confusion-matrix-tool met een spamfilter. Verander één waarde tegelijk en laat de klas voorspellen welke metric verandert en waarom.',
    classDiscussion: 'Vergelijk een situatie waarin false positives vervelend zijn met een situatie waarin false negatives ernstiger zijn.',
    commonMisconceptions: ['“De hoogste accuracy betekent het beste model.”', '“Precision en recall zijn hetzelfde.”', '“Een benchmarkscore vertelt automatisch hoe goed een model in mijn echte taak is.”'],
    teacherPrep: ['Zet een eenvoudige confusion matrix op het scherm.', 'Kies één klasvoorbeeld met duidelijke positive/negative cases.', 'Leg vooraf kort uit wat een representatieve evalset is.'],
    exitTicket: 'Kies tussen precision en recall voor één concreet scenario en leg uit welk type fout voor jou het zwaarst weegt.',
    extension: 'Laat leerlingen een mini-evalset van 10 voorbeelden ontwerpen en vooraf voorspellen welke metric zij het belangrijkst vinden.'
  },
  'modelkeuze': {
    moduleId: 'modelkeuze', recommendedMinutes: 45,
    teacherFocus: 'Verschuif de vraag van “welk model is het slimst?” naar “welke oplossing past bij deze taak en randvoorwaarden?”.',
    openingQuestion: 'Waarom zou je niet automatisch het grootste of meest geavanceerde model kiezen?',
    coreMessage: 'Modelkeuze is een trade-off tussen taakfit, kwaliteit, snelheid, context, kosten, tools, privacy, deployment en betrouwbaarheid.',
    liveDemo: 'Vergelijk twee denkbeeldige modellen voor dezelfde taak: een snelle kleine lokale variant en een zwaardere cloudvariant. Laat leerlingen per criterium afwegen welke keuze passend is.',
    classDiscussion: 'Maak met de klas een beslisboom: taak → risico → data → latency → toolbehoefte → modelkeuze.',
    commonMisconceptions: ['“Groter is altijd beter.”', '“Een modelscore op één benchmark vertelt genoeg.”', '“Privacy zit alleen in de modelnaam.”'],
    teacherPrep: ['Kies één herkenbare use case.', 'Maak vooraf een eenvoudige trade-offtabel.', 'Bepaal welke factoren in jullie context echt doorslaggevend zijn.'],
    exitTicket: 'Noem een AI-taak waarbij snelheid belangrijker kan zijn dan maximale modelkwaliteit, en leg uit waarom.',
    extension: 'Laat leerlingen voor eenzelfde probleem twee verschillende oplossingsarchitecturen ontwerpen en vergelijken.'
  },
  'groen-ai': {
    moduleId: 'groen-ai', recommendedMinutes: 40,
    teacherFocus: 'Leerlingen begrijpen waar de milieu-impact van AI vandaan komt en leren voorzichtig omgaan met exacte claims over energie, water en CO₂.',
    openingQuestion: 'Waar denk je dat de energie voor een AI-antwoord vandaan komt, en welke stappen kosten energie?',
    coreMessage: 'AI heeft infrastructuur nodig: rekenhardware, datacenters, elektriciteit en koeling. Efficiëntie is vaak een betere en eerlijkere ingang dan één vast getal per prompt.',
    liveDemo: 'Vergelijk twee workflows: één lange ongerichte prompt die meerdere keren opnieuw wordt uitgevoerd en één compacte workflow met duidelijk doel en hergebruik van resultaten. Bespreek relatieve efficiëntie.',
    classDiscussion: 'Laat leerlingen bedenken waar je AI-gebruik kunt verminderen zonder het leerdoel te verminderen.',
    commonMisconceptions: ['“Elke prompt kost altijd exact dezelfde hoeveelheid energie.”', '“Een lokaal model heeft per definitie geen milieu-impact.”', '“Groene AI betekent vooral geen AI gebruiken.”'],
    teacherPrep: ['Gebruik relatieve voorbeelden in plaats van schijnprecisie.', 'Bereid één inefficiënte en één efficiëntere workflow voor.', 'Leg uit dat hardware, datacenter en energiemix meewegen.'],
    exitTicket: 'Noem twee manieren waarop je een AI-workflow efficiënter kunt maken zonder het doel te verliezen.',
    extension: 'Laat leerlingen een “AI-efficiency checklist” ontwerpen voor hun eigen schoolgebruik.'
  },
  'ethiek-deepfakes': {
    moduleId: 'ethiek-deepfakes', recommendedMinutes: 50,
    teacherFocus: 'Maak duidelijk dat ethiek niet alleen gaat over regels, maar over gevolgen, waarden, macht, privacy, eerlijkheid en verantwoordelijkheid.',
    openingQuestion: 'Wanneer kan iets technisch mogelijk zijn maar toch geen goed idee?',
    coreMessage: 'AI-systemen worden gebruikt door mensen in contexten met gevolgen. Bias, privacy, auteursrecht, transparantie en synthetische media vragen om bewuste keuzes en menselijke verantwoordelijkheid.',
    liveDemo: 'Analyseer een fictieve synthetische afbeelding of tekst zonder te focussen op “AI-detectoren”. Laat leerlingen bewijs, bron, context en onzekerheid bespreken.',
    classDiscussion: 'Laat groepen een AI-toepassing beoordelen vanuit verschillende rollen: gebruiker, getroffen persoon, organisatie en toezichthouder.',
    commonMisconceptions: ['“AI is neutraal omdat het door data wordt getraind.”', '“Een detector kan altijd bepalen of iets door AI is gemaakt.”', '“Ethiek komt pas aan het einde van een project.”'],
    teacherPrep: ['Kies een neutrale, leeftijdsgeschikte case.', 'Bereid meerdere perspectieven op dezelfde casus voor.', 'Vermijd het tonen van echte gevoelige personen of misleidende nepcontent.'],
    exitTicket: 'Welke twee vragen zou jij altijd stellen voordat je synthetische media deelt?',
    extension: 'Laat leerlingen een korte AI-gebruiksrichtlijn voor hun klas formuleren.'
  },
  'ai-veiligheid-privacy': {
    moduleId: 'ai-veiligheid-privacy', recommendedMinutes: 50,
    teacherFocus: 'Maak veiligheid praktisch: welke data deel je, welke rechten geef je een systeem, welke instructies zijn betrouwbaar en waar moet een mens goedkeuren?',
    openingQuestion: 'Welke informatie zou je wel aan een AI geven, maar niet zonder toestemming aan een onbekende op straat?',
    coreMessage: 'Veilige AI ontstaat uit de combinatie van dataminimalisatie, toegangsbeperkingen, betrouwbare instructies, veilige tools en menselijke controle.',
    liveDemo: 'Laat een voorbeeld zien van een document waarin een kwaadaardige instructie tussen gewone tekst staat. Bespreek waarom een AI die tekst als data moet behandelen en niet als opdracht.',
    classDiscussion: 'Teken samen de keten data → model → tool → actie en zet bij iedere stap een mogelijke veiligheidsmaatregel.',
    commonMisconceptions: ['“Als de gebruiker geen wachtwoord deelt, is privacy geregeld.”', '“Een systeeminstructie maakt prompt injection onmogelijk.”', '“Een AI die weinig fouten maakt heeft automatisch weinig veiligheidsrisico.”'],
    teacherPrep: ['Gebruik alleen fictieve data.', 'Bereid een onschuldig prompt-injectionvoorbeeld voor.', 'Plan extra aandacht voor human-in-the-loop bij risicovolle acties.'],
    exitTicket: 'Noem één datasetveld dat je kunt verwijderen uit een AI-taak en leg uit waarom dat veiliger is.',
    extension: 'Laat leerlingen een “least privilege”-ontwerp maken voor een AI-assistent op school.'
  },
  'ai-tools-agents': {
    moduleId: 'ai-tools-agents', recommendedMinutes: 55,
    teacherFocus: 'Laat leerlingen het verschil begrijpen tussen een model dat tekst genereert en een systeem dat informatie ophaalt, tools gebruikt en meerdere stappen uitvoert.',
    openingQuestion: 'Wat verandert er wanneer een AI niet alleen antwoordt, maar ook zelf een bestand kan lezen of een actie kan uitvoeren?',
    coreMessage: 'Tools en agents vergroten de mogelijkheden én de mogelijke impact van fouten. Naarmate autonomie stijgt, moet ook controle en begrenzing meebewegen.',
    liveDemo: 'Bouw op het bord een workflow: vraag → retrieval → model → tool → controle → actie. Laat leerlingen aanwijzen waar een fout kan ontstaan.',
    classDiscussion: 'Welke stap in een workflow mag volgens jullie nooit volledig autonoom zijn? Laat verschillende antwoorden verdedigen.',
    commonMisconceptions: ['“Een agent is gewoon een chatbot met een langere prompt.”', '“Meer autonomie is altijd efficiënter en dus beter.”', '“RAG maakt hallucinaties onmogelijk.”'],
    teacherPrep: ['Gebruik een eenvoudige fictieve workflow.', 'Kies één externe tool of gegevensbron als voorbeeld.', 'Bepaal expliciet waar menselijke goedkeuring hoort.'],
    exitTicket: 'Ontwerp één AI-workflow met een menselijk controlepunt en leg uit waarom dat punt nodig is.',
    extension: 'Laat leerlingen dezelfde workflow ontwerpen met lage, middelhoge en hoge autonomie en de risico’s vergelijken.'
  },
  'ai-projecten': {
    moduleId: 'ai-projecten', recommendedMinutes: 60,
    teacherFocus: 'Breng de hele leerlijn samen. Leerlingen leren een AI-oplossing benaderen als een project: probleem, criteria, prototype, testen, verbeteren, documenteren en monitoren.',
    openingQuestion: 'Wanneer weet je eigenlijk dat een AI-oplossing “goed genoeg” is?',
    coreMessage: 'Een betrouwbare AI-oplossing begint bij een echt probleem en wordt bewezen door testgevallen, succescriteria, documentatie, veiligheid en continu verbeteren.',
    liveDemo: 'Neem een eenvoudige AI-taak en laat live zien hoe je van probleem naar succescriterium, prototype en vijf testcases gaat.',
    classDiscussion: 'Laat teams hun project pitchen alsof zij toestemming vragen om de oplossing in de praktijk te gebruiken.',
    commonMisconceptions: ['“Een goede demo betekent dat het systeem klaar is.”', '“Je hebt maar één metric nodig.”', '“Documentatie is alleen administratie achteraf.”'],
    teacherPrep: ['Kies één klein voorbeeldproject als model.', 'Zet de projectcyclus zichtbaar op het bord.', 'Bereid een eenvoudige evaluatierubric voor.'],
    exitTicket: 'Formuleer één probleem, één succescriterium en één testcase voor een eigen AI-idee.',
    extension: 'Laat leerlingen hun eindproject beoordelen met peer review voordat zij het presenteren.'
  }
};

export function getTeacherGuide(moduleId: string): TeacherLessonGuide {
  return TEACHER_LESSON_GUIDES[moduleId] ?? TEACHER_LESSON_GUIDES['wat-is-ai'];
}

export function getTeacherModules() {
  return ACADEMY_MODULES.map((module: any) => ({
    ...module,
    presentation: ACADEMY_PRESENTATIONS[module.id]
  })).filter((item: any) => Boolean(item.presentation));
}

export function buildTeacherSlideNote(slide: AcademyPresentationSlide, guide: TeacherLessonGuide) {
  const byKind: Record<AcademyPresentationSlide['kind'], string> = {
    intro: `Open met de vraag: “${guide.openingQuestion}” en laat eerst meerdere leerlingen reageren voordat je de kernuitleg geeft.`,
    concept: `Leg de begrippen uit aan de hand van één concreet voorbeeld uit de klas. Benadruk: ${guide.coreMessage}`,
    example: `Gebruik het voorbeeld als gespreksmoment. Vraag eerst wat leerlingen zelf zien voordat je de vaktermen benoemt.`,
    activity: `Laat leerlingen actief formuleren, vergelijken of ontwerpen. Loop rond en luister naar begripsverwarring; bespreek daarna één sterk en één fout voorbeeld plenair.`,
    scenario: `Laat de klas eerst een keuze maken en daarna hun redenering verdedigen. Stuur het gesprek terug naar doel, risico, bewijs en menselijke controle.`,
    recap: `Sluit af met het exit ticket: “${guide.exitTicket}” en laat twee leerlingen hun antwoord kort toelichten.`
  };

  return {
    talkTrack: byKind[slide.kind],
    discussion: slide.question?.prompt || guide.classDiscussion,
    watchOut: guide.commonMisconceptions[Math.min(Math.max(Number(slide.id.match(/-(\d+)$/)?.[1] ?? 1) - 1, 0), guide.commonMisconceptions.length - 1)],
    demo: guide.liveDemo
  };
}
