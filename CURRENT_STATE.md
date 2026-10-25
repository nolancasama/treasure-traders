# Current State

## Status
Frozen v1 design + scaffold + **core game model done and tested**
(2026-10-25). Nothing playable in the browser yet: art, world, UI/audio and
the chapter flows are next. Built directly by Claude (Codex hit its usage
limit; the teacher asked Claude to do it).

## What Exists
- `docs/BRIEF.md` — the teacher's original brief (verbatim).
- `SPEC.md` — the frozen v1 design (the contract). `DESIGN_DECISIONS.md` — why.
- Scaffold: Vite 8 + React 19 + R3F + three 0.186 + zustand + TypeScript +
  Vitest + Playwright (same versions as monster-island).
- Vendored speech packages: `vendor/esl-stt` (v1.0.0, d3761e3) and
  `vendor/esl-pronunciation-coach` (v1.1.0, 158b994); `.d.mts` copies type the
  `.mjs` imports; `src/audio/vendor.ts` is the only import point.
- **Content** (`src/game/content/`): frozen ids, items/articles/sentences,
  cast (names, voices, personal lines), shared EN+JP lines (kana + grade 1–3
  kanji), chapters (targets, cards, canonical starts), stickers (9).
- **Core model** (`src/game/logic/`, pure TS, barrel `index.ts`):
  - interaction API returning beat scripts: `talk / ask / answer / collect /
    inspect / leave`
  - truth checks, ask-before-you-get, reversible trades, contradiction
    bag-checks with Kiwi modelling on the second lie
  - exactly-once transactions, the Mayor's deposit rules, every chapter's
    special rules (Grandma, Ken, library, Lost & Found, Captain + sea chest,
    Chapter 5 chain, finale), sticker askers
  - objectives with graduated hints, indicators, placements
  - generator (fixed Chapter 1 + seeded Chapters 2–5) with the
    solver/validator (solvable, band, no dead ends)
  - `plan.ts` autoplay / intents
  - save/load with schema + item-conservation checks, backup and a
    migration hook; settings
  - speech judges over esl-stt
- **Tests: 97 unit tests pass** (`npm test`, ~12 s):
  - 2,000-seed sweeps per chapter, all valid with zero retries
  - 25 full campaigns through the real API to the finale
  - random-play truthfulness, lies never rewarded, exactly-once across
    save/reload after every step, trade undo, chapter rules, save corruption
  - a 60-transcript speech corpus
- Review galleries: `?gallery=<name>` loads `src/dev/galleries/<name>.tsx`;
  screenshot specs in `tests/shots/`.

## Current Work
Next slices, in order (all Claude-direct now):
1. **Art kit**: nine stationery models, festival chest, sea chest, SVG icons,
   player/Kiwi/18 NPC rigs with gestures, portraits; items/people galleries.
2. **World** (town, collision, controller, camera, actors, FX) and
   **UI + audio** (HUD, prompts with the speech ladder, backpack, journal,
   title, settings, TTS presets, synth music/SFX, esl-stt recognizer, coach).
3. **Integration**: chapter flows, cutscenes, save/replay, ending; e2e.
4. **Polish/QA** at 1366×768, README, deploy.

Drafts with layout and UI design intent: `.ai/drafts/` (gitignored).

## Known Issues
- Real microphones and TTS voices are untested (headless tests stub them).
- Chapter 3 validation is the slowest (~10 ms per seed); fine at runtime.

## Next Steps
Build the art kit (start of slice 1 above).
