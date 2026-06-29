import { describe, it, expect } from 'vitest';
import {
  applyAllProposals,
  applyOrthoProposals,
  applyTrimProposals,
  previewBatch,
} from '../src/lib/batch-apply.ts';
import { analyzeEnvelope } from '../src/lib/audio.ts';
import { PROFILES } from '../src/lib/profiles.ts';
import type { Segment } from '../src/lib/types.ts';

const SR = 16000;

function makeSyntheticAudio(
  regions: Array<{ start: number; end: number; amp: number }>,
): Float32Array {
  const duration = Math.max(...regions.map((r) => r.end));
  const samples = new Float32Array(Math.ceil(duration * SR));
  for (const { start, end, amp } of regions) {
    for (let i = Math.round(start * SR); i < Math.round(end * SR); i++) {
      samples[i] = amp;
    }
  }
  return samples;
}

// Audio with silent padding at both ends — gives analyzeEnvelope a realistic noise
// floor so voiced regions are clearly distinguishable from silence.
function makeVoicedAudio(): Float32Array {
  return makeSyntheticAudio([
    { start: 0,   end: 0.5, amp: 0   },
    { start: 0.5, end: 2.5, amp: 0.8 },
    { start: 2.5, end: 3.0, amp: 0   },
  ]);
}

function seg(overrides: Partial<Segment> & { start: number; end: number; words: string }): Segment {
  return {
    id: 0,
    detection: '',
    isTag: false,
    editedTxt: false,
    editedTime: false,
    ...overrides,
  };
}

const es = PROFILES.es;

// 'tambien' is in the ES accent map → orthoFix yields 'También.' (accent + initial cap + period)
// 'Bien.' is already fully correct for ES → orthoFix makes no changes
const NEEDS_FIX = 'tambien';
const ALREADY_CORRECT = 'Bien.';
const FIXED = 'También.';

describe('previewBatch — wav null', () => {
  it('counts ortho-fixable segments; all wav-dependent counts are 0', () => {
    const segs = [seg({ start: 0, end: 1, words: NEEDS_FIX })];
    const p = previewBatch(segs, null, es);
    expect(p.ortho).toBe(1);
    expect(p.deletes).toBe(0);
    expect(p.trims).toBe(0);
    expect(p.splits).toBe(0);
    expect(p.merges).toBe(0);
    expect(p.total).toBe(1);
  });

  it('returns all zeros when no segment needs correction', () => {
    const segs = [seg({ start: 0, end: 1, words: ALREADY_CORRECT })];
    const p = previewBatch(segs, null, es);
    expect(p.ortho).toBe(0);
    expect(p.total).toBe(0);
  });

  it('skips tag segments in ortho count', () => {
    const segs = [seg({ start: 0, end: 1, words: '[laugh]', isTag: true })];
    const p = previewBatch(segs, null, es);
    expect(p.ortho).toBe(0);
  });

  it('empty segment array → all zeros', () => {
    const p = previewBatch([], null, es);
    expect(p.total).toBe(0);
    expect(p.ortho).toBe(0);
  });
});

describe('previewBatch — with wav', () => {
  it('all-silent audio: segment is counted as delete', () => {
    const silentAudio = new Float32Array(SR * 3);
    const wav = analyzeEnvelope(silentAudio, SR);
    const segs = [seg({ start: 0, end: 3, words: 'hello' })];
    const p = previewBatch(segs, wav, es);
    expect(p.deletes).toBe(1);
  });

  it('clearly voiced segment is not counted as delete', () => {
    // Segment spans only the voiced region; silent padding establishes the floor.
    const wav = analyzeEnvelope(makeVoicedAudio(), SR);
    const segs = [seg({ start: 0.5, end: 2.5, words: 'hello' })];
    const p = previewBatch(segs, wav, es);
    expect(p.deletes).toBe(0);
  });
});

describe('applyOrthoProposals', () => {
  it('corrects accent: tambien → También.', () => {
    const segs = [seg({ start: 0, end: 1, words: NEEDS_FIX })];
    const result = applyOrthoProposals(segs, es);
    expect(result.segments[0].words).toBe(FIXED);
    expect(result.segments[0].editedTxt).toBe(true);
  });

  it('does not mutate the input array', () => {
    const segs = [seg({ start: 0, end: 1, words: NEEDS_FIX })];
    applyOrthoProposals(segs, es);
    expect(segs[0].words).toBe(NEEDS_FIX);
    expect(segs[0].editedTxt).toBe(false);
  });

  it('leaves tag segments (isTag: true) untouched', () => {
    const segs = [seg({ start: 0, end: 1, words: '[laugh]', isTag: true })];
    const result = applyOrthoProposals(segs, es);
    expect(result.segments[0].words).toBe('[laugh]');
    expect(result.segments[0].editedTxt).toBe(false);
    expect(result.preview.ortho).toBe(0);
  });

  it('preserves [bracket] token when mixed with text', () => {
    const segs = [seg({ start: 0, end: 1, words: '[laugh] hola', isTag: false })];
    const result = applyOrthoProposals(segs, es);
    expect(result.segments[0].words.startsWith('[laugh]')).toBe(true);
  });

  it('does not change boundaries (start/end unchanged)', () => {
    const segs = [seg({ start: 1.5, end: 3.7, words: NEEDS_FIX })];
    const result = applyOrthoProposals(segs, es);
    expect(result.segments[0].start).toBe(1.5);
    expect(result.segments[0].end).toBe(3.7);
  });

  it('does not set editedTxt when text is already correct', () => {
    const segs = [seg({ start: 0, end: 1, words: ALREADY_CORRECT })];
    const result = applyOrthoProposals(segs, es);
    expect(result.segments[0].editedTxt).toBe(false);
    expect(result.preview.ortho).toBe(0);
  });

  it('preview.ortho matches the number of segments actually changed', () => {
    const segs = [
      seg({ start: 0, end: 1, words: NEEDS_FIX }),
      seg({ start: 1, end: 2, words: ALREADY_CORRECT }),
    ];
    const result = applyOrthoProposals(segs, es);
    const actualChanged = result.segments.filter((s) => s.editedTxt).length;
    expect(result.preview.ortho).toBe(actualChanged);
    expect(result.preview.ortho).toBe(1);
  });
});

describe('applyTrimProposals', () => {
  it('adjusts start/end to voice edges and sets editedTime', () => {
    const wav = analyzeEnvelope(makeVoicedAudio(), SR);
    const segs = [seg({ start: 0, end: 3, words: 'hello' })];
    const result = applyTrimProposals(segs, wav, es);
    expect(result.segments[0].editedTime).toBe(true);
    expect(result.segments[0].start).toBeGreaterThan(0.3);
    expect(result.segments[0].start).toBeLessThan(0.7);
    expect(result.segments[0].end).toBeGreaterThan(2.3);
    expect(result.segments[0].end).toBeLessThan(2.7);
  });

  it('does not change words', () => {
    const wav = analyzeEnvelope(makeVoicedAudio(), SR);
    const segs = [seg({ start: 0, end: 3, words: 'hello' })];
    const result = applyTrimProposals(segs, wav, es);
    expect(result.segments[0].words).toBe('hello');
  });

  it('does not mutate the input array', () => {
    const wav = analyzeEnvelope(makeVoicedAudio(), SR);
    const segs = [seg({ start: 0, end: 3, words: 'hello' })];
    applyTrimProposals(segs, wav, es);
    expect(segs[0].start).toBe(0);
    expect(segs[0].end).toBe(3);
  });
});

describe('applyAllProposals — wav null', () => {
  it('applies ortho; boundaries stay unchanged', () => {
    const segs = [seg({ start: 1, end: 2, words: NEEDS_FIX })];
    const result = applyAllProposals(segs, null, es);
    expect(result.segments[0].words).toBe(FIXED);
    expect(result.segments[0].editedTxt).toBe(true);
    expect(result.segments[0].start).toBe(1);
    expect(result.segments[0].end).toBe(2);
    expect(result.segments[0].editedTime).toBe(false);
  });

  it('does not touch tag segments', () => {
    const segs = [seg({ start: 0, end: 1, words: '[laugh]', isTag: true })];
    const result = applyAllProposals(segs, null, es);
    expect(result.segments[0].words).toBe('[laugh]');
    expect(result.segments[0].editedTxt).toBe(false);
  });

  it('does not mutate input', () => {
    const segs = [seg({ start: 0, end: 1, words: NEEDS_FIX })];
    applyAllProposals(segs, null, es);
    expect(segs[0].words).toBe(NEEDS_FIX);
  });
});

describe('applyAllProposals — with wav', () => {
  it('removes a silent segment', () => {
    const silentAudio = new Float32Array(SR * 3);
    const wav = analyzeEnvelope(silentAudio, SR);
    const segs = [seg({ start: 0, end: 3, words: 'hello' })];
    const result = applyAllProposals(segs, wav, es);
    expect(result.segments).toHaveLength(0);
  });

  it('applies ortho and trim in the same pass on a voiced segment', () => {
    const wav = analyzeEnvelope(makeVoicedAudio(), SR);
    const segs = [seg({ start: 0, end: 3, words: NEEDS_FIX })];
    const result = applyAllProposals(segs, wav, es);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].words).toBe(FIXED);
    expect(result.segments[0].editedTxt).toBe(true);
    expect(result.segments[0].editedTime).toBe(true);
    expect(result.segments[0].start).toBeGreaterThan(0.3);
    expect(result.segments[0].start).toBeLessThan(0.7);
  });
});

describe('no-op cases', () => {
  it('empty array → preview all zeros, result is empty', () => {
    const result = applyAllProposals([], null, es);
    expect(result.segments).toHaveLength(0);
    expect(result.preview.total).toBe(0);
  });

  it('tag-only array → ortho count 0, no editedTxt set', () => {
    const segs = [
      seg({ start: 0, end: 1, words: '[laugh]', isTag: true }),
      seg({ start: 1, end: 2, words: '[breath]', isTag: true }),
    ];
    const result = applyOrthoProposals(segs, es);
    expect(result.preview.ortho).toBe(0);
    expect(result.segments.every((s) => !s.editedTxt)).toBe(true);
  });
});
