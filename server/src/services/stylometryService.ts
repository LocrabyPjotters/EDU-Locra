import { prisma } from '../index';

export interface StylometryMetrics {
  totalWords: number;
  totalSentences: number;
  avgSentenceLength: number;
  lexicalDiversityTTR: number; // Type-Token Ratio
  passiveVoiceRatio: number;
  vocabularyComplexity: number; // Percentage words > 7 letters
  academicTransitionsCount: number;
}

export interface StylometryAnalysisResult {
  scanId: string;
  documentTitle: string;
  metrics: StylometryMetrics;
  baselineMetrics: Partial<StylometryMetrics> | null;
  styleAnomalyScore: number; // 0.0 - 1.0 (deviation from own baseline)
  aiProbabilityScore: number; // 0.0 - 1.0 (stylometric AI detection markers)
  flaggedReasons: string[];
  verdict: 'geen_afwijking' | 'aandachtspunt' | 'sterke_indicatie_ai_of_extern';
}

export class StylometryService {
  /**
   * Extraheert stilometrische kenmerken uit een Nederlandse tekst.
   */
  public extractMetrics(text: string): StylometryMetrics {
    const cleanText = text.trim();
    if (!cleanText) {
      return {
        totalWords: 0,
        totalSentences: 0,
        avgSentenceLength: 0,
        lexicalDiversityTTR: 0,
        passiveVoiceRatio: 0,
        vocabularyComplexity: 0,
        academicTransitionsCount: 0
      };
    }

    // Zinnen splitsen op . ! ? en nieuwe regels
    const rawSentences = cleanText.split(/[.!?]+|\n+/).map(s => s.trim()).filter(s => s.length > 0);
    const sentences = rawSentences.length > 0 ? rawSentences : [cleanText];

    // Woorden splitsen
    const words = cleanText
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s'-]/gu, '')
      .split(/\s+/)
      .filter(w => w.length > 0);

    const totalWords = words.length;
    const totalSentences = sentences.length;

    if (totalWords === 0) {
      return {
        totalWords: 0,
        totalSentences: 0,
        avgSentenceLength: 0,
        lexicalDiversityTTR: 0,
        passiveVoiceRatio: 0,
        vocabularyComplexity: 0,
        academicTransitionsCount: 0
      };
    }

    const avgSentenceLength = parseFloat((totalWords / totalSentences).toFixed(1));

    // Type-Token Ratio (Unieke woorden / totaal aantal woorden)
    const uniqueWords = new Set(words);
    const lexicalDiversityTTR = parseFloat((uniqueWords.size / totalWords).toFixed(3));

    // Passieve lijdende vorm patronen in het Nederlands:
    // "wordt/worden/werd/werden/is/zijn ... [ge/be/ver/her/ont]...[d/t/en]"
    const passiveRegex = /\b(wordt|worden|werd|werden|is|zijn)\b(?:\s+\w+){0,4}\s+\b(ge|be|ver|her|ont)\w+(d|t|en)\b/gi;
    let passiveMatches = 0;
    sentences.forEach(s => {
      if (passiveRegex.test(s)) {
        passiveMatches++;
      }
    });
    const passiveVoiceRatio = parseFloat((passiveMatches / totalSentences).toFixed(3));

    // Woorden met lengte >= 8 letters (complexe/vakterminologie)
    const complexWords = words.filter(w => w.length >= 8).length;
    const vocabularyComplexity = parseFloat((complexWords / totalWords).toFixed(3));

    // Typische AI overgangswoorden en formeel register in het Nederlands
    const aiTransitionMarkers = [
      'bovendien', 'echter', 'desalniettemin', 'ten eerste', 'ten tweede', 'concluderend',
      'samenvattend', 'daarenboven', 'enerzijds', 'anderzijds', 'cruciaal', 'facetten',
      'alomvattend', 'belichaamt', 'onmiskenbaar', 'resumerend'
    ];
    let academicTransitionsCount = 0;
    words.forEach(w => {
      if (aiTransitionMarkers.includes(w)) {
        academicTransitionsCount++;
      }
    });

    return {
      totalWords,
      totalSentences,
      avgSentenceLength,
      lexicalDiversityTTR,
      passiveVoiceRatio,
      vocabularyComplexity,
      academicTransitionsCount
    };
  }

  /**
   * Verwerkt een nieuwe betrouwbare tekst van een leerling en werkt het DNA-profiel bij.
   */
  public async updateStudentWritingProfile(userId: string, sampleText: string): Promise<void> {
    const metrics = this.extractMetrics(sampleText);
    if (metrics.totalWords < 40) return; // Te kort voor een statistisch profiel

    const profile = await prisma.studentWritingProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      await prisma.studentWritingProfile.create({
        data: {
          userId,
          samplesCount: 1,
          avgSentenceLength: metrics.avgSentenceLength,
          lexicalDiversityTTR: metrics.lexicalDiversityTTR,
          passiveVoiceRatio: metrics.passiveVoiceRatio,
          vocabularyComplexity: metrics.vocabularyComplexity,
          baselineVectors: JSON.stringify([metrics])
        }
      });
      return;
    }

    // Gewogen voortschrijdend gemiddelde
    const count = profile.samplesCount;
    const newCount = count + 1;
    const newAvgSentenceLength = parseFloat(((profile.avgSentenceLength * count + metrics.avgSentenceLength) / newCount).toFixed(1));
    const newLexicalDiversity = parseFloat(((profile.lexicalDiversityTTR * count + metrics.lexicalDiversityTTR) / newCount).toFixed(3));
    const newPassiveVoice = parseFloat(((profile.passiveVoiceRatio * count + metrics.passiveVoiceRatio) / newCount).toFixed(3));
    const newVocabComplexity = parseFloat(((profile.vocabularyComplexity * count + metrics.vocabularyComplexity) / newCount).toFixed(3));

    let history: any[] = [];
    try {
      if (profile.baselineVectors) history = JSON.parse(profile.baselineVectors);
    } catch {}
    history.push({ ...metrics, date: new Date().toISOString() });
    if (history.length > 10) history = history.slice(-10);

    await prisma.studentWritingProfile.update({
      where: { userId },
      data: {
        samplesCount: newCount,
        avgSentenceLength: newAvgSentenceLength,
        lexicalDiversityTTR: newLexicalDiversity,
        passiveVoiceRatio: newPassiveVoice,
        vocabularyComplexity: newVocabComplexity,
        baselineVectors: JSON.stringify(history)
      }
    });
  }

  /**
   * Analyseert een ingeleverd werkstuk tegen het historische DNA van de leerling én algemene AI-kenmerken.
   */
  public async scanSubmission(
    userId: string,
    orgId: string,
    text: string,
    documentTitle: string,
    assignmentId?: string
  ): Promise<StylometryAnalysisResult> {
    const metrics = this.extractMetrics(text);
    const flaggedReasons: string[] = [];

    const profile = await prisma.studentWritingProfile.findUnique({
      where: { userId }
    });

    let styleAnomalyScore = 0.0;

    if (profile && profile.samplesCount >= 2) {
      // We hebben een historisch DNA-profiel van deze leerling
      const sentenceLenDiff = Math.abs(metrics.avgSentenceLength - profile.avgSentenceLength) / Math.max(1, profile.avgSentenceLength);
      const vocabCompDiff = Math.abs(metrics.vocabularyComplexity - profile.vocabularyComplexity) / Math.max(0.05, profile.vocabularyComplexity);
      const passiveDiff = Math.abs(metrics.passiveVoiceRatio - profile.passiveVoiceRatio) / Math.max(0.05, profile.passiveVoiceRatio);

      if (sentenceLenDiff > 0.6) {
        flaggedReasons.push(`Zinslengte (${metrics.avgSentenceLength} w/zin) wijkt ${Math.round(sentenceLenDiff * 100)}% af van het eigen gemiddelde (${profile.avgSentenceLength} w/zin)`);
      }
      if (vocabCompDiff > 0.7 && metrics.vocabularyComplexity > profile.vocabularyComplexity) {
        flaggedReasons.push(`Woordenschat-complexiteit (${Math.round(metrics.vocabularyComplexity * 100)}%) is significant hoger dan historisch (${Math.round(profile.vocabularyComplexity * 100)}%)`);
      }
      if (passiveDiff > 1.0 && metrics.passiveVoiceRatio > 0.25) {
        flaggedReasons.push(`Opvallende toename in passieve lijdende vormen (${Math.round(metrics.passiveVoiceRatio * 100)}% vs baseline ${Math.round(profile.passiveVoiceRatio * 100)}%)`);
      }

      // Bereken totale anomalie
      styleAnomalyScore = Math.min(1.0, parseFloat(((sentenceLenDiff * 0.4) + (vocabCompDiff * 0.35) + (passiveDiff * 0.25)).toFixed(2)));
    } else {
      // Nog geen baseline; vergelijk met typische VO-scholieren referentiewaarden
      if (metrics.avgSentenceLength > 24) {
        flaggedReasons.push(`Ongebruikelijk lange zinnen voor scholierenniveau (${metrics.avgSentenceLength} woorden per zin)`);
        styleAnomalyScore += 0.3;
      }
      if (metrics.vocabularyComplexity > 0.35) {
        flaggedReasons.push(`Zeer hoog aandeel academische/formele woorden (${Math.round(metrics.vocabularyComplexity * 100)}%)`);
        styleAnomalyScore += 0.3;
      }
    }

    // AI-kans berekenen op basis van syntactische uniformiteit en transitie-dichtheid
    let aiProbabilityScore = 0.05;
    const transitionDensity = metrics.totalWords > 0 ? (metrics.academicTransitionsCount / metrics.totalWords) * 100 : 0;
    if (transitionDensity > 1.8) {
      flaggedReasons.push(`Hoge concentratie typische AI-overgangsmarkeringen (${metrics.academicTransitionsCount}x 'bovendien/desalniettemin/concluderend')`);
      aiProbabilityScore += 0.45;
    }

    // AI schrijft vaak met extreem consistente zinslengtes en medium-high TTR
    if (metrics.avgSentenceLength >= 16 && metrics.avgSentenceLength <= 24 && metrics.lexicalDiversityTTR > 0.55) {
      aiProbabilityScore += 0.3;
    }

    if (metrics.passiveVoiceRatio > 0.3) {
      aiProbabilityScore += 0.2;
    }

    aiProbabilityScore = Math.min(0.98, parseFloat(aiProbabilityScore.toFixed(2)));
    styleAnomalyScore = Math.min(1.0, parseFloat(styleAnomalyScore.toFixed(2)));

    let verdict: 'geen_afwijking' | 'aandachtspunt' | 'sterke_indicatie_ai_of_extern' = 'geen_afwijking';
    if (styleAnomalyScore >= 0.65 || aiProbabilityScore >= 0.75) {
      verdict = 'sterke_indicatie_ai_of_extern';
    } else if (styleAnomalyScore >= 0.35 || aiProbabilityScore >= 0.45) {
      verdict = 'aandachtspunt';
    }

    // Bewaar het resultaat in de database
    const scan = await prisma.plagiarismScanResult.create({
      data: {
        orgId,
        studentId: userId,
        assignmentId,
        documentTitle: documentTitle || 'Werkstuk zonder titel',
        scannedText: text.slice(0, 15000), // Max 15k tekens bewaren
        styleAnomalyScore,
        aiProbabilityScore,
        flaggedReasons: JSON.stringify(flaggedReasons),
        status: verdict === 'sterke_indicatie_ai_of_extern' ? 'review_needed' : 'ok'
      }
    });

    return {
      scanId: scan.id,
      documentTitle: scan.documentTitle,
      metrics,
      baselineMetrics: profile ? {
        avgSentenceLength: profile.avgSentenceLength,
        lexicalDiversityTTR: profile.lexicalDiversityTTR,
        passiveVoiceRatio: profile.passiveVoiceRatio,
        vocabularyComplexity: profile.vocabularyComplexity
      } : null,
      styleAnomalyScore,
      aiProbabilityScore,
      flaggedReasons,
      verdict
    };
  }
}

export const stylometryService = new StylometryService();
