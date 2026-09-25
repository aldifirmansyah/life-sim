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

## Keys

- `WASD` walk, `Shift` run, mouse to look.
- `E` talk to the neighbour you're looking at, or use what's in front of you: the warung, pasar stalls, the warkop, the bakso cart, your front door, your garden planters. In menus, number keys (or click) choose and `Esc` goes back.
- `Tab` phone: Chats (the Warga RT 04 group, private messages, invitations and your plans), Contacts (everyone you've met, what you know about them), Bag (eat or drink), Skills, and a Glossary.
- Neighbours on their teras call out as you pass: go over and talk. Use Invite… in a conversation to make plans, then turn up.
- The phone's Journal lists what's coming up (kerja bakti on Sundays, pengajian on Thursdays, the arisan, 17 Agustus on day 15), the neighbours' stories (look for ✦), Mbah Minah's memories, and your reputation.
- Restore Mbah Minah's house from your front door (Restore the house…), with Pak Karyo's help.
- The notice board at the balai has odd jobs and a guitar for sale. The pos ronda at night, the kali (with a pancing from the warung) and the lapangan in the afternoon all have something to do.
- Hold `Shift` for 200 m or more to go for a jog.
- `M` map, `Esc` pause and settings, `H` hide the key hints.

## Debug keys

- `F3`, or backtick (`` ` ``) on a Mac, where F3 is a system key: performance overlay with CPU ms, draw calls and NPC counts per LOD tier, plus name tags over nearby residents. With it on, the map (`M`) shows every resident.
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
  ui/                hud (clock, location, toasts), map, overlays (start, pause, settings), dialogue, contacts, portrait, panel, activities
  dialogue/          DialogueProvider interface, TemplateDialogueProvider, lines.json
  social/            friendship rules, NPC–NPC chats and call-outs, plans, phone messages, reputation, story arcs, Mbah Minah
  game/              items, stats and bag, interaction, garden, actions, calendar, events, house restoration, odd jobs
  npc/               residents and passers-by: data model, roster, schedules, character generator + renderer, places, waypoint graph, runtime, debug view
```
