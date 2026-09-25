# CLAUDE.md: Singapore

## What this is
A first-person life-sim in the browser, set in **Singapore**: the whole island, compressed, travelled in place. The player is **Aldi**, a young Indonesian software engineer who lands at Changi to start work at **Chopee** (a pun on Shopee) on Science Park Drive, rents a place, and builds a life. The core of the game is social interaction. It has to hold 60 FPS on a mid-range laptop with integrated graphics.

**`docs/design-spec.md` is the source of truth**, and **`docs/singapore-plan.md` has the steps and every decision made with the user.** Read both before starting a step. If they disagree with this file, they win, except for the "Current state" notes below.

The game used to be set in an Indonesian kampung ("Kampung Sukamaju", player Raka). That version is complete and kept on the branch **`kampung-v1`** (commit `18dfd08`); its content was removed from this branch and its systems are ported back from there as each Singapore step needs them.

## Decisions already made (don't reopen unless asked)
- **Setting:** real Singapore, the whole island (Clementi and Science Park Drive explicitly), compressed. Real names for public places; businesses get pun names (Chopee, Marina Bay Stands, Jool, Nab, EZ-Lah, EON Orchard, Lucky Place, VivaCity, FairlyPrice, 8-Twelve, SingaTel, Uniworsal Studios).
- **Player:** Aldi, fixed, no appearance editor, face never shown. Avoid gendered pronouns for Aldi in text: use the name.
- **Work:** software engineer at Chopee: two-week sprints of tickets done anywhere, office days at Science Park, a city office in a Raffles Place tower. Free days to go around.
- **Home:** rented, chosen by the player (a property app, viewings, a lease). Clementi first.
- **Travel:** in place, no loading screens or fast travel. Public transport first (walk, MRT, buses), then taxis and ride-hail as a passenger, then Aldi's own car, which has to be bought (a big goal).
- **Language:** English with Singlish, only. Glossary.
- **Day:** 30 real minutes. Start: Sunday 26 July at Changi.
- **Romance:** not in v1 (keep the hook). **Dialogue:** templates behind `DialogueProvider`; an LLM provider can plug in later; game logic never lives in the provider.

## Steps (docs/singapore-plan.md)
1. **The new spec and the groundwork: DONE, awaiting the user's check.** The island, streaming, skyline, buildings, roads, the MRT East-West Line and Changi branch you can ride.
2. Changi and the first ride. 3. Science Park Drive, one-north and Clementi (the job, buses). 4. The CBD and Marina Bay. 5. A place to live. 6. People and conversation. 7. Chinatown, Tiong Bahru, Little India, Kampong Glam and Orchard. 8. The calendar. 9. The other regions. 10. Taxis and ride-hail. 11. Aldi's own car. 12. Performance pass and docs.

Do one step at a time. At the end of each, check it and stop for the user's go-ahead.

## Current state (step 1)
The game lives in `src/` and builds with Vite (`npm run dev`, `npm run build`); `three` is pinned to 0.169.0.

**Module map.** `src/main.ts` generates the island, wires input and UI, and runs the loop.
- `core/`: `util` (`mulberry32`, `hash`, `rng`, `Frame`, helpers), `settings`, `state` (`S`, `inWorld`, `inMenu`), `time` (clock, `timeWarp`, sleep), `player` (movement, floors, riding, camera), `collision` (boxes, rotated boxes, height ranges, spatial hash), `levels` (floors: platforms, stairs), `input` (`actions.interact` for E).
- `render/`: `context` (renderer, scene, camera: near 0.15, far 2600, fog), `batch` (`Batch`, `mat`, `prismGeo`, `BOX`, `litMat`, `bulbMat`), `props` (`PropSet`), `textures`, `sky` (dome, stars, moon), `lighting` (`KF`, `updateEnv`, `envHooks`, `env`, `prewarm`), `signs` (sign atlas), `quality` (pixel ratio, shadow map).
- `city/`: `geo` (coordinates, coastline, waters, land use, `TOWNS`, place names), `roads` (expressways and main roads, town streets, segment grid), `mrtdata` (lines, stations, track path), `mrtbuild` (viaduct, stations, platform screen doors), `facade` (the building material), `gen` (lots, chunks, authored landmarks), `pool` (pooled instancing), `stream` (loading chunks, far ground, sea, skyline, fog), `trains` (timetable, cars, riding, announcements).
- `ui/`: `hud` (clock, where Aldi is, toasts), `map` (the island), `overlays` (start, pause, settings, map), `panel`, `minigame`, `bubbles`, `portrait`.
- `game/`: `calendar` (dates from Sunday 26 July), `save` (position, day, time), `bus`.
- `interiors/`: `interior` (registry, rooms, indoor light and sound), `door`, `shutter` (ready for the interiors to come).
- Kept for the steps ahead but not wired yet: `social/social.ts` and `social/reputation.ts` (friendship rules), `npc/types`, `npc/appearance`, `npc/characters` (the instanced crowd renderer and poses), `npc/schedule`.
- Everything else from the kampung (world builders, residents, dialogue lines, items, events, arcs, interiors' content, tutorial, stats, weather, the phone) is on `kampung-v1`; port it from there when its step comes, rewritten for Singapore.

**Coordinates.** Units are metres; +x east, +z south. `toGame(lat, lon)` maps real coordinates at **1:10** around (1.35 N, 103.82 E): x = (lon − 103.82) × 11129, z = −(lat − 1.35) × 11057. The island spans about x −2250…2400, z −1300…1200 (Tekong reaches x 2900). Heights are real.

**Geography** (`city/geo.ts`). Polygons in lat/lon: the main island (~46 points), Sentosa, Pulau Ubin, Jurong Island, Tekong; waters inside (Marina Bay, Kallang Basin, MacRitchie, Upper Seletar, Jurong Lake); zones (airport, the Central and Western catchments, Tuas). `landAt(x, z)` gives sea, water, beach (the south-east coast strip and Sentosa's south shore), park, forest, airport, industry or urban. `TOWNS`: 57 towns with a real centre, a radius in game metres, a kind (hdb, lowhdb, cbd, mall, shophouse, mixed, campus, airport, landmark, civic, park, resort, kampung, industrial, lowrise) and a region. `placeName()` names any point for the HUD.

**Roads** (`city/roads.ts`). Expressways (PIE, AYE, ECP, CTE, BKE, KJE, SLE, TPE, KPE; 14–16 m) and main roads (Orchard Road, Clementi Road, Commonwealth Avenue West, South Buona Vista Road, Science Park Drive, Upper Changi Road, Tampines Avenue, Nicoll Highway, Serangoon Road, Jurong Gateway Road, Woodlands Avenue, Ang Mo Kio Avenue, Sentosa Gateway) as polylines; town streets (7 m) on every third lot line inside built-up towns. `nearRoad`, `segsNear`, `roadCloseness`. No vehicle graph yet (step 3/10).

**Generation** (`city/gen.ts`). The island is cut into **36 m lots**; each lot (seeded by `hash('lot', ix, iz)`) decides what stands on it from the land use, the town it's in (kind, distance from the centre) or, between towns, the distance to the nearest one (estates near towns; houses, greenery, some industry further out). Buildings keep clear of roads and the MRT (`clear()` samples the footprint; one shrink, then give up). Builders: HDB slabs (30 × 11, 30–56 m, water tank on top) and point blocks (17 × 17, 70–110 m) with a mall and hawker centre near the town centre; shophouse rows (5.7 m units, 8–12 m, pitched roofs, bright colours); towers (glass or office, up to 250 m in the CBD); malls; campus buildings among trees; civic buildings; landed houses; industry with chimneys and tanks; forests, parks and palms; kampung huts on Ubin. Authored blockouts: **Changi Airport** (three terminals round the MRT station, the Jool dome, the control tower, two runways) and **Marina Bay** (Marina Bay Stands: three 160–170 m towers and the sky park on top; the podium; the durian domes). Everything goes into **128 m chunks** as data: items (pool, position, size, `ry`, optional `rz`, colour, facade style), colliders and floors. Generation takes about 200–300 ms at start-up and is the same every time and in any order. The old kampung's global `R()` and its determinism rules are gone.

**Streaming** (`city/stream.ts`, `city/pool.ts`). Chunks within the load radius (300/420/560 m by quality) become instances in **pooled InstancedMeshes** (`bldg`, `solid`, `roof`, `cyl`, `crown`, `ground`, `road`, `glass`, `dome`): one draw call per pool whatever the chunk count, only the changed range uploaded. Loading is nearest first within 3 ms a frame; chunks unload a little past the radius. Colliders and floors are made the first time a chunk loads and switched on and off after. Ground: 16 m cells from `groundAt()` merged into runs. Beyond the chunks: one flat mesh of the island (at −0.6), the sea plane (−1.2, tinted by the sky), and the **skyline**: every building ≥ 26 m on the island in one instanced mesh with the same material, each hidden while its own chunk is loaded. Fog is long (near 90–170, far 1100–1900) so the skyline reads; `applyCityFog()` sets it by quality.

**Facades** (`city/facade.ts`). One Lambert material with `onBeforeCompile`: the shader draws windows from the world position and the face normal (storey height and bay width by style), and a per-instance `aStyle` picks the pattern: HDB (void deck on the ground floor, pale corridor parapets), point blocks, glass towers (reflecting the sky), offices (ribbon windows), shophouses and malls (lit shopfronts), industry (cladding), terminals, houses. At night a hash picks which windows glow (`uWin` from `envHooks`).

**Levels and collision.** `core/levels.ts`: floors are boxes on the ground plane (axis-aligned or turned) with a surface at y0, or a slope from y0 to y1 along their local x (stairs, ramps). The player's feet (`player.y`) stand on the highest surface at most a step (0.55) above them, or the ground at 0; off an edge Aldi falls. `core/collision.ts`: colliders have a height range (y0..y1) and can be rotated (`addRotCol`); only those overlapping the body's height (feet + 0.35 to feet + 1.8) block.

**The MRT** (`city/mrtdata.ts`, `city/mrtbuild.ts`, `city/trains.ts`).
- **Lines:** the East-West Line (33 stations, Pasir Ris to Tuas Link) and the Changi Airport branch (Tanah Merah, Expo, Changi Airport), stations at their real positions. The track is straight through each station (its platforms, along the average bearing of its neighbours) and straight from station to station. Everything is elevated for now: deck at 8 m, car floor and platforms at 9 m, tracks 2.1 m either side of the centre. The branch's Tanah Merah platforms run parallel to the East-West Line's, joined by a short bridge (`Station.link`). Underground stations in the city and at Changi come in later steps.
- **Stations:** a deck on piers, side platforms (3.75–7.75 m out, 56 m long) with half-height screen doors (glass panels, and a collider in each of the six doorways that opens with the train's doors), outer walls with a gap for the stairs, canopy, name signs, stairs straight out from the middle of each platform to the street (a sloped slab and a floor ramp, handrails), a sign at the foot. Station floors and colliders are registered at start-up.
- **Trains:** three 16 m cars; doors 4 m either side of each car's middle, so they line up with the screen doors. Each line runs a timetable from one rail clock: 34 m/s, 1.4 m/s², 11 s at each station (doors open after 1.2 s, close 1.2 s before leaving), 18 s at the ends, trains every 70 s on the East-West Line (27 trains) and 2 on the branch. Trains keep left. Cars (one instanced hollow car with seats, poles, window pillars and a green stripe), cab noses, door leaves and the screen-door leaves are instanced; far trains skip their updates.
- **Riding:** walk in through open doors and you're aboard (`player.ride`): movement is in the car's frame (the aisle between the seats, the doorways, the gangways to the next car), the car carries Aldi and turns the view with it, the clock runs 4.5× (`S.clockScale`) so a ride takes about the real journey's game time, and stations are announced with a chime (boarding, "Next station", arrival, "This train terminates here"). Walk out through open doors onto the platform. Holding T: 6× aboard; 75× otherwise, with the trains following the clock.

**HUD and map.** The location label reads the train ("East-West Line to Tuas Link"), the station ("Clementi MRT"), the room, or `placeName()`; the eyebrow reads "Singapore · <region>". Energy, mood and money are hidden until they return. M: the island map (coastline, waters, towns, expressways and main roads, the MRT with stations, Aldi's arrow).

**Time.** `S.time` in minutes since midnight; 06:00 → 26:00 then sleep (Aldi wakes where Aldi is until there's a home). 0.8 game-minutes per real second.

**Save.** `game/save.ts`: `sg-save` in localStorage, version 1: day, time, position (not while riding). Autosave every 2 minutes and on hide/close; Continue on the start screen.

**Start.** New game: Aldi at the foot of the Changi Airport station's stairs at 07:30 on Sunday 26 July, facing the station, with a welcome toast.

**Performance** (headless, High, 1280 × 720): 19–20 draw calls, 140–181k triangles, JS 1–2.6 ms per frame (trains up to 1.8 ms), about 50–66 chunks and 3.5–5k instances loaded. Headless software rendering is slow (about 3–4 fps; one frame 250–450 ms), so test scripts wait on conditions, not fixed times. Real hardware hasn't been checked.

**Debug.** F3 or backtick: fps, draws, triangles, JS update and render ms, the costliest parts (`lap()`), chunks and instances loaded, colliders, position, quality, generation time. In dev builds `window.__sg` exposes `S`, `player`, `geo`, `gen`, `stream`, `trains`, `mrt`, `mrtbuild`, `collision`, `levels`, `settings`, `quality`, `renderer`, `parts` for headless scripts. Don't `import()` modules from test scripts (after hot reloads that creates second copies); use `__sg`.

**Known gaps (step 1)**
- A blockout: no people, no interiors, no shops, no job, no home, no stats. Buildings are boxes; town layouts are generated, not authored (steps 2–9 author them).
- Everything on the MRT is elevated, including the city and Changi Airport stations (underground in reality). The trains run all night.
- Station stairs lead straight to the street; no concourse, fare gates or cards yet (step 4 of the plan's transport work).
- Low buildings, trees and ground detail stop at the load radius; only the skyline (≥ 26 m) and the island's flat shape go further.
- Colliders are never removed, only switched off; memory grows with the chunks visited (fine for a session).
- The map's labels overlap in the city centre.

## Working conventions
- Run `npm run build` (typecheck + build) before committing. Format with `npm run format`.
- Performance budget (spec §9): < 150 draw calls, < 300k triangles, < 8 ms JS per frame. Check with F3.
- Streamed geometry goes through the pools (`city/gen.ts` `put()`); fixed sets use `PropSet`/`Batch`. No per-NPC or per-building models.
- World generation uses its own seeded `rng(hash(...))` per lot or place, never `Math.random` (that's for cosmetic noise only).
- Social logic ticks at 1 Hz. Only near people get a full per-frame update.
- Wrap all `localStorage` access in try/catch.
- Visual language: flat-shaded low-poly, a warm tropical palette, Shrikhand for display text, Figtree for UI.
