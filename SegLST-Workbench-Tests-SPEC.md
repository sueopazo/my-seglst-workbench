# SegLST Workbench — Unit tests for the pure logic (lib/)

Add automated tests for the pure, DOM-free logic before adding more language profiles.
Goal: a fast safety net so adding Portuguese (or any change) can't silently break
Spanish or English. Test the logic in `lib/` only — NOT the UI, waveform, or mouse
gestures (those stay manually verified).

## Setup
- Add **Vitest** (fits Vite cleanly). Add `"test": "vitest"` (and `"test:run":
  "vitest run"`) to package.json scripts.
- Tests live next to the code or in a `tests/` dir, as is idiomatic for Vitest.

## What to cover (pure functions in lib/)

### 1. Orthography profiles — the highest-value tests (regression guard for languages)
- **Spanish profile:** accent restoration proposals, ¿¡ opening marks, sentence
  capitalization, final punctuation — assert it proposes what it should on sample
  inputs.
- **English profile:** sentence capitalization, `i`→`I`, contraction/possessive
  apostrophes (`dont`→`don't`, `Johns`→`John's`), whitespace cleanup, final punctuation.
- **Cross-profile isolation (critical):** assert the **English profile produces NO
  accent/¿¡ proposals**, and the Spanish profile's behavior is unchanged. This is the
  exact regression that adding a new language could cause.
- **Conservatism:** assert neither profile "corrects" slang/dialect it should preserve
  (`y'all`, `gonna` in EN; regional forms in ES) and that bracket tokens `[...]` are
  left untouched.

### 2. Segment operations (segments.ts)
- **split:** text stays whole in the first half; second half empty + correct state
  flag (needsText); times split at the playhead.
- **merge:** result spans first.start → next.end; texts concatenated with one space.
- **export (`exportSeglst`):** `session_id` comes from `meta.sessionId` (the bug we
  fixed) — assert it is NOT the speaker. Round-trip a small sample.

### 3. Audio analysis (audio.ts) — with small synthetic envelopes
- **detectEdges / trim proposals:** on a hand-made envelope, assert start/end land where
  expected.
- **internalSilences:** detects silences ≥ threshold, ignores shorter ones.
- (Use tiny synthetic Float32 arrays / envelopes — no real audio files needed.)

## Out of scope
- UI, DOM, wavesurfer rendering, mouse gestures, keyboard handlers — verified manually.
- No need for full coverage; aim for the regression-prone logic above.

## Verification
- `npm test` runs and passes.
- Deliberately break a rule (e.g. make the English profile emit an accent proposal) →
  a test fails. Revert → passes. (Confirms the net actually catches regressions.)

## Why now
Adding Portuguese next is the change most likely to regress Spanish/English. These tests
turn "re-test three languages by hand" into "run npm test in two seconds."
