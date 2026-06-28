import { LANG_KEY, STORAGE_KEY } from './constants';
import type { LogEntry, SavedState, Segment, SessionMeta } from './types';

export function loadSavedState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedState;
    if (data.version !== 1 || !Array.isArray(data.segments)) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveState(payload: {
  meta: SessionMeta;
  segments: Segment[];
  originalSegments?: Segment[];
  log: LogEntry[];
  logSeq: number;
  cur: number;
  workElapsedMs?: number;
}): void {
  const state: SavedState = {
    version: 1,
    savedAt: Date.now(),
    ...payload,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearSavedState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function loadSavedLang(): string {
  return localStorage.getItem(LANG_KEY) ?? 'en';
}

export function saveLang(code: string): void {
  localStorage.setItem(LANG_KEY, code);
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  }) as T;
}
