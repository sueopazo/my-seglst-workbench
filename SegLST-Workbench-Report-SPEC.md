# SegLST Workbench — Downloadable QA report (.md)

Adds a downloadable per-file report (Markdown) summarizing review effort and changes,
to inform project managers about where corrections happen and how long manual review
takes. Reuses the effort/AHT metric model from the standalone transcript comparator.

Same locked rules: offline; no sensitive data in output (no real names/emails/client);
don't rewrite the DSP.

## What the report contains

### 1. Time
- **Total elapsed time** for the file (from the existing per-file timer).
- Formatted mm:ss (or h:mm:ss).

### 2. Effort metrics — diff (input vs output)
Compare the original input `.seglst` against the corrected output (the comparator
model), computed at export/report time:
- Segment counts: unchanged / modified / added / removed.
- Word-level: words added, words removed.
- **Edit rate %** (how much of the content changed).
- **New text %**.
- Speaker-label changes (if any).
- Overall **effort level**: Light / Moderate / Heavy (same thresholds as the comparator).

### 3. Change detail — changelog
From the in-app change log (what the reviewer actually did):
- Count by action type: boundary adjustments, spelling proposals accepted, segments
  created / split / merged / deleted, manual text edits.
- Optionally a compact list of the logged changes (the existing "Registro" entries).

### 4. Effort-level explanation (transparency)
At the bottom of the report, include a short plain-language explanation of HOW the
effort level is computed — so a manager reading it doesn't see "Heavy" as an arbitrary
label.

**Use these calibrated thresholds** (the reviewer adjusted them against real AHT
experience — port the diff logic from the comparator but use THESE cutoffs):
- `editRatio` = (words added + words deleted) / total original words
- `addedWordsRatio` = share of text that is newly added
- **Light:** editRatio < 0.20 AND addedWordsRatio < 0.20
- **Moderate:** editRatio < 0.50  (i.e. 0.20–0.49)
- **Heavy:** editRatio >= 0.50
- **Override:** if addedWordsRatio > 0.30, level = Heavy regardless
- (Segment alignment uses a similarity threshold of 0.34 to decide modified-vs-new —
  port this from the comparator too so the diff counts match.)

Requirements for the explanation text:
- State these real inputs and thresholds (the actual numbers above), 2-4 lines, neutral.
- Keep the comparator's honest caveat: thresholds are indicative and calibrated against
  real AHT experience.
- Generate it from the same constants used in the calc (don't hardcode a second copy
  that could drift).

### Report format
- A clean Markdown document with a header (file identifier — use the seglst filename,
  NOT any personal/client data), the time, then the sections (diff metrics, changelog
  summary, effort-level explanation).
- Human-readable, manager-facing: clear labels, the effort level prominent.
- No personal data, client names, or project identifiers anywhere in the output — use
  the filename as-is only if it's already the generic identifier; otherwise a neutral
  label.

## Where / how to download

- **A "Download report" button always available**, next to the existing Export control.
- **On the last segment**, alongside the existing "download your new file" card, add a
  second card "download your report".
- Offer three choices where it makes sense: **file only / report only / both**.
- The report is generated on demand (at click), computing the diff fresh against the
  loaded input.

## Implementation

- Add a `lib/report.ts` (pure logic) that:
  - takes the original input segments + current segments + elapsed time + changelog,
  - computes the diff metrics (reuse/port the comparator's LCS-based segment/word diff
    and effort thresholds),
  - returns a Markdown string.
- Keep it in `lib/` so it's testable and DOM-free; the UI just triggers download of the
  returned string as a `.md` file.
- The diff logic mirrors the validated comparator (segment-level + word-level LCS,
  edit-rate, effort level) — port it, don't reinvent.

## Tests (extend Vitest)
- `report.ts`: given a small input + edited output, the diff counts (modified/added/
  removed, words added/removed, edit rate, effort level) are correct.
- Effort-level thresholds produce Light/Moderate/Heavy at the expected boundaries.
- The generated Markdown contains the time and both sections; contains no `@`-emails or
  client identifiers (defensive check on the header label).

## Verification
- `npm run build` clean; `npm test` passes.
- Review a file, click "Download report" → a `.md` downloads with: total time, diff
  metrics (matching what the comparator would produce on the same two files), and the
  changelog summary.
- Last-segment cards offer file / report / both.
- No personal/client data in the output.

## Non-goals (unchanged)
- Single channel; Latin script only; offline; don't rewrite `lib/audio.ts`.
- Per-segment timing is out of scope — only total elapsed time.
