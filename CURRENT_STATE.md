# Current State

## Status
In progress (end of session, 2026-10-25). Built directly by Claude (Codex hit
its usage limit; the teacher asked Claude to do it).
- **Done and committed:** frozen design, scaffold, core game model, art kit.
- **Not yet playable in the browser.** The town (world), the HUD/audio and the
  chapter flows remain.

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
- **Tests: 131 unit tests pass** (`npm test`): 97 core + 34 art.
  `npm run typecheck` passes. The e2e smoke test passes.
- **Review galleries:** `?gallery=items` (views: items, chests, hand, icons,
  closeup&item=) and `?gallery=people` (lineup, states, faces, kiwi,
  portraits, closeup&id=). `npm run shots` re-renders them to `.tmp/shots/`;
  last reviewed and accepted this session.

## Current Work
None in flight. The next session starts the **world** slice.

Remaining plan (Claude-direct unless Codex is available again; it was out
until 2026-10-26 00:30 JST):
1. **World**: town with five districts and gates, decorations by chest count,
   collision, keyboard + tap-to-walk controller, follow camera with
   conversation shots and lens shift, NPC actors at their placements,
   indicators, FX (pickup, trade, deposit, wind intro, gate shots, fireworks),
   region culling, adaptive dpr; a world gallery.
2. **UI + audio**: HUD, Ask/Answer prompts with the speech ladder and
   mic-free fallback, backpack (inspect, bag-check), journal, title, settings,
   chapter select, cards/results; TTS voice presets, synthesised music/SFX,
   the esl-stt recognizer, the pronunciation coach; a UI gallery.
3. **Integration**: App/store, chapter flows and cutscenes, save/replay,
   ending; `window.__tt` test hook; e2e full playthroughs (mic-free + stubbed
   speech) using `plan.ts` intents.
4. **Polish/QA** at 1366×768, README, deploy (`.github/workflows` is
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

## Next Steps
1. Read SPEC §9–§10 and the world draft; build the world slice in
   `src/game/world/`, `src/scene/town/`, `src/scene/fx/` and
   `src/dev/galleries/world.tsx`.
2. Verify the world with screenshots at 1366×768 (and the draw-call budget),
   then build UI + audio, then integrate.
