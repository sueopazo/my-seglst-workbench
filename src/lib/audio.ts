import { GAP, REL, RUN } from './constants';
import type { EdgeDetection, SilenceRun, WavAnalysis } from './types';

export function frameAt(wav: WavAnalysis, t: number): number {
  return Math.round(t / wav.hop);
}

export function tFrame(wav: WavAnalysis, i: number): number {
  return i * wav.hop;
}

export function segPeakDb(wav: WavAnalysis, s: number, e: number): number {
  const i0 = Math.max(0, frameAt(wav, s));
  const i1 = Math.min(wav.nf - 1, frameAt(wav, e));
  if (i1 <= i0) return wav.floor;
  let p = -Infinity;
  for (let i = i0; i <= i1; i++) p = Math.max(p, wav.db[i]);
  return p;
}

export function detectEdges(
  wav: WavAnalysis,
  s: number,
  e: number,
  pad = 0.25,
): EdgeDetection | null {
  const i0 = Math.max(0, frameAt(wav, s - pad));
  const i1 = Math.min(wav.nf - 1, frameAt(wav, e + pad));
  const ic0 = Math.max(0, frameAt(wav, s));
  const ic1 = Math.min(wav.nf - 1, frameAt(wav, e));
  if (ic1 <= ic0) return null;

  let peak = -Infinity;
  for (let i = ic0; i <= ic1; i++) peak = Math.max(peak, wav.db[i]);
  const thr = Math.max(peak - REL, wav.floor + 6);

  let on: number | null = null;
  let off: number | null = null;
  let run = 0;

  for (let i = i0; i <= i1; i++) {
    if (wav.db[i] > thr) {
      run++;
      if (run >= RUN && on === null) on = i - run + 1;
    } else run = 0;
  }

  run = 0;
  for (let i = i1; i >= i0; i--) {
    if (wav.db[i] > thr) {
      run++;
      if (run >= RUN && off === null) off = i + run - 1;
    } else run = 0;
  }

  if (on === null || off === null) return null;
  return { start: tFrame(wav, on), end: tFrame(wav, off), thr, peak };
}

export function internalSilences(wav: WavAnalysis, s: number, e: number): SilenceRun[] {
  const i0 = Math.max(0, frameAt(wav, s));
  const i1 = Math.min(wav.nf - 1, frameAt(wav, e));

  let peak = -Infinity;
  for (let i = i0; i <= i1; i++) peak = Math.max(peak, wav.db[i]);
  const thr = Math.max(peak - REL, wav.floor + 6);

  const runs: [number, number][] = [];
  let st: number | null = null;

  for (let i = i0; i <= i1; i++) {
    if (wav.db[i] <= thr) {
      if (st === null) st = i;
    } else if (st !== null) {
      if ((i - st) * wav.hop >= GAP) runs.push([st, i - 1]);
      st = null;
    }
  }
  if (st !== null && (i1 - st) * wav.hop >= GAP) runs.push([st, i1]);

  return runs
    .filter((r) => tFrame(wav, r[0]) > s + 0.05 && tFrame(wav, r[1]) < e - 0.05)
    .map((r) => ({
      mid: tFrame(wav, Math.round((r[0] + r[1]) / 2)),
      from: tFrame(wav, r[0]),
      to: tFrame(wav, r[1]),
      len: (r[1] - r[0]) * wav.hop,
    }));
}

export function analyzeEnvelope(ch: Float32Array, sr: number): WavAnalysis {
  const hopS = Math.round(0.005 * sr);
  const winS = Math.round(0.02 * sr);
  const nf = Math.max(0, Math.floor((ch.length - winS) / hopS));
  const env = new Float32Array(nf);

  for (let i = 0; i < nf; i++) {
    let s = 0;
    const o = i * hopS;
    for (let j = 0; j < winS; j++) {
      const v = ch[o + j];
      s += v * v;
    }
    env[i] = Math.sqrt(s / winS);
  }

  const sm = new Float32Array(nf);
  const K = 6;
  for (let i = 0; i < nf; i++) {
    let a = 0;
    let c = 0;
    for (let j = -Math.floor(K / 2); j < K / 2; j++) {
      const k = i + j;
      if (k >= 0 && k < nf) {
        a += env[k];
        c++;
      }
    }
    sm[i] = a / (c || 1);
  }

  const db = new Float32Array(nf);
  let peakAll = 1e-9;
  for (let i = 0; i < nf; i++) peakAll = Math.max(peakAll, sm[i]);
  for (let i = 0; i < nf; i++) db[i] = 20 * Math.log10(sm[i] / peakAll + 1e-9);

  const sorted = Float32Array.from(db).sort();
  const floor = sorted[Math.floor(nf * 0.05)] ?? -90;

  return { sr, hop: hopS / sr, nf, db, floor };
}
