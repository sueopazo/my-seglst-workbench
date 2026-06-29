# SegLST Workbench — English orthography profile

Adds **English** as a corpus-language profile (the orthography rules applied to the
transcript text), selectable from the existing language dropdown. The UI is already in
English and does not change. Spanish profile stays exactly as is.

Same locked rules: orthography is **proposals, never auto-applied**; don't rewrite the
DSP; offline/standalone.

## Principle: the English profile is minimal and conservative

Per the official English transcription guidelines, the English profile must NOT
"correct" toward formal English. It only normalizes mechanics. It must **preserve**
real dialect, slang, and contractions as spoken (`y'all`, dropped-g forms, etc.).
Over-correcting spontaneous speech introduces errors — same principle already used for
Spanish.

## Rules for the English profile

Include ONLY these (all surfaced as proposals, like the Spanish ones):

1. **Sentence-initial capitalization** — capitalize the first letter of a sentence /
   after sentence-ending punctuation.
2. **Proper-noun / "I" capitalization** is NOT auto-corrected (can't reliably detect
   proper nouns; leave to the human). Only the standalone pronoun **"i" → "I"** is safe
   to propose.
3. **Apostrophes in contractions and possessives** — propose the apostrophe form when
   the bare form appears: `dont`→`don't`, `Im`→`I'm`, `cant`→`can't`, `youre`→`you're`,
   `Johns`→`John's` (possessive 's). Use a finite list of common contractions; do NOT
   guess aggressively on possessives beyond clear 's cases.
4. **Whitespace cleanup** — collapse multiple spaces, trim, fix spacing around
   punctuation.
5. **Final punctuation** — optionally propose a sentence-ending period on
   complete-looking utterances (same behavior as the Spanish profile's finalPunct).

### Explicitly NOT in the English profile
- No accent/diacritic map (English has none).
- No opening marks (¿ ¡ are Spanish-only).
- No slang/dialect "correction" — preserve `y'all`, `gonna`, dropped-g as spoken.
- No number-to-words normalization (out of scope for now — see note below).

## Implementation

- Add an `en` `LanguageProfile` alongside the existing `es` one. Reuse the profile
  interface; the English profile fills: sentence-capitalize = true, finalPunct =
  (match Spanish behavior), contractions list, whitespace cleanup. accents/openingMarks
  = none.
- The language dropdown selects which profile drives the proposals. Selecting English
  must produce English-appropriate proposals and zero Spanish-specific ones (no accent
  or ¿¡ proposals).
- Default profile can still be inferred from the `NV_[LANG]` filename if present;
  dropdown overrides.
- Everything else (waveform, CRUD, tokens, layout) is language-agnostic — untouched.

## Verification

- `npm run build` clean.
- Load a file, select **English** in the dropdown → proposals reflect English rules
  (capitalization, apostrophes), and NO accent/¿¡ proposals appear.
- `dont` → proposes `don't`; `i think` → proposes `I think`; double spaces collapse.
- Slang/dialect (`y'all`, `gonna`) is NOT flagged for correction.
- Switch back to **Spanish** → Spanish rules work exactly as before (no regression).
- All proposals remain proposals (nothing auto-applied).

## Out of scope (note for later — not now)

The official guidelines spend most of their normalization rules on **numbers written as
words** (e.g. "fourteen" not "14", "twenty twenty four" not "2024", "nine oh two one oh"
not "90210"), plus dates/money/units in words. This applies to ALL languages and is
likely a bigger source of manual editing than diacritics. Not part of this profile;
flagged as a high-value future feature to evaluate after the end-to-end timing test.

## Non-goals (unchanged)
- Single channel; Latin script only; offline; don't rewrite `lib/audio.ts`.
