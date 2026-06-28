import { describe, it, expect } from 'vitest';
import { orthoFix } from '../src/lib/ortho.ts';
import { PROFILES } from '../src/lib/profiles.ts';

const es = PROFILES.es;
const en = PROFILES.en;
const pt = PROFILES.pt;
const de = PROFILES.de;
const fr = PROFILES.fr;
const ita = PROFILES.it;

describe('Spanish profile', () => {
  it('proposes accent restoration with initial cap', () => {
    // tambien → también (accent) then T capitalised (first word) then period
    const { out } = orthoFix('tambien', es);
    expect(out).toBe('También.');
  });

  it('proposes initial capitalization + final period', () => {
    const { out } = orthoFix('hola', es);
    expect(out).toBe('Hola.');
  });

  it('proposes ¿ on interrogative clause', () => {
    const { out } = orthoFix('donde vas?', es);
    expect(out).toContain('¿');
    expect(out).toBe('¿Donde vas?');
  });

  it('capitalizes after existing ¡ mark', () => {
    const { out } = orthoFix('¡que bueno!', es);
    expect(out).toContain('¡Que');
  });

  it('proposes comma before pero', () => {
    const { out } = orthoFix('fue temprano pero llego', es);
    expect(out).toContain(', pero');
  });

  it('does not add final period after dangling conjunction', () => {
    const { out } = orthoFix('Y', es);
    expect(out).not.toMatch(/\.$/);
  });

  it('leaves bracket tokens untouched', () => {
    const { out } = orthoFix('[laugh] hola', es);
    expect(out).toContain('[laugh]');
    expect(out).toContain('Hola');
  });
});

describe('English profile', () => {
  it('proposes initial cap + final period', () => {
    const { out } = orthoFix('hello world', en);
    expect(out).toBe('Hello world.');
  });

  it('proposes I for standalone i', () => {
    // 'so' is in danglingEnd → no period; test focuses on i→I rule
    const { out } = orthoFix('i think so', en);
    expect(out).toBe('I think so');
  });

  it('proposes apostrophe for dont (capitalised as first word)', () => {
    // dont → don't (contraction), then D capitalised (first word)
    const { out } = orthoFix('dont', en);
    expect(out).toBe("Don't.");
  });

  it("proposes don't when dont is not the first word", () => {
    const { out } = orthoFix('i dont think', en);
    expect(out).toContain("don't");
  });

  it("proposes I'm for im", () => {
    const { out } = orthoFix('im going', en);
    expect(out).toContain("I'm going");
  });

  it('collapses multiple spaces', () => {
    const { out } = orthoFix('hello  world', en);
    expect(out).toBe('Hello world.');
  });

  it("preserves y'all when already correct", () => {
    // 'this' is in danglingEnd, so no period; y'all is already correct
    const { out } = orthoFix("y'all gonna love this", en);
    expect(out).toBe("Y'all gonna love this");
  });

  it("proposes y'all apostrophe for yall (capitalised as first word)", () => {
    const { out } = orthoFix('yall gonna love this', en);
    // yall → y'all (contraction rule), then Y capitalised (first word)
    expect(out).toContain("Y'all");
  });

  it("proposes y'all in mid-sentence position", () => {
    const { out } = orthoFix('i know yall love it', en);
    expect(out).toContain("y'all");
  });

  it('does not alter gonna (slang preserved)', () => {
    const { out } = orthoFix('gonna', en);
    expect(out).toBe('Gonna.');
  });

  it('leaves bracket tokens untouched; capitalises text after token', () => {
    // [laugh] is extracted; dont → don't → first real word capitalised → Don't
    const { out } = orthoFix('[laugh] dont', en);
    expect(out).toContain('[laugh]');
    expect(out).toContain("Don't");
  });

  it('does not add final period after dangling preposition', () => {
    const { out } = orthoFix('and', en);
    expect(out).not.toMatch(/\.$/);
  });
});

describe('Cross-profile isolation', () => {
  it('English profile: no accent proposal for tambien', () => {
    const { out } = orthoFix('tambien', en);
    // No accent map → stays 'tambien' (just gets initial cap + period)
    expect(out).not.toContain('también');
    expect(out).toBe('Tambien.');
  });

  it('English profile: no ¿ proposal', () => {
    const { out } = orthoFix('where are you?', en);
    expect(out).not.toContain('¿');
  });

  it('English profile: no ¡ proposal', () => {
    const { out } = orthoFix('great!', en);
    expect(out).not.toContain('¡');
  });

  it('Spanish profile: no contraction apostrophe for dont', () => {
    const { out } = orthoFix('dont', es);
    expect(out).not.toContain("don't");
  });

  it('Spanish profile still works after calling English profile', () => {
    orthoFix('dont', en);
    const { out } = orthoFix('tambien', es);
    // Profiles are pure functions — no shared mutable state
    expect(out).toBe('También.');
  });
});

describe('Portuguese (pt-BR) profile', () => {
  it('proposes initial cap + final period', () => {
    const { out } = orthoFix('olá', pt);
    expect(out).toBe('Olá.');
  });

  it('collapses multiple spaces', () => {
    const { out } = orthoFix('bom  dia', pt);
    expect(out).toBe('Bom dia.');
  });

  it('proposes cap and period on plain utterance', () => {
    const { out } = orthoFix('tudo bem', pt);
    expect(out).toBe('Tudo bem.');
  });

  it('does not add final period after dangling conjunction', () => {
    const { out } = orthoFix('e', pt);
    expect(out).not.toMatch(/\.$/);
  });

  it('leaves bracket tokens untouched', () => {
    const { out } = orthoFix('[laugh] tudo bem', pt);
    expect(out).toContain('[laugh]');
    expect(out).toContain('Tudo bem');
  });

  it('does not alter pre-existing diacritics (econômico)', () => {
    const { out } = orthoFix('econômico', pt);
    expect(out).toBe('Econômico.');
  });

  it('does not alter pre-existing diacritics (ônibus)', () => {
    const { out } = orthoFix('ônibus', pt);
    expect(out).toBe('Ônibus.');
  });

  it('does not alter pre-existing diacritics (recepção)', () => {
    const { out } = orthoFix('recepção', pt);
    expect(out).toBe('Recepção.');
  });
});

describe('Three-language isolation', () => {
  it('PT: no accent proposal for tambien', () => {
    const { out } = orthoFix('tambien', pt);
    expect(out).not.toContain('también');
    expect(out).toBe('Tambien.');
  });

  it('PT: no ¿ proposal', () => {
    const { out } = orthoFix('onde você está?', pt);
    expect(out).not.toContain('¿');
  });

  it('PT: no contraction apostrophe for dont', () => {
    const { out } = orthoFix('dont', pt);
    expect(out).not.toContain("don't");
  });

  it('ES still works after calling PT profile', () => {
    orthoFix('tudo bem', pt);
    const { out } = orthoFix('tambien', es);
    expect(out).toBe('También.');
  });

  it('EN still works after calling PT profile', () => {
    orthoFix('tudo bem', pt);
    const { out } = orthoFix('dont', en);
    expect(out).toBe("Don't.");
  });
});

describe('German (de) profile', () => {
  it('proposes initial cap + final period', () => {
    const { out } = orthoFix('hallo welt', de);
    expect(out).toBe('Hallo welt.');
  });

  it('collapses multiple spaces', () => {
    const { out } = orthoFix('hallo  welt', de);
    expect(out).toBe('Hallo welt.');
  });

  it('leaves bracket tokens untouched', () => {
    const { out } = orthoFix('[lachen] hallo', de);
    expect(out).toContain('[lachen]');
    expect(out).toContain('Hallo');
  });

  it('capitalizes ü-initial word', () => {
    const { out } = orthoFix('über alles', de);
    expect(out).toBe('Über alles.');
  });

  it('does NOT auto-capitalize nouns mid-sentence', () => {
    const { out } = orthoFix('das haus ist groß', de);
    // 'haus' must stay lowercase — noun-caps is not in this profile
    expect(out).toBe('Das haus ist groß.');
    expect(out).not.toMatch(/\bHaus\b/);
  });

  it('does not alter pre-existing umlauts (Müßiggang)', () => {
    const { out } = orthoFix('Müßiggang ist aller Laster Anfang', de);
    expect(out).toContain('Müßiggang');
    expect(out).toContain('ß');
  });

  it('does not add ¿ or ¡', () => {
    const { out } = orthoFix('wie geht es dir?', de);
    expect(out).not.toContain('¿');
    expect(out).not.toContain('¡');
  });

  it('does not propose accent changes for German text', () => {
    const { out } = orthoFix('schon', de);
    // 'schon' must not be changed to 'schön'
    expect(out).toBe('Schon.');
    expect(out).not.toContain('ö');
  });
});

describe('French (fr) profile', () => {
  it('proposes initial cap + final period', () => {
    const { out } = orthoFix('bonjour le monde', fr);
    expect(out).toBe('Bonjour le monde.');
  });

  it('collapses multiple spaces', () => {
    const { out } = orthoFix('bonjour  monde', fr);
    expect(out).toBe('Bonjour monde.');
  });

  it('leaves bracket tokens untouched', () => {
    const { out } = orthoFix('[rire] bonjour', fr);
    expect(out).toContain('[rire]');
    expect(out).toContain('Bonjour');
  });

  it('does not alter pre-existing accents (déjà)', () => {
    const { out } = orthoFix('déjà vu', fr);
    expect(out).toBe('Déjà vu.');
    expect(out).toContain('é');
    expect(out).toContain('à');
  });

  it('does not alter pre-existing accents (être)', () => {
    const { out } = orthoFix('être ou ne pas être', fr);
    expect(out).toContain('être');
  });

  it('does not add ¿ or ¡', () => {
    const { out } = orthoFix('comment allez-vous?', fr);
    expect(out).not.toContain('¿');
    expect(out).not.toContain('¡');
  });

  it('does not propose elision apostrophes', () => {
    // "le ami" → must NOT become "l'ami"
    const { out } = orthoFix('le ami est là', fr);
    expect(out).not.toContain("l'");
  });
});

describe('Italian (it) profile', () => {
  it('proposes initial cap + final period', () => {
    const { out } = orthoFix('ciao mondo', ita);
    expect(out).toBe('Ciao mondo.');
  });

  it('collapses multiple spaces', () => {
    const { out } = orthoFix('ciao  mondo', ita);
    expect(out).toBe('Ciao mondo.');
  });

  it('leaves bracket tokens untouched', () => {
    const { out } = orthoFix('[ridere] ciao', ita);
    expect(out).toContain('[ridere]');
    expect(out).toContain('Ciao');
  });

  it('does not alter pre-existing accents (città)', () => {
    const { out } = orthoFix('città bella', ita);
    expect(out).toBe('Città bella.');
    expect(out).toContain('à');
  });

  it('does not alter double consonants (notte)', () => {
    const { out } = orthoFix('buona notte', ita);
    expect(out).toBe('Buona notte.');
    expect(out).toContain('tt');
  });

  it('does not add ¿ or ¡', () => {
    const { out } = orthoFix('come stai?', ita);
    expect(out).not.toContain('¿');
    expect(out).not.toContain('¡');
  });

  it('does not propose accent changes for plain words', () => {
    // 'pero' in Italian means "however" — must NOT become Spanish 'però'
    const { out } = orthoFix('pero voglio andare', ita);
    expect(out).not.toContain('però');
    expect(out).toBe('Pero voglio andare.');
  });
});

describe('Six-language isolation', () => {
  it('DE: no accent proposal — schon stays schon', () => {
    const { out } = orthoFix('schon', de);
    expect(out).toBe('Schon.');
  });

  it('DE: no ¿¡', () => {
    expect(orthoFix('warum?', de).out).not.toContain('¿');
    expect(orthoFix('toll!', de).out).not.toContain('¡');
  });

  it('FR: no accent proposal — tambien stays tambien', () => {
    const { out } = orthoFix('tambien', fr);
    expect(out).not.toContain('también');
    expect(out).toBe('Tambien.');
  });

  it('FR: no ¿¡', () => {
    expect(orthoFix('pourquoi?', fr).out).not.toContain('¿');
    expect(orthoFix('super!', fr).out).not.toContain('¡');
  });

  it('IT: no accent proposal — tambien stays tambien', () => {
    const { out } = orthoFix('tambien', ita);
    expect(out).not.toContain('también');
    expect(out).toBe('Tambien.');
  });

  it('IT: no ¿¡', () => {
    expect(orthoFix('perché?', ita).out).not.toContain('¿');
    expect(orthoFix('bene!', ita).out).not.toContain('¡');
  });

  it('ES still works after calling DE/FR/IT', () => {
    orthoFix('hallo welt', de);
    orthoFix('bonjour monde', fr);
    orthoFix('ciao mondo', ita);
    const { out } = orthoFix('tambien', es);
    expect(out).toBe('También.');
  });

  it('EN still works after calling DE/FR/IT', () => {
    orthoFix('hallo welt', de);
    orthoFix('bonjour monde', fr);
    orthoFix('ciao mondo', ita);
    const { out } = orthoFix('dont', en);
    expect(out).toBe("Don't.");
  });

  it('PT still works after calling DE/FR/IT', () => {
    orthoFix('hallo welt', de);
    orthoFix('bonjour monde', fr);
    orthoFix('ciao mondo', ita);
    const { out } = orthoFix('tudo bem', pt);
    expect(out).toBe('Tudo bem.');
  });

  it('DE does not bleed into ES — haus not flagged as needing cap in ES', () => {
    orthoFix('das haus ist groß', de);
    const { out } = orthoFix('hola', es);
    expect(out).toBe('Hola.');
  });
});
