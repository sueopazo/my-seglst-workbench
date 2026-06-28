import { formatElapsed } from './format';
import type { LogEntry, Segment } from './types';

// Thresholds — also used verbatim in the generated explanation text (no second copy)
export const SIMILARITY_THRESHOLD = 0.34;
export const LIGHT_EDIT_RATIO = 0.20;
export const LIGHT_ADDED_RATIO = 0.20;
export const MODERATE_EDIT_RATIO = 0.50;
export const ADDED_OVERRIDE_RATIO = 0.30;

export type EffortLevel = 'light' | 'moderate' | 'heavy';

export interface DiffMetrics {
  segOriginal: number;
  segOutput: number;
  unchanged: number;
  modified: number;
  added: number;
  removed: number;
  wordsAdded: number;
  wordsDeleted: number;
  totalOriginalWords: number;
  totalOutputWords: number;
  editRatio: number;
  addedWordsRatio: number;
  effortLevel: EffortLevel;
}

export interface ReportParams {
  fileName: string | null;
  elapsedMs: number;
  originalSegments: Segment[] | null;
  currentSegments: Segment[];
  log: LogEntry[];
}

// --- diff primitives (ported from transcript_comparator.html) ---

function tokenize(t: string): string[] {
  return t.split(/\s+/).filter(Boolean);
}

function normWord(w: string): string {
  return w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function normText(t: string): string {
  return t.toLowerCase().replace(/\s+/g, ' ').trim();
}

type LcsOp =
  | { t: 'eq'; a: number; b: number }
  | { t: 'del'; a: number }
  | { t: 'ins'; b: number };

function lcsOps<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): LcsOp[] {
  const n = a.length;
  const m = b.length;
  const dp: Int32Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = eq(a[i], b[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const out: LcsOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      out.push({ t: 'eq', a: i, b: j });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ t: 'del', a: i });
      i++;
    } else {
      out.push({ t: 'ins', b: j });
      j++;
    }
  }
  while (i < n) { out.push({ t: 'del', a: i }); i++; }
  while (j < m) { out.push({ t: 'ins', b: j }); j++; }
  return out;
}

function wordCounts(aText: string, bText: string): { ins: number; del: number } {
  const aw = tokenize(aText);
  const bw = tokenize(bText);
  const ops = lcsOps(aw, bw, (x, y) => normWord(x) === normWord(y) && normWord(x) !== '');
  let ins = 0;
  let del = 0;
  for (const op of ops) {
    if (op.t === 'ins') ins++;
    else if (op.t === 'del') del++;
  }
  return { ins, del };
}

function dice(aText: string, bText: string): number {
  const a = tokenize(normText(aText)).map(normWord).filter(Boolean);
  const b = tokenize(normText(bText)).map(normWord).filter(Boolean);
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const ma = new Map<string, number>();
  for (const w of a) ma.set(w, (ma.get(w) ?? 0) + 1);
  const mb = new Map<string, number>();
  for (const w of b) mb.set(w, (mb.get(w) ?? 0) + 1);
  let inter = 0;
  for (const [w, c] of ma) {
    const bc = mb.get(w);
    if (bc !== undefined) inter += Math.min(c, bc);
  }
  return (2 * inter) / (a.length + b.length);
}

type AlignedSeg =
  | { type: 'unchanged'; orig: Segment; curr: Segment }
  | { type: 'modified'; orig: Segment; curr: Segment }
  | { type: 'added'; curr: Segment }
  | { type: 'removed'; orig: Segment };

function alignSegments(origSegs: Segment[], currSegs: Segment[]): AlignedSeg[] {
  const ops = lcsOps(origSegs, currSegs, (x, y) => normText(x.words) === normText(y.words));
  const result: AlignedSeg[] = [];
  let pendingDel: number[] = [];
  let pendingIns: number[] = [];

  function flushGap(): void {
    const usedB = new Set<number>();
    for (const ai of pendingDel) {
      let best = -1;
      let bestScore = 0;
      for (const bi of pendingIns) {
        if (usedB.has(bi)) continue;
        const s = dice(origSegs[ai].words, currSegs[bi].words);
        if (s > bestScore) { bestScore = s; best = bi; }
      }
      if (best >= 0 && bestScore >= SIMILARITY_THRESHOLD) {
        usedB.add(best);
        result.push({ type: 'modified', orig: origSegs[ai], curr: currSegs[best] });
      } else {
        result.push({ type: 'removed', orig: origSegs[ai] });
      }
    }
    for (const bi of pendingIns) {
      if (!usedB.has(bi)) result.push({ type: 'added', curr: currSegs[bi] });
    }
    pendingDel = [];
    pendingIns = [];
  }

  for (const op of ops) {
    if (op.t === 'eq') {
      flushGap();
      result.push({ type: 'unchanged', orig: origSegs[op.a], curr: currSegs[op.b] });
    } else if (op.t === 'del') {
      pendingDel.push(op.a);
    } else {
      pendingIns.push(op.b);
    }
  }
  flushGap();
  return result;
}

// --- public API ---

export function computeDiff(orig: Segment[], curr: Segment[]): DiffMetrics {
  const aligned = alignSegments(orig, curr);
  const totalOriginalWords = orig.reduce((s, x) => s + tokenize(x.words).length, 0);
  const totalOutputWords = curr.reduce((s, x) => s + tokenize(x.words).length, 0);

  let unchanged = 0, modified = 0, added = 0, removed = 0;
  let wordsAdded = 0, wordsDeleted = 0, wordsAddedFromNewSegs = 0;

  for (const r of aligned) {
    switch (r.type) {
      case 'unchanged':
        unchanged++;
        break;
      case 'modified': {
        modified++;
        const wc = wordCounts(r.orig.words, r.curr.words);
        wordsAdded += wc.ins;
        wordsDeleted += wc.del;
        break;
      }
      case 'added': {
        added++;
        const n = tokenize(r.curr.words).length;
        wordsAdded += n;
        wordsAddedFromNewSegs += n;
        break;
      }
      case 'removed':
        removed++;
        wordsDeleted += tokenize(r.orig.words).length;
        break;
    }
  }

  const editRatio = (wordsAdded + wordsDeleted) / Math.max(1, totalOriginalWords);
  const addedWordsRatio = wordsAddedFromNewSegs / Math.max(1, totalOriginalWords);

  let effortLevel: EffortLevel;
  if (editRatio < LIGHT_EDIT_RATIO && addedWordsRatio < LIGHT_ADDED_RATIO) {
    effortLevel = 'light';
  } else if (editRatio < MODERATE_EDIT_RATIO) {
    effortLevel = 'moderate';
  } else {
    effortLevel = 'heavy';
  }
  if (effortLevel !== 'heavy' && addedWordsRatio > ADDED_OVERRIDE_RATIO) {
    effortLevel = 'heavy';
  }

  return {
    segOriginal: orig.length,
    segOutput: curr.length,
    unchanged, modified, added, removed,
    wordsAdded, wordsDeleted,
    totalOriginalWords, totalOutputWords,
    editRatio, addedWordsRatio, effortLevel,
  };
}

const LOG_TYPE_LABELS: Record<LogEntry['type'], string> = {
  orto: 'Text edits (orto)',
  tiempo: 'Boundary adjustments (tiempo)',
  estruct: 'Structural changes (estruct)',
  tag: 'Tag changes (tag)',
  alerta: 'Alerts (alerta)',
  campo: 'Field changes (campo)',
};

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function safeFileName(raw: string | null): string {
  if (!raw || raw.includes('@')) return 'transcript';
  return raw.replace(/[/\\]/g, '_').slice(0, 120);
}

export function generateReport(params: ReportParams): string {
  const { fileName, elapsedMs, originalSegments, currentSegments, log } = params;
  const label = safeFileName(fileName);
  const elapsed = formatElapsed(Math.floor(elapsedMs / 1000));
  const lines: string[] = [];

  lines.push(`# QA Report — ${label}`);
  lines.push('');
  lines.push(`**Review time:** ${elapsed}`);
  lines.push('');

  if (originalSegments === null) {
    lines.push('_Original file not available — session was restored from autosave before this feature_');
    lines.push('_was added. Reload the original .seglst file to generate full diff metrics._');
    lines.push('');
  } else {
    const m = computeDiff(originalSegments, currentSegments);
    const levelLabel = m.effortLevel === 'light' ? 'Light' : m.effortLevel === 'moderate' ? 'Moderate' : 'Heavy';

    lines.push(`## Effort Level: ${levelLabel}`);
    lines.push('');
    lines.push(`Edit rate: ${pct(m.editRatio)} · New text: ${pct(m.addedWordsRatio)}`);
    lines.push('');
    lines.push('## Diff Metrics (original vs output)');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Segments (original → output) | ${m.segOriginal} → ${m.segOutput} |`);
    lines.push(`| Unchanged | ${m.unchanged} |`);
    lines.push(`| Modified | ${m.modified} |`);
    lines.push(`| Added | ${m.added} |`);
    lines.push(`| Removed | ${m.removed} |`);
    lines.push(`| Words added | +${m.wordsAdded} |`);
    lines.push(`| Words removed | −${m.wordsDeleted} |`);
    lines.push(`| Total original words | ${m.totalOriginalWords} |`);
    lines.push(`| Edit rate | ${pct(m.editRatio)} |`);
    lines.push(`| New text | ${pct(m.addedWordsRatio)} |`);
    lines.push('');
    lines.push('## How effort is calculated');
    lines.push('');
    lines.push('The effort level (Light / Moderate / Heavy) is derived from two metrics computed');
    lines.push('by a word-level diff between the original and corrected transcript:');
    lines.push('');
    lines.push('- **editRatio** = (words added + words deleted) / total original words');
    lines.push('- **addedWordsRatio** = words in fully-new segments / total original words');
    lines.push('');
    lines.push('Thresholds applied:');
    lines.push(`- **Light:** editRatio < ${pct(LIGHT_EDIT_RATIO)} AND addedWordsRatio < ${pct(LIGHT_ADDED_RATIO)}`);
    lines.push(`- **Moderate:** editRatio ≥ ${pct(LIGHT_EDIT_RATIO)} and < ${pct(MODERATE_EDIT_RATIO)}`);
    lines.push(`- **Heavy:** editRatio ≥ ${pct(MODERATE_EDIT_RATIO)}, or addedWordsRatio > ${pct(ADDED_OVERRIDE_RATIO)} (override)`);
    lines.push('');
    lines.push('These thresholds are indicative and calibrated against real average handling time');
    lines.push('(AHT) experience. They can be adjusted as new reference data becomes available.');
    lines.push('');
  }

  const typeCounts = new Map<LogEntry['type'], number>();
  for (const e of log) {
    typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1);
  }

  lines.push('## Changelog Summary');
  lines.push('');
  lines.push(`Total logged actions: ${log.length}`);
  lines.push('');

  if (log.length > 0) {
    lines.push('| Type | Count |');
    lines.push('|------|-------|');
    for (const [type, logLabel] of Object.entries(LOG_TYPE_LABELS)) {
      const count = typeCounts.get(type as LogEntry['type']) ?? 0;
      if (count > 0) lines.push(`| ${logLabel} | ${count} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
