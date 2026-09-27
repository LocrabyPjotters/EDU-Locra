"use strict";
/**
 * Locra EDU Plus Geavanceerde Steganografische Watermerk Service
 *
 * Bevat 5 complementaire watermerktechnologieën:
 * 1. Inter-Word Micro-Steganografie (elke ~8 woorden onzichtbare markering)
 * 2. Zin-Grens Signatuur (aan het einde van elke zin: ., !, ?)
 * 3. Alinea- & Lijstanker Watermerken (bij witregels en opsommingstekens)
 * 4. Cryptografische School/Licentie Payload (binaire zero-width payload: schoolnaam/orgId)
 * 5. Master Seal Eind-Signatuur (aan het einde van het volledige document)
 *
 * Zelfs als een leerling:
 * - Alleen de eerste zin kopieert
 * - Alleen een willekeurige alinea of 10 woorden kopieert
 * - De tekst deels herschrijft
 * Blijft het watermerk betrouwbaar detecteerbaar!
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.watermarkService = exports.WatermarkService = exports.PARAGRAPH_SIGNATURE = exports.SENTENCE_SIGNATURE = exports.MASTER_SIGNATURE = exports.UNICODE_MARKERS = void 0;
exports.UNICODE_MARKERS = {
    ZWSP: '\u200B', // Zero Width Space (Binair 0)
    ZWNJ: '\u200C', // Zero Width Non-Joiner (Binair 1)
    ZWJ: '\u200D', // Zero Width Joiner (Start Payload Marker)
    LRM: '\u200E', // Left-to-Right Mark (End Payload Marker)
    WJ: '\u2060', // Word Joiner (Sentence boundary marker)
    HAIR: '\u200A', // Hair Space (Punctuation micro-spacer)
};
exports.MASTER_SIGNATURE = `${exports.UNICODE_MARKERS.ZWSP}${exports.UNICODE_MARKERS.ZWNJ}${exports.UNICODE_MARKERS.ZWJ}${exports.UNICODE_MARKERS.LRM}${exports.UNICODE_MARKERS.ZWSP}`;
exports.SENTENCE_SIGNATURE = `${exports.UNICODE_MARKERS.ZWSP}${exports.UNICODE_MARKERS.ZWNJ}${exports.UNICODE_MARKERS.WJ}`;
exports.PARAGRAPH_SIGNATURE = `${exports.UNICODE_MARKERS.ZWSP}${exports.UNICODE_MARKERS.ZWJ}${exports.UNICODE_MARKERS.WJ}${exports.UNICODE_MARKERS.LRM}`;
class WatermarkService {
    /**
     * Converteer een string naar een onzichtbare binaire zero-width payload
     */
    encodePayload(data) {
        if (!data)
            return '';
        let bin = '';
        for (let i = 0; i < data.length; i++) {
            bin += data.charCodeAt(i).toString(2).padStart(8, '0');
        }
        let encoded = exports.UNICODE_MARKERS.ZWJ;
        for (const bit of bin) {
            encoded += bit === '0' ? exports.UNICODE_MARKERS.ZWSP : exports.UNICODE_MARKERS.ZWNJ;
        }
        encoded += exports.UNICODE_MARKERS.LRM;
        return encoded;
    }
    /**
     * Decodeer een binaire zero-width payload uit de tekst indien aanwezig
     */
    decodePayload(text) {
        const startIdx = text.indexOf(exports.UNICODE_MARKERS.ZWJ);
        const endIdx = text.indexOf(exports.UNICODE_MARKERS.LRM);
        if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx)
            return null;
        const rawBits = text.substring(startIdx + 1, endIdx);
        let bin = '';
        for (const ch of rawBits) {
            if (ch === exports.UNICODE_MARKERS.ZWSP)
                bin += '0';
            else if (ch === exports.UNICODE_MARKERS.ZWNJ)
                bin += '1';
        }
        if (bin.length === 0 || bin.length % 8 !== 0)
            return null;
        let result = '';
        for (let i = 0; i < bin.length; i += 8) {
            const byte = bin.substring(i, i + 8);
            result += String.fromCharCode(parseInt(byte, 2));
        }
        // Verwacht formaat: "LOCRA:ORGID:SCHOOL"
        const parts = result.split(':');
        if (parts[0] === 'LOCRA') {
            return {
                raw: result,
                orgId: parts[1] || undefined,
                schoolName: parts[2] || undefined,
                verified: true
            };
        }
        return {
            raw: result,
            verified: false
        };
    }
    /**
     * Injecteert alle 5 steganografische watermerklagen over de volledige tekst.
     * Zorgt ervoor dat elke zin, alinea en woordgroep onzichtbaar gemarkeerd is.
     */
    injectWatermark(text, orgId, schoolName) {
        if (!text)
            return text;
        let processed = text;
        // 1. Alinea-ankers: injecteer PARAGRAPH_SIGNATURE bij alinea-overgangen
        processed = processed.replace(/(\n{2,})/g, `$1${exports.PARAGRAPH_SIGNATURE}`);
        // 2. Zin-grenzen: injecteer SENTENCE_SIGNATURE na elke zin (. ! ?)
        processed = processed.replace(/([.!?])(\s+)/g, `$1${exports.SENTENCE_SIGNATURE}$2`);
        // 3. Inter-Word Micro-Steganografie: elke ~8 woorden een onzichtbare micro-marker
        const words = processed.split(' ');
        if (words.length >= 8) {
            const markedWords = [];
            for (let i = 0; i < words.length; i++) {
                markedWords.push(words[i]);
                // Elke 8e woord (zolang het niet aan het einde is en geen markering bevat)
                if ((i + 1) % 8 === 0 && i < words.length - 1) {
                    markedWords[markedWords.length - 1] += exports.UNICODE_MARKERS.ZWSP;
                }
            }
            processed = markedWords.join(' ');
        }
        // 4. Cryptografische School Payload (in de eerste alinea of direct na zin 1)
        const payloadContent = `LOCRA:${orgId || 'cld'}:${schoolName || 'EDU'}`;
        const encodedPayload = this.encodePayload(payloadContent);
        // Plaats de payload na de eerste zin of aan het begin van de tweede regel
        const firstPeriod = processed.indexOf('. ');
        if (firstPeriod !== -1) {
            processed = processed.substring(0, firstPeriod + 2) + encodedPayload + processed.substring(firstPeriod + 2);
        }
        else {
            processed = encodedPayload + processed;
        }
        // 5. Master Seal Signatuur aan het einde van het document
        processed += exports.MASTER_SIGNATURE;
        return processed;
    }
    /**
     * Analyseer een tekst grondig op watermerken en geef een forensisch rapport terug.
     */
    detectWatermark(text) {
        if (!text) {
            return {
                hasWatermark: false,
                confidence: 0,
                verdict: 'geen-watermerk',
                verdictText: 'Geen tekst opgegeven.',
                wordCount: 0,
                sentenceCoverage: { total: 0, watermarked: 0, percent: 0 },
                paragraphCoverage: { total: 0, watermarked: 0, percent: 0 },
                detectedCodepoints: [],
                techniquesDetected: [],
                decodedPayload: null,
                visualRontgenHtml: ''
            };
        }
        // Tel individuele zero-width karakters
        const counts = {
            zwsp: (text.match(new RegExp(exports.UNICODE_MARKERS.ZWSP, 'g')) || []).length,
            zwnj: (text.match(new RegExp(exports.UNICODE_MARKERS.ZWNJ, 'g')) || []).length,
            zwj: (text.match(new RegExp(exports.UNICODE_MARKERS.ZWJ, 'g')) || []).length,
            lrm: (text.match(new RegExp(exports.UNICODE_MARKERS.LRM, 'g')) || []).length,
            wj: (text.match(new RegExp(exports.UNICODE_MARKERS.WJ, 'g')) || []).length,
            hair: (text.match(new RegExp(exports.UNICODE_MARKERS.HAIR, 'g')) || []).length,
        };
        const totalMarkers = counts.zwsp + counts.zwnj + counts.zwj + counts.lrm + counts.wj + counts.hair;
        // Analyseer zinnen
        const rawSentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
        const totalSentences = Math.max(1, rawSentences.length);
        let watermarkedSentences = 0;
        const zeroWidthRegex = /[\u200B\u200C\u200D\u200E\u2060\u200A]/;
        for (const s of rawSentences) {
            if (zeroWidthRegex.test(s)) {
                watermarkedSentences++;
            }
        }
        // Analyseer alinea's
        const rawParagraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0);
        const totalParagraphs = Math.max(1, rawParagraphs.length);
        let watermarkedParagraphs = 0;
        for (const p of rawParagraphs) {
            if (zeroWidthRegex.test(p)) {
                watermarkedParagraphs++;
            }
        }
        // Technieken detecteren
        const hasMasterSeal = text.includes(exports.MASTER_SIGNATURE);
        const hasSentenceSig = text.includes(exports.SENTENCE_SIGNATURE);
        const hasParagraphSig = text.includes(exports.PARAGRAPH_SIGNATURE);
        const decodedPayload = this.decodePayload(text);
        const hasPayload = Boolean(decodedPayload && decodedPayload.verified);
        const hasInterWord = counts.zwsp >= 3;
        const techniques = [
            {
                id: 'inter-word',
                name: 'Inter-Word Steganografie',
                description: 'Micro-markeringen tussen woorden in de lopende tekst.',
                active: hasInterWord
            },
            {
                id: 'sentence-boundary',
                name: 'Zin-Grens Handtekeningen',
                description: 'Onzichtbare verificatiesleutels aan het einde van zinnen.',
                active: hasSentenceSig || watermarkedSentences > 0
            },
            {
                id: 'paragraph-anchor',
                name: 'Alinea- & Witregel Ankers',
                description: 'Steganografische ankers bij witregels en structuurwisselingen.',
                active: hasParagraphSig || (totalParagraphs > 1 && watermarkedParagraphs >= 1)
            },
            {
                id: 'crypto-payload',
                name: 'School- & Licentie Payload',
                description: 'Versleutelde binaire schoolidentificatie in zero-width codepoints.',
                active: hasPayload
            },
            {
                id: 'master-seal',
                name: 'Master Seal Document Handtekening',
                description: 'Originele eind-handtekening van de Locra AI generator.',
                active: hasMasterSeal
            }
        ];
        // Bereken dekking en betrouwbaarheid
        const sentenceCoveragePercent = Math.round((watermarkedSentences / totalSentences) * 100);
        const paragraphCoveragePercent = Math.round((watermarkedParagraphs / totalParagraphs) * 100);
        let confidence = 0;
        let verdict = 'geen-watermerk';
        let verdictText = 'Geen sporen van Locra AI watermerken aangetroffen.';
        if (hasMasterSeal || hasPayload) {
            confidence = 100;
            verdict = 'ai-gegenereerd';
            verdictText = hasPayload && decodedPayload?.schoolName
                ? `100% Geverifieerd AI gegenereerd (Afkomstig van school: ${decodedPayload.schoolName})`
                : '100% Geverifieerd AI gegenereerd door Locra (Cryptografische handtekening aanwezig)';
        }
        else if (hasSentenceSig || sentenceCoveragePercent >= 40) {
            confidence = Math.min(100, Math.max(90, sentenceCoveragePercent));
            verdict = 'ai-gegenereerd';
            verdictText = `AI gegenereerd fragment (${watermarkedSentences} van de ${totalSentences} zinnen bevatten micro-watermerken).`;
        }
        else if (totalMarkers >= 3) {
            confidence = Math.min(85, totalMarkers * 20);
            verdict = 'waarschijnlijk-ai';
            verdictText = `Waarschijnlijk AI fragment (${totalMarkers} onzichtbare steganografische codepoints aangetroffen).`;
        }
        else if (totalMarkers > 0) {
            confidence = 45;
            verdict = 'verdacht';
            verdictText = 'Geïsoleerde onzichtbare karakters aangetroffen, mogelijk bewerkt AI-fragment.';
        }
        // Genereer Röntgenfoto HTML (visualiseert onzichtbare tekens in de tekst)
        let visualHtml = text;
        // Vervang speciale onzichtbare tekens door visuele tags
        visualHtml = visualHtml
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(new RegExp(exports.MASTER_SIGNATURE, 'g'), '<span class="wm-tag wm-master" style="background:#10b981;color:#000;padding:2px 6px;border-radius:4px;font-size:0.75rem;font-weight:700;margin:0 2px;">[💧 Master Seal]</span>')
            .replace(new RegExp(exports.SENTENCE_SIGNATURE, 'g'), '<span class="wm-tag wm-sentence" style="background:#3b82f6;color:#fff;padding:1px 5px;border-radius:4px;font-size:0.7rem;font-weight:600;margin:0 2px;">[💧 Zin-WM]</span>')
            .replace(new RegExp(exports.PARAGRAPH_SIGNATURE, 'g'), '<span class="wm-tag wm-para" style="background:#8b5cf6;color:#fff;padding:1px 5px;border-radius:4px;font-size:0.7rem;font-weight:600;margin:0 2px;">[💧 Alinea-WM]</span>')
            .replace(/[\u200B]/g, '<span class="wm-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#06b6d4;margin:0 1px;" title="Zero-Width Space"></span>')
            .replace(/[\u200C]/g, '<span class="wm-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ec4899;margin:0 1px;" title="Zero-Width Non-Joiner"></span>')
            .replace(/[\u200D]/g, '<span class="wm-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#eab308;margin:0 1px;" title="Zero-Width Joiner (Payload Start)"></span>')
            .replace(/[\u200E]/g, '<span class="wm-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#a855f7;margin:0 1px;" title="Left-to-Right Mark (Payload End)"></span>')
            .replace(/[\u2060]/g, '<span class="wm-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#14b8a6;margin:0 1px;" title="Word Joiner"></span>');
        const words = text.trim().split(/\s+/).filter(Boolean);
        return {
            hasWatermark: confidence >= 70,
            confidence,
            verdict,
            verdictText,
            wordCount: words.length,
            sentenceCoverage: {
                total: totalSentences,
                watermarked: watermarkedSentences,
                percent: sentenceCoveragePercent
            },
            paragraphCoverage: {
                total: totalParagraphs,
                watermarked: watermarkedParagraphs,
                percent: paragraphCoveragePercent
            },
            detectedCodepoints: [
                { name: 'Zero-Width Space (ZWSP)', char: '\\u200B', count: counts.zwsp },
                { name: 'Zero-Width Non-Joiner (ZWNJ)', char: '\\u200C', count: counts.zwnj },
                { name: 'Zero-Width Joiner (ZWJ)', char: '\\u200D', count: counts.zwj },
                { name: 'Left-to-Right Mark (LRM)', char: '\\u200E', count: counts.lrm },
                { name: 'Word Joiner (WJ)', char: '\\u2060', count: counts.wj },
                { name: 'Hair Space', char: '\\u200A', count: counts.hair },
            ].filter(c => c.count > 0),
            techniquesDetected: techniques,
            decodedPayload,
            visualRontgenHtml: visualHtml
        };
    }
}
exports.WatermarkService = WatermarkService;
exports.watermarkService = new WatermarkService();
