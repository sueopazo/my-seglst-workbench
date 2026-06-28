# SegLST Workbench — Continuous Waveform View (the "be Gecko's waveform" rebuild)

Replaces the current per-segment waveform box with a **single continuous full-file
waveform**, like Gecko — embedded inside the existing workbench UI, which stays
(it's already better than Gecko: session autosave, token palette, status minimap,
keyboard flow, IN/OUT). Goal: bring the visual boundary sweep in-house so Gecko drops
out of the QA1 flow.

Same locked rules: single channel, Latin script, offline, don't rewrite the DSP.

---

## The core fix: render from the decoded audio, not the energy envelope

Today the waveform is drawn from the coarse energy envelope (≈100 points/sec). That's
why it looks like sparse dots/bars at any zoom — there simply aren't enough points to
look like a waveform. Gecko (wavesurfer) draws from the **actual audio samples** at
full resolution and **fills** the shape, so it stays dense and continuous at any zoom.

- Render the full file with **wavesurfer from the decoded audio** (its own
  high-resolution peaks), **filled / continuous** style (mirrored, no bar gaps) —
  match Gecko's look.
- Use the DSP energy envelope **only for analysis** (the trim proposals), **never for
  the visual**.
- **Decode the WAV once:** feed the same `AudioBuffer` to wavesurfer (display) and to
  `analyzeEnvelope` (analysis). No double decode of the ~98 MB file.

This single change is what fixes "puntitos y rayas separadas."

## Layout (Option A — continuous, always visible)

- A **continuous full-file waveform strip**, always visible, spanning the width — not
  one isolated segment at a time.
- **All segments drawn as regions** on that one waveform, color-coded (reuse the
  minimap status colors: edited / tag / silent / etc.).
- The **active segment is highlighted**; **neighbor segments stay visible** for context
  (so you can see overlaps and gaps with the segments before/after).
- A **time ruler / timeline** beneath the waveform (wavesurfer timeline plugin), like
  Gecko's scale (1:30, 1:40, …).
- The existing **edit panel stays below** (token palette, "¿Tiene habla? → escribir
  texto", IN/OUT, prev/next) and operates on the selected segment.
- Keep the **status minimap strip** at the very top — different purpose (whole-file
  status overview vs. acoustic detail).

## Zoom & navigation

- **Zoom slider with a wide range:** min ~1 px/s (full-file overview) up to a high
  value for fine boundary work (Gecko-like — e.g. several hundred to ~1000+ px/s).
  Let wavesurfer re-render densely as you zoom; it stays continuous because it draws
  from high-res peaks.
- **Horizontal scroll** to move through the file.
- **Auto-center:** stepping to a segment scrolls/centers it in the view.

## Boundary editing

- The **active segment's region edges are draggable/resizable** (wavesurfer regions) →
  writes back to `segment.start` / `segment.end` and sets `editedTime`.
- Neighbor regions are **visible but not draggable** (so you don't move them by
  accident) — or lightly styled.
- The numeric **IN/OUT inputs stay** as a precision fallback.

## Playback (already built — keep)

- Play / Pause (resume from playhead), Play Segment (from segment start), Play whole
  file. The **playhead moves along the continuous waveform**.

## Keep — do NOT lose in the rebuild

- **Session autosave / restore** (the thing that beats Gecko — Gecko loses edits if you
  don't click out of the input; we must not regress this).
- Token palette always visible + inline insertion.
- "¿Tiene habla? → escribir texto" for noise gaps.
- Status minimap.
- Keyboard flow (play/pause, navigate, accept).
- Separable start/end trim proposals.

## Parked (not now)

- Auto-flag of escaping boundaries — it over-flags (90 vs ~8 real on the javier file);
  revisit later. The manual sweep with a good continuous waveform is the priority.

---

## Technical notes for Claude Code

- wavesurfer v7 + **regions** plugin + **timeline** plugin. Pin the version.
- **Render source = decoded audio / high-res peaks, NOT the coarse envelope.** Filled
  continuous style (no `barGap`/`barWidth` gaps, or the default fill), mirrored.
- Decode once; share the `AudioBuffer` between wavesurfer and `analyzeEnvelope`.
- Long files at high zoom: rely on wavesurfer's windowed/virtualized rendering. If a
  canvas-size limit is hit, cap the effective max px/s or use scroll windowing.
- This **replaces** the per-segment `showSegment()` model in the current
  `wavesurfer-view.ts` — the view is now the whole file with regions, not one segment.

## Suggested build order (one stage per session, Plan Mode)

1. **Continuous full-file render** from decoded audio + timeline ruler + zoom/scroll —
   get the dense, filled, Gecko-like look working first.
2. **All segments as regions** + active highlight + neighbor context + auto-center.
3. **Draggable active edges** wired to `start`/`end`, with IN/OUT staying in sync.

Test each stage in `npm run dev` against a real `.seglst` + `.wav` before committing.

## Non-goals (unchanged)

- Single channel; no multi-speaker views. Latin script only. Offline / standalone.
- Don't rewrite `lib/audio.ts` — envelope stays for analysis only.
