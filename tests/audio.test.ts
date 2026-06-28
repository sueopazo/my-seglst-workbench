import { describe, it, expect } from 'vitest';
import { analyzeEnvelope, detectEdges, internalSilences } from '../src/lib/audio.ts';
import { GAP } from '../src/lib/constants.ts';
import type { WavAnalysis } from '../src/lib/types.ts';

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

describe('detectEdges', () => {
  it('finds voice onset and offset in a simple speech region', () => {
    const audio = makeSyntheticAudio([
      { start: 0, end: 0.5, amp: 0 },
      { start: 0.5, end: 2.5, amp: 0.8 },
      { start: 2.5, end: 3.0, amp: 0 },
    ]);
    const wav: WavAnalysis = analyzeEnvelope(audio, SR);
    const result = detectEdges(wav, 0, 3.0);
    expect(result).not.toBeNull();
    expect(result!.start).toBeGreaterThanOrEqual(0.4);
    expect(result!.start).toBeLessThan(0.65);
    expect(result!.end).toBeGreaterThan(2.35);
    expect(result!.end).toBeLessThanOrEqual(2.65);
  });

  it('returns null for an all-silent region', () => {
    const audio = new Float32Array(SR * 2);
    const wav: WavAnalysis = analyzeEnvelope(audio, SR);
    const result = detectEdges(wav, 0, 2.0);
    expect(result).toBeNull();
  });
});

describe('internalSilences', () => {
  it('detects a silence gap longer than GAP between two speech regions', () => {
    const silenceLen = GAP + 0.3;
    const audio = makeSyntheticAudio([
      { start: 0, end: 1.0, amp: 0.8 },
      { start: 1.0, end: 1.0 + silenceLen, amp: 0 },
      { start: 1.0 + silenceLen, end: 2.5, amp: 0.8 },
    ]);
    const wav: WavAnalysis = analyzeEnvelope(audio, SR);
    const runs = internalSilences(wav, 0, 2.5);
    expect(runs.length).toBe(1);
    expect(runs[0].len).toBeGreaterThanOrEqual(GAP);
  });

  it('does not report silences shorter than GAP', () => {
    const shortSilence = GAP * 0.5;
    const audio = makeSyntheticAudio([
      { start: 0, end: 1.0, amp: 0.8 },
      { start: 1.0, end: 1.0 + shortSilence, amp: 0 },
      { start: 1.0 + shortSilence, end: 2.5, amp: 0.8 },
    ]);
    const wav: WavAnalysis = analyzeEnvelope(audio, SR);
    const runs = internalSilences(wav, 0, 2.5);
    expect(runs.length).toBe(0);
  });
});
