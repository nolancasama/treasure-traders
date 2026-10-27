# Current State

## Status
Playable end to end (2026-10-28). All slices are committed: frozen design,
scaffold, core model, art kit, world, UI + audio, and integration (App, store,
flows, presentation, e2e). `npm run e2e` is green (11/11, ~20 min).
Next is polish/QA, README and deploy.

## What Exists
- `docs/BRIEF.md` — the teacher's original brief. `SPEC.md` — frozen v1
  design (the contract). `DESIGN_DECISIONS.md` — why (brief changes, core
  model, art kit).
- Scaffold: Vite 8 + React 19 + R3F + three 0.186 + zustand + TypeScript +
  Vitest + Playwright. Vendored `vendor/esl-stt` (v1.0.0) and
  `vendor/esl-pronunciation-coach` (v1.1.0); `src/audio/vendor.ts` is the
  only import point. `src/audio/tts.ts`, `src/input/keyboard.ts` and
  `src/scene/partBuilder.ts` were adopted from monster-island and are now in use.
- **Core model** (`src/game/content/`, `src/game/logic/`, barrel `index.ts`):
  - beat-script interaction API (`talk / ask / answer / collect / inspect /
    leave`), truth checks, reversible trades, exactly-once transactions
  - all five chapters' rules, objectives with graduated hints, indicators,
    placements
  - seeded generator + solver/validator; `plan.ts` (autoplay/intents for
    tests and future e2e)
  - save/load with integrity checks, settings
  - speech judges over esl-stt
- **Art kit** (`src/scene/models/`, `src/scene/*.ts(x)`, `src/ui/icons/`):
  - nine stationery models (+ display scales, plaques/silhouettes)
  - Festival Treasure Chest, Captain's sea chest
  - 20 characters (one skinned mesh + face each; states, gestures,
    expressions, held items, look-at), Kiwi
  - props: bench, easel, rod, brush
  - `Lighting`, blob shadows, glow, `textSprite`
  - SVG item icons/silhouettes, sticker icons
  - portraits rendered from the rigs
- **World** (`src/game/world/`, `src/game/runtime.ts`, `src/scene/World*.tsx`,
  `src/scene/town/`, `src/scene/fx/`, `src/input/tap.ts`): five districts,
  gates from state, decorations by chest count, shared collision + A* tap
  paths, follow/conversation/cutscene camera with lens shift, library cutaway,
  NPC actors, indicators, Kiwi, FX, liveliness, culling, adaptive dpr.
  **`docs/WORLD_API.md` is the frozen integration boundary.**
- **UI + audio** (`src/ui/`, `src/audio/`): `createUI` + `UIHost`; title,
  HUD, backpack bar/panel/inspect/bag-check, dialogue, Ask/Answer with the
  speech ladder and mic-free fallback, journal, settings, chapter select,
  cards, results, tips; `speech.ts` over esl-stt; `audio.ts` synthesised
  district music/SFX/ambience with ducking. **`docs/UI_API.md` is the
  frozen UI boundary.**
- **Integration** (`src/App.tsx`, `src/game/store.ts`, `src/game/flow/game.ts`
  + `presentation.ts`, `src/dev/gameHook.ts`): title orbit, new/continue/
  chapter replay, async interaction and chapter flows, cutscenes, finale,
  results, free roam, saves; `window.__tt` only with `?e2e=1`.
- **Tests:** 188 unit tests (`npm test`); typecheck and build pass.
  E2E (`npm run e2e`, 11 specs, ~20 min under SwiftShader): Playwright
  projects `chromebook-short` (`npm run e2e:short`), `chromebook-mic-free` and
  `chromebook-speech` (`npm run e2e:campaign`) each get a fresh browser.
  Campaign screenshots land in `.tmp/shots/game/` (reviewed 2026-10-28).
- **Review galleries:** `?gallery=items` (views: items, chests, hand, icons,
  closeup&item=) and `?gallery=people` (lineup, states, faces, kiwi,
  portraits, closeup&id=), `?gallery=ui` (46 views incl.
  1280×800 and touch), `?gallery=world` (14 views incl. play-follow,
  conversation, gates, wind, fireworks; renderer.info overlay). `npm run shots` re-renders them to `.tmp/shots/`;
  last reviewed and accepted this session.

## Current Work
None in flight. No delegated work is pending.

## Known Issues
- Real microphones and TTS voices are untested (headless tests stub them).
- Filled festival-chest medallions show thin items (pen/pencil) small. This
  is acceptable; revisit if hard to read in the world.
- Silhouettes of pen/pencil/marker look alike in empty backpack slots. The
  fixed slot order distinguishes them.
- World polish backlog: finale fireworks read as faint confetti specks (need
  bold coloured bursts); wind-FX items are barely visible in wide shots;
  Festival field is a large empty lawn; Grandma clips the bench edge; arch
  sign plank is blank (label floats above it).
- Seen in the game screenshots (2026-10-28): the title orbit and the Square
  follow view have a large beige beam/post across the left foreground (the
  camera clips through or sits behind geometry); in Square conversations a
  pillar can stand between the player and the NPC; in the finale, an NPC head
  and a dark blob sit at the bottom edge of the frame.
- Chapter 1 has not been hand-played in a real browser yet (the e2e plays it
  with real clicks/keys/taps, and the screenshots were reviewed).

- Under SwiftShader, iterate with `npx playwright test <file> -g "<name>"`
  after `npm run build` (preview on port 4183).

## Next Steps
1. Hand-play Chapter 1 at 1366×768 (`npm run dev`), with a real mic if
   possible.
2. Polish slice: the world backlog and screenshot issues above (camera
   occlusion first, since it hides the play area on the title and Square).
3. README, deploy (`.github/workflows` is present).
