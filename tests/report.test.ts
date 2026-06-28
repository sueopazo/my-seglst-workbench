import { describe, it, expect } from 'vitest';
import {
  computeDiff,
  generateReport,
  LIGHT_EDIT_RATIO,
  LIGHT_ADDED_RATIO,
  MODERATE_EDIT_RATIO,
  ADDED_OVERRIDE_RATIO,
} from '../src/lib/report.ts';
import type { LogEntry, Segment } from '../src/lib/types.ts';

function seg(words: string): Segment {
  return { id: 0, start: 0, end: 1, words, detection: '', isTag: false, editedTxt: false, editedTime: false };
}

function logEntry(type: LogEntry['type'], detail = ''): LogEntry {
  return { seq: 1, segId: 0, type, detail };
}

describe('computeDiff — segment counts', () => {
  it('all unchanged', () => {
    const s = [seg('hello world')];
    const m = computeDiff(s, s);
    expect(m.unchanged).toBe(1);
    expect(m.modified).toBe(0);
    expect(m.added).toBe(0);
    expect(m.removed).toBe(0);
    expect(m.wordsAdded).toBe(0);
    expect(m.wordsDeleted).toBe(0);
    expect(m.editRatio).toBe(0);
  });

  it('one word swapped in a modified segment', () => {
    const orig = [seg('hello world foo')];
    const curr = [seg('hello world bar')];
    const m = computeDiff(orig, curr);
    expect(m.modified).toBe(1);
    expect(m.unchanged).toBe(0);
    expect(m.wordsAdded).toBe(1);
    expect(m.wordsDeleted).toBe(1);
    expect(m.editRatio).toBeCloseTo(2 / 3);
  });

  it('added segment', () => {
    const orig = [seg('hello world')];
    const curr = [seg('hello world'), seg('new text here')];
    const m = computeDiff(orig, curr);
    expect(m.unchanged).toBe(1);
    expect(m.added).toBe(1);
    expect(m.wordsAdded).toBe(3);
    expect(m.wordsDeleted).toBe(0);
  });

  it('removed segment', () => {
    const orig = [seg('hello world'), seg('extra stuff here')];
    const curr = [seg('hello world')];
    const m = computeDiff(orig, curr);
    expect(m.unchanged).toBe(1);
    expect(m.removed).toBe(1);
    expect(m.wordsDeleted).toBe(3);
    expect(m.wordsAdded).toBe(0);
  });

  it('empty arrays produce zeroed metrics', () => {
    const m = computeDiff([], []);
    expect(m.unchanged).toBe(0);
    expect(m.editRatio).toBe(0);
    expect(m.effortLevel).toBe('light');
  });

  it('segOriginal and segOutput reflect array lengths', () => {
    const orig = [seg('a'), seg('b'), seg('c')];
    const curr = [seg('a'), seg('b')];
    const m = computeDiff(orig, curr);
    expect(m.segOriginal).toBe(3);
    expect(m.segOutput).toBe(2);
  });
});

describe('computeDiff — addedWordsRatio', () => {
  it('counts only words in wholly-new segments', () => {
    // orig: 5 words; one modified (+1 ins, +1 del); one added (2 words)
    const orig = [seg('a b c d e'), seg('foo bar')];
    const curr = [seg('a b c d X'), seg('foo bar'), seg('new segment')];
    const m = computeDiff(orig, curr);
    // 'a b c d e' modified → 'a b c d X': 1 ins, 1 del
    // 'foo bar' unchanged
    // 'new segment' added: 2 words
    expect(m.modified).toBe(1);
    expect(m.unchanged).toBe(1);
    expect(m.added).toBe(1);
    const totalOrig = 7; // 5 + 2
    expect(m.totalOriginalWords).toBe(totalOrig);
    expect(m.addedWordsRatio).toBeCloseTo(2 / totalOrig);
  });
});

describe('effort level thresholds', () => {
  it('Light: editRatio well below 20%, no new segments', () => {
    // 11 words orig, 1 word changed → editRatio = 2/11 ≈ 0.182 < 0.20
    const orig = [seg('a b c d e f g h i j k')];
    const curr = [seg('a b c d e f g h i j X')];
    const m = computeDiff(orig, curr);
    expect(m.editRatio).toBeCloseTo(2 / 11);
    expect(m.effortLevel).toBe('light');
  });

  it(`Light boundary: editRatio < ${LIGHT_EDIT_RATIO} AND addedWordsRatio < ${LIGHT_ADDED_RATIO}`, () => {
    const orig = [seg('a b c d e f g h i j k')]; // 11 words
    const curr = [seg('a b c d e f g h i j X')]; // 1 change
    const m = computeDiff(orig, curr);
    expect(m.editRatio).toBeLessThan(LIGHT_EDIT_RATIO);
    expect(m.addedWordsRatio).toBeLessThan(LIGHT_ADDED_RATIO);
    expect(m.effortLevel).toBe('light');
  });

  it(`Moderate: editRatio = ${LIGHT_EDIT_RATIO} (boundary, not Light)`, () => {
    // 10 words orig, 1 word changed → editRatio = 2/10 = 0.20
    const orig = [seg('a b c d e f g h i j')];
    const curr = [seg('a b c d e f g h i X')];
    const m = computeDiff(orig, curr);
    expect(m.editRatio).toBeCloseTo(LIGHT_EDIT_RATIO);
    expect(m.effortLevel).toBe('moderate');
  });

  it(`Moderate: editRatio 40% (well below ${MODERATE_EDIT_RATIO})`, () => {
    // 20 words orig, 4 words changed → 8/20 = 0.40
    const orig = [seg('a b c d e f g h i j'), seg('k l m n o p q r s t')];
    const curr = [seg('a b c d e f g h i j'), seg('k l m n o A B C D t')];
    const m = computeDiff(orig, curr);
    expect(m.editRatio).toBeCloseTo(8 / 20);
    expect(m.effortLevel).toBe('moderate');
  });

  it(`Heavy: editRatio = ${MODERATE_EDIT_RATIO} (boundary)`, () => {
    // 20 words orig, 5 words changed → 10/20 = 0.50
    const orig = [seg('a b c d e f g h i j'), seg('k l m n o p q r s t')];
    const curr = [seg('a b c d e f g h i j'), seg('k l m n o A B C D E')];
    const m = computeDiff(orig, curr);
    expect(m.editRatio).toBeCloseTo(MODERATE_EDIT_RATIO);
    expect(m.effortLevel).toBe('heavy');
  });

  it(`Heavy: editRatio well above ${MODERATE_EDIT_RATIO}`, () => {
    // 10 words orig, 5 words changed → 10/10 = 1.0
    const orig = [seg('a b c d e f g h i j')];
    const curr = [seg('a b c d e A B C D E')];
    const m = computeDiff(orig, curr);
    expect(m.editRatio).toBeCloseTo(1.0);
    expect(m.effortLevel).toBe('heavy');
  });

  it(`Heavy override: addedWordsRatio > ${ADDED_OVERRIDE_RATIO} even if editRatio < ${MODERATE_EDIT_RATIO}`, () => {
    // orig: 5 words, add new segment with 3 words → addedWordsRatio = 3/5 = 0.60 > 0.30
    // editRatio = 3/5 = 0.60... wait that's >= 0.50 too.
    // Let me use bigger orig to keep editRatio < 0.50:
    // orig: 10 words, add new segment with 4 words → addedWordsRatio = 4/10 = 0.40 > 0.30
    // editRatio = 4/10 = 0.40 < 0.50 → would be Moderate without override
    const orig = [seg('a b c d e f g h i j')];
    const curr = [seg('a b c d e f g h i j'), seg('w x y z')];
    const m = computeDiff(orig, curr);
    expect(m.editRatio).toBeCloseTo(4 / 10);
    expect(m.addedWordsRatio).toBeGreaterThan(ADDED_OVERRIDE_RATIO);
    expect(m.effortLevel).toBe('heavy');
  });
});

describe('generateReport', () => {
  const origSegs = [seg('hello world foo')];
  const currSegs = [seg('hello world bar')];
  const sampleLog: LogEntry[] = [
    logEntry('orto', 'Text edited manually'),
    logEntry('tiempo', 'Boundary adjusted'),
    logEntry('orto', 'Spelling fixed'),
  ];

  it('contains formatted review time', () => {
    const report = generateReport({
      fileName: 'test.seglst.json',
      elapsedMs: (4 * 60 + 32) * 1000,
      originalSegments: origSegs,
      currentSegments: currSegs,
      log: sampleLog,
    });
    expect(report).toContain('04:32');
  });

  it('contains diff metrics section', () => {
    const report = generateReport({
      fileName: 'test.seglst.json',
      elapsedMs: 0,
      originalSegments: origSegs,
      currentSegments: currSegs,
      log: [],
    });
    expect(report).toContain('## Diff Metrics');
    expect(report).toContain('## Effort Level');
  });

  it('contains changelog summary section', () => {
    const report = generateReport({
      fileName: 'test.seglst.json',
      elapsedMs: 0,
      originalSegments: origSegs,
      currentSegments: currSegs,
      log: sampleLog,
    });
    expect(report).toContain('## Changelog Summary');
    expect(report).toContain('Total logged actions: 3');
  });

  it('contains effort explanation with real threshold values', () => {
    const report = generateReport({
      fileName: 'test.seglst.json',
      elapsedMs: 0,
      originalSegments: origSegs,
      currentSegments: currSegs,
      log: [],
    });
    expect(report).toContain('## How effort is calculated');
    // Verify that the constants are rendered, not hardcoded strings
    const lightPct = `${(LIGHT_EDIT_RATIO * 100).toFixed(1)}%`;
    const moderatePct = `${(MODERATE_EDIT_RATIO * 100).toFixed(1)}%`;
    const overridePct = `${(ADDED_OVERRIDE_RATIO * 100).toFixed(1)}%`;
    expect(report).toContain(lightPct);
    expect(report).toContain(moderatePct);
    expect(report).toContain(overridePct);
  });

  it('header contains no @ character (no email or sensitive IDs)', () => {
    const report = generateReport({
      fileName: 'test.seglst.json',
      elapsedMs: 0,
      originalSegments: null,
      currentSegments: [],
      log: [],
    });
    expect(report).not.toContain('@');
  });

  it('falls back to neutral label when fileName contains @', () => {
    const report = generateReport({
      fileName: 'john.doe@client.com_session.json',
      elapsedMs: 0,
      originalSegments: null,
      currentSegments: [],
      log: [],
    });
    expect(report).not.toContain('@');
    expect(report).toContain('transcript');
  });

  it('falls back to neutral label when fileName is null', () => {
    const report = generateReport({
      fileName: null,
      elapsedMs: 0,
      originalSegments: null,
      currentSegments: [],
      log: [],
    });
    expect(report).toContain('transcript');
  });

  it('handles null originalSegments gracefully', () => {
    const report = generateReport({
      fileName: 'test.seglst.json',
      elapsedMs: 0,
      originalSegments: null,
      currentSegments: currSegs,
      log: [],
    });
    expect(report).toContain('autosave');
    expect(report).toContain('## Changelog Summary');
    expect(report).not.toContain('## Effort Level');
  });

  it('changelog table lists action types with count > 0', () => {
    const log: LogEntry[] = [
      logEntry('orto'),
      logEntry('orto'),
      logEntry('tiempo'),
    ];
    const report = generateReport({
      fileName: 'test.seglst.json',
      elapsedMs: 0,
      originalSegments: origSegs,
      currentSegments: currSegs,
      log,
    });
    expect(report).toContain('Text edits (orto)');
    expect(report).toContain('Boundary adjustments (tiempo)');
  });

  it('h:mm:ss format for sessions over one hour', () => {
    const report = generateReport({
      fileName: 'test.seglst.json',
      elapsedMs: (1 * 3600 + 5 * 60 + 3) * 1000,
      originalSegments: null,
      currentSegments: [],
      log: [],
    });
    expect(report).toContain('1:05:03');
  });
});
