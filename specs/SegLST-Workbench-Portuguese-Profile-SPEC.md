# SegLST Workbench — Portuguese (Brazil) orthography profile

Adds **Portuguese (pt-BR)** as a corpus-language profile, selectable from the language
dropdown. UI stays in English. Spanish and English profiles are NOT touched.

Same locked rules: orthography is **proposals, never auto-applied**; don't rewrite the
DSP; offline.

## Philosophy: a helper, not a perfect corrector

The tool is a time-saving aid — the human always confirms. Recognizing only a few
mechanical things is plenty. The one hard rule: **the profile must never propose a
wrong correction.** Proposing too little is fine; proposing something incorrect wastes
the reviewer's time. So this profile is deliberately minimal and conservative.

We are not native Portuguese speakers, and Portuguese accents are meaning-dependent
(like Spanish diacritics), so anything risky is intentionally LEFT OUT — to be added
later only if native reviewers see a clear, safe pattern worth adding.

## Rules for the Portuguese profile (only the mechanically safe ones)

Include ONLY:
1. **Sentence-initial capitalization.**
2. **Standalone-pronoun safe caps** only if unambiguous (no aggressive proper-noun
   guessing — leave that to the human).
3. **Whitespace cleanup** — collapse multiple spaces, trim, fix spacing around
   punctuation.
4. **Final punctuation** — optionally propose a sentence-ending period on
   complete-looking utterances (same as ES/EN behavior).

### Explicitly NOT in the Portuguese profile (left out on purpose)
- **No accent/diacritic map.** Portuguese accents (á à â ã é ê í ó ô õ ú, ç) depend on
  meaning and the post-2009 Acordo Ortográfico; a fixed map would propose wrong
  corrections. Leave empty. Native reviewers can suggest safe additions later.
- **No opening marks** (¿ ¡ are Spanish-only; Portuguese doesn't use them).
- **No slang/dialect/regional "correction."** Preserve regional standard variants as
  spoken (e.g. BR econômico, recepção, ônibus) — do NOT flag them.
- Bracket tokens `[...]` left untouched.

## Implementation
- Add a `pt` (pt-BR) `LanguageProfile` alongside `es` and `en`. Fill: sentence-capitalize
  = true, whitespace cleanup, finalPunct (match ES/EN). accents = empty/none,
  openingMarks = none.
- Dropdown selects the active profile. Selecting Portuguese must produce only the safe
  proposals above and ZERO Spanish-specific (no ¿¡, no ES accent proposals).
- Default profile still inferable from `NV_[LANG]` filename; dropdown overrides.

## Tests (extend the Vitest suite)
- Add Portuguese cases mirroring the English ones: capitalization, whitespace, final
  punctuation propose correctly.
- **Isolation:** Portuguese profile produces NO ¿¡ and NO Spanish-accent proposals;
  selecting it does not change ES/EN behavior.
- **Conservatism:** Portuguese regional standard forms (econômico, ônibus, recepção)
  are NOT flagged for correction.
- Run `npm test` — all three languages' isolation tests pass.

## Verification
- `npm run build` clean; `npm test` passes.
- Select Portuguese with a file → only safe proposals; no ¿¡, no accent proposals.
- Switch among ES / EN / PT → each behaves correctly, no cross-contamination.
- Spanish (your working profile) unchanged.

## Later (not now, only if native reviewers find safe patterns)
- Targeted, validated accent or Acordo Ortográfico rules — added one at a time, each
  confirmed by a native reviewer, each as a proposal. Only if the pattern is clearly
  safe and worth it. The profile grows from real evidence, never from guessing.

## Non-goals (unchanged)
- Single channel; Latin script only; offline; don't rewrite `lib/audio.ts`.
