# Current State

## Status
Frozen v1 design and scaffold (2026-10-25). No gameplay implemented yet.

## What Exists
- `docs/BRIEF.md` — the teacher's original brief (verbatim).
- `SPEC.md` — the frozen v1 design (the contract for all slices).
- `DESIGN_DECISIONS.md` — what changed from the brief and why.
- Scaffold: Vite 8 + React 19 + R3F + three 0.186 + zustand + TypeScript +
  Vitest + Playwright (same versions as monster-island). `npm run typecheck`,
  `npm test`, `npm run build` and the e2e smoke test pass.
- Vendored speech packages: `vendor/esl-stt` (v1.0.0, d3761e3, identical to
  esl-time's copy) and `vendor/esl-pronunciation-coach` (v1.1.0, 158b994).
  `.d.mts` copies of their `.d.ts` let TypeScript type the `.mjs` imports.
  `src/audio/vendor.ts` is the only import point (coach lazy-loaded).
- Adopted from monster-island: `src/scene/partBuilder.ts`,
  `src/game/logic/rng.ts`, `src/input/keyboard.ts`, `src/audio/tts.ts`.
- Review galleries: `?gallery=<name>` loads `src/dev/galleries/<name>.tsx`
  (dev or `?e2e=1`); screenshot specs go in `tests/shots/<name>.spec.ts`
  using `tests/shots/helpers.ts`; `npm run shots` writes `.tmp/shots/`.
- `.github/workflows/deploy-pages.yml` (copied from aquarium-tycoon).

## Current Work
Build plan (each slice delegated through the router, reviewed by Claude):
1. **Core model** — `src/game/logic`, `src/game/content`: items, holdings,
   truth, roles/transactions, missions, chapter templates, generator,
   solver/validator, save, speech judges over esl-stt; unit tests.
   ‖ **Art kit** — `src/scene/models`, `src/ui/icons`, items/people galleries:
   nine stationery models + chests + icons, player, Kiwi, 19 NPCs, portraits.
2. **World** (`src/scene`, `src/game/world`, runtime, input) ‖ **UI + audio**
   (`src/ui`, `src/audio`), each with its own gallery.
3. **Integration** — `src/game/flow`, App, store: chapters 1–5, cutscenes,
   save/replay, ending; e2e full playthroughs.
4. **Polish/QA** — visual review fixes, budgets, README, deploy.

## Known Issues
None yet.

## Next Steps
Dispatch step 1 (core model ‖ art kit).
