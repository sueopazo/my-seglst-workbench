import { GAP } from './constants';
import { f2, hasCJK } from './format';
import type { ExportRow, LogEntry, SeglstRaw, Segment, SessionMeta } from './types';

export function parseSeglst(
  data: unknown,
  onLog: (segId: number, type: LogEntry['type'], detail: string) => void,
): { segments: Segment[]; meta: SessionMeta } {
  if (!Array.isArray(data)) throw new Error('El .seglst debe ser una lista');

  const raw = data as SeglstRaw[];
  const meta: SessionMeta = {
    sessionId: raw[0]?.session_id ?? null,
    speaker: raw[0]?.speaker ?? null,
    seglstName: null,
    wavName: null,
  };

  const segments: Segment[] = raw.map((d, i) => ({
    id: i,
    start: parseFloat(String(d.start_time)),
    end: parseFloat(String(d.end_time)),
    words: (d.words ?? '').trim(),
    detection: d.detection_method ?? '',
    isTag: false,
    editedTxt: false,
    editedTime: false,
  }));

  for (const s of segments) {
    if (s.words === '') {
      s.words = '[other-noise]';
      s.isTag = true;
      onLog(
        s.id,
        'tag',
        `Empty ${s.detection || 'rms'} → [other-noise] (confirm)`,
      );
      continue;
    }

    if (hasCJK(s.words)) onLog(s.id, 'alerta', 'Possible transcription in another language');
  }

  return { segments, meta };
}

export function exportSeglst(segments: Segment[], meta: SessionMeta): ExportRow[] {
  const speaker = meta.speaker ?? 'unknown';
  return segments.map((s) => ({
    session_id: meta.sessionId ?? speaker,
    speaker,
    start_time: f2(s.start),
    end_time: f2(s.end),
    words: s.words,
  }));
}

export function reindex(segments: Segment[]): void {
  segments.forEach((s, i) => {
    s.id = i;
  });
}

export function splitBySilence(
  segments: Segment[],
  index: number,
  cuts: number[],
  bounds: number[],
): Segment[] {
  const s = segments[index];
  const tw = s.words.split(/\s+/).filter(Boolean);
  const parts = bounds.length - 1;
  const out: Segment[] = [];
  let used = 0;

  for (let k = 0; k < parts; k++) {
    let cnt =
      k === parts - 1 ? tw.length - used : Math.round(tw.length / parts);
    cnt = Math.max(0, Math.min(cnt, tw.length - used));
    out.push({
      ...s,
      words: tw.slice(used, used + cnt).join(' '),
      start: bounds[k],
      end: bounds[k + 1],
      editedTxt: true,
      editedTime: true,
      needsTextReview: true,
    });
    used += cnt;
  }

  void cuts;
  return out;
}

export function mergeSegments(a: Segment, b: Segment): Segment {
  return {
    ...a,
    words: `${a.words} ${b.words}`.replace(/\s+/g, ' ').trim(),
    end: b.end,
    editedTxt: true,
    editedTime: true,
  };
}

export function canMergeNext(segments: Segment[], index: number): boolean {
  if (index >= segments.length - 1) return false;
  const s = segments[index];
  const next = segments[index + 1];
  if (s.isTag || next.isTag) return false;
  const gap = next.start - s.end;
  return gap >= 0 && gap < GAP;
}
