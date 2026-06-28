# SegLST Workbench — Workspace layout reorg (lower half)

Reorganizes the workspace below the waveform so the most-used actions are reachable
**without vertical scrolling**. Today the optimization proposals (spelling / trim
start / trim end) sit *below* the text box and fall off-screen — the reviewer has to
scroll down to see and accept them. The fix: a grid layout that places each zone by
proximity to how often it's used.

Pure layout/CSS reorg — do NOT change any logic, the waveform render, or the mouse
gestures. Same locked rules apply.

## Guiding principle

Arrange the lower half as a **responsive grid (columns + rows)** in the space next to
and below the waveform. **No fixed pixel widths** — use grid/flex proportions so it
adapts to screen width. Nothing should require vertical scrolling to reach the common
actions. Positions below are relative intent, not exact measurements; fine spacing is
adjustable afterward.

## Target arrangement

**Above the waveform:**
- Move the **segment counter** ("Segmento N / total") and the **speaker email** to
  *above* the waveform (today they sit below it).

**Below the waveform (the grid):**
1. **Segment action row** (top, single line): Play, Play segment, Partir, Fusionar,
   Borrar, keyboard hints, IN/OUT, and the duration badge (e.g. `140 ms · <200`).
   Keep it on one line, no horizontal scroll.
2. **Noise-gap prompt** ("Hueco de ruido — ¿Tiene habla? → escribir texto"), when the
   segment is a noise gap: place it **above the token chips**.
3. **Token chips** (`[other-noise]`, `[inhale]`, …): directly **above the text box**
   (they're inserted into the text, so they belong adjacent to it).
4. **Text box**: left side, taking the bulk of the width.
5. **Optimization proposals** (Corregir ortografía / Recortar inicio / Recortar fin,
   each with its own "aceptar"): in a **column to the RIGHT of the text box**, fully
   **visible without scrolling**. This is the main pain point being fixed.
6. **Anterior / Siguiente**: at the bottom.

## Two segment modes — both must fit the grid

- **Speech segment:** text box (left) + proposals (right), chips above the text box.
- **Noise gap:** the noise-gap prompt sits above the chips; the big token palette /
  label picker occupies the text-box zone. The grid must handle both without breaking
  or introducing scroll.

## Constraints

- **No vertical scroll** to reach the common actions in either mode, at normal window
  sizes.
- **No horizontal scroll** at any width.
- Responsive: degrade gracefully on narrower windows (e.g. proposals can wrap below the
  text box on very narrow screens, but should be side-by-side at normal widths).
- Do NOT touch: waveform render, mouse gestures (resize / seek / drag-create), playback
  logic, or any data/CRUD behavior. CSS + DOM structure only.

## Verification

- `npm run build` clean.
- Speech segment: proposals visible to the right of the text box without scrolling.
- Noise gap: prompt above chips, label picker in place, no scroll.
- Counter + email appear above the waveform.
- No horizontal scroll at wide or narrow widths; layout reflows sensibly when narrowed.
- Editing, accepting proposals, chips, CRUD, playback all still work (nothing logical
  changed).
