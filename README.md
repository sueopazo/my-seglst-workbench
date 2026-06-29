# SegLST Workbench

A browser-based tool for reviewing and correcting speaker diarization transcripts.
Inspired by [Gecko](https://github.com/gong-io/gecko), rebuilt around productivity and
reviewer experience: it loads a speaker's `.seglst.json` segment file and their `.wav`
track and provides a single-screen workspace to fix segment text, adjust boundaries,
and insert non-speech tokens.

Runs entirely in the browser. No server, no upload — the audio and transcript never
leave the machine.

> **Format:** SegLST (`.seglst.json`) is a segment-level JSON transcript format used in
> NeMo-style speaker diarization pipelines. Each segment carries a speaker, a start/end
> time, and the spoken text. SegLST has no per-word timestamps, which is why the word
> highlight below estimates them.

## Highlights

Built to make segment review faster and smoother:

- **Persistent autosave.** Progress is saved to the browser's `localStorage` and
  survives closing the tab or reloading — reopen and the session is restored exactly
  where it was left, including the elapsed-time counter.
- **Pre-review optimization pass.** An optional screen applies bulk proposals in one
  click — accept all boundary trims, all spelling fixes, or everything — so per-segment
  work starts from a cleaner state.
- **One-click token insertion.** The full official non-speech token set is available as
  buttons that insert at the cursor (frequent tokens always visible, the rest in an
  accordion, each with a hover description). No typing bracket tags by hand.
- **Full segment editing from the waveform.** Split at the playhead, delete, create by
  dragging on the waveform, and merge adjacent segments.
- **Logarithmic waveform gain.** A soft-knee log scale (like Audacity/Praat) that raises
  low-amplitude detail so quiet sounds and segment tails stay visible.
- **Word highlight on playback.** Words are highlighted in sync with audio position
  (estimated, since SegLST carries no per-word timestamps) to help keep your eye on
  where the audio is in the text.
- **Per-language spelling proposals.** Tailored per language, surfaced as proposals that
  are never auto-applied — the reviewer always confirms.
- **Downloadable effort report.** After a review, generates a Markdown report with total
  time and change metrics (segments modified/added/removed, edit rate, effort level),
  with a transparent explanation of how the effort level is computed.

In a real timed run, review time dropped to roughly half of the previous average,
mainly thanks to the pre-review optimization pass and one-click token insertion.

## Features

- Continuous full-file waveform with timeline, zoom, and adjustable log gain.
- Click-to-seek, play / play-segment, and active-segment auto-follow during playback.
- Segment CRUD: split, merge-with-next, delete, and create-by-drag (new segments stay
  gray until text is entered).
- Optional pre-review optimization screen with per-type bulk accept (borders / spelling
  / all), each showing a count.
- Full official non-speech token palette with frequent/accordion split and tooltips.
- Spelling proposals (and trim start / trim end) shown per segment, accepted
  individually or in bulk; never auto-applied.
- Sub-200ms gap merge suggestion (proposal, not automatic).
- Word-level highlight synced to playback and seek.
- Persistent autosave via `localStorage`; Ctrl/Cmd+S confirms the autosave.
- Per-file elapsed-time counter, persisted across reloads.
- Downloadable Markdown effort/time report.
- Drag-and-drop or click to load files.
- Remembers the selected language across sessions.

## Supported languages

Latin-script languages: **English, Spanish, Portuguese (BR), German, French, Italian.**

Each language has its own spelling profile. Spanish is the most complete (full accent
and punctuation handling); the others are intentionally conservative — they propose only
mechanically safe corrections and leave meaning-dependent decisions (accents, German
noun capitalization, Italian geminates, etc.) to the reviewer.

**Out of scope:** non-Latin writing systems (CJK, right-to-left scripts such as Arabic
and Hebrew, Cyrillic). These break core assumptions of the tool (word spacing, text
direction, script detection) and would need foundational work, not just a new profile.
A team working in those languages can fork this repo and build that layer on top.

## Running it

Requires Node.js.

```bash
npm install
npm run dev        # local dev server
npm run build      # production build to dist/
npm run preview    # preview the production build
npm test           # run the unit tests
```

To use: load a speaker's `.seglst.json` and matching `.wav`, optionally run the
optimization pass, then review segment by segment. Export writes the corrected
`.seglst.json`, preserving the original filename.

## Architecture

- `src/lib/` — pure logic, no DOM: audio analysis (envelope/dB, edge detection,
  internal silences), segment operations (split/merge/export), spelling profiles, the
  report generator, and the word-timing estimator. This is the tested layer
  (`npm test`).
- `src/ui/` — rendering: waveform view and minimap.
- `src/app.ts` — orchestration wiring the two together.

Anyone extending the tool (a new writing system, a new spelling profile) should start in
`src/lib/`. UI strings are English-only by design; the selectable language affects
spelling rules, not the interface.

## Scope

Single speaker channel per file (not a multi-speaker cross-channel view), Latin script,
fully offline/standalone.