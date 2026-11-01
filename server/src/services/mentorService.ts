import { prisma } from '../index';
import { clusterRouter } from './clusterRouter';

export interface MentorStudentItem {
  id: string;
  displayName: string;
  email: string;
  username: string;
  careSignals: {
    level1Count: number;
    level2Count: number;
    level3Count: number;
    hasCriticalOpen: boolean;
  };
  writingDna: {
    samplesCount: number;
    lastAnomalyScore: number | null;
    needsReview: boolean;
  };
  examProgress: {
    examsCompleted: number;
    avgGrade: number | null;
  };
}

export class MentorService {
  /**
   * Haalt alle klassen op waarvan de docent mentor is (of alle klassen indien admin).
   */
  public async getMentorClasses(userId: string, orgId: string, isAdmin: boolean) {
    if (isAdmin) {
      return prisma.class.findMany({
        where: { orgId },
        include: {
          _count: { select: { studentMembers: true } },
          teacherMembers: {
            where: { isMentor: true },
            include: { teacher: { select: { id: true, displayName: true } } }
          }
        },
        orderBy: { name: 'asc' }
      });
    }

    // Docent: haal klassen op waar isMentor = true
    const mentorRelations = await prisma.teacherClass.findMany({
      where: {
        teacherId: userId,
        isMentor: true,
        class: { orgId }
      },
      include: {
        class: {
          include: {
            _count: { select: { studentMembers: true } },
            teacherMembers: {
              where: { isMentor: true },
              include: { teacher: { select: { id: true, displayName: true } } }
            }
          }
        }
      }
    });

    return mentorRelations.map((rel: any) => rel.class);
  }

  /**
   * Haalt het complete mentoroverzicht op voor een specifieke klas.
   */
  public async getMentorClassOverview(classId: string, orgId: string) {
    const cls = await prisma.class.findFirst({
      where: { id: classId, orgId },
      include: {
        studentMembers: {
          include: {
            student: {
              select: {
                id: true,
                displayName: true,
                email: true,
                username: true,
                writingProfile: true,
                careFlags: {
                  where: { status: { in: ['open', 'in_review'] } },
                  orderBy: { createdAt: 'desc' }
                },
                plagiarismScans: {
                  orderBy: { createdAt: 'desc' },
                  take: 3
                },
                examSessions: {
                  where: { status: 'completed' },
                  select: { grade: true }
                }
              }
            }
          }
        }
      }
    });

    if (!cls) throw new Error('Klas niet gevonden');

    // Bereken recente incidenten voor de klas (afgelopen 30 dagen)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bullyingIncidents = await prisma.bullyingIncident.findMany({
      where: {
        orgId,
        classId,
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Klasveiligheidsscore (100 = perfect veilig, daalt per incident)
    const safetyIndex = Math.max(10, 100 - (bullyingIncidents.length * 8));

    const students: MentorStudentItem[] = cls.studentMembers.map((m: any) => {
      const s = m.student;
      const flags = s.careFlags || [];
      const level1 = flags.filter((f: any) => f.escalationLevel === 1).length;
      const level2 = flags.filter((f: any) => f.escalationLevel === 2).length;
      const level3 = flags.filter((f: any) => f.escalationLevel === 3).length;

      const scans = s.plagiarismScans || [];
      const latestScan = scans[0];

      const completedExams = s.examSessions || [];
      const validGrades = completedExams.map((e: any) => e.grade).filter((g: any): g is number => typeof g === 'number');
      const avgGrade = validGrades.length > 0
        ? parseFloat(((validGrades as number[]).reduce((a: number, b: number) => a + b, 0) / validGrades.length).toFixed(1))
        : null;

      return {
        id: s.id,
        displayName: s.displayName,
        email: s.email,
        username: s.username,
        careSignals: {
          level1Count: level1,
          level2Count: level2,
          level3Count: level3,
          hasCriticalOpen: level3 > 0
        },
        writingDna: {
          samplesCount: s.writingProfile?.samplesCount || 0,
          lastAnomalyScore: latestScan ? latestScan.styleAnomalyScore : null,
          needsReview: scans.some((sc: any) => sc.status === 'review_needed')
        },
        examProgress: {
          examsCompleted: completedExams.length,
          avgGrade
        }
      };
    });

    return {
      classId: cls.id,
      className: cls.name,
      description: cls.description,
      totalStudents: students.length,
      safetyIndex,
      recentIncidentsCount: bullyingIncidents.length,
      students
    };
  }

  /**
   * Genereert of haalt een vertrouwelijke gespreksleidraad op voor de mentor bij een zorgsignaal.
   */
  public async generateOrGetConversationGuide(flagId: string, orgId: string): Promise<string> {
    const flag = await prisma.studentCareFlag.findFirst({
      where: { id: flagId, orgId },
      include: {
        user: { select: { displayName: true, username: true } }
      }
    });

    if (!flag) throw new Error('Zorgsignaal niet gevonden');

    if (flag.conversationGuide) {
      return flag.conversationGuide;
    }

    // Genereer een vertrouwelijke pedagogische leidraad
    const categoryLabels: Record<string, string> = {
      suicide_risk: 'Acute Zorgen rondom Levensmoeheid / Zelfbeschadiging',
      self_harm: 'Signalen van Zelfbeschadiging of Somberheid',
      acute_distress: 'Grote Mentale Druk of Emotionele Nood',
      safety: 'Fysieke of Sociale Onveiligheid'
    };

    const thema = categoryLabels[flag.category] || 'Emotioneel Welzijn';
    const leerling = flag.user.displayName;

    let guide = `### 📋 Vertrouwelijke Gespreksleidraad voor Mentor & Zorgteam\n\n`;
    guide += `**Leerling:** ${leerling} | **Thema:** ${thema} | **Escalatieniveau:** ${flag.escalationLevel} (Verhoogde Aandacht)\n\n`;
    guide += `> **Doel:** Het creëren van een veilige, oordeelvrije bedding om te signaleren hoe het met de leerling gaat, zonder te confronteren met chatdata.\n\n`;

    guide += `#### 1. Gesprekssetting & Voorbereiding\n`;
    guide += `- Kies een rustige, neutrale ruimte waar andere leerlingen niet kunnen meekijken of luisteren.\n`;
    guide += `- Plan 15 tot 20 minuten; zorg dat je zelf niet gehaast bent.\n`;
    guide += `- Noem **niet** letterlijk dat een algoritme of chat dit heeft gesignaleerd; open vanuit je eigen menselijke observatie als mentor.\n\n`;

    guide += `#### 2. Openingsvragen & Gespreksstarters\n`;
    guide += `1. *"Hoi ${leerling}, fijn dat we even rustig kunnen zitten. Hoe gaan de lessen en je toetsen de laatste tijd voor jouw gevoel?"*\n`;
    guide += `2. *"Ik merk aan je dat er soms veel op je afkomt. Hoe zit je op dit moment in je vel op school en thuis?"*\n`;
    guide += `3. *"Is er iets waar je je op dit moment zorgen over maakt of waar je piekert waar we je als school bij kunnen ondersteunen?"*\n`;
    guide += `4. *"Met wie praat je meestal als je een baaldag hebt of ergens mee zit?"*\n\n`;

    guide += `#### 3. Do's & Don'ts\n`;
    guide += `- ✅ **DO:** Luister actief (LSD: Luisteren, Samenvatten, Doorvragen), erken de emoties ("Ik hoor dat dit zwaar voor je is").\n`;
    guide += `- ✅ **DO:** Bied perspectief dat hulp en verlichting altijd mogelijk zijn.\n`;
    guide += `- ❌ **DON'T:** Bagatelliseer het niet ("Iedereen heeft het wel eens druk") en ga niet direct oplossingen opleggen.\n\n`;

    guide += `#### 4. Vervolgstappen & Escalatieprotocol\n`;
    guide += `- Maak direct een vervolgafspraak voor over 3 of 4 dagen.\n`;
    guide += `- Indien de leerling aangeeft vast te lopen: betrek de interne zorgcoördinator of vertrouwenspersoon.\n`;
    guide += `- Leg een korte, feitelijke notitie vast in het leerlingdossier conform het schoolveiligheidsplan.\n`;

    // Sla op in database
    await prisma.studentCareFlag.update({
      where: { id: flagId },
      data: { conversationGuide: guide }
    });

    return guide;
  }

  /**
   * Wijzigt of een docent mentor is van een specifieke klas.
   */
  public async toggleTeacherMentor(classId: string, teacherId: string, isMentor: boolean, orgId: string) {
    const cls = await prisma.class.findFirst({ where: { id: classId, orgId } });
    if (!cls) throw new Error('Klas niet gevonden');

    return prisma.teacherClass.upsert({
      where: {
        classId_teacherId: { classId, teacherId }
      },
      create: {
        classId,
        teacherId,
        isMentor
      },
      update: {
        isMentor
      }
    });
  }
}

export const mentorService = new MentorService();
