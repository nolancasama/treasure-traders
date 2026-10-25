# Design Decisions

This file records meaningful product, UX, visual, architectural, or behavioral decisions for this project.

For each significant decision, record:

- Date
- What was decided or changed
- Why
- Previous approach, if relevant
- Rejected alternatives, if useful

Only record decisions that may be useful to understand later.

Do NOT record:
- trivial UI adjustments
- routine bug fixes
- formatting changes
- mechanical refactors with no design consequence
- every individual code modification

Git is the source of truth for detailed code-change history.

A useful rule:

> If a future developer or AI could reasonably ask, "Why is it designed this way?", record the answer here.

## 2026-10-25 — Brief accepted, with these changes

The teacher's brief (`docs/BRIEF.md`) is the product definition; `SPEC.md` is
the frozen design built from it. Sibling games' classroom lessons
(monster-island, survival-island, esl-haunted-hotel, esl-likes, esl-verbs,
esl-counting, esl-time) were applied throughout.

**Accepted as written:** the core English (Do you have a ___? / Yes, I do. /
No, I don't.), the nine items, the five districts and chapters, several ways
to obtain items (trade, help, investigate, deliver, mini-games), truthful NPC
answers, yes/no checked against the real inventory, the journal, the fairness
rules, seeded replay with validation, local save with corruption handling,
the test list, the Chromebook target.

**Changed:**

- **Art is procedural low-poly with blob shadows, no asset files.** The brief
  asks for high-quality models with soft shadows; school networks block asset
  downloads/CDNs/webfonts (Sight-Word-Factory) and Chromebook GPUs need ~100
  draw calls and no real-time shadows (monster-island budget). Quality comes
  from crafted merged vertex-coloured models, warm lighting, animation and
  feedback, not textures.
- **"Natural audio pronunciation" is browser TTS.** No recorded files (same
  network reason); per-character voice presets and a slow setting.
- **Asking: the child says the whole question; the spoken item decides.**
  The brief has the player select an item, then speak. That makes the English
  decorative. Item cards stay on screen as inert visual support; tapping one
  is the mic-free/rescue route. Same precedent as monster-island's food cards.
- **Tap-to-talk, not hold-to-talk.** "Push-to-talk" is honoured as "the mic
  only opens on a press": one press = one bounded session (esl-stt 8 s cap),
  auto-stop on a correct live result. Holding is hard for 9-year-olds on a
  trackpad.
- **Mic-free is a teacher setting; buttons are a rescue, not a choice.**
  Automatic fallback happens on permission/hardware errors (whole session)
  and after the third miss on a prompt (that prompt only). No per-prompt
  opt-out button: esl-verbs found most students tick a voluntary mic-free
  toggle.
- **Speech uses the shared modules, vendored at their release tags.**
  esl-stt v1.0.0 (controlledAnswer matching + recognizer adapter with the
  classroom error rules) and esl-pronunciation-coach v1.1.0 (Japanese hint
  card on item-word near misses, lazy-loaded). Vendored like esl-time
  (`vendor/<pkg>/` + VERSION). Game-specific aliases are passed as options;
  the packages are never edited. Rejected: a sixth bespoke speechMatch.ts.
- **Recognition decides what was said; logic decides whether it is true.**
  The yes/no judge never looks at the inventory; truth is checked afterwards,
  so a recognition bug can never reward a lie.

**Added:**

- **One overarching goal: the Festival Treasure Chest.** A nine-slot chest in
  the square, filled 2/2/2/2/1 across the chapters; each deposit adds visible
  decorations; the ninth item (the pen — the textbook unit's title question,
  "Do you have a pen?") opens it and fireworks burst out. Gives every chapter
  the same clear purpose and makes the title's "treasure" literal.
- **The wind scattered the supplies.** One-line premise a 9-year-old gets at
  once, and it justifies every NPC holding something.
- **Kiwi the parrot** follows the player, gives graduated Japanese hints and
  models English sentences on the second miss (in-world, not a menu).
- **Ask before you get.** Nothing changes hands until the matching question
  was asked and answered "Yes" (monster-island: gating by the question stops
  students skipping the English and trying everything).
- **Every trade is reversible with the same person** (trader's offer and want
  swap after a trade). This is how "recover from incorrect decisions" and
  "never permanently stuck" are guaranteed structurally, then verified by the
  solver. Rejected: locking "essential" items (invisible rules confuse kids).
- **Canonical chapter start states.** Leftovers go to the spare box at a
  chapter's end; each chapter starts from defined inventory/chest/areas.
  Makes checkpoints, replays and validation independent per chapter.
- **The save stores the generated chapter instance, not only the seed.**
  A later code change can never silently change a saved puzzle.
- **The Mayor collects only the current chapter's targets, and only once the
  chapter's other missions are done.** Prevents depositing the librarian's
  notebooks or a lost item before it is returned.
- **Lost & Found is solved by the negative answer.** Each student lost one
  item and holds the other two, so "No, I don't. I lost it!" identifies the
  owner — the brief's "negative responses may provide useful clues" made into
  the puzzle itself. Lost items are never chapter-target types.
- **Optional sticker questions** (returning characters ask about your bag)
  cover the brief's "other characters ask questions along the way" and
  optional side missions without blocking anything.

**Rejected:**

- A standalone "remember which character has which object" mini-game: the
  journal records every answer by design, so a memory test would contradict
  it. Chapter 4's planning from journal facts fills that role.
- A truth-test quiz on the final chest: by the finale the bag is nearly
  empty, so every answer would be "No". The finale is the single climactic
  "Do you have a pen?" instead.
- Scores, timers, stars for speed.

## 2026-10-25 — Chapter mechanics and mini-games (frozen in SPEC §6)

- Ch1 answers only (five prompts, three Yes / two No; the "No" gets the pen);
  Ch2 introduces asking and one-step trades with a giver (no wrong trade is
  possible yet); Ch3 hidden-object library search and Lost & Found matching;
  Ch4 a two-trade chain with a decoy trader plus a delivery and the Captain's
  silhouette sea chest (asking an object); Ch5 a three-step combined chain
  (investigate, find, deliver, trade) and the finale.
- Difficulty band follows the brief: one interaction → two connected → two or
  three connected.
- Investigations are bounded (≤ 5 people), every "No" becomes a journal fact,
  and hints escalate to Kiwi flying to the answer, so nothing needs blind
  guessing. Rejected: visible giveaways (an item on the right stall) — they
  make the question pointless.

## 2026-10-25 — Engineering inherited from the sibling 3D games

- Stack and layout as monster-island/aquarium-tycoon: React 19 + R3F + three
  0.186 + zustand + TS + Vite 8 + Vitest + Playwright; pure rules in
  `src/game/logic` with unit tests; async scripted flows; per-frame state in
  `runtime.ts`; test hook only with `?e2e=1`; procedural PartBuilder models,
  inline SVG icons, Web Audio synthesis; adaptive dpr ≤ 1.5; GitHub Pages with
  a relative base.
- Review galleries (`?gallery=items|people|world|ui`) let parallel workers
  build and screenshot their slices without touching the shared app entry.
