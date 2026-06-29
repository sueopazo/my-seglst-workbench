import { describe, it, expect } from 'vitest';
import { estimateWordTimings, currentWordIndex } from '../src/lib/wordTiming.ts';

describe('estimateWordTimings', () => {
  it('returns one window per word covering the full span', () => {
    const ws = estimateWordTimings('hola mundo adiós', 10, 20);
    expect(ws).toHaveLength(3);
    expect(ws[0].start).toBe(10);
    expect(ws[ws.length - 1].end).toBe(20);
  });

  it('windows are monotonically increasing and non-overlapping', () => {
    const ws = estimateWordTimings('uno dos tres cuatro', 0, 8);
    for (let i = 1; i < ws.length; i++) {
      expect(ws[i].start).toBe(ws[i - 1].end);
      expect(ws[i].end).toBeGreaterThan(ws[i].start);
    }
  });

  it('longer words (more syllables) get more time', () => {
    // "a" = 1 syl, "mariposa" = 4 syl → mariposa should get more time
    const ws = estimateWordTimings('a mariposa', 0, 10);
    const short = ws[0].end - ws[0].start;
    const long = ws[1].end - ws[1].start;
    expect(long).toBeGreaterThan(short);
  });

  it('bracket token counts as one unit (not split on brackets)', () => {
    const ws = estimateWordTimings('[other-noise]', 5, 10);
    expect(ws).toHaveLength(1);
    expect(ws[0].word).toBe('[other-noise]');
    expect(ws[0].start).toBe(5);
    expect(ws[0].end).toBe(10);
  });

  it('bracket token mixed with words', () => {
    const ws = estimateWordTimings('hola [laugh] mundo', 0, 9);
    expect(ws).toHaveLength(3);
    expect(ws[1].word).toBe('[laugh]');
    expect(ws[0].start).toBe(0);
    expect(ws[2].end).toBe(9);
  });

  it('comma pause bonus gives the word with comma more time than equal-syllable word without', () => {
    // "hola," and "mundo" have 2 syllables each but "hola," gets pause bonus
    const ws = estimateWordTimings('hola, mundo', 0, 10);
    const withComma = ws[0].end - ws[0].start;
    const without = ws[1].end - ws[1].start;
    expect(withComma).toBeGreaterThan(without);
  });

  it('sentence-final period gives pause bonus', () => {
    // "fin." = 1 syl + period bonus; "no" = 1 syl, no bonus → fin. gets more time
    const ws = estimateWordTimings('fin. no', 0, 10);
    const withPeriod = ws[0].end - ws[0].start;
    const without = ws[1].end - ws[1].start;
    expect(withPeriod).toBeGreaterThan(without);
  });

  it('single-word segment spans the full range', () => {
    const ws = estimateWordTimings('palabra', 3, 7);
    expect(ws).toHaveLength(1);
    expect(ws[0].start).toBe(3);
    expect(ws[0].end).toBe(7);
  });

  it('empty string returns empty array', () => {
    expect(estimateWordTimings('', 0, 5)).toHaveLength(0);
  });

  it('whitespace-only returns empty array', () => {
    expect(estimateWordTimings('   ', 0, 5)).toHaveLength(0);
  });

  it('only-tag segment returns single window', () => {
    const ws = estimateWordTimings('[music]', 0, 4);
    expect(ws).toHaveLength(1);
    expect(ws[0].start).toBe(0);
    expect(ws[0].end).toBe(4);
  });

  it('windows cover exactly end (no gap, no overshoot)', () => {
    const ws = estimateWordTimings('a b c d e', 1.5, 9.5);
    const covered = ws.reduce((sum, w) => sum + (w.end - w.start), 0);
    expect(covered).toBeCloseTo(8, 10);
    expect(ws[0].start).toBe(1.5);
    expect(ws[ws.length - 1].end).toBe(9.5);
  });
});

describe('currentWordIndex', () => {
  const ws = estimateWordTimings('uno dos tres', 0, 6);

  it('returns -1 before segment start', () => {
    expect(currentWordIndex(ws, -1)).toBe(-1);
  });

  it('returns index 0 at segment start', () => {
    expect(currentWordIndex(ws, 0)).toBe(0);
  });

  it('returns index of the word whose window contains t', () => {
    // Each word ~2s: [0,2), [2,4), [4,6)
    expect(currentWordIndex(ws, 3)).toBe(1);
  });

  it('returns last index when t equals or exceeds end', () => {
    expect(currentWordIndex(ws, 6)).toBe(2);
    expect(currentWordIndex(ws, 100)).toBe(2);
  });

  it('returns -1 on empty windows', () => {
    expect(currentWordIndex([], 3)).toBe(-1);
  });
});
