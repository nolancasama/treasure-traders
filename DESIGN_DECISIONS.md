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

## 2026-10-25 — Built directly by Claude

Codex hit its usage limit about 30 seconds into the first two slices (both
returned QUOTA_EXHAUSTED with no usable code). The router fell back to Claude,
and the teacher said "do it yourself", so the slice plan in CURRENT_STATE.md
is executed directly, in the same order. The worktrees were removed.

## 2026-10-25 — Core model decisions

- **Interaction API = pure beat scripts.** `talk / ask / answer / collect /
  inspect` return `{ state, beats, prompt }`. State changes are applied (and
  can be saved) before any animation plays; beats are lines, gestures and
  events for the flow layer; the prompt is the next Ask or Answer input. The
  flow layer never decides game rules.
- **Questions carry ids** (`kind:target:item:serial`). A stale or repeated
  answer is ignored, which is part of the exactly-once guarantee alongside
  per-transaction once-ids (`c<chapter>:<seed>:<what>`).
- **Abstract solver, verified against the real API.** Validation searches only
  material state (holdings, roles, mission flags), not conversation
  details. Tests then replay the solver's plan through the real API for every
  chapter and for 25 full campaigns, so the two models can't drift apart. The
  same plan converter (`plan.ts`) will drive the e2e playthroughs.
- **Spot ids are abstract and stable:** `square-pencil`, `square-eraser`,
  `library-1..8` (three hold notebooks, active once Ms. Page asks; five are
  named distractors), `grounds-1..6` (one hides Chapter 5's R).
- **Sticker question items are deterministic** from the chapter seed, the
  asker and their ask count. About half are items the player holds, so
  "Yes, I do." comes up as often as "No, I don't.".
- **Nine stickers, not eight:** the sea chest's promised sticker is a new
  "anchor" (SPEC §6.6 updated) instead of taking one of the askers'.
- **Chapter 1 keeps the pen** at chapter end (Chapter 2's canonical start
  inventory), so the Mayor's "Keep the pen for trading!" stays true. Other
  chapters send leftovers to the spare box.
- **Residents without a role** stay at home, answer truthfully (they hold
  nothing) and use their flavour/"done" lines. Chapter 5 helpers and the Mayor
  stand at the festival stage; sticker askers stand at two asker spots per
  chapter (`placement()`).
- **esl-stt corrections live in the game wrapper** (`speechJudge.ts`), found by
  probing v1.0.0:
  - "pencil case"/"pen case" resolved to pencil/pen, so phrases are joined
    into one token first.
  - Live interim "pen…" could still become "pencil", so live acceptance of
    pen/pencil waits until the item word is not the last token.
  - There is no yes/no profile: the answer judge reuses esl-stt normalisation
    with game rules ("I do" = yes; "don't"/"not" = no; both = unclear; only
    the top hypothesis decides; live accepts only a clear yes/no word).
- **The save also checks item conservation.** Totals must equal the
  chapter's start, so a hand-edited or corrupted save that duplicates an item
  is backed up and replaced instead of loaded.

## 2026-10-25 — Art kit decisions

- **One skinned mesh per character.** Every primitive is rigidly weighted to
  one of 12 bones (hips, spine, head, arms + elbows, legs + knees). A body
  with moving head, arms and legs is 1 draw call, plus a face mesh. The
  sibling games used ~6 limb meshes per character; 18 NPCs plus the town
  would not fit ~100 draw calls that way. A fixed bounding sphere keeps
  frustum culling on.
- **Expressions swap the face geometry** (neutral/happy/sad/surprised × open/
  blink, prebuilt), so they cost no extra draw calls. Knees and elbows exist
  so sitting (Grandma on her bench), giving and "think" read naturally.
- **Gestures vs. looping states:** nod/shake/cheer/give/show are timed
  one-shots. "present" (an item held up) is a looping state, because a
  "Yes, I do!" line can outlast any timer; the flow ends it explicitly.
- **Items are modelled at real scale** with per-item display scales (world
  pickups ≈ 2–4×, in hand ≈ 1.4–3×). At true scale they vanish next to a
  person. Long items use a 45° pose in plaques like the icons. Flat items
  show their top; the stapler shows its side profile (its top view is
  unrecognisable).
- **Portraits are rendered from the 3D rigs** (small offscreen renderer,
  cached data URLs), not drawn separately. The journal face can never drift
  from the person in the world. There is a coloured-initial fallback without
  WebGL.
- **Hair under covering hats** drops the fringe and uses a smaller, lower
  volume, because hair spheres poked through caps. The headscarf replaces the
  hair.
- **Sea-chest engravings are pale gold inlays, larger than first drawn.**
  Children must identify them to ask the right question; dark-on-dark failed
  review.
- **Budget:** ≤ 4,500 triangles per character body (measured 3.2k–4.4k), ≤ 1,500
  per item, ≤ 2 draw calls per item. The 20-character line-up renders in 77
  calls including labels and shadows.

## 2026-10-27 — World layout, collision, and frozen integration boundary

- **Compact harbor and explicit support surfaces.** The hub follows the world
  draft, with square (0,0), market (37,0), school (0,-36), harbor (8,34),
  and festival (-48,0). The south bank is z=28–37 and the pier ends at z=49;
  the draft's z=58 pier was rejected because it adds unnecessary walking.
  The library is a raised 14×10m room with an east doorway, eight named
  supports, and an automatic roof/south-wall cutaway. Every core spot maps to
  a support top. Rejected: putting hidden items at arbitrary floating points.
- **Shared footprints, restricted land, and checked paths.** Scenery and
  collision consume the same rectangle/circle descriptors. Walk rectangles
  restrict water and district access; closed gates also have explicit
  barriers. Keyboard movement projects and slides in 0.14m substeps. Taps use
  a 1m A* grid with diagonal corner checks and line-of-sight smoothing.
  Rejected: direct steering alone, which strands tap targets behind the
  fountain or library furniture, and a separate invisible collision map.
- **World API v1 is frozen.** `createWorld` returns a frozen command/event
  object with a copied `WorldState` input and mutable renderer runtime.
  `worldStateFromGame` adapts placements, indicators, active items, gates,
  and chest state without applying rules. Interaction/arrival subscriptions
  and explicit camera, FX, gesture, held-item, input-lock, and panel-height
  commands are documented in `docs/WORLD_API.md`. Rejected: coupling the
  world to a React game store or running chapter scripts inside scene code;
  the integration slice owns flows, audio, UI, and model transitions.
- **Stable follow camera and deliberate framing.** Movement is relative to
  the smoothed camera, with no manual orbit. Conversations use an over-shoulder
  three-quarter shot; keyframed paths cover intro, gates, and finale. Bottom
  panel height applies a perspective lens shift, capped at 30% of the viewport.
  Input locks are explicit and cancel walking. Rejected: camera bobbing or
  changing field of view to make space for dialogue.
- **Merged scenery and shared instance batches preserve the budget.** Each
  district uses merged vertex colors; trees, lamps, flags, bunting, birds,
  droplets, cheap townsfolk, particles, and actor blob shadows use instances.
  Distant districts and actors are hidden; no real-time shadows or external
  assets are used. Decorations pop at chest counts 2/4/6/8/9. DPR starts at
  min(devicePixelRatio,1.5) and drops once to 1 after four continuously slow
  seconds below 28fps. Rejected: individual meshes for every prop/particle
  and shadow maps, which would spend the Chromebook budget on scenery.
  Review renders exposed floating harbor lamps and an interior fence segment;
  lamps now share explicit collision footprints on land, the fence stops at
  the library approach, and merged grass foundations support scenery outside
  the paved navigation areas. Grass outside those areas is decorative;
  paving and pier surfaces define the playable boundary. Rejected: widening
  navigation onto all background land, which would allow bypassing gates.

## 2026-10-27 — Cutaway readability and indoor companion

- Hide the library district label while its room is cut away, so signage never
  covers the playable interior. Kiwi automatically perches on the player's
  shoulder indoors; follow and hint flights resume outside the room.
