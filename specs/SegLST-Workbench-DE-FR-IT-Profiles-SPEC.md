# SegLST Workbench — German / French / Italian minimal profiles

Adds three more corpus-language profiles — **German (de)**, **French (fr)**,
**Italian (it)** — selectable from the language dropdown. UI stays in English.
Existing profiles (es, en, pt) are NOT touched.

Same locked rules: orthography is **proposals, never auto-applied**; don't rewrite the
DSP; offline.

## Philosophy: minimal and safe, like pt — a helper, not a corrector

The tool aids the reviewer; the human always confirms. Each of these three languages
has rules that depend on **meaning or native knowledge** and therefore must NOT be
automated by non-native logic:
- German: capitalize ALL nouns (requires knowing which words are nouns), umlauts, ß.
- French: meaning-dependent accents (é/è/ê…), elision apostrophes, compound hyphens.
- Italian: mandatory accents on minimal-pair monosyllables, geminate (double)
  consonants.

These risky rules are **deliberately left out**. A native reviewer for each language
can suggest safe additions later, one at a time. The one hard rule: **never propose a
wrong correction.** Proposing little is fine.

## Rules for each of the three profiles (identical, safe set only)

Include ONLY:
1. **Sentence-initial capitalization.**
2. **Whitespace cleanup** — collapse multiple spaces, trim, fix spacing around
   punctuation.
3. **Final punctuation** — optional sentence-ending period on complete-looking
   utterances (same as es/en/pt behavior).

### Explicitly NOT in these profiles (left out on purpose)
- **No accent/diacritic handling.** Leave existing accents (ä ö ü ß / é è ê ç à / à è ì
  ò ù é) exactly as they come — do NOT add, remove, or "correct" them. They're
  meaning-dependent and validated by native reviewers, not by the tool.
- **German: do NOT auto-capitalize nouns.** Only sentence-initial capitalization.
  (Noun capitalization needs real grammatical knowledge — leave to the human.)
- **French: do NOT auto-insert elision apostrophes or compound hyphens.**
- **Italian: do NOT touch double consonants or monosyllable accents.**
- **No opening marks** (¿ ¡ — not used in any of these).
- **No slang/dialect/regional "correction"** — preserve spoken forms.
- Bracket tokens `[...]` untouched.

## Implementation
- Add `de`, `fr`, `it` `LanguageProfile`s alongside es/en/pt. Each fills:
  sentence-capitalize = true, whitespace cleanup, finalPunct. accents = none/empty,
  openingMarks = none, no noun-caps, no apostrophe/hyphen rules.
- The three are structurally identical to each other (and to the pt minimal profile) —
  same safe set, different `code`/`label`. Reuse, don't duplicate logic.
- Dropdown selects the active profile; default still inferable from `NV_[LANG]`
  filename, dropdown overrides.

## Tests (extend the Vitest suite)
- For each of de/fr/it: capitalization, whitespace, final punctuation propose correctly.
- **Isolation:** none of de/fr/it produce ¿¡ or any accent proposals; selecting them
  does not change es/en/pt behavior.
- **Conservatism:** existing accented words (e.g. DE `Müßiggang`, FR `déjà`, IT `città`)
  are NOT flagged or altered; German nouns are NOT auto-capitalized; Italian double
  consonants untouched.
- `npm test` passes for all six languages' isolation.

## Verification
- `npm run build` clean; `npm test` passes.
- Select de / fr / it with a file → only the safe proposals; no ¿¡, no accent changes,
  no noun-caps.
- Switch among all six languages → each behaves correctly, no cross-contamination.
- es (and en/pt) unchanged.

## Later (only if native reviewers find safe, validated patterns)
- Per-language targeted rules (e.g. a safe subset of German noun caps, French elisions),
  added one at a time, each confirmed by a native reviewer, each as a proposal.

## Non-goals (unchanged)
- Single channel; Latin script only; offline; don't rewrite `lib/audio.ts`.
