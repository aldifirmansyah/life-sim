# Kampung

A first-person, browser-based life simulation set in an Indonesian kampung, built with Three.js. Social interaction with the neighbours is the core of the game.

- `docs/design-spec.md`: the full game design spec. It is the source of truth.
- `prototype/index.html`: the Phase 1 build, a single self-contained HTML file.
- `CLAUDE.md`: context and working rules for Claude Code.

## Run the prototype

It uses ES modules loaded from a CDN, so serve it over HTTP instead of opening the file directly:

```bash
cd prototype && python3 -m http.server 5173
# then open http://localhost:5173
```
