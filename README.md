# SegLST Workbench

A browser-based QA tool for reviewing speaker segments in multi-speaker audio
diarization data. It loads one speaker's `.seglst.json` segment file alongside their
`.wav` track and provides a single-screen workspace to correct segment text, adjust
boundaries, and insert non-speech tokens — replacing Gecko in the QA1 review step.

Runs entirely in the browser. No server, no upload: the audio and transcript never
leave the machine.

## Why this over Gecko

SegLST Workbench was built specifically for the QA1 review flow, and removes the main
reasons a reviewer had to keep Gecko (and a second tool pass) in the loop.

- **Persistent autosave.** Gecko autosaves, but the work is lost when the window
  closes. Here, progress is saved to the browser's `localStorage` and **survives
  closing the tab or reloading** — reopen and the session is restored exactly where it
  was left, including the elapsed-time counter.
- **Pre-review optimization pass.** Before reviewing segment by segment, an optional
  screen applies bulk proposals in one click — accept all boundary trims, all spelling
  fixes, or everything — so the per-segment work starts from a cleaner state. This is
  one of the two biggest time savers.
- **One-click token insertion.** The full official non-speech token set is available as
  buttons that insert at the cursor (frequent tokens always visible, the rest in an
  accordion, each with a hover description). No typing bracket tags by hand. The other
  biggest time saver.
- **Full segment editing from the waveform.** Split at the playhead, delete, create by
  dragging on the waveform, and **merge adjacent segments** — the last of which Gecko
  does not do, and which removes the need to move text between mis-split segments by
  hand.
- **Logarithmic waveform gain ("Realce").** A soft-knee log scale (like Audacity/Praat)
  that raises low-amplitude detail so quiet sounds and segment tails are visible —
  removing the last reason to open Gecko for a visual check of boundaries.
- **Per-language orthography proposals.** Spelling/casing suggestions tailored per
  language, surfaced as proposals that are never auto-applied — the reviewer always
  confirms.
- **Correct `session_id` on export.** The original `session_id` is preserved rather than
  overwritten with the filename.

### Result

In a real, timed QA1 run, review time dropped from a previous average of ~90 minutes to
**~42 minutes — less than half.** The largest contributions come from the pre-review
optimization pass and one-click token insertion.

## Features

- Continuous full-file waveform with timeline, zoom, and adjustable log gain.
- Click-to-seek, play / play-segment, and active-segment auto-follow during playback.
- Segment CRUD: split, merge-with-next, delete, and create-by-drag (new segments stay
  gray until text is entered).
- Optional pre-review optimization screen with per-type bulk accept (borders / spelling
  / all), each showing a count.
- Full official non-speech token palette with frequent/accordion split and hover
  tooltips.
- Orthography proposals (spelling, trim start, trim end) shown per segment, accepted
  individually or in bulk; never auto-applied.
- Sub-200ms gap merge suggestion (proposal, not automatic).
- Persistent autosave via `localStorage`; Ctrl/Cmd+S confirms the autosave.
- Per-file elapsed-time counter, persisted across reloads.
- Drag-and-drop or click to load files.
- Remembers the selected language across sessions.

## Supported languages

Latin-script languages: **English, Spanish, Portuguese (BR), German, French, Italian.**

Each language has its own orthography profile. Spanish is the most complete (full
accent and punctuation handling); the others are intentionally conservative — they
propose only mechanically safe corrections and leave meaning-dependent decisions
(accents, German noun capitalization, Italian geminates, etc.) to the reviewer.

**Out of scope:** non-Latin writing systems (CJK, right-to-left scripts such as Arabic
and Hebrew, Cyrillic). These break core assumptions of the tool (word spacing, text
direction, script detection) and would require foundational work, not just a new
profile. A team working in those languages can clone this repo and build that layer on
top.

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
  internal silences), segment operations (split/merge/export), and orthography profiles.
  This is the tested layer (`npm test`).
- `src/ui/` — rendering: waveform view and minimap.
- `src/app.ts` — orchestration wiring the two together.

Anyone extending the tool (e.g. adding a writing system or a new orthography profile)
should start in `src/lib/`. UI strings are English-only by design; the selectable
language affects orthography rules, not the interface.

## Scope

Single speaker channel per file (not a multi-speaker cross-channel view), Latin script,
fully offline/standalone.