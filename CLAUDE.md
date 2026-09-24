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
1. **Foundation: DONE.** Originally `prototype/index.html`; migrated to Vite + TypeScript in `src/` (the user confirmed it matches).
2. **NPC core: DONE.** Character generator, waypoint graph and A*, schedule-driven movement for 24 residents, simulation LOD, debug overlay. The user has run it on a Mac.
3. **Conversation: DONE** (the user confirmed it, including the smoother reply-to-choices transition). Interaction prompt, dialogue panel, topics, relationships, memories, Contacts page.
4. **Activities and economy: DONE, awaiting the user's check.** Stats, money, bag, shops, warung shift, freelance work, cooking, jogging, gardening, gifts.
5. Living world: NPC–NPC chats, gatherings, gossip, invitations, ambient NPCs, phone.
6. Depth: story arcs, events (17 Agustus), milestones, reputation, house restoration.
7. Polish: save/load, settings, audio, tutorial, balancing.

Do one phase at a time. At the end of each phase, check it and stop for the user's go-ahead.

## Current state (Phase 4, Activities and economy)
The game lives in `src/` and builds with Vite (`npm run dev`, `npm run build`). `three` is pinned to 0.169.0 from npm, matching the prototype's r169. `prototype/index.html` is the original single-file build (Three.js from jsDelivr, no build step). It is kept only for comparison; don't develop in it.

**Module map.** `src/main.ts` wires input and UI, builds the world, and runs the loop.
- `core/`: `util` (seeded RNG `R`, helpers), `settings`, `state` (`S`), `time` (clock, `EVENTS`, sleep), `player` (movement, camera), `collision` (colliders + spatial hash), `input`.
- `render/`: `context` (renderer, scene, camera, fog), `batch` (instancing and the `B`/`C`/`blob` helpers), `textures`, `sky`, `lighting` (`KF`, `updateEnv`), `signs`, `quality`.
- `world/`: `layout` (all layout data, palettes, `ZONES`), `houses`, `trees`, `landmarks`, `streets`, `boundaries`, `pasar`, `ground`.
- `ui/`: `hud`, `map`, `overlays`.
- `dialogue/`: `types` (`DialogueProvider`, `DialogueContext`), `lines.json` (all template text), `template` (`TemplateDialogueProvider`).
- `social/`: `social` (friendship rules, etiquette, cooldowns, memories, what Raka has discovered).
- `ui/` also has `dialogue` (the dialogue panel), `contacts` (the phone: Contacts, Bag, Skills, Glossary), `portrait`, `panel` (the general activity menu) and `activities` (shops, home, garden, warung shift).
- `game/`: `items` (catalogue, gift preferences, shop stock, recipes), `stats` (energy, mood, money, skills, bag, jogging), `interact` (E targets: residents and things), `garden` (Raka's planters), `actions` (animated pay, take, sit, eat and stand sequences; seat finding).
- `render/hands.ts`: Raka's first-person hands and the items he holds. `npc/vendors.ts`: pasar stall-keepers.
- `npc/`: `types` (the spec §8.2 NPC model), `roster` (the 24 residents and their ties), `schedule` (authoring helpers), `appearance` (character generator), `characters` (instanced renderer and poses), `places` (POIs, slots, homes), `navgraph` (lanes, A*, paths), `npcs` (runtime), `debug`.

**Determinism.** The layout comes from `mulberry32(20260924)`. The build order in `main.ts` (blocks → landmarks → block trees → streets → boundaries → pasar → ground) and the order of `R()` calls inside each builder must not change, or the kampung changes. `Math.random` is only used for cosmetic noise (textures, stars, hill rotation, sign grain). NPC code never calls `R()`: it has its own `mulberry32(7331)` and a `hash(a, b)` for per-day jitter.

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

**Input.** Pointer lock, with a drag-to-look fallback. Touch uses a left-side joystick and right-side look. Keys: E talk, Tab phone, M map, Esc pause, F3 or backtick for the perf overlay (on a Mac F3 is taken by the system, so use backtick), H hide hints. `S.dialog` and `S.phone` are menu states like `S.map`; `inWorld()` and `inMenu()` in `core/state.ts` cover them all.

**NPCs.** 24 residents in 15 households (`npc/roster.ts`), following the spec §8.1 roster, with two feuds in `TIES`: Udin vs Hartono (motorbike noise) and Wati vs Endang (an unpaid loan). Each resident is a spec §8.2 `NPC`, plus a runtime `Resident` in `npc/npcs.ts`.
- **Places.** A POI has an entry chain (its first point lies on a lane) and slots with a tag, pose (`stand`/`sit`/`squat`/`hidden`), seat height, facing, `via` points and an approach point. Slots are claimed one NPC at a time. `hidden` slots (doors, the two `away` points outside the gapura) are shared. When every slot is taken, the NPC stands a little way back. Schedule locations are `<group>.<tag>`, e.g. `warung.bench`, `home.teras` or `away`. `home` resolves to the household's house: the free row house whose door is nearest `HOUSEHOLD_SITES`. Homes whose teras has no bench get two plastic stools, added in `initWorldNav()` before the batches are built.
- **Graph.** Lane centrelines (jalan, gangs, kali path, the road outside the gapura), split at crossings and where POI entries join. It has about 66 nodes, because only NPC homes and landmarks attach. A* runs over lanes only, and a path is slot → via → entry → lanes → entry → via → approach. NPCs don't collide with static colliders; the paths are laid out to be clear. A headless check of every lane, entry and approach segment found nothing blocked except the gate collider (NPCs walk out through it) and a morning pasar stall that touches the mouth of Gang Anggrek.
- **Schedules.** `week({weekday, fri, sat, sun, jumatan, ronda})` builds 7 days of blocks covering 06:00–26:00. Jumatan and ronda nights are overlays. An NPC leaves when `now ≥ next.start − travel − jitter`, and travel is estimated from the actual path. Movement is driven by game time (1.45 m/s at the base clock, so crossing the kampung takes about 90 game-minutes). After a new day or a time jump of more than 30 game-minutes, `resync()` places everyone from their schedule; a trip that should already be underway starts partway along its path.
- **LOD.** Near (< 40 m): every frame, with sidestepping (NPCs and player), keep-left lane offsets, head turns toward the player and gestures. Mid (40–80 m): 10 Hz. Far (> 80 m): 1 Hz, hidden past `min(120, fog.far)`. NPCs indoors or away aren't drawn. The schedule tick runs at 1 Hz, or every game-minute while fast-forwarding. Nearby NPCs are circles the player can't walk through (`collision.circles`).
- **Rendering.** `Crowd` draws all residents with 6 InstancedMeshes (boxes, torso, icosahedra, hair cap, frustum, cylinder). That is 6 draw calls, plus 6 in the shadow pass, whatever the NPC count. Parts are posed procedurally (thigh and shin, arms, head group), and unused parts sit at a zero matrix.
- **Debug.** F3 shows update and render CPU ms, NPC counts per tier and NPC sim ms, plus name tags with each NPC's activity. G (with F3 on) draws the waypoint graph and live paths. With F3 on, the map (M) shows every resident. In dev builds `window.__kampung` exposes state for headless scripts.

**Conversation.** Raka's late grandmother is **Mbah Minah**; the kampung remembers her.
- **Prompt.** `talkTarget()` picks the nearest visible resident within 2.5 m who is inside a cone around the camera's forward direction. The prompt says "Say hello" before the first meeting and "Talk to <proper name>" after. E opens the panel, and there's a Talk button on touch.
- **Panel.** It shows a portrait, name, occupation, stage chip and 5 hearts (20 friendship each). The typewriter runs on wall-clock time; E, Space, Enter or Esc skips it. Choices use keys 1–6 or clicks. Esc goes back, or says goodbye. The camera turns to the NPC's head, and the NPC (`Resident.talking`) stops walking, faces Raka if standing, and gestures while speaking. Each exchange takes 3 game-minutes; the rest of the time the clock is paused.
- **Flow.** Intro line on first meeting (per-NPC in `lines.json`), or a greeting based on stage, memory, "again today" or "busy walking". Then an etiquette choice once a day: the proper title (`properName()`: Pak/Bu/Mas/Mbak/Dek/Ustadz/Pak RT) or a bare first name, which costs −3 with elders (45+, Pak RT, Ustadz), is fine with under-25s and is flat with peers. Main menu: Chat… (12 topics in pages of 5, marked ♥/✕ once known), Ask about, Compliment, Joke around… (joke/tease), Hear the gossip, Goodbye. Gift, Invite and favours wait for Phases 4–6.
- **Rules** (`social/social.ts`). Liked topic +4 (+5 in a good mood), neutral +1, disliked −3. The same topic within 2 days is −1 (−2 if grumpy). Gains are capped at +10 per NPC per day. After 7 days without talking, friendship drops 1 a day, down to 0. Ask reveals one fact a day, in order: a like, birthday, a dislike, story 1 (acquaintance+), more likes, story 2 (friend+), more dislikes. Compliments and jokes depend on traits, stage and mood. Tease needs friend stage (or acquaintance with a cheerful or sporty NPC), otherwise −4/−5. Gossip reveals how they feel about another resident, strongest feelings first; NPCs who dislike gossip refuse. Stages are at 10/35/60/80. Memories (last 10) feed next-day greetings.
- **Provider.** `ui/dialogue.ts` builds a `DialogueContext` (kind + outcome chosen by game logic) and awaits `provider.getLine()`. Swap `provider` for an LLM-backed one later; it only returns text. `lines.json` has 103 keys and 378 lines, at least 5 variants per common line, with `traits` or `mood` tags for flavoured variants.
- **Phone** (Tab). Contacts lists met residents by friendship. It shows the portrait (`ui/portrait.ts`, drawn from `AppearanceParams`), stage, hearts, known likes and dislikes, birthday, housemates, ties learned through gossip, and the last memories. Glossary lists about 40 terms.
- Relationship state lives in memory only; saving is Phase 7.

**Activities and economy** (spec §6–7).
- **Stats** (`game/stats.ts`). Energy and mood run 0–100, money is in rupiah (start Rp 150.000). Being awake costs 1.2 energy per game-hour, mood drifts toward 50, and running costs energy by distance (less with Fitness). At ≤12 energy Raka can't run; at 0 he walks slower. Sleep restores 14 energy per hour slept (`sleepRestore`), and so does eating. Skills (Cooking, Fitness, Gardening, Charisma, Music) run 1–10 with XP thresholds in `LEVELS`, and `practise()` toasts level-ups. The HUD shows energy and mood bars and money under the clock.
- **Items** (`game/items.ts`). 44 items in 8 categories: drink, snack, meal, ingredient, produce, seed, dish, gift. `PREFS` gives each resident's loved and disliked items; `giftReaction()` adds derived likes (home cooking, food lovers, kids and snacks, gardeners and seeds, elders and produce). `STOCK` sets what each vendor sells, and `EAT_HERE` marks what's eaten on the spot. `RECIPES` lists 6 dishes, with Cooking-level gates.
- **Interaction** (`game/interact.ts`). E picks whichever is nearest the centre of view: a resident (talk) or an `Interactable` with a reach and a `label()` that returns null when it's unavailable. Things registered in `ui/activities.ts`: the warung counter (while Bu Sri or Dimas is there), each pasar pagi stall (while the pasar is up), Warkop Berkah (Pak Slamet), the bakso cart (Mas Joko), Raka's front door, and the 3 garden planters.
- **Panel** (`ui/panel.ts`). A general menu in the dialogue card style: numbered rows (keys 1–8, 9 for the next page, Esc/0 back) and a footer with money, energy and mood. `S.panel` is a menu state.
- **Activities.** Shops: buy into the bag, or eat on the spot at the warkop and bakso cart. Home: freelance work (1/2/4 h for Rp 35k/75k/160k at −8 energy per hour, 06:00–23:00), cook (ingredients → 2–3 portions, 1–5★ quality from Cooking level plus luck), rest 1 h (+15), nap 2 h (+25, after 11:00), sleep (after 20:00; reuses `core/time.sleep`). Warung shift: once a day, 07:00–20:00, while Bu Sri is there. It's a 45 s match-the-order mini-game paying Rp 25k plus Rp 2k tips per customer, with Charisma XP and friendship with Bu Sri. Garden (`game/garden.ts`): 3 planters on Gang Mawar in front of Raka's pagar. Plant a seedling, water once a day, and a plant grows a day only if it was watered the day before; chilli 4 days, tomato 5, kemangi 3. Harvest gives 2+ produce. Jogging: run ≥200 m and stop, and you get a toast, Fitness XP and a mood bonus (bigger before 09:30). Time-skipping activities fade the screen (`passTime`), and NPCs resync after long skips.
- **Gifts** (in conversation, Give a gift…). One gift per resident per day, not counted against the daily friendship cap. Loved +8, liked +4, neutral +1, disliked −3. Home cooking (berbagi) adds +3, or +4 at 4★+. Reactions Raka has seen are shown in Contacts and in the gift list. Gifts leave memories that feed next-day greetings. The conversation menu is Chat…, Ask, Banter… (compliment, joke, tease), Give a gift…, Hear the gossip, Goodbye. Positive exchanges train Charisma, which slightly improves jokes and teasing.
- **Phone.** Tabs are Contacts, Bag (eat or drink from here), Skills (vitals and skill levels) and Glossary.
- **Sellers must be present.** `seller()` in `ui/activities.ts` decides who is minding each shop: Bu Sri or Dimas at the warung, Pak Slamet at the warkop, Mas Joko at the bakso cart, and a stall-keeper at each pasar stall. With nobody there, the prompt doesn't appear and a sale can't happen. While the shop menu is open, its keeper is held at the counter (`Resident.talking`); the panel's `onClose` releases them. Pasar stall-keepers (`npc/vendors.ts`) are non-resident figures drawn in extra Crowd slots. Each sits on a stool at one end of its stall facing the jalan, appears only while the pasar is up, and reaches across when serving.
- **Animated actions** (`game/actions.ts`). `S.acting` blocks movement, input and mouse-look while a sequence plays; Esc skips to the end with every effect applied. Raka's hands (`render/hands.ts`) hang off the camera and draw over the world (no depth test). Each item has a low-poly look (cup, drink bag, bowl, plate, rice wrap, fruit, bottle, packet, bunch, paper, ball).
  - Buying: Raka turns to the seller, pays a note with the left hand, and the seller reaches over (`serve()` / `serveAt()`) as the item comes into the right hand. Then it goes into the bag and the shop reopens.
  - Eat-here food and drink (warkop, bakso): Raka sits on the nearest free seat within 4.5 m (warkop benches and stools, the pos ronda by the bakso cart), eats or sips, then stands. Seats he uses are claimed with `PLAYER` (−2) so NPCs leave them alone.
  - From the bag: meals and home cooking are eaten sitting if a seat is within 3 m (warung bench, his own teras bench), otherwise standing. Snacks, drinks and fruit are always standing.
  - Bites shrink food; bowls and cups stay. `finishEating()` applies energy and mood, adds 5 or 15 game-minutes, and toasts.

**Known gaps and issues**
- The `infill` step, meant to add back-row houses inside blocks, places nothing: interiors are too narrow once the row houses are in. Trees fill those spaces instead.
- Buildings can't be entered yet. The spec calls for separate interior scenes loaded with a fade.
- No ambient NPCs, no audio, no saving (relationships, money and the bag reset on reload), and no rain. Futsal, fishing, guitar, ronda duty and house restoration aren't playable yet (Phases 5–6). NPCs don't start conversations yet (Phase 5: teras call-outs, invitations).
- NPC–NPC chats and gatherings are Phase 5. Residents only share places by schedule. Kerja bakti, arisan and pengajian aren't scheduled yet (Phase 6).
- Walking takes real game time, so short blocks after a long walk can arrive late or be skipped. The schedules are written with that in mind; keep it in mind when adding blocks.
- The prototype's claude.ai artifact hot-reload hook (`window.claude.hot`) was dropped in the migration; it did nothing outside claude.ai.
- It has only been tested in headless Chromium with SwiftShader (about 30 FPS in software). It still needs a check on real hardware.

## Working conventions
- Run `npm run build` (typecheck + build) before committing. Format with `npm run format`.
- Performance budget (spec §9): < 150 draw calls, < 300k triangles, < 8 ms JS per frame. Check with F3.
- Don't load a separate model per NPC. Use procedural low-poly characters with a shared geometry and instanced or recoloured materials.
- Social logic ticks at 1 Hz. Only near NPCs (< 40 m) get a full per-frame update.
- Wrap all `localStorage` access in try/catch.
- Keep the visual language: flat-shaded low-poly, a warm tropical palette, Shrikhand for display text, Figtree for UI.
