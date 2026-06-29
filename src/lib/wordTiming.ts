export interface WordWindow {
  word: string;
  start: number;
  end: number;
}

const PAUSE_BONUS: Record<string, number> = {
  ',': 0.3,
  ';': 0.4,
  '.': 0.6,
  '?': 0.6,
  '!': 0.6,
  ':': 0.4,
};

function syllableCount(word: string): number {
  // Bracket tokens [foo] → weight 1 (they're short paralinguistic tags)
  if (word.startsWith('[')) return 1;
  const groups = word.match(/[aeiouáéíóúàèìòùäëïöüâêîôûãõ]+/gi);
  return Math.max(1, groups ? groups.length : 1);
}

function pauseWeight(word: string): number {
  const last = word[word.length - 1];
  return last ? (PAUSE_BONUS[last] ?? 0) : 0;
}

/** Split text into tokens: bracket tags [like-this] are kept whole. */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  // Match either a bracket token or a run of non-whitespace
  const re = /\[[^\]]*\]|[^\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

/**
 * Estimate per-word time windows for a segment.
 * Weights each word by syllable count + pause bonus at sentence-final punctuation.
 * Bracket tokens count as a single unit.
 */
export function estimateWordTimings(
  text: string,
  start: number,
  end: number,
): WordWindow[] {
  const words = tokenize(text);
  if (words.length === 0) return [];

  const duration = Math.max(0, end - start);

  const weights = words.map(w => syllableCount(w) + pauseWeight(w));
  const total = weights.reduce((a, b) => a + b, 0);

  const result: WordWindow[] = [];
  let t = start;
  for (let i = 0; i < words.length; i++) {
    const share = total > 0 ? weights[i] / total : 1 / words.length;
    const wEnd = i < words.length - 1 ? t + share * duration : end;
    result.push({ word: words[i], start: t, end: wEnd });
    t = wEnd;
  }
  return result;
}

/**
 * Given a playhead position and word windows, return the index of the
 * current word (-1 if before all words or after all words).
 */
export function currentWordIndex(windows: WordWindow[], t: number): number {
  for (let i = 0; i < windows.length; i++) {
    if (t >= windows[i].start && t < windows[i].end) return i;
  }
  // Clamp to last word if we're at or past end
  if (windows.length > 0 && t >= windows[windows.length - 1].end) {
    return windows.length - 1;
  }
  return -1;
}
