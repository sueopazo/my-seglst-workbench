import { ACCENTS, CONTRACTIONS } from './constants';

export interface LanguageProfile {
  code: string;
  label: string;
  letters: RegExp;
  expectedScript: RegExp;
  capitalizeAfter: RegExp;
  finalPunct: boolean;
  accents?: Record<string, string>;
  openingMarks?: boolean;
  danglingEnd?: RegExp;
  contractions?: Record<string, string>;
}

export const PROFILES: Record<string, LanguageProfile> = {
  es: {
    code: 'es',
    label: 'Español',
    letters: /[A-Za-zñáéíóúüÁÉÍÓÚÑÜ]/,
    expectedScript: /[A-Za-zñáéíóúüÁÉÍÓÚÑÜ0-9 .,;:¿¡?!'"\\-]/,
    capitalizeAfter: /[.!?]\s+$/,
    finalPunct: true,
    accents: ACCENTS,
    openingMarks: true,
    danglingEnd:
      /\b(pero|y|que|o|como|si|sí|a|en|con|de|la|el|un|una|los|las|del|al|por|para|sin|más|muy|tan|ya|no|ni|se|me|te|le|nos|es|son|está|están|hay|he|ha|va|voy|ser|estar)$/i,
  },
  pt: {
    code: 'pt',
    label: 'Português (BR)',
    letters: /[A-Za-záàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/,
    expectedScript: /[A-Za-záàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ0-9 .,;:?!'"\\-]/,
    capitalizeAfter: /[.!?]\s+$/,
    finalPunct: true,
    openingMarks: false,
    // Use (?:^|\s) instead of \b: JS \b is not Unicode-aware, so \b before ASCII
    // letters like 'o' or 'a' fires inside Portuguese words with diacritics (e.g.
    // recepção ends in ão+o, where ã is \W, creating a false \b before 'o').
    danglingEnd:
      /(?:^|\s)(e|ou|mas|que|se|como|a|o|em|com|de|da|do|para|por|um|uma|os|as|no|na|nos|nas|ao|é|são|tem|ter|ser|estar|não|já|também|mais|nem)$/i,
  },
  en: {
    code: 'en',
    label: 'English',
    letters: /[A-Za-z]/,
    expectedScript: /[A-Za-z0-9 .,;:?!'"\\-]/,
    capitalizeAfter: /[.!?]\s+$/,
    finalPunct: true,
    openingMarks: false,
    contractions: CONTRACTIONS,
    danglingEnd:
      /\b(but|and|or|if|so|as|at|in|on|by|to|for|of|the|a|an|this|that|is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|may|might|shall|can)$/i,
  },
  de: {
    code: 'de',
    label: 'Deutsch',
    letters: /[A-Za-zäöüÄÖÜß]/,
    expectedScript: /[A-Za-zäöüÄÖÜß0-9 .,;:?!'"\\-]/,
    capitalizeAfter: /[.!?]\s+$/,
    finalPunct: true,
    openingMarks: false,
  },
  fr: {
    code: 'fr',
    label: 'Français',
    letters: /[A-Za-zàâäéèêëîïôùûüçÀÂÄÉÈÊËÎÏÔÙÛÜÇ]/,
    expectedScript: /[A-Za-zàâäéèêëîïôùûüçÀÂÄÉÈÊËÎÏÔÙÛÜÇ0-9 .,;:?!'"\\-]/,
    capitalizeAfter: /[.!?]\s+$/,
    finalPunct: true,
    openingMarks: false,
  },
  it: {
    code: 'it',
    label: 'Italiano',
    letters: /[A-Za-zàèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]/,
    expectedScript: /[A-Za-zàèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ0-9 .,;:?!'"\\-]/,
    capitalizeAfter: /[.!?]\s+$/,
    finalPunct: true,
    openingMarks: false,
  },
};

export function inferProfile(filename: string): string {
  const m = /\bNV[_-]([A-Z]{2})/i.exec(filename);
  if (m) {
    const code = m[1].toLowerCase();
    if (code in PROFILES) return code;
  }
  return 'es';
}
