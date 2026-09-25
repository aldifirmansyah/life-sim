# Singapore

A first-person, browser-based life simulation set in Singapore, built with Three.js. Aldi, a young Indonesian software engineer, lands at Changi to start work at Chopee on Science Park Drive, finds a place to live, and makes a life in the city. The whole island is there, compressed, and travelled in place: on foot and by MRT for now, buses, taxis and a car later.

- `docs/design-spec.md`: the game design spec, the source of truth.
- `docs/singapore-plan.md`: the steps and the decisions made with the user.
- `src/`: the game, in TypeScript, built with Vite.
- `CLAUDE.md`: context and working rules for Claude Code.

The earlier version of the game, set in an Indonesian kampung, is on the branch `kampung-v1`.

## Run the game

Needs Node 20 or later.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck, then build to dist/
npm run preview    # serve dist/
```

`npm run typecheck` runs `tsc` on its own, and `npm run format` runs Prettier over `src/`.

## Playing

A new game starts at the foot of the Changi Airport MRT station on Sunday 26 July. Climb the stairs to the platform, wait for a train, walk in when the doors open, and get off wherever you like; the East-West Line runs from Pasir Ris to Tuas Link, and the airport branch joins it at Tanah Merah. The game autosaves every couple of minutes (not while you're on a train); Continue picks up where you left off. Esc opens the pause menu with Save, New game and the settings.

## Keys

- `WASD` walk, `Shift` run, mouse to look.
- `M` the island map.
- `T` hold to fast-forward (the trains keep to the clock).
- `[` / `]` jump an hour.
- `F3` or backtick: the performance overlay.
- `H` hide the key hints, `Esc` pause.
