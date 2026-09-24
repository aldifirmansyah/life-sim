# Kampung

A first-person, browser-based life simulation set in an Indonesian kampung, built with Three.js. Social interaction with the neighbours is the core of the game.

- `docs/design-spec.md`: the full game design spec. It is the source of truth.
- `src/`: the game, in TypeScript, built with Vite.
- `prototype/index.html`: the original Phase 1 build, a single self-contained HTML file. Kept for side-by-side comparison.
- `CLAUDE.md`: context and working rules for Claude Code.

## Run the game

Needs Node 20 or later.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck, then build to dist/
npm run preview    # serve dist/
```

`npm run typecheck` runs `tsc` on its own, and `npm run format` runs Prettier over `src/`.

## Run the prototype

It loads Three.js from a CDN, so serve it over HTTP instead of opening the file directly:

```bash
cd prototype && python3 -m http.server 5174
# then open http://localhost:5174
```

## Debug keys

- `F3` (or backtick): performance overlay with CPU ms, draw calls and NPC counts per LOD tier, plus name tags over nearby residents. With it on, the map (`M`) shows every resident.
- `G` (with F3 on): waypoint graph and the paths of walking residents.
- `T` hold: fast-forward time (60×). `[` / `]`: jump an hour back or forward.

## Source layout

```
src/
  main.ts            boot, world build order, frame loop
  style.css          all UI styles
  core/              util (seeded RNG), settings, state, time, player, collision (spatial hash), input
  render/            context (renderer/scene/camera), batch (instancing), textures, sky, lighting, signs, quality
  world/             layout data, houses, trees, landmarks, streets, boundaries, pasar pagi, ground
  ui/                hud (clock, location, toasts), map, overlays (start, pause, settings)
  npc/               residents: data model, roster, schedules, character generator + renderer, places, waypoint graph, runtime, debug view
```
