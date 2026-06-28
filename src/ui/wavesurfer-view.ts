import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/plugins/regions';
import TimelinePlugin from 'wavesurfer.js/plugins/timeline';

// Soft-knee log mapping: stretches low amplitudes upward without clipping loud peaks.
// k=1 → nearly linear; k=30 → Gecko-like; k=200 → extreme enhancement.
function applyWaveGain(data: Float32Array, k: number): Float32Array {
  const logK = Math.log(1 + k);
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    out[i] = Math.sign(x) * Math.log(1 + k * Math.abs(x)) / logK;
  }
  return out;
}

export type BoundaryChangedCallback = (start: number, end: number) => void;

export interface SegmentRegion {
  start: number;
  end: number;
  color: string;
}

export class WaveSurferView {
  private ws: WaveSurfer | null = null;
  private wsRegions: ReturnType<typeof RegionsPlugin.create> | null = null;
  private onChanged: BoundaryChangedCallback | null = null;
  private totalDuration = 0;
  private pendingZoom: number | null = null;
  private _dragActive = false;
  private _dragBlocked = false;
  private _dragCreateCleanup: (() => void) | null = null;

  /** Call once when WAV is decoded. Destroys any previous instance first. */
  init(
    container: HTMLElement,
    mediaEl: HTMLAudioElement,
    channelData: Float32Array,
    duration: number,
    onBoundaryChanged: BoundaryChangedCallback,
    gain = 1,
  ): void {
    this.destroy();
    this.onChanged = onBoundaryChanged;
    this.totalDuration = duration;
    const peaks = gain > 1 ? applyWaveGain(channelData, gain) : channelData;
    const wsRegions = RegionsPlugin.create();
    this.wsRegions = wsRegions;
    this.ws = WaveSurfer.create({
      container,
      media: mediaEl,
      peaks: [peaks],
      duration,
      waveColor: '#6e7a87',
      progressColor: '#2c8557',
      height: 256,
      plugins: [wsRegions, TimelinePlugin.create({ height: 20 })],
    });

    // wavesurfer loads async (Promise.resolve().then); decodedData is null until
    // 'ready' fires. Store any zoom() call made before ready and apply it here.
    this.ws.on('ready', () => {
      if (this.pendingZoom !== null) {
        this.ws?.zoom(this.pendingZoom);
        this.pendingZoom = null;
      }
    });
  }

  /**
   * Draw all segment regions and highlight the active one.
   * Call on every goTo(). DSP overlays (silences, trim) apply to active segment only.
   */
  showSegment(
    all: SegmentRegion[],
    cur: number,
    silences?: { from: number; to: number; len: number }[],
    seek = true,
  ): void {
    if (!this.ws || !this.wsRegions) return;
    this.wsRegions.clearRegions();

    const active = all[cur];
    if (!active) return;

    // Internal silences — read-only purple tint (active segment only)
    for (const s of silences ?? []) {
      this.wsRegions.addRegion({
        start: s.from,
        end: s.to,
        color: 'rgba(180,140,220,0.25)',
        drag: false,
        resize: false,
      });
    }

    // All non-active segments — status-colored background, not interactive
    for (let i = 0; i < all.length; i++) {
      if (i === cur) continue;
      const r = all[i];
      this.wsRegions.addRegion({
        start: r.start,
        end: r.end,
        color: r.color,
        drag: false,
        resize: false,
      });
    }

    // Active segment — highlighted on top, resizable edges
    const segRegion = this.wsRegions.addRegion({
      start: active.start,
      end: active.end,
      color: 'rgba(44,133,87,0.30)',
      drag: false,
      resize: true,
    });
    segRegion.on('update-end', () => {
      this.onChanged?.(segRegion.start, segRegion.end);
    });

    // Auto-center on end boundary of active segment (skip during playback to avoid jumping audio)
    if (seek) {
      const progress = active.start / this.totalDuration;
      this.ws.seekTo(Math.max(0, Math.min(1, progress)));
    }
  }

  enableDragCreate(
    isGap: (t: number) => boolean,
    onCreate: (start: number, end: number) => void,
  ): void {
    if (!this.ws || !this.wsRegions) return;
    const wsRegions = this.wsRegions;
    const wrapper = this.ws.getWrapper();

    const onPointerDown = (e: PointerEvent) => {
      const rect = wrapper.getBoundingClientRect();
      const t = ((e.clientX - rect.left) / rect.width) * (this.ws?.getDuration() ?? 0);
      this._dragBlocked = !isGap(t);
      this._dragActive = true;
    };
    wrapper.addEventListener('pointerdown', onPointerDown, true);

    const cleanupDrag = wsRegions.enableDragSelection({
      color: 'rgba(100,200,140,0.20)',
      minLength: 0.05,
    });

    wsRegions.on('region-initialized', (region) => {
      if (!this._dragActive) return;
      if (this._dragBlocked) {
        region.remove();
        this._dragActive = false;
        this._dragBlocked = false;
      }
    });

    wsRegions.on('region-created', (region) => {
      if (!this._dragActive) return;
      this._dragActive = false;
      const { start, end } = region;
      region.remove();
      if (end - start >= 0.05) onCreate(start, end);
    });

    this._dragCreateCleanup = () => {
      cleanupDrag();
      wrapper.removeEventListener('pointerdown', onPointerDown, true);
    };
  }

  /**
   * Redraw the waveform with a new gain factor without destroying the instance.
   * Regions, zoom, and playhead position are preserved.
   */
  updateGain(channelData: Float32Array, gain: number): void {
    if (!this.ws) return;
    const peaks = gain > 1 ? applyWaveGain(channelData, gain) : channelData;
    const scrollLeft = this.ws.getScroll();
    const currentTime = this.ws.getCurrentTime();
    const isPlaying = this.ws.isPlaying();
    this.ws.setOptions({ peaks: [peaks], duration: this.totalDuration });
    const decoded = this.ws.getDecodedData();
    if (!decoded) return;
    void this.ws.getRenderer().render(decoded).then(() => {
      this.ws?.setScroll(scrollLeft);
      const pct = currentTime / this.totalDuration;
      this.ws?.getRenderer().renderProgress(pct, isPlaying);
    });
  }

  zoom(pxPerSec: number): void {
    if (!this.ws) return;
    if (!this.ws.getDecodedData()) {
      this.pendingZoom = pxPerSec;
      return;
    }
    this.pendingZoom = null;
    this.ws.zoom(pxPerSec);
  }

  destroy(): void {
    this._dragCreateCleanup?.();
    this._dragCreateCleanup = null;
    this.ws?.destroy();
    this.ws = null;
    this.wsRegions = null;
    this.pendingZoom = null;
  }
}
