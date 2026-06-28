# PROGRESS — SegLST Workbench v2

Phase tracker for the v2 refactor. Full detail in `SegLST-Workbench-v2-SPEC.md`.
Work one phase per session. Update this file as items complete.

**Current focus:** Phase 0

---

## Phase 0 — Bug fixes ✓
- [x] Fix export: `session_id: meta.sessionId ?? speaker` in `exportSeglst`.
- [x] Deleted dead `src/workers/audio-worker.ts` (used `AudioContext` in worker
      scope, never imported anywhere). Decode-once rewire deferred to Phase 3.
- [x] `splitBySilence` now sets `needsTextReview: true` on each part. Minimap
      shows amber cell; toast warns after split; flag clears when user edits text.

## Phase 1 — Orthography → proposals + language profiles ✓
- [x] Stop mutating text at import (`parseSeglst` no longer calls `orthoFix`).
- [x] Ortho fixes surface as `.prop.orto` cards in `renderProps()` — same UX as
      audio proposals. Accept individually (click / Enter) or via "Aceptar todo".
- [x] `src/lib/profiles.ts`: `LanguageProfile` interface + `PROFILES` (es, en) +
      `inferProfile()` (reads `NV_ES` / `NV_EN` from filename).
- [x] English profile: whitespace collapse, capitalize, final period — near-empty, safe.
- [x] Spanish profile: accent map, ¿¡ opening marks, pero comma, dangling-end list.
- [x] Bracket-safe capitalize: leading `[tokens]` skipped in regex.
- [x] Language dropdown in header; auto-inferred on seglst load; persists in localStorage.

## Phase 2 — Inline token buttons ✓
- [x] Chip row always visible in speech mode (`tag-panel` shown, `tag-hint` hidden).
- [x] Chip click on speech segment → `insertTokenAtCursor()` inserts at textarea cursor
      with auto-spacing; undo supported via `snapshot()`.
- [x] `isTag` mode unchanged: chips show "on" state, click still calls `setTag()`.
- [x] `orthoFix` now extracts `[tokens]` as `\x00N\x00` placeholders before all rules,
      restores after — accent map, capitalize, and punctuation rules are fully opaque.

## Phase 3 — Full-file waveform (wavesurfer.js) ✓
- [x] wavesurfer.js v7 + regions plugin installed (7.12.8), bundled via Vite — ~90 kB gzip.
- [x] Decode once: `decodeWaveform` now returns `{ wav, peaks, duration }`. `computePeaks`
      and `analyzeEnvelope` both run on the same `Float32Array` from one `decodeAudioData` call.
- [x] Draggable region edges (`resize: true`, `drag: false`) write back to
      `segment.start/end` via `onBoundaryChange()` (`editedTime=true`, snapshot, log).
- [x] DSP overlay: `detectEdges` → thin orange (0.02s) non-resizable regions;
      `internalSilences` → purple shaded read-only regions. DSP prop cards unchanged.
- [x] Current segment region (green tint) auto-centered via `ws.seekTo(midProgress)`
      on every `goTo()`. Playback unaffected (playback is stopped before navigation).
- [x] Minimap kept alongside waveform. `src/ui/waveform.ts` deleted (hand-rolled canvas
      fully replaced). `interact: false` keeps ← → as the navigation spine.

## v2.1 Quick Wins ✓
- [x] Backchannel tokens: `[uh-huh]` and `[mmm]` added to `TAGS` in `constants.ts`.
- [x] Export card on last segment: `renderProps()` renders a `.prop.export-end` card
      when `cur === segments.length - 1`, calling `export()` on click.
- [x] Load prompt at startup: `#empty` replaced with two `.empty-zone` labels pointing
      to the existing hidden file inputs. Restore-from-autosave confirm unchanged.

## v2.1 Waveform zoom + separable trim proposals ✓
- [x] Zoom slider (`#zoom-bar`, range 0–150 px/s) wired to `ws.zoom()`. Appears only
      when WAV is loaded; resets to 0 on new file.
- [x] Auto-center shifts from segment midpoint to **end boundary** — the handle that
      needs manual attention is always in center view when zoomed in.
- [x] Trim card split into two independent cards: ⇤ "Recortar inicio" and ⇥ "Recortar fin".
      Each has its own accept action (`trimStart` / `trimEnd`). Enter key accepts the
      first card shown (start first, then end — natural two-keystroke flow).
- [x] `previewBatch()` counts each boundary separately (`trims` now = sum of individual
      boundary actions). `applyAllProposals` / `trimSegment` unchanged (still applies
      both at once in batch mode).
- [x] `trimEdges()` removed; `trimStart()` / `trimEnd()` replace it.

## v2.1 Playback model + deep zoom ✓
- [x] Three separate controls: Play/Pause `▶`/`⏸` (Space, resumes from playhead),
      Play Segment `↺` (always seeks to `s.start`, stops at `s.end + 50ms`),
      Play File `≫` (plays from current `audio.currentTime` to EOF, no stop timer).
- [x] Bug fixed: Space no longer restarts from segment start when resuming a paused
      playback — `playPause()` calls `audio.play()` with no seek.
- [x] `audio.ended` event wired to `stopPlayback()` so state cleans up on natural EOF.
- [x] Zoom range: slider positions 1–100 → log-scale 1–2000 px/s
      (`Math.round(Math.pow(2000, v / 100))`). At slider=100, 2000 px/s shows ~400ms
      in an 800px viewport — enough precision for sub-10ms boundary inspection.

## v2.1 Auto-flag: segmentos con audio fuera del borde ✓
- [x] `escapesBoundary(wav, start, end)` en `lib/audio.ts`: comprueba energía
      `floor+6 dB` en ventana 40–300ms fuera de cada borde. Reusa `segPeakDb`.
- [x] Minimap: celdas naranjas (`.escape`, `#f5a04a`) para segmentos con fuga,
      con prioridad `needs-review > flag > escape > silent > tag > edited`.
- [x] Wavesurfer: región del segmento activo en tinte naranja (`rgba(184,99,26,0.15)`)
      cuando `escaped=true`; verde cuando no.
- [x] Header: botones ⚑← / ⚑→ (`#btn-escape-prev` / `#btn-escape-next`) con badge
      de conteo. Disabled cuando no hay wav o no hay segmentos con fuga.
- [x] Shortcuts: `]` → siguiente con fuga, `[` → anterior con fuga.
- [x] El flag se recomputa en cada `updateView()` — no persiste en el schema.

## Etapa 1 — Waveform continua: render de alta resolución + regla de tiempo ✓
- [x] `decodeWaveform` retorna `channelData: Float32Array` (full-res ~4M samples)
      en lugar de `peaks` (5 000 puntos coarsos). `computePeaks` eliminado.
- [x] `WaveSurferView.init()` acepta `channelData: Float32Array`; pasa `peaks: [channelData]`
      a wavesurfer — Float32Array directo, sin copiar. Altura 96→128.
- [x] Eliminados `barWidth`, `barGap`, `barRadius` → render filled/continuous en lugar de barras.
- [x] `TimelinePlugin.create({ height: 20 })` agregado — regla de tiempo bajo la onda.
- [x] `app.ts` actualizado para pasar `channelData` en lugar de `peaks`.

## Etapa 2 — Todas las regiones + highlight activo ✓
- [x] `SegmentRegion` interface exportada desde `wavesurfer-view.ts`.
- [x] `showSegment()` recibe `all: SegmentRegion[]` + `cur: number` en lugar de
      `start`/`end` individuales. Silencios y trim markers solo para el activo.
- [x] Todos los segmentos no-activos dibujados como regiones de fondo
      (`drag: false, resize: false`), coloreados por estado.
- [x] Segmento activo pintado encima (`rgba(44,133,87,0.30)` verde o
      `rgba(184,99,26,0.30)` naranja si `escaped`), con `resize: true`.
- [x] `regionColor()` en `app.ts` mapea el estado de cada segmento a RGBA
      (misma prioridad que el minimap: needs-review > flag > escape > silent > edited).
- [x] `flagged` importado de `lib/format` para detectar segmentos < 200ms.

## Etapa 3 — Ajustes de UI: flujo de carga, botones de play, ancho del waveform ✓
- [x] Flujo de entrada: `#work` solo se revela cuando AMBOS archivos están listos.
      `onSeglstFile()` no llama `showWork()` si no hay wav. `onWavFile()` llama
      `showWork() + initWave()` al terminar el decode, solo si hay segmentos cargados.
      `channelData` / `decodedDuration` guardados para cuando el seglst llega después.
- [x] Botones de play: `▶ Play` / `⏸ Pausa` (pill, antes círculo), `↺ Play segment`
      (pill con texto). 5 puntos de `textContent` en `app.ts` actualizados.
- [x] Waveform a 80vw: `#wave-wrap`, `#zoom-bar`, `#wave-empty` movidos fuera del
      `.card` a un nuevo `#wave-block` hermano. `.stage` ahora `flex-direction: column`.
      `#wave-block { width: 80vw; max-width: 100% }` — sin márgenes negativos,
      sin riesgo de scroll horizontal.

## Etapa 3 + Auto-follow — Click-to-seek y seguimiento de segmento ✓
- [x] Click-to-seek: quitado `interact: false` de `WaveSurfer.create()`. Click sobre
      onda vacía mueve `audio.currentTime`; handles de borde no se pisan (capturan
      `mousedown` y detienen propagación). Play/pausa reanuda desde posición clickeada.
- [x] Auto-follow: `timeupdate` listener en `bindEvents()`. `onTimeUpdate()` escanea
      segmentos cada ~250ms; cuando `audio.currentTime` cruza al siguiente segmento,
      llama `advanceTo()`. Skip si `stopTimer !== null` (modo playSegment), si no hay
      foco en textarea y si no cambia el segmento.
- [x] `advanceTo()`: actualiza `cur` y `playing` sin llamar `stopPlayback()`; llama
      `updateView(false)` para no mover el playhead de wavesurfer.
- [x] `showSegment()` con nuevo parámetro `seek = true`: `ws.seekTo()` solo cuando
      `seek` es true (navegación manual). Durante auto-follow, wavesurfer autoScroll
      sigue al playhead de forma nativa.
- [x] Bug fix: `updateView()` ahora usa `'▶ Play'`/`'⏸ Pausa'` (antes revertía al
      icono solo en cada navegación).

## v2.2 — 6 ajustes de UI/interacción ✓
- [x] Cambio 1: `markLoaded(lblSeglst)` ya existía (app.ts:218); verificado sin cambio.
- [x] Cambio 2: 6 botones del header (`⚑←`, `⚑→`, Aceptar todo, Deshacer, Registro,
      Exportar) inician con `hidden`. `showWork()` los revela cuando ambos archivos
      están listos — cubre flujos onWavFile, onSeglstFile y tryRestore.
- [x] Cambio 3: Botón `>>` (`btn-play-all`) eliminado del HTML. `btnPlayAll` removido
      de `els`, binding y `playFile()` eliminados. `▶ Play` = `playPause()` (toggle
      desde playhead, sin stop-timer). Space sin cambio.
- [x] Cambio 4: `showSegment()` centra waveform en `active.start` en lugar de
      `active.end` al navegar. Space reproduce desde el inicio del segmento.
- [x] Cambio 5: `.wavewrap [data-resize] { background: transparent !important }` —
      handles de resize invisibles pero funcionales (cursor ew-resize conservado).
- [x] Cambio 6: Waveform height 128 → 256 px.

## Segment CRUD ✓
- [x] §2 Merge (⊞ Fusionar): une segmento activo con el siguiente. Deshabilitado en el último.
- [x] §3 Delete (🗑 Borrar): elimina con confirmación. Foco pasa al vecino correcto.
- [x] §1 Split (✂ Partir): parte el activo en el playhead. Primera mitad conserva texto;
      segunda nace vacía con `needsText: true` (gris). Botón activo solo cuando el
      playhead está estrictamente dentro del segmento; listener `seeked` lo actualiza.
- [x] §4 Create by drag: arrastrar en zona vacía crea segmento nuevo con `needsText: true`
      (gris). Colisión resuelta: `_dragBlocked` (capture-phase) mata rubber-band cuando
      el drag empieza sobre un segmento existente. `_dragActive` distingue drag de
      llamadas programáticas a `addRegion()`.
- [x] Estado unificado: `needsText` (gris) = "vacío, falta texto" → Split segunda mitad
      + drag-create. `needsTextReview` (ámbar) = "texto redistribuido automáticamente,
      revisar" → `splitBySilence` propuestas.

## Phase 4 — Tests
- [ ] Add Vitest.
- [ ] `orthoFix` per profile, incl. bracket-token safety.
- [ ] `detectEdges`, `internalSilences` with synthetic envelopes.
- [ ] `splitBySilence` word-distribution behavior.
- [ ] `exportSeglst` — the `session_id` fix.

---

## Notes / decisions log
- (add notes here as you go — surprises, deviations, things to revisit)
