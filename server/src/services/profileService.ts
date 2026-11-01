import { PrismaClient } from '@prisma/client';
import { ollamaClient } from './ollama';

export interface ProfileAnalysisResult {
  interests?: string[];
  learningStyle?: string;
  strengths?: string[];
  difficulties?: string[];
  goals?: string[];
  personalityTraits?: string[];
  aiPersonaSummary?: string;
}

/**
 * Service voor het discreet en verantwoord opbouwen van AI-leerlingprofielen.
 * Respecteert te allen tijde de admin-instellingen en categorie-schakelaars van de school.
 */
export class ProfileService {
  /**
   * Analyseer een recente conversatie-interactie op de achtergrond en werk het profiel bij.
   */
  async analyzeAndUpdateUserProfile(
    prisma: PrismaClient,
    params: {
      userId: string;
      orgId: string;
      conversationTitle?: string;
      userPrompt: string;
      assistantResponse: string;
      force?: boolean;
    }
  ) {
    const { userId, orgId, conversationTitle, userPrompt, assistantResponse, force } = params;

    try {
      // 1. Controleer schoolinstellingen (OrgSettings)
      let settings = await prisma.orgSettings.findUnique({
        where: { orgId }
      });

      if (!settings) {
        settings = await prisma.orgSettings.create({
          data: { orgId }
        });
      }

      if (!settings.enableUserProfileBuilding && !force) {
        return null; // Feature staat uit voor de school
      }

      // Check of de gebruiker niet een docent of beheerder is (of controleer of student opt-out heeft gekozen)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true }
      });

      if (!user) return null;

      // Als de gebruiker personalisatie zelf heeft uitgezet (indien toegestaan door admin)
      if (user.profile && !user.profile.isPersonalizationEnabled && !force) {
        return null;
      }

      // Alleen zinvol als de interactie voldoende inhoud heeft (tenzij geforceerd door admin)
      if (userPrompt.trim().length < 15 && !force) {
        return null;
      }

      // 2. Bepaal welke categorieën actief zijn
      const activeCategories: string[] = [];
      if (settings.profileTrackInterests) activeCategories.push('interests');
      if (settings.profileTrackLearningStyle) activeCategories.push('learningStyle');
      if (settings.profileTrackStrengthsWeaknesses) {
        activeCategories.push('strengths');
        activeCategories.push('difficulties');
      }
      if (settings.profileTrackGoals) activeCategories.push('goals');
      if (settings.profileTrackPersonality) activeCategories.push('personalityTraits');

      if (activeCategories.length === 0) {
        return null;
      }

      // 3. Bouw de analyse-prompt voor het AI Helper Model
      const helperModel = settings.orgHelperModel || 'qwen3.5:9b';
      const existingProfile = user.profile;

      const systemPrompt = `Je bent een pedagogische AI-analysator voor een Nederlands schoolsysteem.
Jouw doel is om op een veilige, respectvolle en constructieve manier te ontdekken wat de interesses, leervoorkeuren en onderwijsbehoeften van de leerling zijn.
Neem GEEN gevoelige persoonsgegevens (zoals medische data, achternamen, adressen of religie) op.

Actief toegestane categorieën door schoolbeheerder:
${activeCategories.map(c => `- ${c}`).join('\n')}

Antwoord UITSLUITEND met een valide JSON object in het volgende formaat (zonder markdown code blocks of extra tekst):
{
  ${settings.profileTrackInterests ? '"interests": ["onderwerp1", "onderwerp2"],' : ''}
  ${settings.profileTrackLearningStyle ? '"learningStyle": "korte observatie over hoe de leerling het prettigst leert (bijv. beelddenker, stapsgewijs, praktijkvoorbeelden)",' : ''}
  ${settings.profileTrackStrengthsWeaknesses ? '"strengths": ["vak of onderwerp"],' : ''}
  ${settings.profileTrackStrengthsWeaknesses ? '"difficulties": ["vak of onderwerp waar hulp bij nodig is"],' : ''}
  ${settings.profileTrackGoals ? '"goals": ["toekomstdroom of leardoel"],' : ''}
  ${settings.profileTrackPersonality ? '"personalityTraits": ["communicatiestijl of toonvoorkeur"],' : ''}
  "aiPersonaSummary": "Korte 1-2 zinnen samenvatting in het Nederlands voor de AI-assistent om voorbeelden aan te passen."
}`;

      const userContent = `Titel van gesprek: "${conversationTitle || 'Geen titel'}"
Leerling zei: "${userPrompt.slice(0, 1500)}"
AI antwoordde: "${assistantResponse.slice(0, 1500)}"

Bestaand profiel tot nu toe:
- Interesses: ${existingProfile?.interests || '[]'}
- Leerstijl: ${existingProfile?.learningStyle || 'onbekend'}
- Sterktes: ${existingProfile?.strengths || '[]'}
- Moeite met: ${existingProfile?.difficulties || '[]'}
- Doelen: ${existingProfile?.goals || '[]'}

Vul dit aan met ENKEL nieuwe, duidelijke observaties uit het recente gesprek. Als er niets nieuws te melden valt over een veld, laat het veld dan leeg of herhaal wat al bekend was.`;

      // 4. Roep het model aan
      const rawRes = await ollamaClient.generate(userContent, helperModel, systemPrompt, false);
      if (!rawRes.ok) return null;
      const resData = (await rawRes.json()) as any;
      const rawAiResponse = resData.response || '';
      
      // JSON extraheren en parsen
      const jsonMatch = rawAiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed: ProfileAnalysisResult = JSON.parse(jsonMatch[0]);

      // 5. Samenvoegen en dedubliceren (Merge helper)
      const mergeArrays = (existingJson: string | null | undefined, newItems: string[] | undefined): string => {
        let existing: string[] = [];
        try {
          if (existingJson) existing = JSON.parse(existingJson);
        } catch {}
        if (!Array.isArray(existing)) existing = [];
        if (!Array.isArray(newItems)) return JSON.stringify(existing);

        const combined = Array.from(new Set([...existing, ...newItems.map(s => s.trim())]))
          .filter(Boolean)
          .slice(0, 20); // Max 20 items per categorie
        return JSON.stringify(combined);
      };

      const updatedInterests = settings.profileTrackInterests
        ? mergeArrays(existingProfile?.interests, parsed.interests)
        : existingProfile?.interests;

      const updatedStrengths = settings.profileTrackStrengthsWeaknesses
        ? mergeArrays(existingProfile?.strengths, parsed.strengths)
        : existingProfile?.strengths;

      const updatedDifficulties = settings.profileTrackStrengthsWeaknesses
        ? mergeArrays(existingProfile?.difficulties, parsed.difficulties)
        : existingProfile?.difficulties;

      const updatedGoals = settings.profileTrackGoals
        ? mergeArrays(existingProfile?.goals, parsed.goals)
        : existingProfile?.goals;

      const updatedPersonality = settings.profileTrackPersonality
        ? mergeArrays(existingProfile?.personalityTraits, parsed.personalityTraits)
        : existingProfile?.personalityTraits;

      const updatedLearningStyle = settings.profileTrackLearningStyle
        ? (parsed.learningStyle?.trim() || existingProfile?.learningStyle)
        : existingProfile?.learningStyle;

      const updatedSummary = parsed.aiPersonaSummary?.trim() || existingProfile?.aiPersonaSummary;

      // 6. Opslaan in de database
      return await prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          orgId,
          interests: updatedInterests,
          learningStyle: updatedLearningStyle,
          strengths: updatedStrengths,
          difficulties: updatedDifficulties,
          goals: updatedGoals,
          personalityTraits: updatedPersonality,
          aiPersonaSummary: updatedSummary,
          lastAnalyzedAt: new Date(),
          analysisCount: 1
        },
        update: {
          interests: updatedInterests,
          learningStyle: updatedLearningStyle,
          strengths: updatedStrengths,
          difficulties: updatedDifficulties,
          goals: updatedGoals,
          personalityTraits: updatedPersonality,
          aiPersonaSummary: updatedSummary,
          lastAnalyzedAt: new Date(),
          analysisCount: { increment: 1 }
        }
      });
    } catch (err: any) {
      console.warn('Kon AI-profiel niet analyseren op achtergrond:', err.message);
      return null;
    }
  }

  /**
   * Analyseer direct de recente geschiedenis van de leerling op verzoek van de beheerder.
   */
  async analyzeUserHistory(prisma: PrismaClient, params: { userId: string; orgId: string }) {
    const { userId, orgId } = params;

    const userMessages = await prisma.message.findMany({
      where: {
        conversation: {
          userId,
          orgId
        },
        role: 'user'
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        conversation: { select: { title: true } }
      }
    });

    if (userMessages.length === 0) {
      throw new Error('Deze leerling heeft nog geen gesprekken gevoerd.');
    }

    const sampleChats = userMessages
      .map(m => `[Gesprek: "${m.conversation?.title || 'Zonder titel'}"] Leerling vroeg: "${m.content.slice(0, 300)}"`)
      .join('\n');

    return await this.analyzeAndUpdateUserProfile(prisma, {
      userId,
      orgId,
      conversationTitle: 'On-demand analyse van recente chats',
      userPrompt: sampleChats,
      assistantResponse: 'Analyseer het patroon van vragen, onderwerpen en belevingswereld van deze leerling.',
      force: true
    });
  }

  /**
   * Haal de personalsatie-instructie op voor in de AI system prompt.
   */
  async getPersonalizationPrompt(prisma: PrismaClient, userId: string, orgId: string): Promise<string> {
    try {
      const settings = await prisma.orgSettings.findUnique({
        where: { orgId },
        select: { enableUserProfileBuilding: true }
      });

      if (!settings?.enableUserProfileBuilding) {
        return '';
      }

      const profile = await prisma.userProfile.findUnique({
        where: { userId }
      });

      if (!profile || !profile.isPersonalizationEnabled) {
        return '';
      }

      const lines: string[] = [];

      let interests: string[] = [];
      try {
        if (profile.interests) interests = JSON.parse(profile.interests);
      } catch {}

      let goals: string[] = [];
      try {
        if (profile.goals) goals = JSON.parse(profile.goals);
      } catch {}

      let difficulties: string[] = [];
      try {
        if (profile.difficulties) difficulties = JSON.parse(profile.difficulties);
      } catch {}

      if (interests.length > 0) {
        lines.push(`- Interesses/Belevingswereld van de leerling: ${interests.join(', ')}.`);
      }
      if (profile.learningStyle) {
        lines.push(`- Leerstijl & Uitlegvoorkeur: ${profile.learningStyle}.`);
      }
      if (difficulties.length > 0) {
        lines.push(`- Aandachtspunten waar leerling extra ondersteuning bij kan gebruiken: ${difficulties.join(', ')}.`);
      }
      if (goals.length > 0) {
        lines.push(`- Leer- en toekomstdromen: ${goals.join(', ')}.`);
      }
      if (profile.aiPersonaSummary) {
        lines.push(`- Observatie: ${profile.aiPersonaSummary}`);
      }

      if (lines.length === 0) return '';

      return `\n\n[LEERLINGPROFIEL (VOOR PEDAGOGISCHE PERSONALISATIE)]
De school heeft personalisatie geactiveerd om uitleg beter aan te laten sluiten op de leerling:
${lines.join('\n')}
Instructie: Gebruik deze informatie subtiel en natuurlijk (bijvoorbeeld door metaforen of analogieën te kiezen uit de interesses van de leerling). Zeg niet letterlijk "Omdat je van voetbal houdt...", maar verwerk het vloeiend in je voorbeelden. Het is niet verplicht om het te gebruiken!\n`;
    } catch {
      return '';
    }
  }
}

export const profileService = new ProfileService();
