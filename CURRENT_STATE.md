# Current State

## Status
Playable end to end, with the graphics upgrade in place (2026-11-03): a colourful
storybook town with sky, cottages, paving, living background and a real finale.
Live at https://nolancasama.github.io/treasure-traders/. Next is hand-playing it on a
real Chromebook.

## What Exists
- `docs/BRIEF.md` — the teacher's original brief. `SPEC.md` — frozen v1
  design (the contract). `DESIGN_DECISIONS.md` — why (brief changes, core
  model, art kit, graphics upgrade).
- Scaffold: Vite 8 + React 19 + R3F + three 0.186 + zustand + TypeScript +
  Vitest + Playwright. Vendored `vendor/esl-stt` (v1.0.0) and
  `vendor/esl-pronunciation-coach` (v1.1.0); `src/audio/vendor.ts` is the
  only import point.
- **Core model** (`src/game/content/`, `src/game/logic/`, barrel `index.ts`):
  beat-script interaction API, truth checks, reversible trades, exactly-once
  transactions, five chapters, seeded generator + solver, save/load, speech judges.
- **Art kit** (`src/scene/models/`): stationery, both chests, 20 skinned characters
  (`people.ts` pose-blending rig, lazy faces, talking mouths; `personality.ts` per-person
  idles), Kiwi, props.
- **World** (`src/game/world/`, `src/game/runtime.ts`, `src/scene/`):
  - `town/ground.ts` paving, land, water; `town/districts.ts` all five districts as
    `low`/`tall`/`signs` chunks; `town/builders.ts` shared parts and gates;
    `town/decorations.ts` staged milestone pop-ins; `town/ambient.ts` birds, fish,
    ripples, folk; `town/signs.ts` one text atlas.
  - `Lighting.tsx` + `Atmosphere.tsx` sky, hills, clouds and the afternoon→golden→dusk
    mood; `materials.ts` shared wind and see-through shaders.
  - `cameraRig.ts` (pure, tested) picks conversation shots; `WorldCamera.tsx` feeds the
    see-through holes; `fx/` sparkles and GPU fireworks.
  - **`docs/WORLD_API.md` is the integration boundary** (v1.1, additive).
- **UI + audio** (`src/ui/`, `src/audio/`): `createUI` + `UIHost`, shared `UiIcon` set;
  **`docs/UI_API.md` is the frozen UI boundary.**
- **Integration** (`src/App.tsx`, `src/game/store.ts`, `src/game/flow/game.ts`
  + `presentation.ts`, `src/dev/gameHook.ts`): title orbit, new/continue/chapter replay,
  conversations, trade choreography, chapter clears with milestone shots, finale, free
  roam, saves; `window.__tt` only with `?e2e=1`.
- **Tests:** `npm test` (unit, including camera sight lines and finale staging);
  `npm run e2e` (11 specs, about 25 min under SwiftShader); `npm run e2e:short`,
  `npm run e2e:campaign`. Campaign screenshots land in `.tmp/shots/game/`.
- **Review galleries:** `?gallery=items|people|ui|world`; `npm run shots` renders them to
  `.tmp/shots/`. `tests/shots/perf.spec.ts` measures relative frame cost.

## Current Work
None in flight. No delegated work is pending.

## Known Issues
- Real microphones, real TTS voices and real Chromebook GPUs are untested: everything
  so far ran headless under SwiftShader, which says nothing absolute about frame rate.
- Chapter 1 has not been hand-played in a real browser yet (the e2e plays it with real
  clicks/keys/taps, and the screenshots were reviewed).
- Wide review views reach roughly 100 draw calls; the follow view is lower. If a
  Chromebook struggles, first reduce `tall` scatter (`SCATTER` in `town/districts.ts`).
- Under SwiftShader, iterate with `npx playwright test <file> -g "<name>"`
  after `npm run build` (preview on port 4183).

## Next Steps
1. Hand-play Chapter 1 and the finale at 1366×768 on a real Chromebook, with a real mic.
   Watch frame rate at the Festival Grounds and whether the dithered see-through looks
   right at the school's device pixel ratio.
