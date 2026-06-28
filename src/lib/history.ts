import { HISTORY_LIMIT } from './constants';
import type { LogEntry, Segment } from './types';

export interface HistorySnapshot {
  segments: Segment[];
  log: LogEntry[];
  cur: number;
}

export class History {
  private stack: HistorySnapshot[] = [];

  get canUndo(): boolean {
    return this.stack.length > 0;
  }

  push(segments: Segment[], log: LogEntry[], cur: number): void {
    this.stack.push({
      segments: structuredClone(segments),
      log: structuredClone(log),
      cur,
    });
    if (this.stack.length > HISTORY_LIMIT) this.stack.shift();
  }

  pop(): HistorySnapshot | null {
    return this.stack.pop() ?? null;
  }

  clear(): void {
    this.stack = [];
  }
}
