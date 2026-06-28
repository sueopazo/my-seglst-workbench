export interface SeglstRaw {
  session_id?: string;
  speaker?: string;
  start_time: string | number;
  end_time: string | number;
  words?: string;
  detection_method?: string;
}

export interface Segment {
  id: number;
  start: number;
  end: number;
  words: string;
  detection: string;
  isTag: boolean;
  editedTxt: boolean;
  editedTime: boolean;
  needsTextReview?: boolean;
  needsText?: boolean;
}

export interface SessionMeta {
  sessionId: string | null;
  speaker: string | null;
  seglstName: string | null;
  wavName: string | null;
  langCode?: string;
}

export interface LogEntry {
  seq: number;
  segId: number;
  type: 'campo' | 'orto' | 'tiempo' | 'estruct' | 'tag' | 'alerta';
  detail: string;
}

export interface WavAnalysis {
  sr: number;
  hop: number;
  nf: number;
  db: Float32Array;
  floor: number;
}

export interface EdgeDetection {
  start: number;
  end: number;
  thr: number;
  peak: number;
}

export interface SilenceRun {
  mid: number;
  from: number;
  to: number;
  len: number;
}

export interface SavedState {
  version: 1;
  savedAt: number;
  meta: SessionMeta;
  segments: Segment[];
  log: LogEntry[];
  logSeq: number;
  cur: number;
  workElapsedMs?: number;
}

export interface ExportRow {
  session_id: string;
  speaker: string;
  start_time: string;
  end_time: string;
  words: string;
}
