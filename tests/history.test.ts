import { describe, it, expect } from 'vitest';
import { History } from '../src/lib/history.ts';
import { HISTORY_LIMIT } from '../src/lib/constants.ts';
import type { Segment } from '../src/lib/types.ts';

function seg(words: string): Segment {
  return { id: 0, start: 0, end: 1, words, detection: '', isTag: false, editedTxt: false, editedTime: false };
}

describe('History', () => {
  it('starts empty — canUndo is false', () => {
    const h = new History();
    expect(h.canUndo).toBe(false);
  });

  it('canUndo is true after push', () => {
    const h = new History();
    h.push([seg('a')], [], 0);
    expect(h.canUndo).toBe(true);
  });

  it('pop returns last snapshot; canUndo becomes false when stack empties', () => {
    const h = new History();
    h.push([seg('a')], [], 2);
    const snap = h.pop();
    expect(snap).not.toBeNull();
    expect(snap!.segments[0].words).toBe('a');
    expect(snap!.cur).toBe(2);
    expect(h.canUndo).toBe(false);
  });

  it('pop on empty stack returns null', () => {
    const h = new History();
    expect(h.pop()).toBeNull();
  });

  it('LIFO order: second push is popped first', () => {
    const h = new History();
    h.push([seg('A')], [], 0);
    h.push([seg('B')], [], 1);
    expect(h.pop()!.segments[0].words).toBe('B');
    expect(h.pop()!.segments[0].words).toBe('A');
    expect(h.canUndo).toBe(false);
  });

  it('clear empties the stack', () => {
    const h = new History();
    h.push([seg('a')], [], 0);
    h.push([seg('b')], [], 1);
    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.pop()).toBeNull();
  });

  it('snapshot is deep-cloned — mutating original does not affect stored snapshot', () => {
    const h = new History();
    const segs = [seg('original')];
    h.push(segs, [], 0);
    segs[0].words = 'mutated';
    expect(h.pop()!.segments[0].words).toBe('original');
  });

  it('stack is capped at HISTORY_LIMIT — oldest snapshot is evicted', () => {
    const h = new History();
    for (let i = 0; i < HISTORY_LIMIT + 1; i++) {
      h.push([seg(String(i))], [], i);
    }
    let count = 0;
    while (h.canUndo) { h.pop(); count++; }
    expect(count).toBe(HISTORY_LIMIT);
  });
});
