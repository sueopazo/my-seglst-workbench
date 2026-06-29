# SegLST Workbench — Tests for uncovered lib/ logic

Add Vitest coverage for the pure logic in `src/lib/` that currently has zero tests.
This closes the gap before the tool gets wider use. Tests only — do NOT change the
logic being tested (if a real bug surfaces, report it separately, don't silently
"fix" it inside a test).

Priority order (highest return first).

## 1. batch-apply.ts — HIGHEST PRIORITY
This is the bulk-proposal logic (accept all / accept borders / accept spelling) — one
of the two main time-savers, and currently has no tests at all. A bug here corrupts
output silently.
- `previewBatch` — given segments with proposals, returns the correct preview/counts.
- `applyOrthoProposals` — applies only spelling proposals; leaves boundaries untouched.
- `applyTrimProposals` — applies only boundary trims; leaves text untouched.
- `applyAllProposals` — applies both; result equals the real composition of the two.
- Counts reported match the number actually applied.
- Idempotence / no-op: applying with zero proposals changes nothing.
- Bracket tokens `[...]` and already-correct text are left intact.

## 2. history.ts — critical (undo safety net)
The undo is the safety net for delete-without-confirmation, so it must be correct.
- `push` adds a snapshot; `canUndo` reflects state correctly.
- `pop` returns the last snapshot and steps back.
- `clear` empties; `canUndo` false afterward.
- Boundary cases: pop on empty, push beyond any cap (if there is one), LIFO order.

## 3. profiles.ts — language inference
- `inferProfile(filename)` returns the right profile when a language hint is present,
  and the default when not. (Real files don't carry a language prefix, so the default
  path matters most — test it explicitly.)

## 4. format.ts — trivial but pure, cheap to lock down
- `f2`, `mmss`, `formatElapsed` — correct formatting incl. edge values (0, >1h).
- `isTagOnly` — true for bracket-only segments, false otherwise.
- `flagged` — correct per its definition.
- `hasCJK` — true for CJK input, false for Latin (guards the Latin-script assumption).

## Out of scope (leave manual)
- CRUD in app.ts (delete/split/insert/merge) — would require extracting to lib/ first;
  separate future task, not this one.
- playSegment timing, bfcache handling, any DOM/event logic — manual verification.
- waveform-decode.ts (needs AudioContext), localStorage-dependent parts of storage.ts
  (the pure `debounce` can be tested; the rest needs a mock — optional).

## Verification
- `npm test` passes with the new tests added to the existing suite (currently ~115).
- To confirm the tests bite: temporarily break one rule (e.g. make applyOrthoProposals
  also touch a boundary) -> a test fails -> revert -> passes.
- No production logic changed.
