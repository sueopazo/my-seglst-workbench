import { detectEdges, internalSilences, segPeakDb } from './audio';
import { applyOrthoToSegment } from './ortho';
import type { LanguageProfile } from './profiles';
import { canMergeNext, reindex, splitBySilence } from './segments';
import type { Segment, WavAnalysis } from './types';

export interface BatchPreview {
  ortho: number;
  deletes: number;
  trims: number;
  splits: number;
  merges: number;
  total: number;
}

export interface BatchResult {
  segments: Segment[];
  preview: BatchPreview;
}

function isSilent(wav: WavAnalysis, s: Segment): boolean {
  return !s.isTag && segPeakDb(wav, s.start, s.end) < wav.floor + 12;
}

function countTrimBoundaries(wav: WavAnalysis, s: Segment): number {
  if (s.isTag) return 0;
  const d = detectEdges(wav, s.start, s.end);
  if (!d) return 0;
  let n = 0;
  if (Math.abs(d.start - s.start) > 0.03) n++;
  if (Math.abs(d.end - s.end) > 0.03) n++;
  return n;
}

function needsSplit(wav: WavAnalysis, s: Segment): boolean {
  if (s.isTag) return false;
  return internalSilences(wav, s.start, s.end).length > 0;
}

function countOrtho(segments: Segment[], profile: LanguageProfile): number {
  let n = 0;
  for (const s of segments) {
    if (s.isTag) continue;
    const { changed } = applyOrthoToSegment(s.words, profile);
    if (changed) n++;
  }
  return n;
}

export function previewBatch(
  segments: Segment[],
  wav: WavAnalysis | null,
  profile: LanguageProfile,
): BatchPreview {
  const ortho = countOrtho(segments, profile);
  let deletes = 0;
  let trims = 0;
  let splits = 0;
  let merges = 0;

  if (wav) {
    for (const s of segments) {
      if (isSilent(wav, s)) deletes++;
      else {
        trims += countTrimBoundaries(wav, s);
        if (needsSplit(wav, s)) splits++;
      }
    }

    for (let i = 0; i < segments.length - 1; i++) {
      if (canMergeNext(segments, i)) merges++;
    }
  }

  return {
    ortho,
    deletes,
    trims,
    splits,
    merges,
    total: ortho + deletes + trims + splits + merges,
  };
}

function applyOrtho(s: Segment, profile: LanguageProfile): boolean {
  if (s.isTag) return false;
  const { words, changed } = applyOrthoToSegment(s.words, profile);
  if (!changed) return false;
  s.words = words;
  s.editedTxt = true;
  return true;
}

function trimSegment(wav: WavAnalysis, s: Segment): boolean {
  const d = detectEdges(wav, s.start, s.end);
  if (!d || (Math.abs(d.start - s.start) <= 0.03 && Math.abs(d.end - s.end) <= 0.03)) {
    return false;
  }
  s.start = d.start;
  s.end = d.end;
  s.editedTime = true;
  return true;
}

function splitSegment(wav: WavAnalysis, segments: Segment[], index: number): number {
  const s = segments[index];
  const sil = internalSilences(wav, s.start, s.end);
  if (!sil.length) return 0;

  const cuts = sil.map((x) => x.mid);
  const bounds = [s.start, ...cuts, s.end];
  const parts = splitBySilence(segments, index, cuts, bounds);

  for (let k = 0; k < parts.length; k++) {
    const d = detectEdges(wav, parts[k].start, parts[k].end, 0.05);
    if (d) {
      parts[k].start = d.start;
      parts[k].end = d.end;
    }
  }

  segments.splice(index, 1, ...parts);
  return parts.length - 1;
}

export function applyOrthoProposals(
  segments: Segment[],
  profile: LanguageProfile,
): BatchResult {
  const preview = previewBatch(segments, null, profile);
  const out = structuredClone(segments) as Segment[];
  for (const s of out) applyOrtho(s, profile);
  reindex(out);
  return { segments: out, preview };
}

export function applyTrimProposals(
  segments: Segment[],
  wav: WavAnalysis,
  profile: LanguageProfile,
): BatchResult {
  const preview = previewBatch(segments, wav, profile);
  const out = structuredClone(segments) as Segment[];
  for (const s of out) {
    if (!s.isTag && !isSilent(wav, s)) trimSegment(wav, s);
  }
  reindex(out);
  return { segments: out, preview };
}

export function applyAllProposals(
  segments: Segment[],
  wav: WavAnalysis | null,
  profile: LanguageProfile,
): BatchResult {
  const preview = previewBatch(segments, wav, profile);
  const out = structuredClone(segments) as Segment[];

  for (const s of out) {
    applyOrtho(s, profile);
  }

  if (wav) {
    for (let i = out.length - 1; i >= 0; i--) {
      if (isSilent(wav, out[i])) {
        out.splice(i, 1);
      }
    }

    for (const s of out) {
      if (!s.isTag) trimSegment(wav, s);
    }

    for (let i = out.length - 1; i >= 0; i--) {
      if (!out[i].isTag && internalSilences(wav, out[i].start, out[i].end).length) {
        splitSegment(wav, out, i);
      }
    }

    let i = 0;
    while (i < out.length - 1) {
      if (canMergeNext(out, i)) {
        const a = out[i];
        const b = out[i + 1];
        a.words = `${a.words} ${b.words}`.replace(/\s+/g, ' ').trim();
        a.end = b.end;
        a.editedTxt = true;
        a.editedTime = true;
        out.splice(i + 1, 1);
        continue;
      }
      i++;
    }
  }

  reindex(out);
  return { segments: out, preview };
}
