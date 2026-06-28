import { describe, it, expect } from 'vitest';
import {
  canMergeNext,
  exportSeglst,
  mergeSegments,
  parseSeglst,
  splitBySilence,
} from '../src/lib/segments.ts';
import type { Segment, SessionMeta } from '../src/lib/types.ts';

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

const baseMeta: SessionMeta = {
  sessionId: 'sess-001',
  speaker: 'SPK_A',
  seglstName: null,
  wavName: null,
};

describe('exportSeglst', () => {
  it('uses sessionId (not speaker) for session_id field', () => {
    const rows = exportSeglst([seg({ start: 0, end: 1, words: 'hello' })], baseMeta);
    expect(rows[0].session_id).toBe('sess-001');
    expect(rows[0].session_id).not.toBe('SPK_A');
  });

  it('falls back to speaker when sessionId is null', () => {
    const meta: SessionMeta = { ...baseMeta, sessionId: null };
    const rows = exportSeglst([seg({ start: 0, end: 1, words: 'hello' })], meta);
    expect(rows[0].session_id).toBe('SPK_A');
  });

  it('formats times to 2 decimal places', () => {
    const rows = exportSeglst([seg({ start: 1.1234, end: 2.9999, words: 'hi' })], baseMeta);
    expect(rows[0].start_time).toBe('1.12');
    expect(rows[0].end_time).toBe('3.00');
  });

  it('round-trips a small segment list', () => {
    const segs = [
      seg({ id: 0, start: 0, end: 1.5, words: 'hello' }),
      seg({ id: 1, start: 1.5, end: 3.0, words: 'world' }),
    ];
    const rows = exportSeglst(segs, baseMeta);
    expect(rows).toHaveLength(2);
    expect(rows[0].words).toBe('hello');
    expect(rows[1].words).toBe('world');
    expect(rows.every((r) => r.speaker === 'SPK_A')).toBe(true);
  });
});

describe('parseSeglst', () => {
  const noop = () => {};

  it('parses basic segment list', () => {
    const { segments, meta } = parseSeglst(
      [{ session_id: 'sess-001', speaker: 'SPK_A', start_time: '0.00', end_time: '1.00', words: 'hello' }],
      noop,
    );
    expect(segments).toHaveLength(1);
    expect(segments[0].words).toBe('hello');
    expect(segments[0].isTag).toBe(false);
    expect(meta.sessionId).toBe('sess-001');
    expect(meta.speaker).toBe('SPK_A');
  });

  it('converts empty words to [other-noise] and sets isTag', () => {
    const logs: string[] = [];
    const { segments } = parseSeglst(
      [{ start_time: '0.00', end_time: '1.00', words: '' }],
      (_id, _type, detail) => logs.push(detail),
    );
    expect(segments[0].words).toBe('[other-noise]');
    expect(segments[0].isTag).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
  });
});

describe('canMergeNext', () => {
  it('returns true when gap between segments is less than GAP (0.2 s)', () => {
    const segs = [
      seg({ id: 0, start: 0, end: 1.0, words: 'a' }),
      seg({ id: 1, start: 1.1, end: 2.0, words: 'b' }),
    ];
    expect(canMergeNext(segs, 0)).toBe(true);
  });

  it('returns false when gap clearly exceeds GAP (0.2 s)', () => {
    // Use 0.3 gap to avoid float precision issues near the 0.2 boundary
    const segs = [
      seg({ id: 0, start: 0, end: 1.0, words: 'a' }),
      seg({ id: 1, start: 1.3, end: 2.0, words: 'b' }),
    ];
    expect(canMergeNext(segs, 0)).toBe(false);
  });

  it('returns false when current segment is a tag', () => {
    const segs = [
      seg({ id: 0, start: 0, end: 1.0, words: '[laugh]', isTag: true }),
      seg({ id: 1, start: 1.1, end: 2.0, words: 'b' }),
    ];
    expect(canMergeNext(segs, 0)).toBe(false);
  });

  it('returns false when next segment is a tag', () => {
    const segs = [
      seg({ id: 0, start: 0, end: 1.0, words: 'a' }),
      seg({ id: 1, start: 1.1, end: 2.0, words: '[laugh]', isTag: true }),
    ];
    expect(canMergeNext(segs, 0)).toBe(false);
  });

  it('returns false for the last segment', () => {
    const segs = [seg({ id: 0, start: 0, end: 1.0, words: 'a' })];
    expect(canMergeNext(segs, 0)).toBe(false);
  });
});

describe('splitBySilence', () => {
  it('splits a segment into two parts with correct time bounds', () => {
    const segs = [seg({ id: 0, start: 0, end: 10, words: 'hello world' })];
    const result = splitBySilence(segs, 0, [], [0, 5, 10]);
    expect(result).toHaveLength(2);
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBe(5);
    expect(result[1].start).toBe(5);
    expect(result[1].end).toBe(10);
  });

  it('marks both parts as needing text review', () => {
    const segs = [seg({ id: 0, start: 0, end: 10, words: 'hello world' })];
    const result = splitBySilence(segs, 0, [], [0, 5, 10]);
    expect(result[0].needsTextReview).toBe(true);
    expect(result[1].needsTextReview).toBe(true);
  });
});

describe('mergeSegments', () => {
  it('spans from a.start to b.end', () => {
    const a = seg({ id: 0, start: 0, end: 1.5, words: 'hello' });
    const b = seg({ id: 1, start: 1.6, end: 3.0, words: 'world' });
    const result = mergeSegments(a, b);
    expect(result.start).toBe(0);
    expect(result.end).toBe(3.0);
  });

  it('concatenates words with a single space', () => {
    const a = seg({ id: 0, start: 0, end: 1, words: 'hello' });
    const b = seg({ id: 1, start: 1, end: 2, words: 'world' });
    expect(mergeSegments(a, b).words).toBe('hello world');
  });

  it('collapses extra whitespace when concatenating', () => {
    const a = seg({ id: 0, start: 0, end: 1, words: 'hello  ' });
    const b = seg({ id: 1, start: 1, end: 2, words: '  world' });
    expect(mergeSegments(a, b).words).toBe('hello world');
  });

  it('sets editedTxt and editedTime to true', () => {
    const a = seg({ id: 0, start: 0, end: 1, words: 'a' });
    const b = seg({ id: 1, start: 1, end: 2, words: 'b' });
    const result = mergeSegments(a, b);
    expect(result.editedTxt).toBe(true);
    expect(result.editedTime).toBe(true);
  });

  it('does not mutate the input segments', () => {
    const a = seg({ id: 0, start: 0, end: 1, words: 'a' });
    const b = seg({ id: 1, start: 1, end: 2, words: 'b' });
    mergeSegments(a, b);
    expect(a.words).toBe('a');
    expect(a.end).toBe(1);
  });
});
