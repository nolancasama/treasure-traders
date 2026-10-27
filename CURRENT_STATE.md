# Current State

## Status
In progress (2026-10-27). World slice built by Codex via the router, reviewed
and accepted by Claude.
- **Done and committed:** frozen design, scaffold, core game model, art kit,
  world (town + World API).
- **Not yet playable as a game.** HUD/audio and the chapter flows remain;
  the town is walkable in `?gallery=world`.

## What Exists
- `docs/BRIEF.md` — the teacher's original brief. `SPEC.md` — frozen v1
  design (the contract). `DESIGN_DECISIONS.md` — why (brief changes, core
  model, art kit).
- Scaffold: Vite 8 + React 19 + R3F + three 0.186 + zustand + TypeScript +
  Vitest + Playwright. Vendored `vendor/esl-stt` (v1.0.0) and
  `vendor/esl-pronunciation-coach` (v1.1.0); `src/audio/vendor.ts` is the
  only import point. `src/audio/tts.ts`, `src/input/keyboard.ts` and
  `src/scene/partBuilder.ts` are adopted from monster-island, not yet wired up.
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
- **Tests: 151 unit tests pass** (`npm test`). `npm run typecheck` and
  `npm run build` pass. The e2e smoke test passes.
- **Review galleries:** `?gallery=items` (views: items, chests, hand, icons,
  closeup&item=) and `?gallery=people` (lineup, states, faces, kiwi,
  portraits, closeup&id=), `?gallery=world` (14 views incl. play-follow,
  conversation, gates, wind, fireworks; renderer.info overlay). `npm run shots` re-renders them to `.tmp/shots/`;
  last reviewed and accepted this session.

## Current Work
UI + audio slice delegated (see `.ai/work-order.json`); review its result
before integration.

Remaining plan (all delegated through the router):
1. **UI + audio**: HUD, Ask/Answer prompts with the speech ladder and
   mic-free fallback, backpack (inspect, bag-check), journal, title, settings,
   chapter select, cards/results; TTS voice presets, synthesised music/SFX,
   the esl-stt recognizer, the pronunciation coach; a UI gallery.
2. **Integration**: App/store, chapter flows and cutscenes against
   `docs/WORLD_API.md`, save/replay, ending; `window.__tt` test hook; e2e
   full playthroughs (mic-free + stubbed speech) using `plan.ts` intents.
3. **Polish/QA** at 1366×768, README, deploy (`.github/workflows` is
   present).

Design intent for slices 1–2 (layout coordinates, UI look, component list)
is in `.ai/drafts/wave3-world.md` and `.ai/drafts/wave3-ui-audio.md`. They
are local and gitignored. The essentials are also in SPEC §9–§11.

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

## Next Steps
1. Review the UI + audio result (`?gallery=ui` shots at 1366×768).
2. Integration slice against `docs/WORLD_API.md` and the UI `say/prompt` API.
3. Polish (world backlog above), README, deploy.
