# SegLST Workbench — Segment CRUD (split / merge / delete / create)

Follow-on after the continuous waveform view. Adds segment editing directly from the
waveform, like Gecko (plus merge, which Gecko lacks). Same locked rules: single
channel, Latin script, offline, don't rewrite the DSP.

The waveform already has two mouse gestures: **drag a boundary handle** = resize the
active segment; **click on empty space** = move the playhead. The new actions must not
collide with those.

---

## 1. Split (scissor button)

- Position the playhead with a click where the cut should go, then press a **scissor
  button** → splits the **active** segment into two at the playhead position.
- The two halves share the boundary at the playhead: first half = [start, playhead],
  second half = [playhead, end].
- **Text stays whole in the first half**; the second half starts empty. (No word-level
  timestamps exist, so text can't be auto-distributed — the reviewer moves text by hand
  with copy-paste.) Mark the second half as needing text (it's an empty speech segment
  — see the gray-until-typed state in §4).
- Only valid when the playhead is strictly inside the active segment (not at its edges).

## 2. Merge (button)

- A **merge button** joins the **active** segment with the **next** one.
- Result spans from the active segment's `start` to the next segment's `end`.
- Texts are concatenated with a single space.
- Disabled when the active segment is the last one.
- (Merging with the previous segment can come later; start with next only.)
- This is the plus over Gecko — for fixing segments that were split wrong without
  moving text around.

## 3. Delete (trash button)

- A **trash button** deletes the **active** segment.
- **Requires confirmation** (it's destructive — even with undo available).
- After delete, focus moves to a sensible neighbor (e.g. the next segment, or the
  previous if it was the last).

## 4. Create (drag on empty waveform)

- **Drag across an empty area of the waveform** (where no segment exists) to create a
  new segment spanning the dragged range. No button — direct drag, like Gecko.
- **The new segment is an empty speech segment** open for text entry — do NOT assume
  `[other-noise]`. The reviewer types whatever it is.
- **Gray-until-typed state (like Gecko):** a created-but-empty segment shows in **gray**
  on the waveform and minimap until text is entered; once it has text, it takes its
  normal base color. (Reuse / add a state flag on the segment for "empty, awaiting
  text".)

### Gesture collision — the important part
The create-by-drag must **only** trigger on empty space, never interfering with the
existing resize and seek:
- Drag **on a boundary handle** of the active segment → resize (existing behavior).
- Drag **over an empty area** (no segment under the cursor) → create new segment.
- Simple **click on empty space** → move playhead (existing behavior).
- wavesurfer Regions has `enableDragSelection` for drag-to-create; gate it so it only
  creates in gaps, and confirm it doesn't capture drags that start on a handle or
  inside an existing region.

---

## Data / behavior notes

- All four actions go through the existing history/undo system (snapshot before each).
- All four persist via the existing autosave.
- After any structural change (split/merge/delete/create), the segment count changes —
  make sure the minimap (`setLength`) and the waveform regions re-render correctly, and
  the "Segmento N / total" counter updates.
- Keep `editedTime` / state flags consistent so the colors are right.

## UI

- Scissor / merge / trash buttons live near the playback controls (Gecko-style row).
- Each disabled when not applicable (e.g. merge on last segment, split with playhead at
  an edge).

## Suggested build order (one per session, Plan Mode for create)

1. **Merge + Delete** — simplest (button-driven, no gesture conflict). Good warm-up.
2. **Split** — playhead + scissor; handle the empty-second-half text state.
3. **Create by drag** — the one with gesture-collision risk; do it last and carefully.
   Includes the gray-until-typed state.

Test each in `npm run dev` against a real file before committing.

## Non-goals (unchanged)

- Single channel; no multi-speaker. Latin script only. Offline / standalone.
- Don't rewrite `lib/audio.ts`.
