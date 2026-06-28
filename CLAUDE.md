# CLAUDE.md — SegLST Workbench

QA1 review tool for a multi-speaker audio diarization QA project. Loads one speaker's
individual channel (`.seglst` JSON + `.wav`) and helps a moderator review it
segment by segment: fix orthography, define accurate boundaries, insert
paralinguistic tokens. Standalone, offline, browser-based.

**The full plan for current work is in `SegLST-Workbench-v2-SPEC.md`. Read it before
starting a phase. Track progress in `PROGRESS.md`.**

## Stack & commands

- Vanilla TypeScript + Vite. No framework. ES2023, ESM.
- `npm run dev` — local dev server (usually http://localhost:5173)
- `npm run build` — `tsc` typecheck + Vite build to `dist/`
- `npm run preview` — serve the built `dist/`
- `npm test` — Vitest watch mode; `npm run test:run` — single run (CI-style)
- Tests live in `tests/`; cover pure logic in `lib/` only (no DOM, no UI).

## Architecture (preserve this separation)

```
src/lib/   Pure logic, NO DOM. Testable in isolation.
src/ui/    Rendering only (waveform, minimap).
src/app.ts Orchestration: wires lib + ui + DOM events.
```

- `lib/audio.ts` is the **DSP core** (envelope/dB analysis, edge & silence
  detection). This is the asset of the project. **Do not rewrite it** — wrap and
  reuse it. New visualizations overlay its output; they don't replace it.
- Keep new pure logic in `lib/` (no DOM), keep DOM work out of `lib/`.

## TypeScript conventions (tsconfig is strict — respect it)

- `verbatimModuleSyntax: true` → type-only imports MUST use `import type { X }`.
- `noUnusedLocals` / `noUnusedParameters` are on → no dead variables/params.
- `noFallthroughCasesInSwitch` is on.
- No `any`. Prefer precise types; the codebase already avoids `any`.
- Run `npm run build` (typecheck) **and** `npm run test:run` before considering a task done. Both must pass.

## Locked scope — do NOT scope-creep

- **Single channel at a time.** No multi-speaker / cross-channel views. QA1 reviews
  each speaker's individual track one at a time, by design.
- **Segment-by-segment stepping is the spine.** New features add context around it;
  they don't replace the prev/next focus flow.
- **Latin script only.** No CJK / non-Latin support (breaks tokenization).
- No server, no accounts, no cloud. Stays standalone and offline.

## Working agreement

- **Use Plan Mode for the larger phases** (especially the waveform refactor). Show
  the plan and wait for approval before editing files.
- **One phase per session.** Don't attempt multiple phases at once.
- After changes: run `npm run build` and `npm run test:run` — both must pass.
- Update `PROGRESS.md` when a phase moves forward.
- Prefer small, reviewable diffs over large rewrites.

## Conventions in this codebase

- **All UI strings must be in English** — toasts, labels, messages, hints, placeholders, confirmations, tooltips. No exceptions. The selectable language (English/Spanish/German/French/Italian) only affects orthography rules for the corpus; it never changes the UI language. Do not let Spanish bleed into future features.
- Orthography/tagging logic must treat `[...]` tokens as opaque (don't capitalize
  after `]`, don't flag brackets as foreign script).
- `localStorage` autosave persists segments + log, but not the decoded audio.
