# SegLST Workbench v2 — Build Spec

A QA1 review tool for a multi-speaker audio diarization QA project. Takes one speaker's
individual channel (`.seglst` JSON + `.wav`) and helps a moderator review it
**segment by segment**: fix orthography, define accurate boundaries, and insert
paralinguistic tokens — fast, with audio context always visible.

This spec describes a **v2 refactor of an existing working app** (Vite + TypeScript,
vanilla, no framework). The current architecture is sound and should be kept; this
document defines what changes.

---

## 0. Current state (what already exists)

```
src/
  lib/        pure logic, no DOM (KEEP — well separated)
    audio.ts            envelope/dB analysis, edge & silence detection (DSP — the valuable core)
    ortho.ts            Spanish orthography fixes
    segments.ts         parse / export / split / merge
    batch-apply.ts      "propose then apply all" engine
    constants.ts        tags, accent map, thresholds
    types.ts, format.ts, history.ts, storage.ts, waveform-decode.ts
  ui/
    waveform.ts         hand-rolled canvas, renders ±0.25s window around current segment
    minimap.ts          per-segment status strip
  workers/audio-worker.ts   (currently dead/broken — see Bug 2)
  app.ts                orchestration (~850 lines)
```

The DSP layer (`audio.ts`) is independent of rendering and must be **preserved**.
It will become an analysis *overlay* on top of the new waveform (Section 4.4).

---

## 1. Scope (locked)

- **QA1, single channel at a time.** One `.seglst` + one `.wav` per session. This
  is correct and intentional — QA1 reviews each speaker's individual track. **Do
  not** add multi-speaker / cross-channel views.
- The disciplined **segment-by-segment stepping** flow (prev/next, one segment in
  focus) stays as the spine. New features add context around it, they don't replace it.

---

## 2. Five architecture decisions

### 4.1 — Orthography becomes proposals, never silent mutation

**Problem today:** `parseSeglst` runs `orthoFix` on every segment at import and
mutates the text before the human sees it (`editedTxt=true`). For spontaneous
speech (disfluencies, false starts) this bakes in errors the reviewer must catch.

**Change:**
- On import, **do not mutate text.** Compute orthography fixes as **pending
  proposals**, surfaced exactly like the audio proposals already are (the `.prop`
  buttons + the "Accept all" badge).
- Nothing changes in the data until the user accepts.
- "Accept all" keeps working for speed.

### 4.2 — Language profiles (multi-language)

Everything except orthography is already language-agnostic. Multi-language = make
the ortho layer pluggable, not a rewrite.

```ts
interface LanguageProfile {
  code: string;                      // 'es', 'en', 'pt', ...
  label: string;                     // 'Español', 'English'
  letters: RegExp;                   // what counts as a word char (for tokenizing)
  expectedScript: RegExp;            // chars considered "in-language" (Section 4.5)
  capitalizeAfter: RegExp;           // punctuation after which to capitalize (near-universal)
  finalPunct: boolean;               // add a trailing period to complete-looking sentences?
  accents?: Record<string, string>;  // accent restoration map (optional, es-style)
  openingMarks?: boolean;            // ¿ ¡ handling (Spanish only)
  danglingEnd?: RegExp;              // words that mean "don't add final period"
}
```

- **English / no-diacritic profile = near-empty and SAFE:** collapse whitespace,
  capitalize sentence starts, optional final period. Build this as the **universal
  core first.** Spanish then becomes the heaviest *profile*, not the center.
- Selection: a **dropdown on load**. Default may be inferred from the `NV_[LANG]`
  filename prefix, but the dropdown is the source of truth.
- **Trap:** Spanish diacritics are partly meaning-dependent (sí/si, él/el, más/mas,
  tú/tu, sé/se). A fixed accent map *will* mis-correct these. This is another reason
  accent restoration must be a **proposal, never automatic** (reinforces 4.1).

### 4.3 — Token buttons: always visible, insert inline at cursor

**Today:** a segment is *either* a tag (`isTag=true`, whole segment = `[other-noise]`)
*or* text. There's no way to put a token mid-utterance.

**Change:**
- The token chip row is **always visible** while a speech segment is focused.
- Clicking a chip **inserts the token at the textarea cursor position** (e.g.
  `sí [laugh] claro`) — it does **not** replace the segment.
- Two modes coexist:
  - `isTag` → segment is **only** noise (existing behavior, keep).
  - **inline insertion** → tokens live inside speech text.
- **Important:** the ortho layer must not capitalize after a `]`, and the script
  detector (4.5) must ignore bracketed tokens.

### 4.4 — Full-file waveform (wavesurfer.js) with DSP overlay

Replace the ±0.25s canvas window with a **full-file waveform**, like Gecko.

- Use **wavesurfer.js v7** + the **regions plugin**. (Pin the version — the regions
  API changed significantly between v6 and v7.) It bundles into `dist/` via Vite, so
  the app stays offline — no CDN.
- wavesurfer provides for free: full waveform, zoom, scroll, moving playhead,
  auto-center, and **draggable/resizable region edges**.
- **Decode the WAV exactly once.** wavesurfer needs audio to draw; `analyzeEnvelope`
  needs the samples too. Decode one `AudioBuffer` and feed both (wavesurfer v7
  accepts pre-computed `peaks`). Do **not** double-decode the ~98 MB file.
- **Keep the DSP as an overlay**, not discarded:
  - proposed trim boundaries → markers on the waveform
  - internal silences → shaded zones
  - the noise-floor / edge logic stays exactly as is
- **Boundary editing via drag:** dragging a region edge writes back to
  `segment.start` / `segment.end` (sets `editedTime=true`). This directly serves the
  "define every boundary" requirement and replaces numeric time-typing as the primary
  gesture (keep the numeric inputs as a precision fallback).
- The current segment's region is highlighted and **auto-centered** on step.
- **Keep the minimap too** (decided): minimap = per-segment status/flag colors;
  waveform = acoustic context. They serve different purposes.

### 4.5 — Script detection parameterized by expected language

**Today:** a hardcoded `hasCJK` check flags "other language."

**Change:**
- Replace with: flag characters **outside `profile.expectedScript`**.
- **CJK is explicitly out of scope.** "Languages without special characters" =
  Latin script (with or without diacritics), **not** Chinese/Japanese/Korean —
  those have no spaces and a different tokenization that breaks `splitBySilence`.
  State this as a hard non-goal.

---

## 3. Bug fixes to fold in (independent of the above)

1. **Export overwrites `session_id`.** `exportSeglst` sets `session_id: speaker`,
   discarding the parsed `meta.sessionId`. Fix: export `session_id: meta.sessionId`
   (with sensible fallback), `speaker: meta.speaker`. **Verify against a reference
   `_fixed` file the pipeline accepts** before trusting it.
2. **The audio worker is dead and would crash:** `audio-worker.ts` uses
   `new AudioContext()`, which does not exist in Worker scope. The app doesn't use it
   anyway (it decodes on the main thread). Resolve as part of 4.4: decode once
   (`OfflineAudioContext` if off-thread is wanted) and delete or correctly rewire the
   worker. No dead code left behind.
3. **`splitBySilence` distributes text by word count, not by time.** It splits the
   word list into roughly equal chunks with no idea which words fall in which time
   bucket. After a split, flag the affected segments in the UI as "review text
   distribution," and/or focus the first split segment for manual text correction.

---

## 4. Data model notes

- `Segment` stays `{ id, start, end, words, detection, isTag, editedTxt, editedTime }`.
- Inline tokens are just bracketed substrings inside `words` — no schema change.
- Ortho/script layers must treat `[...]` tokens as opaque (skip them).
- `localStorage` autosave already persists segments + log; on restore, `wav` is null
  until the user re-loads the `.wav` — make the restore toast say so, since proposals
  won't appear until audio is back.

---

## 5. Testing (new — do this)

The pure `lib/` functions are exactly where silent regressions hide. Add unit tests
(Vitest fits Vite cleanly):
- `orthoFix` per profile (es heavy, en near-empty) — including bracket-token safety.
- `detectEdges`, `internalSilences` — with small synthetic envelopes.
- `splitBySilence` — boundary/word-count behavior.
- `exportSeglst` — the `session_id` fix specifically.

---

## 6. Suggested build order (phases)

- **Phase 0 — Bug fixes.** Items 1–3 above. Smallest, ships correctness immediately.
- **Phase 1 — Ortho → proposals + LanguageProfile.** Build the universal/English core
  first, then port Spanish into a profile. Add the dropdown.
- **Phase 2 — Inline token buttons.** Always-visible chips, cursor insertion,
  ortho/script bracket-safety.
- **Phase 3 — wavesurfer full waveform.** Decode-once, regions, draggable boundaries,
  DSP overlay, auto-center. Keep minimap. (Biggest phase — do it carefully; the data
  layer is already done, so this is rendering + interaction.)
- **Phase 4 — Tests.** Lock in everything above.

---

## 7. Non-goals (don't let scope creep in)

- No multi-speaker / cross-channel diarization view.
- No CJK or non-Latin-script support.
- No server, no accounts, no cloud — stays a standalone offline app.
- Don't rewrite the DSP; it's the asset. Wrap and reuse it.
