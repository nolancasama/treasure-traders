# Current State

## Status
Playable end to end, with the graphics upgrade and four implementation batches of
the 22 visual, collision and interaction fixes. Batch 4 is uncommitted; controller
acceptance is pending. The deployed site at
https://nolancasama.github.io/treasure-traders/ does not include this working tree.

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
- **Tests:** `npm run typecheck`; `npm test` (unit, including camera sight lines,
  navigation, gate settlement, seated support, chest contacts, fish trajectories,
  bridge rope endpoints and the geometry z-fight audit in `town/zfight.test.ts`).
  `npm run e2e`; `npm run e2e:short`,
  `npm run e2e:campaign`. Campaign screenshots land in `.tmp/shots/game/`.
  `npm run e2e:gate` exercises the school unlock animation and effective collision.
- **Review galleries:** `?gallery=items|people|ui|world`; `npm run shots` renders them to
  `.tmp/shots/`. `tests/shots/perf.spec.ts` measures relative frame cost.
- **Fix review harness:** controller-owned `npm run shots:fixes` produces paired
  PNG/JSON evidence in `.tmp/shots/fixes/1366x768/` and `1280x800/`. It waits for
  rendered fixture state; unmet setup reports `HARNESS_PRECONDITION_FAILED`.
  Existing read-only `__tt.readGates()` exposes rendered/effective gate state;
  world-gallery `data-fixes-review` exposes camera, player, fish and fixture state.

## Four Fix Batches
- **1:** bench/collision orientation, bridge hinge barrier and rails, gate settlement,
  stage navigation and static chest collision, direction-independent interaction with
  visibility checks, review fixtures. The stage steps are a route: the approach leads
  through three height-aware walk areas onto the 0.60m deck after the arch opens;
  edge solids leave that entrance clear.
- **2:** complete library entrance and camera-aware cutaway, school portal/rollers and
  three-second unlock shot, Page's book support, shared shelf joints and ground audit.
- **3:** supported seated Ume and bench joints, chest soles/platforms/shadows, suspended
  Coming Soon board, shared cottage joints (including east harbor).
- **4:** merged wooden tripod easel, shoreline-derived fish clearance and regression
  controls, adjacent east harbor fence ropes, pier-end joints, complete bridge rope
  posts/spans, and a prize sign on a front counter board below the tent hem.

## Current Work
Implementation and unit/type validation are complete. Controller visual/behavioral
acceptance of the four batches remains pending; no acceptance result is claimed.

## Known Issues
- Real microphones, real TTS voices and real Chromebook GPUs are untested: everything
  so far ran headless under SwiftShader, which says nothing absolute about frame rate.
- Chapter 1 has not been hand-played in a real browser yet (the e2e plays it with real
  clicks/keys/taps, and the screenshots were reviewed).
- Wide review views reach roughly 100 draw calls; the follow view is lower. If a
  Chromebook struggles, first reduce `tall` scatter (`SCATTER` in `town/districts.ts`).
- Filled chest stationery plaques retain separately reported inherited overlaps;
  the chest assembly audit gates keep their documented empty-slot scope.

## Next Steps
1. Controller: run `npm run shots:fixes` and review both viewport artifact sets;
   perform final acceptance. These checks were not run for Batch 4 implementation.
2. Hand-play Chapter 1 and the finale at 1366×768 on a real Chromebook, with a real mic.
   Watch frame rate at the Festival Grounds and whether the dithered see-through looks
   right at the school's device pixel ratio.
