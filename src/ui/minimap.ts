import { segPeakDb } from '../lib/audio';
import type { Segment, WavAnalysis } from '../lib/types';

const el = (tag: string, cls?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
};

export class Minimap {
  private container: HTMLElement;
  private cells: HTMLElement[] = [];
  private cur = -1;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setLength(n: number, onSelect: (i: number) => void): void {
    this.container.innerHTML = '';
    this.cells = [];
    for (let i = 0; i < n; i++) {
      const c = el('div', 'cell');
      c.title = `#${i + 1}`;
      c.addEventListener('click', () => onSelect(i));
      this.container.appendChild(c);
      this.cells.push(c);
    }
  }

  update(
    segments: Segment[],
    cur: number,
    wav: WavAnalysis | null,
  ): void {
    if (this.cells.length !== segments.length) return;

    segments.forEach((s, i) => {
      const c = this.cells[i];
      c.className = 'cell';

      const silent  = wav && !s.isTag && segPeakDb(wav, s.start, s.end) < wav.floor + 12;
      if (s.needsText)                    c.classList.add('pending');
      else if (s.needsTextReview)         c.classList.add('needs-review');
      else if (silent)                    c.classList.add('silent');
      else if (s.isTag)                   c.classList.add('tag');
      else if (s.editedTxt || s.editedTime) c.classList.add('edited');

      if (i === cur) c.classList.add('cur');
    });

    if (cur !== this.cur) {
      this.cur = cur;
      this.cells[cur]?.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  }

  show(): void {
    this.container.hidden = false;
  }

  hide(): void {
    this.container.hidden = true;
    this.cells = [];
    this.container.innerHTML = '';
  }
}
