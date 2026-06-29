import { describe, it, expect } from 'vitest';
import { f2, flagged, formatElapsed, hasCJK, isTagOnly, mmss } from '../src/lib/format.ts';

describe('f2', () => {
  it('rounds down at 2 decimal places', () => {
    expect(f2(1.2349)).toBe('1.23');
  });

  it('rounds up at 2 decimal places', () => {
    expect(f2(1.2350)).toBe('1.24');
  });

  it('zero → 0.00', () => {
    expect(f2(0)).toBe('0.00');
  });

  it('integer → two decimal zeros', () => {
    expect(f2(10)).toBe('10.00');
  });
});

describe('mmss', () => {
  it('zero → 0:00.00', () => {
    expect(mmss(0)).toBe('0:00.00');
  });

  it('65.5 s → 1:05.50', () => {
    expect(mmss(65.5)).toBe('1:05.50');
  });

  it('seconds portion is zero-padded to 5 chars', () => {
    expect(mmss(125.123)).toBe('2:05.12');
  });

  it('no hour conversion — minutes grow past 60', () => {
    expect(mmss(3600)).toBe('60:00.00');
  });
});

describe('hasCJK', () => {
  it('returns false for Latin text', () => {
    expect(hasCJK('hello world')).toBe(false);
  });

  it('returns true for Japanese kanji', () => {
    expect(hasCJK('日本語')).toBe(true);
  });

  it('returns true for Korean hangul', () => {
    expect(hasCJK('한국어')).toBe(true);
  });

  it('returns true for Japanese hiragana', () => {
    expect(hasCJK('ひらがな')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(hasCJK('')).toBe(false);
  });
});

describe('isTagOnly', () => {
  it('returns true for [laugh]', () => {
    expect(isTagOnly('[laugh]')).toBe(true);
  });

  it('returns true for [other-noise]', () => {
    expect(isTagOnly('[other-noise]')).toBe(true);
  });

  it('returns true for [unintelligible]', () => {
    expect(isTagOnly('[unintelligible]')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isTagOnly('hello')).toBe(false);
  });

  it('returns false when tag is followed by text', () => {
    expect(isTagOnly('[laugh] extra')).toBe(false);
  });

  it('returns false for an unrecognized bracket token', () => {
    expect(isTagOnly('[unknown-tag]')).toBe(false);
  });

  it('trims surrounding whitespace before matching', () => {
    expect(isTagOnly('  [laugh]  ')).toBe(true);
  });
});

describe('flagged', () => {
  it('returns true when duration is below 0.2 s', () => {
    expect(flagged({ start: 0, end: 0.1 })).toBe(true);
  });

  it('returns false when duration equals exactly 0.2 s', () => {
    expect(flagged({ start: 0, end: 0.2 })).toBe(false);
  });

  it('returns false when duration exceeds 0.2 s', () => {
    expect(flagged({ start: 0, end: 0.21 })).toBe(false);
  });
});

describe('formatElapsed', () => {
  it('zero → 00:00', () => {
    expect(formatElapsed(0)).toBe('00:00');
  });

  it('under a minute → 00:SS', () => {
    expect(formatElapsed(59)).toBe('00:59');
  });

  it('over a minute, under an hour → MM:SS', () => {
    expect(formatElapsed(65)).toBe('01:05');
  });

  it('exactly one hour → h:MM:SS', () => {
    expect(formatElapsed(3600)).toBe('1:00:00');
  });

  it('over one hour → h:MM:SS with padded minutes and seconds', () => {
    expect(formatElapsed(3661)).toBe('1:01:01');
  });
});
