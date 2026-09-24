# CLAUDE.md: Kampung

## What this is
Kampung is a first-person life-sim that runs in the browser. It is set in **Kampung Sukamaju, RT 04 / RW 07**, a small Indonesian urban village. The player is **Raka, 27**, a freelance designer who has moved back into his late grandmother's house on Gang Mawar. The core of the game is social interaction: 24 named residents plus ambient passers-by. The game has to hold 60 FPS on a mid-range laptop with integrated graphics.

**`docs/design-spec.md` is the source of truth.** Read it before starting any phase. If it and this file disagree, the spec wins, except for the "Current state" notes below.

## Decisions already made (don't reopen unless asked)
- **Setting:** an Indonesian kampung with narrow *gang* lanes, warungs, a musholla and a pos ronda.
- **Player:** a fixed protagonist. There is no appearance editor, and his face is never shown.
- **Romance:** not in v1. Keep the commented hook in the NPC model.
- **Dialogue:** trait-flavoured templates behind a `DialogueProvider` interface. An LLM provider can plug in later. Game logic never lives in the provider.
- **Language:** English UI and dialogue, with Indonesian terms (Pak, Bu, Mas, Mbak, warung, gang…) and a glossary.

## Build phases (spec §12)
1. **Foundation: DONE.** Originally `prototype/index.html`; now migrated to Vite + TypeScript in `src/` (awaiting the user's side-by-side check before Phase 2).
2. NPC core: character generator, waypoint graph and A*, schedule-driven movement for 24 residents, simulation LOD, debug overlay. Verify 60 FPS.
3. Conversation: interaction prompt, dialogue panel, topics, relationships, memories, Contacts page.
4. Activities and economy.
5. Living world: NPC–NPC chats, gatherings, gossip, invitations, ambient NPCs, phone.
6. Depth: story arcs, events (17 Agustus), milestones, reputation, house restoration.
7. Polish: save/load, settings, audio, tutorial, balancing.

Do one phase at a time. At the end of each phase, check it and stop for the user's go-ahead.

## Current state (Phase 1, Vite + TypeScript)
The game lives in `src/` and builds with Vite (`npm run dev`, `npm run build`). `three` is pinned to 0.169.0 from npm, matching the prototype's r169. `prototype/index.html` is the original single-file build (Three.js from jsDelivr, no build step). It is kept only for comparison; don't develop in it.

**Module map.** `src/main.ts` wires input and UI, builds the world, and runs the loop.
- `core/`: `util` (seeded RNG `R`, helpers), `settings`, `state` (`S`), `time` (clock, `EVENTS`, sleep), `player` (movement, camera), `collision` (colliders + spatial hash), `input`.
- `render/`: `context` (renderer, scene, camera, fog), `batch` (instancing and the `B`/`C`/`blob` helpers), `textures`, `sky`, `lighting` (`KF`, `updateEnv`), `signs`, `quality`.
- `world/`: `layout` (all layout data, palettes, `ZONES`), `houses`, `trees`, `landmarks`, `streets`, `boundaries`, `pasar`, `ground`.
- `ui/`: `hud`, `map`, `overlays`.

**Determinism.** The layout comes from `mulberry32(20260924)`. The build order in `main.ts` (blocks → landmarks → block trees → streets → boundaries → pasar → ground) and the order of `R()` calls inside each builder must not change, or the kampung changes. `Math.random` is only used for cosmetic noise (textures, stars, hill rotation, sign grain).

**World layout.** Units are metres. +z is south (toward the entrance) and −z is north (toward the kali and sawah).
- Main road `Jalan Sukamaju`: x ∈ [-3, 3], z ∈ [-60, 60].
- East–west gangs at z = -32 (Melati), -8 (Kenanga), 16 (Mawar) and 38 (Anggrek). North–south gangs at x = -30 (Dahlia) and 30 (Cempaka). Every gang is 2.4 m wide (`GH = 1.2` half-width).
- Blocks are `XB × ZB`. Frontage per x-band is in `FRONT`. Houses are generated in rows along block edges that face a road (`genRow` → `buildHouse`), with a teras setback of 1.5–2.2 m.
- Landmark footprints are in `RESERVED`: warung, warkop, musholla, balai, ronda, lapangan, raka, ojek, kebun and gateW. House generation skips these areas.
- Named areas (`ZONES`) drive the HUD location label. The same data drives the map (M).
- The kali (canal) runs across z ∈ [-60, -55.5] with a bridge on the jalan. Sawah and a mountain lie to the north. There are neighbouring rooftops outside the east and west walls, and a main road with a row of shophouses (ruko) outside the south gate.

**Rendering.** Almost everything is instanced through a small `Batch` class:
- `solid` for boxes, `roofs` (gable prism), `cyl`, `crowns`, `blobs`, `cones`.
- `lit` holds windows and storefronts that glow at night, using MeshBasic whose colour is driven by time.
- `bulbs`, and `flags` for the bunting.
- The pasar pagi has its own batches under a `pasar` group, toggled by time of day.

Colours are per-instance. The current view draws about 22–35 calls and about 67k triangles.

**Colliders.** A flat array of AABBs (`cols`) with an `on` flag, used for the pasar stalls, indexed by a uniform spatial hash (4 m cells) in `core/collision.ts`. `query()` returns candidate indices in insertion order, so resolution order matches the old linear scan. Use `hit`, `overlapsAny` and `collide` rather than scanning `cols`. The player is a circle of radius 0.32 pushed out of the boxes, with 2 substeps per frame.

**Time.** `S.time` is in minutes since midnight. The day runs from 06:00 to 26:00 (02:00), then an auto-sleep moves the player to Raka's teras. The base rate is 1.2 game-minutes per real second (24 h ≈ 20 min). Holding T gives 60×, and [ / ] jumps an hour. Lighting uses keyframes (`KF`) for the sky, the sun/moon directional light and the hemisphere light. The shadow camera follows the player. Adzan and other events are listed in `EVENTS`.

**Settings.** Quality Low/Med/High controls pixel ratio, shadow map size and fog distance. Sensitivity, head bob and the debug overlay are also settings. They are saved in `localStorage` wrapped in try/catch.

**Input.** Pointer lock, with a drag-to-look fallback. Touch uses a left-side joystick and right-side look. Keys: M map, Esc pause, F3 or backtick for the perf overlay, H hide hints.

**Known gaps and issues**
- The `infill` step, meant to add back-row houses inside blocks, places nothing: interiors are too narrow once the row houses are in. Trees fill those spaces instead.
- Buildings can't be entered yet. The spec calls for separate interior scenes loaded with a fade.
- There are no NPCs, no audio, no save of player position or time, and no rain.
- The prototype's claude.ai artifact hot-reload hook (`window.claude.hot`) was dropped in the migration; it did nothing outside claude.ai.
- It has only been tested in headless Chromium with SwiftShader (about 30 FPS in software). It still needs a check on real hardware.

## Vite + TypeScript migration: DONE, pending the user's check
The prototype was split into the modules above with `three` from npm, the same seeded RNG, and a spatial hash for colliders. Behaviour and visuals are meant to be identical to `prototype/index.html`. Wait for the user to confirm that before starting Phase 2.

## Working conventions
- Run `npm run build` (typecheck + build) before committing. Format with `npm run format`.
- Performance budget (spec §9): < 150 draw calls, < 300k triangles, < 8 ms JS per frame. Check with F3.
- Don't load a separate model per NPC. Use procedural low-poly characters with a shared geometry and instanced or recoloured materials.
- Social logic ticks at 1 Hz. Only near NPCs (< 40 m) get a full per-frame update.
- Wrap all `localStorage` access in try/catch.
- Keep the visual language: flat-shaded low-poly, a warm tropical palette, Shrikhand for display text, Figtree for UI.
