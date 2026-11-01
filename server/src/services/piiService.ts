/**
 * PII Service (AVG / GDPR Privacy Schild)
 * Herkent en maskeert gevoelige persoonsgegevens van leerlingen en docenten
 * vóórdat teksten naar AI-modellen of logs worden gestuurd.
 */

export const piiService = {
  /**
   * Valideert een Nederlands BSN nummer via de officiële 11-proef.
   */
  isValidBsn(candidate: string): boolean {
    const clean = candidate.replace(/\D/g, '');
    if (clean.length < 8 || clean.length > 9) return false;
    const bsn = clean.padStart(9, '0');
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(bsn[i], 10) * (9 - i);
    }
    sum += parseInt(bsn[8], 10) * -1;
    return sum % 11 === 0;
  },

  /**
   * Anonimiseert gevoelige Nederlandse persoonsgegevens in een tekst.
   */
  anonymizeText(text: string): { sanitizedText: string; detectedPiiTypes: string[] } {
    if (!text || typeof text !== 'string') {
      return { sanitizedText: text, detectedPiiTypes: [] };
    }

    let sanitized = text;
    const detected: Set<string> = new Set();

    // 1. E-mailadressen
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    if (emailRegex.test(sanitized)) {
      detected.add('email');
      sanitized = sanitized.replace(emailRegex, '[GEANONIMISEERD_EMAIL]');
    }

    // 2. Nederlandse IBAN nummers
    const ibanRegex = /\bNL\d{2}[A-Z]{4}\d{10}\b/gi;
    if (ibanRegex.test(sanitized)) {
      detected.add('iban');
      sanitized = sanitized.replace(ibanRegex, '[GEANONIMISEERDE_IBAN]');
    }

    // 3. Nederlandse telefoonnummers (+31, 06, vaste nummers)
    const phoneRegex = /(\+31[\s-]?\(?0\)?[\s-]?|0)[1-9][0-9]([\s-]?[0-9]{2}){3,4}\b/g;
    if (phoneRegex.test(sanitized)) {
      detected.add('telefoonnummer');
      sanitized = sanitized.replace(phoneRegex, '[GEANONIMISEERD_TELEFOON]');
    }

    // 4. BSN detectie met 11-proef
    const potentialBsnRegex = /\b\d{8,9}\b/g;
    sanitized = sanitized.replace(potentialBsnRegex, (match) => {
      if (this.isValidBsn(match)) {
        detected.add('bsn');
        return '[GEANONIMISEERD_BSN]';
      }
      return match;
    });

    // 5. Nederlandse Postcode + Huisnummer (bijv. 1234 AB 42)
    const postalRegex = /\b[1-9][0-9]{3}\s?[A-Za-z]{2}\b\s+(\d+[a-zA-Z0-9-]*)/g;
    if (postalRegex.test(sanitized)) {
      detected.add('adres_postcode');
      sanitized = sanitized.replace(postalRegex, '[GEANONIMISEERD_ADRES]');
    }

    return {
      sanitizedText: sanitized,
      detectedPiiTypes: Array.from(detected)
    };
  },

  /**
   * Controleert of een tekst privacygevoelige data bevat.
   */
  containsSensitivePii(text: string): boolean {
    const { detectedPiiTypes } = this.anonymizeText(text);
    return detectedPiiTypes.length > 0;
  }
};
