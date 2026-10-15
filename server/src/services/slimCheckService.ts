import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import PDFDocument from 'pdfkit';
import { prisma } from '../index';
import { ollamaClient } from './ollama';

const pdfParse = require('pdf-parse');

const execFileAsync = promisify(execFile);

export interface RedactRect {
  x: number; // percentage (0-100) or pixels
  y: number;
  width: number;
  height: number;
  isPercent?: boolean;
}

export class SlimCheckService {
  private uploadsBase: string;

  constructor() {
    this.uploadsBase = path.join(process.cwd(), 'uploads', 'slimcheck');
    if (!fs.existsSync(this.uploadsBase)) {
      fs.mkdirSync(this.uploadsBase, { recursive: true });
    }
  }

  getSessionDir(sessionId: string): string {
    const dir = path.join(this.uploadsBase, sessionId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  getPagesDir(sessionId: string): string {
    const dir = path.join(this.getSessionDir(sessionId), 'pages');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  getCropsDir(sessionId: string): string {
    const dir = path.join(this.getSessionDir(sessionId), 'crops');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /**
   * Converts a PDF into PNG images per page.
   * Uses pypdfium2 via python/uv for blazing fast, dependency-free rendering.
   * Returns list of created PNG file paths sorted by page number.
   */
  async convertPdfToImages(pdfPath: string, sessionId: string): Promise<string[]> {
    const pagesDir = this.getPagesDir(sessionId);

    // Clean existing pages
    const existing = fs.readdirSync(pagesDir);
    for (const file of existing) {
      if (file.endsWith('.png')) {
        try { fs.unlinkSync(path.join(pagesDir, file)); } catch (e) { /* ignore */ }
      }
    }

    // Python script using pypdfium2 to render each page
    const pyScript = `
import pypdfium2 as pdfium
import sys, os

pdf_path = sys.argv[1]
out_dir = sys.argv[2]

pdf = pdfium.PdfDocument(pdf_path)
page_count = len(pdf)
print(f"PAGES:{page_count}")

for i, page in enumerate(pdf):
    page_num = i + 1
    # scale 2 is approx 144-150 DPI - ideal balance between OCR sharpness and speed
    image = page.render(scale=2).to_pil()
    out_file = os.path.join(out_dir, f"page_{page_num:03d}.png")
    image.save(out_file)

print("DONE")
`;

    const scriptPath = path.join(this.getSessionDir(sessionId), '_extract_pages.py');
    fs.writeFileSync(scriptPath, pyScript, 'utf8');

    try {
      // Execute via uv run or python3
      const env = { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || ''}` };
      await execFileAsync('uv', ['run', '--with', 'pypdfium2', '--with', 'pillow', 'python3', scriptPath, pdfPath, pagesDir], { env });
    } catch (err: any) {
      // Fallback: try python3 directly if pypdfium2 is installed in system python
      try {
        await execFileAsync('python3', [scriptPath, pdfPath, pagesDir]);
      } catch (err2: any) {
        throw new Error(`PDF pagina-extractie mislukt: ${err.message || err}`);
      }
    } finally {
      if (fs.existsSync(scriptPath)) {
        try { fs.unlinkSync(scriptPath); } catch (e) { /* ignore */ }
      }
    }

    const files = fs.readdirSync(pagesDir)
      .filter(f => f.startsWith('page_') && f.endsWith('.png'))
      .sort()
      .map(f => path.join(pagesDir, f));

    return files;
  }

  /**
   * Permanently blacks out/overwrites the redacted rectangle on an image.
   * Sharp composites a solid dark box onto the pixels permanently.
   */
  async redactImage(imagePath: string, rect: RedactRect): Promise<void> {
    if (!fs.existsSync(imagePath)) return;

    const meta = await sharp(imagePath).metadata();
    const imgWidth = meta.width || 1200;
    const imgHeight = meta.height || 1600;

    let left = rect.isPercent !== false ? Math.round((rect.x / 100) * imgWidth) : Math.round(rect.x);
    let top = rect.isPercent !== false ? Math.round((rect.y / 100) * imgHeight) : Math.round(rect.y);
    let width = rect.isPercent !== false ? Math.round((rect.width / 100) * imgWidth) : Math.round(rect.width);
    let height = rect.isPercent !== false ? Math.round((rect.height / 100) * imgHeight) : Math.round(rect.height);

    // Boundary clamping
    left = Math.max(0, Math.min(left, imgWidth - 10));
    top = Math.max(0, Math.min(top, imgHeight - 10));
    width = Math.min(width, imgWidth - left);
    height = Math.min(height, imgHeight - top);

    if (width <= 0 || height <= 0) return;

    // Create solid rectangle overlay
    const overlayBuffer = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 17, g: 24, b: 39, alpha: 1 } // Solid Locra dark surface color
      }
    }).png().toBuffer();

    const tempOut = `${imagePath}.redacted.png`;
    await sharp(imagePath)
      .composite([{ input: overlayBuffer, left, top }])
      .toFile(tempOut);

    fs.renameSync(tempOut, imagePath);
  }

  /**
   * Applies the redaction rectangle to the first page of every student scan and saves layoutZone.
   */
  async applyRedactionToAllScans(sessionId: string, rect: RedactRect, layoutZone?: { dividerX: number }): Promise<void> {
    const session = await prisma.slimCheckSession.findUnique({
      where: { id: sessionId },
      include: { scans: true }
    });
    if (!session) throw new Error('Sessie niet gevonden');

    const pagesDir = this.getPagesDir(sessionId);

    // If scans are defined by mapping: redact startPage of each scan
    if (session.scans.length > 0) {
      for (const scan of session.scans) {
        const pageFile = path.join(pagesDir, `page_${String(scan.startPage).padStart(3, '0')}.png`);
        if (fs.existsSync(pageFile)) {
          await this.redactImage(pageFile, rect);
        }
      }
    } else {
      // Fallback: redact page 1
      const page1 = path.join(pagesDir, 'page_001.png');
      if (fs.existsSync(page1)) {
        await this.redactImage(page1, rect);
      }
    }

    // Save redaction coordinates and optional layout zone to session
    await prisma.slimCheckSession.update({
      where: { id: sessionId },
      data: {
        redactionRect: JSON.stringify(rect),
        ...(layoutZone ? { layoutZone: JSON.stringify(layoutZone) } : {}),
        status: 'redacting'
      }
    });
  }

  /**
   * Generates a pre-filled Excel template for student-page mapping.
   */
  async generateMappingTemplate(classId: string, orgId: string): Promise<Buffer> {
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        studentMembers: {
          include: { student: true }
        }
      }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Locra SlimCheck';
    const sheet = workbook.addWorksheet('Leerling Mapping');

    sheet.columns = [
      { header: 'Naam', key: 'name', width: 28 },
      { header: 'LocraID', key: 'locraId', width: 28 },
      { header: 'KlasID', key: 'classId', width: 24 },
      { header: 'Startpagina', key: 'startPage', width: 14 },
      { header: 'Eindpagina', key: 'endPage', width: 14 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C5CFC' } // Locra purple
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    const students = (classData?.studentMembers || []).map((s: any) => s.student).filter(Boolean);

    for (const student of students) {
      const row = sheet.addRow({
        name: student.displayName || student.username,
        locraId: student.id,
        classId: classId,
        startPage: '', // left blank for teacher or suggested
        endPage: ''
      });
      row.alignment = { vertical: 'middle' };
    }

    // Auto-fit and borders
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Parses uploaded Excel or CSV mapping file.
   */
  async parseMappingFile(fileBuffer: Buffer, isCsv: boolean): Promise<Array<{
    name: string;
    locraId: string;
    startPage: number;
    endPage: number;
  }>> {
    const results: Array<{ name: string; locraId: string; startPage: number; endPage: number }> = [];

    if (isCsv) {
      const records = parseCsv(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }) as any[];

      for (const rec of records) {
        const locraId = rec['LocraID'] || rec['locraId'] || rec['StudentID'] || rec['studentId'] || rec['ID'] || rec['id'] || '';
        const name = rec['Naam'] || rec['naam'] || rec['Name'] || rec['name'] || '';
        const start = parseInt(rec['Startpagina'] || rec['startPage'] || rec['Start'] || rec['start'] || '1', 10);
        const end = parseInt(rec['Eindpagina'] || rec['endPage'] || rec['End'] || rec['end'] || String(start), 10);

        if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
          results.push({ name, locraId, startPage: start, endPage: end });
        }
      }
    } else {
      const workbook = new ExcelJS.Workbook();
      await (workbook.xlsx.load as any)(fileBuffer);
      const sheet = workbook.worksheets[0];

      if (!sheet) throw new Error('Geen werkblad gevonden in Excel bestand');

      // Find column indices
      let colLocraId = -1;
      let colName = -1;
      let colStart = -1;
      let colEnd = -1;

      const headerRow = sheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').trim().toLowerCase();
        if (val.includes('locra') || val === 'id' || val.includes('studentid')) colLocraId = colNumber;
        if (val.includes('naam') || val.includes('name')) colName = colNumber;
        if (val.includes('start')) colStart = colNumber;
        if (val.includes('eind') || val.includes('end')) colEnd = colNumber;
      });

      // Default fallback column positions if header labels differ
      if (colLocraId === -1) colLocraId = 2;
      if (colName === -1) colName = 1;
      if (colStart === -1) colStart = 4;
      if (colEnd === -1) colEnd = 5;

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const name = String(row.getCell(colName).value || '').trim();
        const locraId = String(row.getCell(colLocraId).value || '').trim();
        const startVal = row.getCell(colStart).value;
        const endVal = row.getCell(colEnd).value;

        const start = parseInt(String(startVal || '1'), 10);
        const end = parseInt(String(endVal || startVal || '1'), 10);

        if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
          results.push({ name, locraId, startPage: start, endPage: end });
        }
      });
    }

    if (results.length === 0) {
      throw new Error('Geen geldige rijen met start- en eindpagina gevonden in de mapping.');
    }

    return results;
  }

  /**
   * Crops a vertical and horizontal slice of a test page image for the answer snippet lightbox.
   */
  async cropAnswerRegion(
    imagePath: string,
    outputPath: string,
    topPercent: number = 20,
    heightPercent: number = 30,
    leftPercent: number = 0,
    widthPercent: number = 100
  ): Promise<string> {
    if (!fs.existsSync(imagePath)) return '';

    try {
      const meta = await sharp(imagePath).metadata();
      const imgWidth = meta.width || 1200;
      const imgHeight = meta.height || 1600;

      const top = Math.max(0, Math.min(Math.round((topPercent / 100) * imgHeight), imgHeight - 100));
      const height = Math.min(Math.round((heightPercent / 100) * imgHeight), imgHeight - top);
      const left = Math.max(0, Math.min(Math.round((leftPercent / 100) * imgWidth), imgWidth - 50));
      const width = Math.min(Math.round((widthPercent / 100) * imgWidth), imgWidth - left);

      await sharp(imagePath)
        .extract({ left, top, width, height })
        .jpeg({ quality: 85 })
        .toFile(outputPath);

      return outputPath;
    } catch (e) {
      console.error('Crop failed:', e);
      return '';
    }
  }

  /**
   * Parse uploaded Assignment / Opgaven PDF ("wat de leerling ziet")
   * Extracts text, saves the file, and uses Ollama to extract the question prompts.
   */
  async parseAssignmentPdf(
    sessionId: string,
    pdfBuffer: Buffer,
    fileName: string
  ): Promise<{ success: boolean; fileName: string; text: string; questions: Array<{ number: number; promptText: string; maxPoints?: number }> }> {
    const session = await prisma.slimCheckSession.findUnique({
      where: { id: sessionId },
      include: { org: { include: { settings: true } } }
    });
    if (!session) throw new Error('Sessie niet gevonden');

    const destDir = this.getSessionDir(sessionId);
    const destPath = path.join(destDir, 'assignment.pdf');
    fs.writeFileSync(destPath, pdfBuffer);

    await prisma.slimCheckSession.update({
      where: { id: sessionId },
      data: {
        assignmentPdfPath: `uploads/slimcheck/${sessionId}/assignment.pdf`,
        assignmentPdfName: fileName
      }
    });

    let rawText = '';
    try {
      const parsed = await pdfParse(pdfBuffer);
      rawText = parsed.text || '';
    } catch (e: any) {
      console.warn('pdfParse failed on assignment PDF:', e.message);
    }

    const gradingModel = session.gradingModelId || session.org.settings?.slimCheckDefaultGradingModel || 'llama3.1:8b';
    let extractedQuestions: Array<{ number: number; promptText: string; maxPoints?: number }> = [];

    if (rawText.trim().length > 20) {
      const prompt = `Je bent een nauwkeurige docent-assistent. Analyseer het onderstaande toetsdocument / opdrachtenblad (de opgaven zoals de leerling die ziet).
Extraheer voor elke vraag het vraagnummer, de volledige opgave/vraagtekst en indien vermeld de maximale score (punten).

Retourneer UITSLUITEND een geldig JSON object in exact dit formaat:
{
  "questions": [
    {
      "number": 1,
      "promptText": "De volledige tekst van vraag 1...",
      "maxPoints": 2
    }
  ]
}

Toetsdocument tekst:
${rawText.slice(0, 12000)}`;

      try {
        const res = await ollamaClient.generate(
          prompt,
          gradingModel,
          'Je bent een behulpzame onderwijsassistent die toetsopdrachten structureert in JSON.',
          false
        );
        if (res.ok) {
          const data = await res.json();
          const jsonMatch = (data.response || '').match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.questions)) {
              extractedQuestions = parsed.questions.map((q: any, i: number) => ({
                number: typeof q.number === 'number' ? q.number : i + 1,
                promptText: String(q.promptText || '').trim(),
                maxPoints: typeof q.maxPoints === 'number' ? q.maxPoints : 1
              }));
            }
          }
        }
      } catch (err: any) {
        console.warn('AI question extraction from assignment PDF failed:', err.message);
      }
    }

    return {
      success: true,
      fileName,
      text: rawText,
      questions: extractedQuestions
    };
  }

  /**
   * Parse uploaded Correctiemodel / Antwoordmodel PDF
   * Extracts text, saves the file, and uses Ollama to parse all questions, criteria and model answers.
   */
  async parseRubricPdf(
    sessionId: string,
    pdfBuffer: Buffer,
    fileName: string
  ): Promise<{ success: boolean; fileName: string; text: string; questions: Array<{ number: number; promptText?: string; modelAnswer: string; maxPoints: number; notes?: string }> }> {
    const session = await prisma.slimCheckSession.findUnique({
      where: { id: sessionId },
      include: { org: { include: { settings: true } } }
    });
    if (!session) throw new Error('Sessie niet gevonden');

    const destDir = this.getSessionDir(sessionId);
    const destPath = path.join(destDir, 'rubric.pdf');
    fs.writeFileSync(destPath, pdfBuffer);

    await prisma.slimCheckSession.update({
      where: { id: sessionId },
      data: {
        rubricPdfPath: `uploads/slimcheck/${sessionId}/rubric.pdf`,
        rubricPdfName: fileName
      }
    });

    let rawText = '';
    try {
      const parsed = await pdfParse(pdfBuffer);
      rawText = parsed.text || '';
    } catch (e: any) {
      console.warn('pdfParse failed on rubric PDF:', e.message);
    }

    const gradingModel = session.gradingModelId || session.org.settings?.slimCheckDefaultGradingModel || 'llama3.1:8b';
    let extractedQuestions: Array<{ number: number; promptText?: string; modelAnswer: string; maxPoints: number; notes?: string }> = [];

    if (rawText.trim().length > 20) {
      const prompt = `Je bent een ervaren docent-assistent. Analyseer het onderstaande correctiemodel / antwoordmodel voor een toets.
Extraheer voor ELKE vraag:
1. Het vraagnummer (number)
2. De vraagstelling / opgave indien aanwezig (promptText)
3. Het volledige modelantwoord of de kernantwoorden (modelAnswer)
4. De maximale punten (maxPoints, default 1)
5. Eventuele docentinstructies, aftrekregels of deelpunten criteria (notes)

Retourneer UITSLUITEND een geldig JSON object in exact dit formaat:
{
  "questions": [
    {
      "number": 1,
      "promptText": "Eventuele vraagtekst...",
      "modelAnswer": "Het juiste antwoord volgens het correctiemodel...",
      "maxPoints": 2,
      "notes": "1 punt voor formule, 1 punt voor juiste eenheid"
    }
  ]
}

Correctiemodel tekst:
${rawText.slice(0, 14000)}`;

      try {
        const res = await ollamaClient.generate(
          prompt,
          gradingModel,
          'Je bent een behulpzame onderwijsassistent die correctiemodellen structureert in JSON.',
          false
        );
        if (res.ok) {
          const data = await res.json();
          const jsonMatch = (data.response || '').match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.questions)) {
              extractedQuestions = parsed.questions.map((q: any, i: number) => ({
                number: typeof q.number === 'number' ? q.number : i + 1,
                promptText: q.promptText ? String(q.promptText).trim() : undefined,
                modelAnswer: String(q.modelAnswer || '').trim(),
                maxPoints: typeof q.maxPoints === 'number' ? q.maxPoints : 1,
                notes: q.notes ? String(q.notes).trim() : undefined
              }));
            }
          }
        }
      } catch (err: any) {
        console.warn('AI question extraction from rubric PDF failed:', err.message);
      }
    }

    return {
      success: true,
      fileName,
      text: rawText,
      questions: extractedQuestions
    };
  }

  /**
   * Main AI pipeline execution:
   * 1. Iterates through each anonymous scan block (or targetScanId if single scan re-grade).
   * 2. Calls Vision LLM for OCR & answer recognition (completely anonymous - zero names seen!).
   * 3. Cuts answer image snippets.
   * 4. Calls Grading LLM to grade against SlimCheckQuestion model answers & opgaven (multimodal with image if math/chemistry).
   * 5. Saves responses into database.
   * 6. Marks status ready for teacher review (and re-syncs if already published).
   */
  async runGradingPipeline(
    sessionId: string,
    onProgress?: (data: { step: string; percent: number; message: string }) => void,
    targetScanId?: string
  ): Promise<void> {
    const session = await prisma.slimCheckSession.findUnique({
      where: { id: sessionId },
      include: {
        questions: { orderBy: { number: 'asc' } },
        scans: { orderBy: { anonIndex: 'asc' } },
        org: { include: { settings: true } }
      }
    });

    if (!session) throw new Error('Sessie niet gevonden');
    if (session.questions.length === 0) throw new Error('Geen correctiemodel vragen opgegeven.');
    if (session.scans.length === 0) throw new Error('Geen scans gevonden om na te kijken.');

    const pagesDir = this.getPagesDir(sessionId);
    const cropsDir = this.getCropsDir(sessionId);

    // Resolve models: session override -> org settings -> default fallback
    const visionModel = session.visionModelId || session.org.settings?.slimCheckDefaultVisionModel || 'minicpm-v:8b';
    const gradingModel = session.gradingModelId || session.org.settings?.slimCheckDefaultGradingModel || 'llama3.1:8b';

    await prisma.slimCheckSession.update({
      where: { id: sessionId },
      data: { status: 'processing' }
    });

    const scansToProcess = targetScanId
      ? session.scans.filter(s => s.id === targetScanId)
      : session.scans;

    const totalScans = scansToProcess.length;
    let completedScans = 0;

    for (const scan of scansToProcess) {
      const scanProgress = Math.round((completedScans / totalScans) * 100);
      onProgress?.({
        step: 'ocr',
        percent: scanProgress,
        message: `OCR verwerking van toets ${completedScans + 1}/${totalScans} (Anoniem ${scan.anonIndex + 1})...`
      });

      await prisma.slimCheckScan.update({
        where: { id: scan.id },
        data: { status: 'ocr' }
      });

      // Gather page images for this student scan
      const scanImages: string[] = [];
      for (let p = scan.startPage; p <= scan.endPage; p++) {
        const pPath = path.join(pagesDir, `page_${String(p).padStart(3, '0')}.png`);
        if (fs.existsSync(pPath)) {
          scanImages.push(pPath);
        }
      }

      // Convert images to base64 for Vision model
      const base64Images: string[] = [];
      for (const imgPath of scanImages) {
        try {
          const buf = fs.readFileSync(imgPath);
          base64Images.push(buf.toString('base64'));
        } catch (e) {
          console.error(`Failed reading page image ${imgPath}`, e);
        }
      }

      // Parse layout zone settings if configured by teacher (e.g. dividerX for question numbers vs answers)
      let parsedLayout: { dividerX?: number } | null = null;
      if (session.layoutZone) {
        try { parsedLayout = JSON.parse(session.layoutZone); } catch (e) { /* ignore */ }
      }
      const dividerX = parsedLayout?.dividerX && parsedLayout.dividerX > 0 ? parsedLayout.dividerX : 0;

      // Build questions context for OCR prompt — ⚠️ GEEN MODEL ANTWOORDEN MEESTUREN!
      // Het modelantwoord mag NIET naar de Vision/OCR-stap, omdat de AI anders beïnvloed
      // wordt en het handschrift "interpreteert" richting het correcte antwoord.
      // Alleen vraagnummers, punten, en optioneel de vraagstelling.
      const qContext = session.questions.map(q => {
        let line = `Vraag ${q.number}: max ${q.maxPoints} punten.`;
        if (q.promptText) line += ` Opgave: "${q.promptText}".`;
        return line;
      }).join('\n');

      const layoutOcrRule = dividerX > 0
        ? `\nBELANGRIJK VOOR DE LAYOUT VAN DIT TOETSBLAD:
- Er bevindt zich een vraagkolom links tot ongeveer ${dividerX}% van de paginabreedte waarin de vraagnummers en/of deelletters (zoals '1.', '1a', 'a)', 'b.') staan.
- De werkelijke antwoorden van de leerling staan RECHTS van deze scheidingslijn (vanaf ${dividerX}%).
- Neem VOORBEDRUKTE OF LINKS STAANDE VRAAGLABELS NOOIT op in de tekst van het antwoord! Als de leerling bij vraag 1a de optie 'C' heeft ingevuld, retourneer dan UITSLUITEND 'C' en NOOIT 'a C' of 'a c'.`
        : `\nBELANGRIJK VOOR DE INDELING:
- Scheid vraagnummers of vraaglabels (zoals '1.', '1a', 'a)', 'b.') altijd strikt van het leerlingantwoord. Als een leerling bij vraag 1a het antwoord 'C' invult, retourneer dan UITSLUITEND 'C' en NOOIT 'a C' of 'a c'.`;

      // Step A: Vision LLM OCR
      const ocrPrompt = `Je bent een nauwkeurige OCR-assistent voor het herkennen van handgeschreven schooltoetsen.
BELANGRIJK: Alle namen zijn geredacteerd; verwerk deze toets volledig anoniem.
${layoutOcrRule}

De toets bevat de volgende vragen:
${qContext}

Lees de bijgevoegde pagina's zorgvuldig. Haal voor ELKE vraag het handgeschreven antwoord van de leerling op.
Schat per vraag op welk percentage van de pagina (top: 0-100%, height: 10-40%) het antwoord te zien is en op welke paginaindex (0 voor eerste pagina, 1 voor tweede etc.).

Retourneer UITSLUITEND een JSON object in exact dit formaat:
{
  "answers": [
    {
      "questionNumber": 1,
      "text": "Tekst van het geschreven antwoord",
      "pageIndex": 0,
      "topPercent": 20,
      "heightPercent": 25,
      "confidence": 0.9
    }
  ]
}`;

      let parsedAnswers: any[] = [];
      try {
        const ocrRes = await ollamaClient.generate(ocrPrompt, visionModel, undefined, false, base64Images);
        if (ocrRes.ok) {
          const ocrData = await ocrRes.json();
          const rawText = ocrData.response || '';

          // Parse JSON from response
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            parsedAnswers = parsed.answers || [];
          }
        }
      } catch (err: any) {
        console.warn(`Vision OCR call failed for scan ${scan.id}, falling back:`, err.message);
      }

      // Save OCR raw output
      await prisma.slimCheckScan.update({
        where: { id: scan.id },
        data: {
          status: 'grading',
          ocrRaw: JSON.stringify(parsedAnswers)
        }
      });

      onProgress?.({
        step: 'grading',
        percent: Math.round(((completedScans + 0.5) / totalScans) * 100),
        message: `Nakijken en feedback formuleren voor toets ${completedScans + 1}/${totalScans}...`
      });

      // Step B: Grading per question - clear previous responses to allow re-grading
      await prisma.slimCheckResponse.deleteMany({
        where: { scanId: scan.id }
      });

      // Helper function to normalize text (case-insensitive, strip punctuation & extra whitespace)
      const normalizeClean = (s: string) =>
        s.toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      // Helper to strip accidental question prefixes from OCR (e.g. "a c" -> "c", "1a C" -> "C", "1. km" -> "km")
      const cleanAnswerPrefix = (text: string, qNum: number): string => {
        if (!text) return '';
        let cleaned = text.trim();
        cleaned = cleaned.replace(new RegExp(`^(?:vraag\\s*)?(?:${qNum}[a-z]?|[a-z])(?:[\\.:\\)-]|\\s+)\\s*`, 'i'), '');
        return cleaned.trim() || text.trim();
      };

      for (const question of session.questions) {
        const studentAns = parsedAnswers.find((a: any) => a.questionNumber === question.number);
        const rawAnsText = studentAns?.text?.trim() || '(Geen duidelijk antwoord herkend op scan)';
        const cleanedAns = cleanAnswerPrefix(rawAnsText, question.number);
        const ansText = cleanedAns || rawAnsText;
        const confidence = studentAns?.confidence ? parseFloat(studentAns.confidence) : 0.75;

        // Crop answer snippet image (focusing on the answer zone right of dividerX if configured)
        const pageIdx = studentAns?.pageIndex ?? 0;
        const sourcePagePath = scanImages[pageIdx] || scanImages[0];
        let cropRelPath: string | null = null;

        if (sourcePagePath && fs.existsSync(sourcePagePath)) {
          const cropFilename = `crop_${scan.id}_q${question.number}.jpg`;
          const cropFullPath = path.join(cropsDir, cropFilename);
          const topPct = studentAns?.topPercent ?? Math.max(10, ((question.number - 1) % 4) * 22 + 5);
          const heightPct = studentAns?.heightPercent ?? 22;
          const cropLeftPct = dividerX > 0 ? Math.min(40, dividerX) : 0;
          const cropWidthPct = 100 - cropLeftPct;

          await this.cropAnswerRegion(sourcePagePath, cropFullPath, topPct, heightPct, cropLeftPct, cropWidthPct);
          cropRelPath = `uploads/slimcheck/${sessionId}/crops/${cropFilename}`;
        }

        // Multimodal handling for Math/Chemistry
        const isSubjectFormula = session.isMultimodal ||
          ['wiskunde', 'scheikunde', 'natuurkunde', 'math', 'chemistry', 'physics']
            .some(s => (session.subject || '').toLowerCase().includes(s));

        const gradingImages: string[] = [];
        if (isSubjectFormula && cropRelPath) {
          const fullCrop = path.join(process.cwd(), cropRelPath);
          if (fs.existsSync(fullCrop)) {
            try {
              gradingImages.push(fs.readFileSync(fullCrop).toString('base64'));
            } catch (e) { /* ignore */ }
          }
        }

        // ── DETERMINISTIC SMART MATCHING ───────────────────────────────────────────
        // If the student answer matches the model answer (case-insensitive, normalized, or stripped of question letter),
        // award full points deterministically without risking LLM failure or false negatives!
        const normStudent = normalizeClean(ansText);
        const normRaw = normalizeClean(rawAnsText);
        const normModel = normalizeClean(question.modelAnswer);

        // Also check if model answer specifies alternative options (e.g. "Kilometer / km" or "C; c")
        const modelOptions = question.modelAnswer
          .split(/[\/,;|\n]/)
          .map(opt => normalizeClean(opt))
          .filter(Boolean);

        const isExactMatch = normStudent.length > 0 && (
          normStudent === normModel ||
          normRaw === normModel ||
          modelOptions.includes(normStudent) ||
          modelOptions.includes(normRaw)
        );

        let aiPoints: number | null = null;
        let aiFeedback = '';
        let aiReasoning = '';
        let gradeConfidence = confidence;
        let needsReview = false;

        if (isExactMatch) {
          // Direct 100% correct match!
          aiPoints = question.maxPoints;
          aiReasoning = `Volledige score (${question.maxPoints}/${question.maxPoints} pt): Het antwoord ("${ansText}") sluit inhoudelijk exact aan bij het correctiemodel ("${question.modelAnswer}").`;
          aiFeedback = `Uitstekend gedaan! Je antwoord is exact juist conform het correctiemodel.`;
          gradeConfidence = 1.0;
          needsReview = false;
        } else {
          // Send to LLM for qualitative evaluation
          const promptTextContext = question.promptText
            ? `Opgave (wat de leerling ziet):\n"${question.promptText}"\n\n`
            : '';

          const gradePrompt = `Je bent een ervaren vakdocent die een formatieve schooltoets nakijkt.
Beoordeel het geschreven antwoord van de leerling eerlijk en constructief aan de hand van de opgave en het correctiemodel.

Vraag ${question.number}:
${promptTextContext}Modelantwoord volgens correctiemodel:
"${question.modelAnswer}"

Maximum te behalen punten: ${question.maxPoints}
Docent criteria/instructies: ${question.notes || 'Geen extra toelichting'}

Geschreven antwoord van de leerling:
"${ansText}" ${rawAnsText !== ansText ? `(origineel gescand: "${rawAnsText}")` : ''}
${isSubjectFormula ? '(Let op: bekijk ook de meegestuurde uitsnede voor mintekens, breuken en wiskundige formules)' : ''}

BELANGRIJKE BEOORDELINGSRICHTLIJNEN:
1. NIET HOOFDLETTER GEVOELIG:
   Beoordeel antwoorden NIET hoofdlettergevoelig (bijv. "kilometer" en "Kilometer", "c" en "C" zijn 100% identiek), tenzij de docent expliciet aangeeft dat hoofdletters strikt vereist zijn.
2. LAYOUT & VRAAGNUMMERS:
   Als een vraagletter of vraagnummer per ongeluk is meegekomen door de scan/layout (bijv. "a c" bij vraag 1a terwijl het modelantwoord "C" is), reken dit dan 100% goed als de kern klopt!
3. HANDMATIGE REVIEW NODIG ("needsReview"):
   Als het antwoord onleesbaar is, het handschrift niet te ontcijferen is, of je als AI twijfelt over de interpretatie: zet "needsReview": true.
4. FEEDBACK:
   Genereer TWEE verschillende soorten feedback in het Nederlands:
   - "decisionReason": zakelijke toelichting ALLEEN voor de docent (+/- punten en criteria)
   - "studentFeedback": opbouwende, didactische feedback direct in de je/jij-vorm voor de leerling (wordt gepubliceerd!)

Retourneer UITSLUITEND een JSON object in exact dit formaat:
{
  "points": 1.5,
  "needsReview": false,
  "decisionReason": "Docent toelichting: ...",
  "studentFeedback": "Feedback voor leerling: ...",
  "confidence": 0.95
}`;

          try {
            const gradeRes = await ollamaClient.generate(
              gradePrompt,
              isSubjectFormula && gradingImages.length > 0 ? visionModel : gradingModel,
              'Je bent een behulpzame, precieze docent-assistent die toetsen nakijkt en didactische feedback formuleert in JSON.',
              false,
              gradingImages.length > 0 ? gradingImages : undefined
            );

            if (gradeRes.ok) {
              const gradeData = await gradeRes.json();
              const jsonMatch = (gradeData.response || '').match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const resObj = JSON.parse(jsonMatch[0]);
                if (resObj.points !== undefined && resObj.points !== null) {
                  aiPoints = Math.max(0, Math.min(question.maxPoints, parseFloat(resObj.points || '0')));
                }
                aiFeedback = String(resObj.studentFeedback || resObj.feedback || '').trim();
                aiReasoning = String(resObj.decisionReason || resObj.reasoning || resObj.explanation || '').trim();
                if (resObj.confidence) gradeConfidence = parseFloat(resObj.confidence);
                if (resObj.needsReview !== undefined) needsReview = Boolean(resObj.needsReview);
              }
            }
          } catch (err: any) {
            console.warn(`Grading call failed for Q${question.number}:`, err.message);
            needsReview = true;
          }
        }

        // Check if manual review is needed
        if (gradeConfidence < 0.6 || ansText === '(Geen duidelijk antwoord herkend op scan)' || ansText.length < 2) {
          needsReview = true;
        }

        // Meaningful fallbacks if LLM output was empty or unparseable
        if (aiPoints === null) {
          needsReview = true;
          aiPoints = 0;
        }

        if (needsReview && !aiReasoning) {
          aiReasoning = `⚠️ Geen zekere automatische beoordeling mogelijk: Het antwoord ("${ansText.slice(0, 45)}") kon niet met voldoende betrouwbaarheid automatisch worden beoordeeld. Docent dient dit handmatig te controleren.`;
        }

        if (needsReview && !aiFeedback) {
          aiFeedback = 'Dit antwoord wordt nog handmatig nagekeken door je docent.';
        }

        if (!aiFeedback) {
          if (ansText === '(Geen duidelijk antwoord herkend op scan)' || ansText.length < 3) {
            aiFeedback = 'Er kon geen duidelijk antwoord worden herkend op de toetsscan. Vraag je docent om toelichting.';
          } else if (aiPoints === question.maxPoints) {
            aiFeedback = 'Uitstekend gedaan! Je antwoord sluit volledig aan bij het gewenste modelantwoord.';
          } else if (aiPoints > 0) {
            aiFeedback = 'Je bent goed op weg en hebt al relevante onderdelen genoemd. Vergelijk je uitwerking met het modelantwoord om de ontbrekende stappen te zien.';
          } else {
            aiFeedback = 'Dit antwoord wijkt nog af van het correctiemodel. Bekijk het juiste antwoord en de stof om te zien hoe je tot de juiste oplossing komt.';
          }
        }

        if (!aiReasoning) {
          if (ansText === '(Geen duidelijk antwoord herkend op scan)' || ansText.length < 3) {
            aiReasoning = `Geen leesbare tekst herkend op toetsscan voor vraag ${question.number}. AI kent 0 van ${question.maxPoints} pt toe.`;
          } else if (aiPoints === question.maxPoints) {
            aiReasoning = `Volledige score (${aiPoints}/${question.maxPoints} pt): Het geschreven antwoord sluit inhoudelijk aan bij de kern van het modelantwoord.`;
          } else if (aiPoints > 0) {
            aiReasoning = `Deelscore (${aiPoints}/${question.maxPoints} pt): Leerling noemt relevante elementen, maar de uitwerking is niet volledig conform rubric criteria.`;
          } else {
            aiReasoning = `Geen punten toegekend (0/${question.maxPoints} pt): Het antwoord ("${ansText.slice(0, 45)}...") wijkt af van het correctiemodel of mist de vereiste kernbegrippen.`;
          }
        }

        // Upsert SlimCheckResponse
        await prisma.slimCheckResponse.create({
          data: {
            scanId: scan.id,
            questionId: question.id,
            rawText: ansText,
            cropImagePath: cropRelPath,
            aiPoints,
            finalPoints: needsReview ? null : aiPoints, // null if review needed so teacher explicitly confirms
            aiFeedback,
            aiReasoning,
            confidence: gradeConfidence,
            needsReview
          }
        });
      }

      await prisma.slimCheckScan.update({
        where: { id: scan.id },
        data: { status: 'done' }
      });

      completedScans++;
    }

    // Pipeline completed -> review status
    await prisma.slimCheckSession.update({
      where: { id: sessionId },
      data: { status: 'review' }
    });

    // If session was already published, automatically re-sync submissions so grades stay updated!
    if (session.isPublished) {
      try {
        await this.publishSession(sessionId);
      } catch (e) {
        console.warn('Re-publish sync error after grading pipeline:', e);
      }
    }

    onProgress?.({
      step: 'done',
      percent: 100,
      message: 'Nakijken voltooid! Klaar voor controle door de docent.'
    });
  }

  /**
   * Publishes session results:
   * Sets isPublished = true, updates status, and optionally pushes grades to AssignmentSubmission.
   */
  async publishSession(sessionId: string): Promise<void> {
    const session = await prisma.slimCheckSession.findUnique({
      where: { id: sessionId },
      include: {
        questions: true,
        scans: {
          include: {
            responses: true,
            student: true
          }
        }
      }
    });

    if (!session) throw new Error('Sessie niet gevonden');

    // Calculate total max score
    const totalMax = session.questions.reduce((sum, q) => sum + q.maxPoints, 0);

    // Sync to assignment if linked and returnGrade is true
    if (session.assignmentId && session.returnGrade) {
      for (const scan of session.scans) {
        if (!scan.studentId) continue;

        const earnedPoints = scan.responses.reduce((sum, r) => sum + (r.finalPoints ?? r.aiPoints ?? 0), 0);
        // Grade between 1.0 and 10.0
        const calculatedGrade = totalMax > 0
          ? Math.max(1.0, Math.min(10.0, parseFloat(((earnedPoints / totalMax) * 9 + 1).toFixed(1))))
          : 0;

        // Collect teacher/AI feedback summary
        const feedbackLines = scan.responses
          .map((r, i) => `Vraag ${i + 1}: ${r.finalPoints ?? r.aiPoints} pt — ${r.teacherNote || r.aiFeedback || ''}`)
          .join('\n');

        // Upsert submission
        const existingSub = await prisma.assignmentSubmission.findFirst({
          where: {
            assignmentId: session.assignmentId,
            studentId: scan.studentId
          }
        });

        if (existingSub) {
          await prisma.assignmentSubmission.update({
            where: { id: existingSub.id },
            data: {
              grade: String(calculatedGrade),
              teacherNotes: session.returnFeedback ? feedbackLines : existingSub.teacherNotes,
              aiGradeReport: feedbackLines,
              status: 'reviewed'
            }
          });
        } else {
          await prisma.assignmentSubmission.create({
            data: {
              assignmentId: session.assignmentId,
              studentId: scan.studentId,
              grade: String(calculatedGrade),
              teacherNotes: session.returnFeedback ? feedbackLines : null,
              aiGradeReport: feedbackLines,
              status: 'reviewed'
            }
          });
        }
      }
    }

    await prisma.slimCheckSession.update({
      where: { id: sessionId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
        status: 'done'
      }
    });
  }

  /**
   * Generates a sleek, printable PDF report for the teacher and class.
   */
  async generatePdfReport(sessionId: string): Promise<Buffer> {
    const session = await prisma.slimCheckSession.findUnique({
      where: { id: sessionId },
      include: {
        org: true,
        questions: { orderBy: { number: 'asc' } },
        scans: {
          include: {
            student: true,
            responses: {
              include: { question: true },
              orderBy: { question: { number: 'asc' } }
            }
          },
          orderBy: { anonIndex: 'asc' }
        }
      }
    });

    if (!session) throw new Error('Sessie niet gevonden');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (b: any) => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err: any) => reject(err));

      const totalMax = session.questions.reduce((sum, q) => sum + q.maxPoints, 0);

      // Header Banner
      doc.rect(40, 40, 515, 65).fill('#7C5CFC');
      doc.fillColor('#FFFFFF').fontSize(18).text('Locra SlimCheck — Nakijkrapport', 55, 52);
      doc.fontSize(10).text(`${session.title}  •  Vak: ${session.subject || 'Algemeen'}  •  Max punten: ${totalMax}`, 55, 78);

      doc.moveDown(4);
      doc.fillColor('#1E293B').fontSize(14).text('Klassenoverzicht', 40, 125);
      doc.fontSize(9).fillColor('#64748B').text(`Aangemaakt: ${new Date(session.createdAt).toLocaleDateString('nl-NL')}  •  Aantal nagekeken toetsen: ${session.scans.length}`);

      let y = 160;
      doc.rect(40, y, 515, 20).fill('#F1F5F9');
      doc.fillColor('#475569').fontSize(9)
        .text('Leerling', 48, y + 5)
        .text('Locra ID', 180, y + 5)
        .text('Score', 330, y + 5)
        .text('Cijfer', 400, y + 5)
        .text('Status', 480, y + 5);

      y += 24;

      for (const scan of session.scans) {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }

        const studentName = scan.student?.displayName || `Anonieme Toets #${scan.anonIndex + 1}`;
        const studentId = scan.studentId || '-';
        const earned = scan.responses.reduce((sum, r) => sum + (r.finalPoints ?? r.aiPoints ?? 0), 0);
        const grade = totalMax > 0 ? ((earned / totalMax) * 9 + 1).toFixed(1) : '-';

        doc.fillColor('#1E293B').fontSize(9)
          .text(studentName.slice(0, 24), 48, y)
          .text(studentId.slice(0, 20), 180, y)
          .text(`${earned} / ${totalMax}`, 330, y)
          .text(String(grade), 400, y)
          .text(scan.status === 'done' ? '✅ Nagekeken' : '⏳ Bezig', 480, y);

        doc.moveTo(40, y + 16).lineTo(555, y + 16).strokeColor('#E2E8F0').stroke();
        y += 22;
      }

      // Detailed question feedback section
      doc.addPage();
      doc.fillColor('#1E293B').fontSize(14).text('Gedetailleerde Resultaten per Vraag', 40, 40);
      y = 70;

      for (const scan of session.scans) {
        if (y > 680) {
          doc.addPage();
          y = 50;
        }

        const name = scan.student?.displayName || `Leerling #${scan.anonIndex + 1}`;
        const earned = scan.responses.reduce((sum, r) => sum + (r.finalPoints ?? r.aiPoints ?? 0), 0);

        doc.rect(40, y, 515, 22).fill('#F8FAFC');
        doc.fillColor('#0F172A').fontSize(11).text(`${name} — Totaal: ${earned}/${totalMax} pt`, 48, y + 5);
        y += 28;

        for (const resp of scan.responses) {
          if (y > 740) {
            doc.addPage();
            y = 50;
          }

          const qNum = resp.question.number;
          const pts = resp.finalPoints ?? resp.aiPoints ?? 0;
          const max = resp.question.maxPoints;

          doc.fillColor('#334155').fontSize(9)
            .text(`Vraag ${qNum} (${pts}/${max} pt):`, 56, y);
          y += 14;

          // AI keuze-toelichting (docent-only)
          if (resp.aiReasoning) {
            const reasonText = `AI toelichting: ${resp.aiReasoning}`;
            doc.fillColor('#B45309').fontSize(8)
              .text(reasonText, 64, y, { width: 460 });
            y += doc.heightOfString(reasonText, { width: 460 }) + 4;
          }

          // AI feedback voor leerling
          if (resp.aiFeedback) {
            const fbText = `Leerlingfeedback: ${resp.aiFeedback}`;
            doc.fillColor('#6D28D9').fontSize(8)
              .text(fbText, 64, y, { width: 460 });
            y += doc.heightOfString(fbText, { width: 460 }) + 4;
          }

          // Docent notitie
          if (resp.teacherNote) {
            const noteText = `Docent: ${resp.teacherNote}`;
            doc.fillColor('#047857').fontSize(8)
              .text(noteText, 64, y, { width: 460 });
            y += doc.heightOfString(noteText, { width: 460 }) + 4;
          }

          y += 6;
        }
        y += 10;
      }

      doc.end();
    });
  }

  /**
   * Generates CSV export compatible with SOMtoday / Magister.
   */
  async generateCsvExport(sessionId: string): Promise<string> {
    const session = await prisma.slimCheckSession.findUnique({
      where: { id: sessionId },
      include: {
        questions: true,
        scans: {
          include: {
            student: true,
            responses: true
          }
        }
      }
    });

    if (!session) throw new Error('Sessie niet gevonden');

    const totalMax = session.questions.reduce((sum, q) => sum + q.maxPoints, 0);

    const rows = [
      ['LocraID', 'Naam', 'Toets', 'Vak', 'BehaaldePunten', 'MaxPunten', 'Cijfer', 'Datum']
    ];

    for (const scan of session.scans) {
      const earned = scan.responses.reduce((sum, r) => sum + (r.finalPoints ?? r.aiPoints ?? 0), 0);
      const grade = totalMax > 0 ? ((earned / totalMax) * 9 + 1).toFixed(1) : '';
      rows.push([
        scan.studentId || '',
        scan.student?.displayName || `Anoniem_${scan.anonIndex + 1}`,
        session.title,
        session.subject || '',
        String(earned),
        String(totalMax),
        grade,
        new Date().toISOString().split('T')[0]
      ]);
    }

    return rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  /**
   * Cleans up expired scans and feedback according to retention settings.
   */
  async runRetentionCleanup(): Promise<{ deletedScans: number; deletedFeedback: number }> {
    const now = new Date();
    let deletedScans = 0;
    let deletedFeedback = 0;

    const sessions = await prisma.slimCheckSession.findMany({
      include: { scans: { include: { responses: true } } }
    });

    for (const session of sessions) {
      // 1. Scan retention
      if (session.retainScans && session.retainScans > 0) {
        const expiryDate = new Date(session.createdAt);
        expiryDate.setDate(expiryDate.getDate() + session.retainScans);

        if (now > expiryDate) {
          const sessionDir = path.join(this.uploadsBase, session.id);
          if (fs.existsSync(sessionDir)) {
            try {
              fs.rmSync(sessionDir, { recursive: true, force: true });
              deletedScans += session.scans.length;
            } catch (e) {
              console.error(`Failed deleting scan directory for session ${session.id}`, e);
            }
          }
        }
      }

      // 2. Feedback retention
      if (session.retainFeedback && session.retainFeedback > 0) {
        const expiryDate = new Date(session.createdAt);
        expiryDate.setDate(expiryDate.getDate() + session.retainFeedback);

        if (now > expiryDate) {
          const res = await prisma.slimCheckResponse.updateMany({
            where: {
              scan: { sessionId: session.id }
            },
            data: {
              aiFeedback: null,
              cropImagePath: null,
              rawText: null
            }
          });
          deletedFeedback += res.count;
        }
      }
    }

    return { deletedScans, deletedFeedback };
  }
}

export const slimCheckService = new SlimCheckService();
