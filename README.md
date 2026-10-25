# Treasure Traders: The School Festival Quest

A browser 3D adventure for Japanese grade-4 students. The wind has scattered
the school festival's supplies all over town; ask "Do you have a ___?",
answer "Yes, I do." / "No, I don't.", trade, help and solve puzzles to fill
the Festival Treasure Chest.

**Status: under construction.** See `CURRENT_STATE.md` for what works today
and `SPEC.md` for the frozen design.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build into dist/
npm run e2e        # build + Playwright end-to-end tests (1366x768)
npm run shots      # build + screenshot passes into .tmp/shots/
```

Review galleries: `http://localhost:5173/?gallery=<name>` (development only,
or with `?e2e=1`).

The full README (classroom setup, controls, deployment) is written when the
game is complete.
