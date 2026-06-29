import { TAG_PINNED, TAG_EXTRA, TAG_TOOLTIPS } from './lib/constants';
import { generateReport } from './lib/report';
import { detectEdges, internalSilences, segPeakDb } from './lib/audio';
import { orthoFix } from './lib/ortho';
import { PROFILES } from './lib/profiles';
import {
  canMergeNext,
  exportSeglst,
  mergeSegments,
  parseSeglst,
  reindex,
  splitBySilence,
} from './lib/segments';
import { applyAllProposals, applyOrthoProposals, applyTrimProposals, previewBatch } from './lib/batch-apply';
import { decodeWaveform } from './lib/waveform-decode';
import { History } from './lib/history';
import { clearSavedState, debounce, loadSavedLang, loadSavedState, saveLang, saveState } from './lib/storage';
import { f2, formatElapsed, hasCJK, mmss } from './lib/format';
import { currentWordIndex, estimateWordTimings } from './lib/wordTiming';
import type { LogEntry, Segment, SessionMeta, WavAnalysis } from './lib/types';
import { Minimap } from './ui/minimap';
import { WaveSurferView } from './ui/wavesurfer-view';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class App {
  private segments: Segment[] = [];
  private meta: SessionMeta = {
    sessionId: null,
    speaker: null,
    seglstName: null,
    wavName: null,
  };
  private log: LogEntry[] = [];
  private logSeq = 0;
  private cur = 0;
  private wav: WavAnalysis | null = null;
  private channelData: Float32Array | null = null;
  private decodedDuration = 0;
  private audioURL: string | null = null;
  private playing: number | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private focusText = false;
  private history = new History();
  private restoredFromSave = false;
  private workElapsedMs = 0;
  private workSessionStart: number | null = null;
  private workTick: ReturnType<typeof setInterval> | null = null;

  private originalSegments: Segment[] | null = null;

  private minimap = new Minimap($('#minimap'));
  private wsView = new WaveSurferView();
  private waveGain = 30;
  private persist = debounce(() => this.writeSave(), 400);

  private get profile() {
    return PROFILES[this.meta.langCode ?? 'es'];
  }

  private els = {
    empty: $('#empty'),
    optimize: $('#optimize'),
    btnOptTrim: $('#btn-opt-trim') as HTMLButtonElement,
    badgeOptTrim: $('#opt-badge-trim'),
    btnOptOrtho: $('#btn-opt-ortho') as HTMLButtonElement,
    badgeOptOrtho: $('#opt-badge-ortho'),
    btnOptAll: $('#btn-opt-all') as HTMLButtonElement,
    badgeOptAll: $('#opt-badge-all'),
    btnOptSkip: $('#btn-opt-skip') as HTMLButtonElement,
    work: $('#work'),
    lblSeglst: $('#lbl-seglst'),
    lblWav: $('#lbl-wav'),
    emptyZoneSeglst: $('label[for="in-seglst"].empty-zone'),
    emptyZoneWav: $('label[for="in-wav"].empty-zone'),
    inSeglst: $('#in-seglst') as HTMLInputElement,
    inWav: $('#in-wav') as HTMLInputElement,
    btnUndo: $('#btn-undo') as HTMLButtonElement,
    btnAcceptAll: $('#btn-accept-all') as HTMLButtonElement,
    acceptBadge: $('#accept-badge'),
    btnLog: $('#btn-log'),
    btnExport: $('#btn-export') as HTMLButtonElement,
    btnReport: $('#btn-report') as HTMLButtonElement,
    logBadge: $('#log-badge'),
    drawer: $('#drawer'),
    drawerClose: $('#drawer-close'),
    log: $('#log'),
    foot: $('#foot'),
    audio: $('#audio') as HTMLAudioElement,
    audioStatus: $('#audio-status'),
    toast: $('#toast'),
    analyzing: $('#analyzing'),
    saveHint: $('#save-hint'),
    posLabel: $('#pos-label'),
    posSpeaker: $('#pos-speaker'),
    waveWrap: $('#wave-wrap'),
    zoomBar: $('#zoom-bar'),
    zoomSlider: $('#zoom-slider') as HTMLInputElement,
    zoomVal: $('#zoom-val'),
    gainSlider: $('#gain-slider') as HTMLInputElement,
    gainVal: $('#gain-val'),
    waveEmpty: $('#wave-empty'),
    btnPlayPause: $('#btn-play-pause') as HTMLButtonElement,
    btnPlaySeg:   $('#btn-play-seg')   as HTMLButtonElement,
    clock: $('#clock'),
    workTimer: $('#work-timer'),
    playheadPos: $('#playhead-pos'),
    tagPanel: $('#tag-panel'),
    tagHint: $('#tag-hint'),
    tagChips: $('#tag-chips'),
    btnTagToText: $('#btn-tag-to-text'),
    textEditor: $('#text-editor') as HTMLTextAreaElement,
    karaokeEl: $('#karaoke-mirror') as HTMLDivElement,
    timeIn: $('#time-in') as HTMLInputElement,
    timeOut: $('#time-out') as HTMLInputElement,
    warnCjk: $('#warn-cjk'),
    props: $('#props'),
    langSelect: $('#lang-select') as HTMLSelectElement,
    btnPrev: $('#btn-prev') as HTMLButtonElement,
    btnNext: $('#btn-next') as HTMLButtonElement,
    btnSplit: $('#btn-split') as HTMLButtonElement,
    btnMergeNext: $('#btn-merge-next') as HTMLButtonElement,
    btnDeleteSeg: $('#btn-delete-seg') as HTMLButtonElement,
    brandBadge: $('#brand-badge'),
  };

  constructor() {
    const savedLang = loadSavedLang();
    this.meta.langCode = savedLang;
    this.els.langSelect.value = savedLang;
    this.updateBrandBadge();
    this.bindEvents();
    this.buildTagChips();
    this.tryRestore();
  }

  private addDropZone(el: HTMLElement, accept: 'seglst' | 'wav'): void {
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('dragend', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      if (accept === 'seglst') void this.onSeglstFile(file);
      else void this.onWavFile(file);
    });
  }

  private bindEvents(): void {
    this.els.inSeglst.addEventListener('change', () => this.onSeglstFile());
    this.els.inWav.addEventListener('change', () => this.onWavFile());
    this.addDropZone(this.els.lblSeglst, 'seglst');
    this.addDropZone(this.els.lblWav, 'wav');
    this.addDropZone(this.els.emptyZoneSeglst, 'seglst');
    this.addDropZone(this.els.emptyZoneWav, 'wav');
    this.els.btnOptTrim.addEventListener('click', () => this.enterWork('trim'));
    this.els.btnOptOrtho.addEventListener('click', () => this.enterWork('ortho'));
    this.els.btnOptAll.addEventListener('click', () => this.enterWork('all'));
    this.els.btnOptSkip.addEventListener('click', () => this.enterWork('skip'));
    this.els.langSelect.addEventListener('change', () => this.onLangChange());
    this.els.btnUndo.addEventListener('click', () => this.undo());
    this.els.btnAcceptAll.addEventListener('click', () => this.acceptAll());
    this.els.btnLog.addEventListener('click', () => this.els.drawer.classList.toggle('open'));
    this.els.drawerClose.addEventListener('click', () => this.els.drawer.classList.remove('open'));
    this.els.btnExport.addEventListener('click', () => this.export());
    this.els.btnReport.addEventListener('click', () => this.downloadReport());
    this.els.btnPlayPause.addEventListener('click', () => this.playPause());
    this.els.btnPlaySeg.addEventListener('click',   () => this.playSegment());
    this.els.audio.addEventListener('ended', () => this.stopPlayback());
    this.els.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.els.btnPrev.addEventListener('click', () => this.goTo(this.cur - 1));
    this.els.btnNext.addEventListener('click', () => this.goTo(this.cur + 1));
    this.els.btnSplit.addEventListener('click', () => this.splitAtPlayhead());
    this.els.audio.addEventListener('seeked', () => {
      this.updateSplitButton();
      this.updatePlayheadLabel();
      this.updateKaraokeHighlight(this.els.audio.currentTime);
    });
    this.els.audio.addEventListener('timeupdate', () => this.updatePlayheadLabel());
    this.els.btnMergeNext.addEventListener('click', () => this.mergeNext());
    this.els.btnDeleteSeg.addEventListener('click', () => this.deleteSeg());
    this.els.btnTagToText.addEventListener('click', () => this.tagToText());
    this.els.zoomSlider.addEventListener('input', () => {
      const v = Number(this.els.zoomSlider.value);
      const pxPerSec = Math.round(Math.pow(2000, v / 100));
      this.els.zoomVal.textContent = `${pxPerSec} px/s`;
      this.wsView.zoom(pxPerSec);
    });

    this.els.gainSlider.addEventListener('input', () => {
      this.waveGain = Number(this.els.gainSlider.value);
      this.els.gainVal.textContent = String(this.waveGain);
    });
    this.els.gainSlider.addEventListener('change', () => {
      this.waveGain = Number(this.els.gainSlider.value);
      if (this.channelData) this.wsView.updateGain(this.channelData, this.waveGain);
    });

    this.els.textEditor.addEventListener('focus', () => this.clearKaraokeHighlight());
    this.els.textEditor.addEventListener('blur', () => {
      if (this.playing !== null) this.updateKaraokeHighlight(this.els.audio.currentTime);
    });
    this.els.textEditor.addEventListener('change', () => this.onTextChange());
    this.els.timeIn.addEventListener('change', () => this.onTimeChange('in'));
    this.els.timeOut.addEventListener('change', () => this.onTimeChange('out'));

    this.els.audio.addEventListener('error', () => {
      const code = this.els.audio.error?.code ?? '?';
      this.setAudioStatus('Playback error', true);
      this.toast(`Audio error (code ${code})`);
    });

    document.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('beforeunload', (e) => {
      if (this.segments.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      // bfcache restore: the .analyzing overlay may be stuck with class 'on'
      // (its finally block never ran when the page was frozen mid-load).
      // Remove it so drop zones are reachable again on the first attempt.
      this.els.analyzing.classList.remove('on');
      // Blob URLs don't survive bfcache; revoke and clear audio state.
      if (this.audioURL) {
        URL.revokeObjectURL(this.audioURL);
        this.audioURL = null;
      }
      this.wav = null;
      this.channelData = null;
      this.els.audio.removeAttribute('src');
      this.els.audio.load();
      this.setAudioStatus('no audio');
      this.wsView.destroy();
      this.setWaveVisible(false);
      this.markLoaded(this.els.lblWav, '');
      this.els.emptyZoneWav.classList.remove('ok');
      this.toast('Drop the .wav again to continue');
    });
  }

  private buildTagChips(): void {
    this.els.tagChips.innerHTML = '';

    const makeChip = (tag: string): HTMLButtonElement => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chip';
      c.textContent = tag;
      const tip = TAG_TOOLTIPS[tag];
      if (tip) c.dataset.tooltip = tip;
      c.addEventListener('click', () => {
        const seg = this.segments[this.cur];
        if (seg?.isTag) {
          this.setTag(tag);
        } else {
          this.insertTokenAtCursor(tag);
        }
      });
      return c;
    };

    for (const tag of TAG_PINNED) {
      this.els.tagChips.appendChild(makeChip(tag));
    }

    const accordionOpen = sessionStorage.getItem('tag-accordion') === '1';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'chip-toggle';
    toggle.textContent = accordionOpen ? 'Fewer tags ▴' : 'More tags ▾';

    const extras = document.createElement('div');
    extras.className = 'chip-extras';
    if (!accordionOpen) extras.hidden = true;
    for (const tag of TAG_EXTRA) {
      extras.appendChild(makeChip(tag));
    }

    toggle.addEventListener('click', () => {
      const nowOpen = extras.hidden;
      extras.hidden = !nowOpen;
      toggle.textContent = nowOpen ? 'Fewer tags ▴' : 'More tags ▾';
      sessionStorage.setItem('tag-accordion', nowOpen ? '1' : '0');
    });

    this.els.tagChips.appendChild(toggle);
    this.els.tagChips.appendChild(extras);
  }

  private updateBrandBadge(): void {
    const code = (this.meta.langCode ?? 'es').toUpperCase();
    this.els.brandBadge.textContent = `${code} · energy`;
  }

  private onLangChange(): void {
    const code = this.els.langSelect.value;
    this.meta.langCode = code;
    saveLang(code);
    this.updateBrandBadge();
    this.updateView();
    this.persist();
  }

  private tryRestore(): void {
    const saved = loadSavedState();
    if (!saved?.segments.length) return;

    const resume = confirm(
      `A saved session was found (${saved.meta.seglstName ?? 'seglst'}, ${saved.segments.length} segments). Restore it?`,
    );
    if (!resume) {
      clearSavedState();
      return;
    }

    this.segments = saved.segments;
    this.originalSegments = saved.originalSegments ?? null;
    this.meta = saved.meta;
    this.log = saved.log;
    this.logSeq = saved.logSeq;
    this.cur = Math.min(saved.cur, this.segments.length - 1);
    this.workElapsedMs = saved.workElapsedMs ?? 0;
    this.restoredFromSave = true;
    this.els.langSelect.value = this.meta.langCode ?? 'es';
    this.updateBrandBadge();
    this.markLoaded(this.els.lblSeglst, saved.meta.seglstName ?? 'seglst restored');
    this.els.emptyZoneSeglst.classList.add('ok');
    this.minimap.setLength(this.segments.length, (i) => this.goTo(i));
    this.minimap.show();
    this.els.btnExport.disabled = false;
    this.els.btnReport.disabled = false;
    this.renderLog();
    this.toast('Session restored');
  }

  private async onSeglstFile(file?: File): Promise<void> {
    const f = file ?? this.els.inSeglst.files?.[0];
    if (!f) return;

    this.restoredFromSave = false;
    this.workElapsedMs = 0;
    this.workSessionStart = null;
    if (this.workTick) { clearInterval(this.workTick); this.workTick = null; }
    this.els.workTimer.hidden = true;

    try {
      const data = JSON.parse(await f.text());
      this.history.clear();
      this.log = [];
      this.logSeq = 0;
      this.cur = 0;

      const parsed = parseSeglst(data, (segId, type, detail) =>
        this.pushLog(segId, type, detail, false),
      );
      this.segments = parsed.segments;
      this.originalSegments = structuredClone(parsed.segments);
      const langCode = this.els.langSelect.value;
      this.meta = { ...parsed.meta, seglstName: f.name, wavName: this.meta.wavName, langCode };

      this.markLoaded(this.els.lblSeglst, f.name);
      this.els.emptyZoneSeglst.classList.add('ok');
      this.minimap.setLength(this.segments.length, (i) => this.goTo(i));
      this.minimap.show();
      this.els.btnExport.disabled = false;
      this.els.btnReport.disabled = false;
      this.els.btnUndo.disabled = true;
      this.renderLog();
      if (this.wav !== null && this.channelData !== null) {
        if (this.restoredFromSave) {
          this.launchWorkView();
        } else {
          this.showOptimize();
        }
      }
      this.persist();
      this.toast(`${this.segments.length} segments loaded`);
    } catch (err) {
      this.toast(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }

  private async onWavFile(file?: File): Promise<void> {
    const f = file ?? this.els.inWav.files?.[0];
    if (!f) return;

    if (this.audioURL) URL.revokeObjectURL(this.audioURL);
    this.wav = null;
    this.audioURL = URL.createObjectURL(f);
    this.els.audio.src = this.audioURL;
    this.els.audio.load();

    this.meta.wavName = f.name;
    this.markLoaded(this.els.lblWav, f.name);
    this.els.emptyZoneWav.classList.add('ok');
    this.setAudioStatus('Loading…');
    this.els.analyzing.classList.add('on');
    this.els.analyzing.textContent = 'Loading audio…';

    let playbackOk = false;
    try {
      await this.waitForAudioReady();
      playbackOk = true;
      const dur = Number.isFinite(this.els.audio.duration) ? this.els.audio.duration : 0;
      this.setAudioStatus(dur > 0 ? `Ready · ${mmss(dur)}` : 'Ready to play');
    } catch (err) {
      this.setAudioStatus('Playback error', true);
      this.toast(`Playback: ${err instanceof Error ? err.message : err}`);
    }

    this.els.analyzing.textContent = 'Analyzing waveform…';
    try {
      const { wav, channelData, duration } = await decodeWaveform(f);
      this.wav = wav;
      this.channelData = channelData;
      this.decodedDuration = duration;
      if (this.segments.length > 0) {
        if (this.restoredFromSave) {
          this.launchWorkView();
        } else {
          this.showOptimize();
        }
      }
      if (playbackOk) {
        this.toast(`Audio ready · ${(wav.nf * wav.hop).toFixed(0)} s`);
      }
    } catch (err) {
      this.wav = null;
      this.channelData = null;
      if (this.segments.length > 0) this.updateView();
      this.toast(`Waveform: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.els.analyzing.classList.remove('on');
      this.els.analyzing.textContent = 'Decoding audio…';
    }
  }

  private waitForAudioReady(): Promise<void> {
    if (this.els.audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('timed out'));
      }, 180_000);

      const ok = () => {
        cleanup();
        resolve();
      };
      const bad = () => {
        cleanup();
        reject(new Error('the browser could not read the file'));
      };
      const cleanup = () => {
        clearTimeout(timeout);
        this.els.audio.removeEventListener('canplaythrough', ok);
        this.els.audio.removeEventListener('error', bad);
      };

      this.els.audio.addEventListener('canplaythrough', ok, { once: true });
      this.els.audio.addEventListener('error', bad, { once: true });
    });
  }

  private setAudioStatus(text: string, isError = false): void {
    this.els.audioStatus.textContent = text;
    this.els.audioStatus.classList.toggle('ok', !isError && text !== 'no audio' && !text.startsWith('Loading'));
    this.els.audioStatus.classList.toggle('err', isError);
  }

  private setWaveVisible(hasWav: boolean): void {
    this.els.waveWrap.classList.toggle('hidden-ui', !hasWav);
    this.els.zoomBar.classList.toggle('hidden-ui', !hasWav);
    this.els.waveEmpty.classList.toggle('hidden-ui', hasWav);
  }

  private markLoaded(label: HTMLElement, name: string): void {
    label.classList.add('ok');
    label.classList.remove('req');
    const input = label.querySelector('input');
    label.textContent = '';
    label.append(`✓ ${name}`);
    if (input) label.append(input);
  }

  private showOptimize(): void {
    this.els.empty.hidden = true;
    this.els.work.hidden = true;
    this.els.btnAcceptAll.hidden = true;
    this.els.btnUndo.hidden = true;
    this.els.btnLog.hidden = true;
    this.els.btnExport.hidden = true;
    this.els.optimize.hidden = false;

    const p = previewBatch(this.segments, this.wav, this.profile);
    this.els.badgeOptTrim.textContent = String(p.trims);
    this.els.badgeOptOrtho.textContent = String(p.ortho);
    this.els.badgeOptAll.textContent = String(p.total);
    this.els.btnOptTrim.disabled = p.trims === 0;
    this.els.btnOptOrtho.disabled = p.ortho === 0;
    this.els.btnOptAll.disabled = p.total === 0;
  }

  private launchWorkView(): void {
    this.els.optimize.hidden = true;
    this.showWork();
    if (this.channelData && this.wav) this.initWave();
    this.updateView();
    this.startWorkTimer();
    this.persist();
  }

  private async enterWork(type: 'all' | 'ortho' | 'trim' | 'skip'): Promise<void> {
    this.els.analyzing.textContent = type === 'skip' ? 'Loading…' : 'Applying changes…';
    this.els.analyzing.classList.add('on');
    await new Promise<void>((r) => setTimeout(r, 0));
    if (type !== 'skip') this.applyOptimize(type);
    this.launchWorkView();
    this.els.analyzing.classList.remove('on');
    this.els.analyzing.textContent = 'Decoding audio…';
  }

  private applyOptimize(type: 'all' | 'ortho' | 'trim'): void {
    if (!this.segments.length) return;

    let segs: Segment[] | null = null;
    let count = 0;
    let label = '';

    if (type === 'all') {
      const r = applyAllProposals(this.segments, this.wav, this.profile);
      if (r.preview.total > 0) {
        segs = r.segments;
        count = r.preview.total;
        label = `Optimize all (${this.segments.length}→${segs.length} segs): ${r.preview.ortho} ortho · ${r.preview.trims} trims`;
      }
    } else if (type === 'ortho') {
      const r = applyOrthoProposals(this.segments, this.profile);
      if (r.preview.ortho > 0) {
        segs = r.segments;
        count = r.preview.ortho;
        label = `Batch spelling: ${count} segments`;
      }
    } else if (this.wav) {
      const r = applyTrimProposals(this.segments, this.wav, this.profile);
      if (r.preview.trims > 0) {
        segs = r.segments;
        count = r.preview.trims;
        label = `Batch edges: ${count} adjustments`;
      }
    }

    if (!segs) return;

    this.snapshot();
    this.segments = segs;
    this.cur = Math.min(this.cur, this.segments.length - 1);
    this.pushLog(0, 'estruct', label);
    this.minimap.setLength(this.segments.length, (i) => this.goTo(i));
    this.toast(`${count} changes applied`);
  }

  private showWork(): void {
    this.els.empty.hidden = true;
    this.els.work.hidden = false;
    this.els.btnAcceptAll.hidden = false;
    this.els.btnUndo.hidden = false;
    this.els.btnLog.hidden = false;
    this.els.btnExport.hidden = false;
    this.els.btnReport.hidden = false;
    this.els.btnSplit.hidden = false;
    this.els.btnMergeNext.hidden = false;
    this.els.btnDeleteSeg.hidden = false;
  }

  private initWave(preserveZoom = false): void {
    if (!this.channelData || !this.wav) return;
    this.setWaveVisible(true);
    const prevZoomVal = preserveZoom ? Number(this.els.zoomSlider.value) : 1;
    this.wsView.init(
      this.els.waveWrap,
      this.els.audio,
      this.channelData,
      this.decodedDuration,
      (s, e) => this.onBoundaryChange(s, e),
      this.waveGain,
    );
    this.wsView.enableDragCreate(
      (t) => !this.segments.some(s => t > s.start && t < s.end),
      (start, end) => this.createSegmentFromDrag(start, end),
    );
    const pxPerSec = Math.round(Math.pow(2000, prevZoomVal / 100));
    this.els.zoomSlider.value = String(prevZoomVal);
    this.els.zoomVal.textContent = `${pxPerSec} px/s`;
    this.wsView.zoom(pxPerSec);
  }

  private goTo(index: number): void {
    if (index < 0 || index >= this.segments.length || index === this.cur) return;
    this.stopPlayback();
    this.cur = index;
    this.updateView();
    this.persist();
  }

  private advanceTo(index: number): void {
    if (index < 0 || index >= this.segments.length || index === this.cur) return;
    this.clearKaraokeHighlight();
    this.cur = index;
    this.playing = index;
    this.updateView(false);
    this.persist();
  }

  private onTimeUpdate(): void {
    const t = this.els.audio.currentTime;
    if (this.playing !== null) this.updateKaraokeHighlight(t);
    if (this.playing === null || this.stopTimer !== null) return;
    let target = -1;
    for (let i = 0; i < this.segments.length; i++) {
      const s = this.segments[i];
      if (t >= s.start && t < s.end) { target = i; break; }
    }
    if (target === -1 || target === this.cur) return;
    if (document.activeElement === this.els.textEditor) return;
    this.advanceTo(target);
  }

  private updateView(seekWaveform = true): void {
    this.setWaveVisible(!!this.wav);

    const s = this.segments[this.cur];
    if (!s) {
      this.renderFoot();
      return;
    }

    this.els.posLabel.innerHTML = `Segment <b>${this.cur + 1}</b> / ${this.segments.length}`;
    this.els.posSpeaker.textContent = this.meta.speaker ?? '';

    if (this.wav) {
      const all = this.segments.map((seg) => ({
        start: seg.start,
        end: seg.end,
        color: this.regionColor(seg),
      }));
      const sil = internalSilences(this.wav, s.start, s.end);
      this.wsView.showSegment(all, this.cur, sil, seekWaveform);
    }

    const dur = s.end - s.start;
    this.els.clock.innerHTML = `${mmss(s.start)} – ${mmss(s.end)}<span class="dur">${(dur * 1000).toFixed(0)} ms</span>`;
    const playingHere = this.playing === this.cur && !this.els.audio.paused;
    this.els.btnPlayPause.classList.toggle('on', playingHere);
    this.els.btnPlayPause.textContent = playingHere ? '⏸ Pause' : '▶ Play';
    this.els.btnPlayPause.disabled = !this.audioURL || !this.segments.length;
    this.els.btnPlaySeg.disabled   = !this.audioURL || !this.segments.length;

    if (s.isTag) {
      this.els.tagPanel.hidden = false;
      this.els.tagHint.hidden = false;
      this.els.textEditor.hidden = true;
      this.els.tagChips.querySelectorAll<HTMLButtonElement>('.chip').forEach((chip) => {
        chip.classList.toggle('on', chip.textContent === s.words);
      });
    } else {
      this.els.tagPanel.hidden = false;
      this.els.tagHint.hidden = true;
      this.els.textEditor.hidden = false;
      this.els.tagChips.querySelectorAll<HTMLButtonElement>('.chip').forEach((chip) => {
        chip.classList.remove('on');
      });
      if (document.activeElement !== this.els.textEditor) {
        this.els.textEditor.value = s.words;
      }
      if (this.focusText) {
        this.focusText = false;
        this.els.textEditor.focus();
      }
    }

    if (document.activeElement !== this.els.timeIn) this.els.timeIn.value = f2(s.start);
    if (document.activeElement !== this.els.timeOut) this.els.timeOut.value = f2(s.end);
    this.els.warnCjk.hidden = !hasCJK(s.words);

    this.els.btnPrev.disabled = this.cur === 0;
    this.els.btnNext.disabled = this.cur === this.segments.length - 1;
    this.els.btnNext.textContent =
      this.cur === this.segments.length - 1 ? 'End' : 'Next →';
    this.els.btnMergeNext.disabled = this.cur >= this.segments.length - 1;
    this.els.btnDeleteSeg.disabled = false;
    this.updateSplitButton();

    this.renderProps();
    this.minimap.update(this.segments, this.cur, this.wav);
    this.renderFoot();
    this.updateAcceptAllBadge();
  }

  private regionColor(s: Segment): string {
    if (s.needsTextReview)           return 'rgba(245,194,122,0.22)';
    if (!this.wav || s.isTag)        return 'rgba(169,216,191,0.15)';
    if (s.needsText)                 return 'rgba(140,145,150,0.30)';
    const silent  = segPeakDb(this.wav, s.start, s.end) < this.wav.floor + 12;
    if (silent)                      return 'rgba(217,179,230,0.18)';
    if (s.editedTxt || s.editedTime) return 'rgba(156,196,221,0.18)';
    return 'rgba(207,212,218,0.22)';
  }

  private updateAcceptAllBadge(): void {
    if (!this.segments.length) {
      this.els.btnAcceptAll.disabled = true;
      this.els.acceptBadge.textContent = '0';
      return;
    }
    const p = previewBatch(this.segments, this.wav, this.profile);
    this.els.acceptBadge.textContent = String(p.total);
    this.els.btnAcceptAll.disabled = p.total === 0;
  }

  private acceptAll(): void {
    if (!this.segments.length) return;

    const before = previewBatch(this.segments, this.wav, this.profile);
    if (before.total === 0) {
      this.toast('No pending proposals');
      return;
    }

    const parts: string[] = [];
    if (before.ortho) parts.push(`${before.ortho} spelling`);
    if (before.deletes) parts.push(`${before.deletes} deletion(s)`);
    if (before.trims) parts.push(`${before.trims} trim(s)`);
    if (before.splits) parts.push(`${before.splits} split(s)`);
    if (before.merges) parts.push(`${before.merges} merge(s)`);
    if (!this.wav && before.ortho) {
      parts.push('(no .wav: spelling only)');
    }

    const ok = confirm(`Apply all at once?\n\n${parts.join('\n')}`);
    if (!ok) return;

    this.stopPlayback();
    this.snapshot();

    const countBefore = this.segments.length;
    const { segments, preview } = applyAllProposals(this.segments, this.wav, this.profile);
    this.segments = segments;
    this.cur = Math.min(this.cur, this.segments.length - 1);

    const bits = [
      `${preview.ortho} ortho`,
      `${preview.deletes} del.`,
      `${preview.trims} trims`,
      `${preview.splits} splits`,
      `${preview.merges} merges`,
    ];
    this.pushLog(
      0,
      'estruct',
      `Apply all: ${bits.join(' · ')} (${countBefore}→${segments.length} segs)`,
    );

    this.minimap.setLength(this.segments.length, (i) => this.goTo(i));
    this.updateView();
    this.toast(`Done: ${before.total} changes · ${segments.length} segments`);
  }

  private renderProps(): void {
    const s = this.segments[this.cur];
    this.els.props.innerHTML = '';
    if (!s) return;

    const mk = (
      cls: string,
      key: string,
      title: string,
      sub: string,
      go: string,
      fn: () => void,
      action?: string,
    ) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `prop ${cls}`;
      if (action) b.dataset.action = action;
      b.innerHTML = `<span class="k">${key}</span><span class="t">${title}<small>${sub}</small></span><span class="go">${go}</span>`;
      b.addEventListener('click', fn);
      this.els.props.appendChild(b);
      return b;
    };

    if (!s.isTag) {
      const { out, changes } = orthoFix(s.words, this.profile);
      if (out !== s.words) {
        mk('orto', 'Aa', 'Fix spelling', changes.join(', '), 'accept', () =>
          this.acceptOrtho(),
        );
      }

      if (this.wav) {
        const silent = segPeakDb(this.wav, s.start, s.end) < this.wav.floor + 12;
        if (silent) {
          mk('del', '⌫', 'No real audio in this segment', 'peak near noise floor', 'delete', () =>
            this.deleteSeg(),
          );
        }

        const d = detectEdges(this.wav, s.start, s.end);
        if (d) {
          if (Math.abs(d.start - s.start) > 0.03) {
            const ds = Math.round((d.start - s.start) * 1000);
            mk('tiempo', '⇤', 'Trim start',
              `${ds >= 0 ? '+' : ''}${ds} ms`, 'accept',
              () => this.trimStart(), 'trim-start');
          }
          if (Math.abs(d.end - s.end) > 0.03) {
            const de = Math.round((d.end - s.end) * 1000);
            mk('tiempo', '⇥', 'Trim end',
              `${de >= 0 ? '+' : ''}${de} ms`, 'accept',
              () => this.trimEnd(), 'trim-end');
          }
        }

        const sil = internalSilences(this.wav, s.start, s.end);
        if (sil.length) {
          const big = Math.max(...sil.map((x) => x.len));
          mk(
            'estruct',
            '⊟',
            'Split on internal silence',
            `${sil.length} pause(s) ≥200 ms · longest ${Math.round(big * 1000)} ms`,
            'split',
            () => this.splitSilence(),
          );
        }
      }
    }

    if (canMergeNext(this.segments, this.cur)) {
      const gap = this.segments[this.cur + 1].start - s.end;
      mk(
        'estruct',
        '⊞',
        'Merge with next',
        `micro-pause of ${(gap * 1000).toFixed(0)} ms (&lt;200)`,
        'merge',
        () => this.mergeNext(),
      );
    }

    if (this.cur === this.segments.length - 1) {
      mk(
        'export-end',
        '↓',
        'Done! Download the corrected file',
        `${this.segments.length} segments ready`,
        'export',
        () => this.export(),
      );
      mk(
        'report-end',
        '📄',
        'Download QA report',
        'effort · diff · changelog',
        'report',
        () => this.downloadReport(),
      );
      mk(
        'both-end',
        '⬇',
        'Download both',
        'corrected file + report',
        'both',
        () => { this.export(); this.downloadReport(); },
      );
    }
  }

  private acceptOrtho(): void {
    const s = this.segments[this.cur];
    if (s.isTag) return;
    const { out, changes } = orthoFix(s.words, this.profile);
    if (out === s.words) return;
    this.snapshot();
    s.words = out;
    s.editedTxt = true;
    this.pushLog(this.cur, 'orto', changes.join(', '));
    this.updateView(false);
  }

  private firstProposalAction(): (() => void) | null {
    const prop = this.els.props.querySelector<HTMLButtonElement>('.prop');
    if (!prop) return null;
    if (prop.classList.contains('orto')) return () => this.acceptOrtho();
    if (prop.classList.contains('del')) return () => this.deleteSeg();
    if (prop.classList.contains('tiempo')) {
      const action = (prop as HTMLButtonElement).dataset.action;
      if (action === 'trim-start') return () => this.trimStart();
      if (action === 'trim-end') return () => this.trimEnd();
    }
    if (prop.classList.contains('estruct') && prop.querySelector('.go')?.textContent === 'split') {
      return () => this.splitSilence();
    }
    if (prop.classList.contains('estruct') && prop.querySelector('.go')?.textContent === 'merge') {
      return () => this.mergeNext();
    }
    return null;
  }

  private snapshot(): void {
    this.history.push(this.segments, this.log, this.cur);
    this.els.btnUndo.disabled = !this.history.canUndo;
    this.persist();
  }

  private undo(): void {
    const h = this.history.pop();
    if (!h) {
      this.toast('Nothing to undo');
      return;
    }
    this.segments = h.segments;
    this.log = h.log;
    this.logSeq = this.log.length ? Math.max(...this.log.map((l) => l.seq)) : 0;
    this.cur = Math.min(h.cur, this.segments.length - 1);
    this.els.btnUndo.disabled = !this.history.canUndo;
    this.renderLog();
    this.updateView();
    this.persist();
    this.toast('Undone');
  }

  private onBoundaryChange(start: number, end: number): void {
    const s = this.segments[this.cur];
    if (!s) return;
    this.snapshot();
    s.start = start;
    s.end = end;
    s.editedTime = true;
    if (document.activeElement !== this.els.timeIn) this.els.timeIn.value = f2(start);
    if (document.activeElement !== this.els.timeOut) this.els.timeOut.value = f2(end);
    const dur = end - start;
    this.els.clock.innerHTML = `${mmss(start)} – ${mmss(end)}<span class="dur">${(dur * 1000).toFixed(0)} ms</span>`;
    this.pushLog(this.cur, 'tiempo', `Boundaries dragged (${f2(start)}→${f2(end)})`);
    this.minimap.update(this.segments, this.cur, this.wav);
    this.renderProps();
    this.persist();
  }

  private trimStart(): void {
    if (!this.wav) return;
    const s = this.segments[this.cur];
    const d = detectEdges(this.wav, s.start, s.end);
    if (!d) return;
    this.snapshot();
    const ds = Math.round((d.start - s.start) * 1000);
    s.start = d.start;
    s.editedTime = true;
    this.pushLog(this.cur, 'tiempo', `Start trimmed (${ds >= 0 ? '+' : ''}${ds} ms)`);
    this.updateView();
  }

  private trimEnd(): void {
    if (!this.wav) return;
    const s = this.segments[this.cur];
    const d = detectEdges(this.wav, s.start, s.end);
    if (!d) return;
    this.snapshot();
    const de = Math.round((d.end - s.end) * 1000);
    s.end = d.end;
    s.editedTime = true;
    this.pushLog(this.cur, 'tiempo', `End trimmed (${de >= 0 ? '+' : ''}${de} ms)`);
    this.updateView();
  }

  private splitSilence(): void {
    if (!this.wav) return;
    const s = this.segments[this.cur];
    const sil = internalSilences(this.wav, s.start, s.end);
    if (!sil.length) {
      this.toast('No internal silence ≥200 ms');
      return;
    }
    this.snapshot();
    const cuts = sil.map((x) => x.mid);
    const bounds = [s.start, ...cuts, s.end];
    const parts = splitBySilence(this.segments, this.cur, cuts, bounds);

    for (let k = 0; k < parts.length; k++) {
      const d = detectEdges(this.wav, parts[k].start, parts[k].end, 0.05);
      if (d) {
        parts[k].start = d.start;
        parts[k].end = d.end;
      }
    }

    this.segments.splice(this.cur, 1, ...parts);
    reindex(this.segments);
    this.pushLog(
      this.cur,
      'estruct',
      `Split into ${parts.length} at silence (${sil.map((x) => `${Math.round(x.len * 1000)}ms`).join(', ')})`,
    );
    this.updateView(false);
    this.toast('Text distributed by count — review each split segment');
  }

  private deleteSeg(): void {
    this.snapshot();
    this.segments.splice(this.cur, 1);
    reindex(this.segments);
    this.cur = Math.min(this.cur, this.segments.length - 1);
    this.pushLog(Math.max(0, this.cur), 'alerta', 'Segment with no audio deleted');
    if (!this.segments.length) {
      this.toast('No segments remaining');
      return;
    }
    this.minimap.setLength(this.segments.length, (i) => this.goTo(i));
    this.updateView();
  }

  private updatePlayheadLabel(): void {
    if (!this.audioURL) return;
    this.els.playheadPos.textContent = mmss(this.els.audio.currentTime);
  }

  private updateSplitButton(): void {
    if (this.els.btnSplit.hidden) return;
    const s = this.segments[this.cur];
    const t = this.els.audio.currentTime;
    this.els.btnSplit.disabled = !s || t <= s.start || t >= s.end;
  }

  private splitAtPlayhead(): void {
    const s = this.segments[this.cur];
    const t = this.els.audio.currentTime;
    if (!s || t <= s.start || t >= s.end) {
      this.toast('Playhead must be strictly inside the segment');
      return;
    }

    this.snapshot();

    const first: Segment = { ...s, end: t, editedTime: true };
    const second: Segment = {
      ...s,
      start: t,
      words: '',
      isTag: false,
      editedTxt: false,
      editedTime: true,
      needsText: true,
    };

    this.segments.splice(this.cur, 1, first, second);
    reindex(this.segments);
    this.pushLog(this.cur, 'estruct', `Split at ${mmss(t)}`);
    this.minimap.setLength(this.segments.length, (i) => this.goTo(i));
    this.updateView();
    this.toast('Second half empty — write its text');
  }

  private createSegmentFromDrag(start: number, end: number): void {
    if (this.segments.some(s => start < s.end && end > s.start)) return;

    this.snapshot();

    const newSeg: Segment = {
      id: 0,
      start,
      end,
      words: '',
      detection: '',
      isTag: false,
      editedTxt: false,
      editedTime: true,
      needsText: true,
    };

    let idx = this.segments.findIndex(s => s.start > start);
    if (idx === -1) idx = this.segments.length;
    this.segments.splice(idx, 0, newSeg);
    reindex(this.segments);

    this.pushLog(idx, 'estruct', `Segment created (${mmss(start)}–${mmss(end)})`);
    this.minimap.setLength(this.segments.length, (i) => this.goTo(i));
    this.cur = idx;
    this.updateView();
    this.persist();
    this.toast('New segment — write the text');
  }

  private mergeNext(): void {
    this.snapshot();
    const merged = mergeSegments(this.segments[this.cur], this.segments[this.cur + 1]);
    Object.assign(this.segments[this.cur], merged);
    this.segments.splice(this.cur + 1, 1);
    reindex(this.segments);
    this.pushLog(this.cur, 'estruct', 'Merged with next');
    this.minimap.setLength(this.segments.length, (i) => this.goTo(i));
    this.updateView();
  }

  private tagToText(): void {
    this.snapshot();
    const s = this.segments[this.cur];
    s.isTag = false;
    s.words = '';
    s.editedTxt = true;
    this.focusText = true;
    this.pushLog(this.cur, 'orto', 'Gap converted to speech');
    this.updateView();
  }

  private setTag(tag: string): void {
    this.snapshot();
    const s = this.segments[this.cur];
    s.words = tag;
    s.isTag = true;
    this.pushLog(this.cur, 'tag', `Tag → ${tag}`);
    this.updateView();
  }

  private insertTokenAtCursor(token: string): void {
    const s = this.segments[this.cur];
    if (s.isTag) return;
    const ta = this.els.textEditor;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    const needsBefore = before.length > 0 && !before.endsWith(' ');
    const needsAfter = after.length > 0 && !after.startsWith(' ');
    const insert = `${needsBefore ? ' ' : ''}${token}${needsAfter ? ' ' : ''}`;
    const newValue = before + insert + after;

    this.snapshot();
    s.words = newValue.trim();
    s.editedTxt = true;

    ta.value = newValue;
    const newPos = before.length + insert.length;
    ta.setSelectionRange(newPos, newPos);
    ta.focus();

    this.pushLog(this.cur, 'orto', `Token inserted: ${token}`);
    this.minimap.update(this.segments, this.cur, this.wav);
    this.renderProps();
  }

  private onTextChange(): void {
    const s = this.segments[this.cur];
    const v = this.els.textEditor.value.trim();
    if (v === s.words) return;
    this.snapshot();
    s.words = v;
    s.editedTxt = true;
    s.needsTextReview = false;
    s.needsText = false;
    this.pushLog(this.cur, 'orto', 'Text edited manually');
    this.minimap.update(this.segments, this.cur, this.wav);
  }

  private onTimeChange(which: 'in' | 'out'): void {
    const s = this.segments[this.cur];
    const raw = which === 'in' ? this.els.timeIn.value : this.els.timeOut.value;
    const v = parseFloat(raw);
    if (Number.isNaN(v)) return;
    this.snapshot();
    if (which === 'in') s.start = v;
    else s.end = v;
    s.editedTime = true;
    this.pushLog(this.cur, 'tiempo', `${which === 'in' ? 'Start' : 'End'} → ${f2(v)}`);
    this.updateView();
  }

  private stopPlayback(): void {
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.els.audio.pause();
    this.els.btnPlayPause.classList.remove('on');
    this.els.btnPlayPause.textContent = '▶ Play';
    this.playing = null;
    this.clearKaraokeHighlight();
  }

  /** Safari needs seeked before play(); stale currentTime otherwise cuts audio instantly. */
  private seekTo(time: number): Promise<void> {
    const audio = this.els.audio;
    const max = Number.isFinite(audio.duration) ? audio.duration : time;
    const target = Math.max(0, Math.min(time, max));

    if (Math.abs(audio.currentTime - target) < 0.02) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        resolve();
      }, 3000);

      const onSeeked = () => {
        cleanup();
        resolve();
      };

      const cleanup = () => {
        clearTimeout(timeout);
        audio.removeEventListener('seeked', onSeeked);
      };

      audio.addEventListener('seeked', onSeeked, { once: true });
      audio.currentTime = target;
    });
  }

  private async playPause(): Promise<void> {
    if (!this.audioURL) { this.toast('Load the .wav first'); return; }
    if (!this.segments.length) { this.toast('Load the .seglst first'); return; }

    if (!this.els.audio.paused) {
      if (this.stopTimer !== null) { clearTimeout(this.stopTimer); this.stopTimer = null; }
      this.els.audio.pause();
      this.els.btnPlayPause.classList.remove('on');
      this.els.btnPlayPause.textContent = '▶ Play';
      return;
    }

    if (this.els.audio.readyState < HTMLMediaElement.HAVE_METADATA) {
      await this.waitForAudioReady();
    }
    this.playing = this.cur;
    try {
      await this.els.audio.play();
      this.els.btnPlayPause.classList.add('on');
      this.els.btnPlayPause.textContent = '⏸ Pause';
    } catch (err) {
      this.stopPlayback();
      this.toast(`Could not play: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async playSegment(): Promise<void> {
    if (!this.audioURL) { this.toast('Load the .wav first'); return; }
    if (!this.segments.length) { this.toast('Load the .seglst first'); return; }

    this.stopPlayback();
    const s = this.segments[this.cur];
    if (this.els.audio.readyState < HTMLMediaElement.HAVE_METADATA) {
      await this.waitForAudioReady();
    }
    const start = Math.max(0, s.start);
    await this.seekTo(start);
    this.playing = this.cur;
    try {
      await this.els.audio.play();
      this.els.btnPlayPause.classList.add('on');
      this.els.btnPlayPause.textContent = '⏸ Pause';
      const actualStart = this.els.audio.currentTime;
      const durationMs = Math.max(100, (this.segments[this.cur].end + 0.05 - actualStart) * 1000);
      this.stopTimer = window.setTimeout(() => {
        if (this.playing === this.cur) this.stopPlayback();
      }, durationMs);
    } catch (err) {
      this.stopPlayback();
      this.toast(`Could not play: ${err instanceof Error ? err.message : err}`);
    }
  }

  private pushLog(
    segId: number,
    type: LogEntry['type'],
    detail: string,
    save = true,
  ): void {
    this.log.push({ seq: ++this.logSeq, segId, type, detail });
    this.renderLog();
    if (save) this.persist();
  }

  private renderLog(): void {
    this.els.logBadge.textContent = String(this.log.length);
    const box = this.els.log;
    if (!this.log.length) {
      box.innerHTML = '<div class="log-empty">No changes yet.</div>';
      return;
    }

    const color: Record<LogEntry['type'], string> = {
      campo: 'var(--muted)',
      orto: 'var(--orto)',
      tiempo: 'var(--tiempo)',
      estruct: 'var(--estruct)',
      tag: 'var(--tag)',
      alerta: 'var(--alerta)',
    };

    box.innerHTML = '';
    for (const l of [...this.log].reverse()) {
      const it = document.createElement('div');
      it.className = 'logitem';
      it.innerHTML = `<div class="dot" style="background:${color[l.type]}"></div><div><div class="d">${l.detail}</div><div class="r">seg #${l.segId + 1} · ${l.type}</div></div>`;
      it.addEventListener('click', () => {
        this.goTo(Math.min(l.segId, this.segments.length - 1));
        this.els.drawer.classList.remove('open');
      });
      box.appendChild(it);
    }
  }

  private renderFoot(): void {
    const parts = [`session ${this.meta.sessionId ?? '—'}`];
    parts.push(
      this.wav
        ? `audio: floor ${this.wav.floor.toFixed(0)} dB · ${this.wav.nf} frames`
        : 'no audio · edges/silences off',
    );
    if (this.meta.seglstName) parts.push(this.meta.seglstName);
    this.els.foot.innerHTML = parts.join('<br>');
  }

  private startWorkTimer(): void {
    this.workSessionStart = Date.now();
    if (this.workTick) clearInterval(this.workTick);
    this.workTick = setInterval(() => this.tickWorkTimer(), 1000);
    this.els.workTimer.hidden = false;
    this.tickWorkTimer();
  }

  private tickWorkTimer(): void {
    const total = this.workElapsedMs +
      (this.workSessionStart ? Date.now() - this.workSessionStart : 0);
    this.els.workTimer.textContent = formatElapsed(Math.floor(total / 1000));
  }

  private writeSave(): void {
    if (!this.segments.length) return;
    saveState({
      meta: this.meta,
      segments: this.segments,
      originalSegments: this.originalSegments ?? undefined,
      log: this.log,
      logSeq: this.logSeq,
      cur: this.cur,
      workElapsedMs: this.workElapsedMs +
        (this.workSessionStart ? Date.now() - this.workSessionStart : 0),
    });
    this.els.saveHint.hidden = false;
    this.els.saveHint.classList.add('show');
    setTimeout(() => this.els.saveHint.classList.remove('show'), 1200);
  }

  private export(): void {
    const out = exportSeglst(this.segments, this.meta);
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const orig = this.meta.seglstName ?? this.meta.speaker ?? 'seglst';
    const base = orig.replace(/\.seglst\.json$/i, '').replace(/\.json$/i, '');
    a.download = `${base}_fixed.seglst.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast(`Exported: ${a.download}`);
  }

  private downloadReport(): void {
    const elapsedMs = this.workElapsedMs +
      (this.workSessionStart ? Date.now() - this.workSessionStart : 0);
    const md = generateReport({
      fileName: this.meta.seglstName,
      elapsedMs,
      originalSegments: this.originalSegments,
      currentSegments: this.segments,
      log: this.log,
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const orig = this.meta.seglstName ?? this.meta.speaker ?? 'seglst';
    const base = orig.replace(/\.seglst\.json$/i, '').replace(/\.json$/i, '');
    a.download = `${base}_report.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast(`Report: ${a.download}`);
  }

  private onKey(e: KeyboardEvent): void {
    const tag = document.activeElement?.tagName;
    const inField = tag === 'TEXTAREA' || tag === 'INPUT';

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) {
      e.preventDefault();
      this.undo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      this.toast('Saved automatically ✓');
      return;
    }

    if (inField || !this.segments.length) return;

    if (e.key === 'ArrowRight' && this.cur < this.segments.length - 1) {
      e.preventDefault();
      this.goTo(this.cur + 1);
    } else if (e.key === 'ArrowLeft' && this.cur > 0) {
      e.preventDefault();
      this.goTo(this.cur - 1);
    } else if (e.key === ' ' && e.shiftKey) {
      e.preventDefault();
      this.playSegment();
    } else if (e.key === ' ' && !e.shiftKey) {
      e.preventDefault();
      this.playPause();
    } else if (e.key === 'Enter') {
      const act = this.firstProposalAction();
      if (act) {
        e.preventDefault();
        act();
      }
    }
  }

  private toast(msg: string): void {
    const t = this.els.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout((t as HTMLElement & { _t?: number })._t);
    (t as HTMLElement & { _t?: number })._t = window.setTimeout(
      () => t.classList.remove('show'),
      3500,
    );
  }

  private updateKaraokeHighlight(t: number): void {
    if (document.activeElement === this.els.textEditor) return;
    const s = this.segments[this.cur];
    if (!s || s.isTag) { this.clearKaraokeHighlight(); return; }
    if (t < s.start || t > s.end) { this.clearKaraokeHighlight(); return; }

    const windows = estimateWordTimings(s.words, s.start, s.end);
    if (windows.length === 0) { this.clearKaraokeHighlight(); return; }

    const ci = currentWordIndex(windows, t);

    let html = '';
    for (let i = 0; i < windows.length; i++) {
      if (i > 0) html += ' ';
      const w = escHtml(windows[i].word);
      if (i < ci) html += `<span class="k-spoken">${w}</span>`;
      else if (i === ci) html += `<span class="k-current">${w}</span>`;
      else html += w;
    }

    this.els.karaokeEl.innerHTML = html;
    this.els.textEditor.style.color = 'transparent';
  }

  private clearKaraokeHighlight(): void {
    this.els.karaokeEl.innerHTML = '';
    this.els.textEditor.style.color = '';
  }
}
