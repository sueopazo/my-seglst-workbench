# SegLST Workbench v2.1 — Review Improvements

Follow-on to `SegLST-Workbench-v2-SPEC.md`. Same locked rules (single channel, Latin
script, offline, don't rewrite the DSP).

## The goal of this release: eliminate the second pass

Right now QA1 takes **two passes over every segment**:
1. In the workbench: text + most edits (this part works well — the auto output is
   close to final).
2. In Gecko: a **visual boundary sweep** over all segments, checking the waveform to
   see if any audio "escapes" the segment edges (mostly the end), dragging where
   needed.

The second pass is where the time goes — it's a full second trip through ~240
segments in a different tool. **This release brings that visual sweep into the
workbench so Gecko drops out of the flow entirely.**

Comparison data backing this: the start boundary is essentially never adjusted
(avg ~0.02s vs. the human), text matches ~88%, but the **end boundary is hand-adjusted
on roughly 1 in 4 segments**. The sweep exists to catch those.

---

## 1. Waveform review mode  (priority — the core of this release)

A full-file waveform the reviewer can sweep visually, matching what Gecko does today.

- **Whole WAV visible** as a waveform (built in Phase 3 — extend it).
- **Zoom comparable to Gecko (about 1 to 500).** A zoom slider plus a few presets.
  Use wavesurfer's native zoom (pixels-per-second); check the pinned wavesurfer
  version's API.
- **Playback controls:**
  - **Play / Pause** (toggle): plays from the current playhead; pausing keeps the
    playhead where it stopped; pressing play resumes from there. *(This fixes the
    current bug where replay restarts from the segment start.)*
  - **Play Segment**: seeks to the focused segment's start and plays just it.
  - **Play whole file**: play continuously from the playhead through the whole file.
- **Drag boundaries** (already built) is the precise manual fix during the sweep.
- **Auto-center when zoomed:** once zoomed in the whole file no longer fits, so
  stepping to a segment must scroll it into center.

## 2. Auto-flag segments where the waveform escapes the boundary  (the differentiator)

Gecko makes the reviewer eyeball all ~240 segments because Gecko knows nothing about
the audio. **The workbench already computes the energy envelope and noise floor** —
so it can find the suspicious segments automatically and point the reviewer at them.

- For each segment, check the envelope just **outside** its edges (a short window,
  e.g. ~0.3s before start and after end). If there is **energy above the noise floor
  outside the segment boundary**, the waveform is "escaping" — flag the segment.
- **Emphasize the end edge** (that's the one adjusted ~1 in 4 times); also check the
  start.
- **Visual flag** on the segment (in the segment list and on its waveform region) in
  a distinct color.
- **Jump-to-flagged navigation:** a key / button to jump to the next (and previous)
  flagged segment. This is what makes the sweep fast — the reviewer visits only the
  ~50 flagged segments, not all 240, and skips the rest with confidence.
- Reuse the existing DSP (`lib/audio.ts`); do not rewrite it.

**Target workflow:** the 240-segment Gecko sweep becomes "jump through ~50 flagged
segments, nudge where needed" — a few minutes inside the workbench, no Gecko.

## 3. Separable start / end trim proposals  (secondary)

Make the start-trim and end-trim **two independent proposals** per segment, each with
its own accept / reject ("Accept all" still applies both). Because the start is
reliable and the end isn't, the reviewer accepts the start in one click and focuses on
the end. Rejecting one leaves the other untouched. Lower priority than 1 and 2 now
that the flagged-sweep is the main path, but still useful.

## 4. Quick wins  (low risk)

- **Load prompt at startup:** replace the intro message with a "load your files"
  prompt / dropzone (`.seglst` + `.wav`). Don't break restore-from-autosave: if there
  is saved state, offer *Restore previous session* vs *Load new files*.
- **Add backchannel tokens:** add `[uh-huh]` and `[mmm]` to the palette. Confirm exact
  spelling against the project's allowed token list.
- **Download button at the end:** when the reviewer passes the last segment, show the
  export / download button instead of a dead "fin" state.

---

## Suggested build order

The waveform work is big — build it across **two sessions**, even though it's all in
scope:

1. **Quick wins** (load prompt, tokens, end download button) — cheap warm-up.
2. **Waveform review mode** (section 1): whole-file waveform, zoom 1–500, play whole /
   play segment / pause-resume. Get the Gecko-parity vista working first. *(Plan Mode.)*
3. **Auto-flag + jump-to-flagged** (section 2): the intelligence layer on top. *(Plan Mode.)*
4. **Separable start/end proposals** (section 3): whenever convenient.

Test each in `npm run dev` against a real file (load a `.seglst` + `.wav`, do a sweep)
before committing.

## Dropped

- Tuning the end-boundary detection algorithm — the end error has no consistent
  direction, so there's nothing systematic to tune. Manual sweep + auto-flag replaces
  it.

## Non-goals (unchanged)

- Single channel at a time; no multi-speaker views.
- Latin script only; no CJK.
- Offline / standalone; no server or accounts.
- Don't rewrite `lib/audio.ts` — reuse the envelope/noise-floor for the auto-flag.
