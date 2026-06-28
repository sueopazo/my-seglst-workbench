import type { LanguageProfile } from './profiles';

function addSpanishPunctuation(text: string, changes: string[], profile: LanguageProfile): string {
  let t = text;

  // ¿ en oraciones interrogativas sin apertura
  t = t.replace(/(^|[.!?]\s+)([^¿¡]*?\?)/g, (m, pre, clause) => {
    const c = clause.trimStart();
    if (!c || c.startsWith('¿')) return m;
    changes.push('¿');
    return `${pre}¿${c}`;
  });

  // coma antes de "pero" (muy frecuente en el corpus)
  if (/\spero\s/i.test(t) && !/, pero/i.test(t)) {
    t = t.replace(/\s+pero\s+/gi, ', pero ');
    changes.push('comma');
  }

  // punto final si el segmento parece una frase completa
  if (
    profile.finalPunct &&
    t.length > 0 &&
    !/[.?!…]$/.test(t) &&
    !t.endsWith('-') &&
    (!profile.danglingEnd || !profile.danglingEnd.test(t.trim()))
  ) {
    t = `${t}.`;
    changes.push('period');
  }

  return t;
}

export function orthoFix(
  text: string,
  profile: LanguageProfile,
): { out: string; changes: string[] } {
  if (!text) return { out: text, changes: [] };

  const changes: string[] = [];

  // 1. Normalize whitespace on full text (safe — brackets have no internal spaces)
  let t = text.replace(/\s+/g, ' ').trim();
  if (t !== text.trim()) changes.push('spaces');

  // 2. Extract [tokens] as opaque placeholders so all following rules skip them
  const brackets: string[] = [];
  t = t.replace(/\[.*?\]/g, (m) => {
    brackets.push(m);
    return `\x00${brackets.length - 1}\x00`;
  });

  // 3. Accent restoration — placeholders are non-word chars so \b boundaries are clean
  if (profile.accents) {
    t = t.replace(/\b([A-Za-zñáéíóúü]+)\b/g, (m) => {
      const k = m.toLowerCase();
      const fx = profile.accents![k];
      if (fx) {
        const r = m[0] === m[0].toUpperCase() ? fx[0].toUpperCase() + fx.slice(1) : fx;
        if (r !== m) changes.push(`${m}→${r}`);
        return r;
      }
      return m;
    });
  }

  // 4a. English: contraction apostrophes (dont→don't) and standalone i→I
  if (profile.contractions) {
    for (const [bare, fixed] of Object.entries(profile.contractions)) {
      const re = new RegExp(`\\b${bare}\\b`, 'gi');
      t = t.replace(re, (m) => {
        const out = m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase()
          ? fixed[0].toUpperCase() + fixed.slice(1)
          : fixed;
        if (out !== m) changes.push(`${m}→${out}`);
        return out;
      });
    }
    t = t.replace(/\bi\b/g, () => {
      changes.push('i→I');
      return 'I';
    });
  }

  // 4. Capitalize first real letter — placeholder-safe (skips leading \x00N\x00 chunks)
  // Char class covers ES (ñáéíóúü) + PT (àâãêôõç) lowercase diacritics.
  t = t.replace(/^((?:\x00\d+\x00\s*)*)([a-zñáàâãäéèêëíîïìóôõöòùúûüç])/, (_m, p, c) => {
    if (c !== c.toUpperCase()) changes.push('Initial cap');
    return p + c.toUpperCase();
  });

  // 5. Capitalize after sentence-ending punctuation
  t = t.replace(/([.?!]\s+)([a-zñáàâãäéèêëíîïìóôõöòùúûüç])/g, (_m, p, c) => p + c.toUpperCase());

  if (profile.openingMarks) {
    // Spanish: capitalize after ¿¡, then apply Spanish-specific punctuation
    t = t.replace(/([¿¡]\s*)([a-zñáàâãéêíóôõúüç])/g, (_m, p, c) => p + c.toUpperCase());
    t = addSpanishPunctuation(t, changes, profile);
  } else {
    // Universal: optional final period only
    if (
      profile.finalPunct &&
      t.length > 0 &&
      !/[.?!…]$/.test(t) &&
      !t.endsWith('-') &&
      (!profile.danglingEnd || !profile.danglingEnd.test(t.trim()))
    ) {
      t = `${t}.`;
      changes.push('period');
    }
  }

  // 6. Restore [tokens]
  if (brackets.length) {
    t = t.replace(/\x00(\d+)\x00/g, (_, i) => brackets[Number(i)]);
  }

  return { out: t, changes: [...new Set(changes)] };
}

export function needsOrthoFix(text: string, profile: LanguageProfile): boolean {
  return orthoFix(text, profile).out !== text;
}

export function applyOrthoToSegment(
  words: string,
  profile: LanguageProfile,
): { words: string; changed: boolean; changes: string[] } {
  const { out, changes } = orthoFix(words, profile);
  return { words: out, changed: out !== words, changes };
}
