import { analyzeEnvelope } from './audio';
import type { WavAnalysis } from './types';

export interface DecodeResult {
  wav: WavAnalysis;
  channelData: Float32Array;
  duration: number;
}

/** Decode a WAV file for waveform / energy analysis (separate from HTML playback). */
export async function decodeWaveform(file: File): Promise<DecodeResult> {
  const ctx = new AudioContext();
  try {
    const ab = await file.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab.slice(0));
    const ch = buf.getChannelData(0);
    return {
      wav: analyzeEnvelope(ch, buf.sampleRate),
      channelData: ch,
      duration: buf.duration,
    };
  } finally {
    await ctx.close();
  }
}
