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

## 2026-10-27 — Frozen UI/audio presentation boundary

- **UI API v1 is a presentation controller plus a React host.** `createUI`
  exposes `say`, `prompt`, screens/cards/notices, settings, slot rectangles,
  district music and measured bottom-panel height; `docs/UI_API.md` freezes
  the contract. It accepts core model types, returns recognized input, and
  never applies game rules or writes saves. Integration receives menu/reset
  callbacks and owns world input locks, chapter flows and persistence.
  Rejected: an App/game store in this slice, or presentation code deciding
  whether an answer is true.
- **Spoken lines require voice completion and a child-controlled Continue.**
  Replay leaves the acknowledgement pending; replacing/cancelling commands
  settles pending promises. Screens retain a small back history so closing
  title Settings returns to Title. The actual rendered bottom-panel height
  is observed rather than guessed, and fixed backpack slots report viewport
  CSS rectangles for the existing world FX. Rejected: a hard-coded camera
  offset and promises stranded when a conversation is left.

## 2026-10-27 — Speech ladder and classroom audio hygiene

- **The controller delegates every speech verdict to the frozen core judges.**
  Misses are per prompt: retry with JP tip, then Kiwi modelling with capture
  closed, then tappable cards. An incomplete noun receives the whole-question
  tip. Transient errors request another press without increasing misses;
  silence is one miss; error/end pairs cannot double count. Permission,
  hardware and unsupported errors enable session-only mic-free; teacher
  settings remain separate. `fallbackSuggested` unlocks only this prompt.
  Rejected: automatic mic restart, persisting a device error as teacher
  preference, or using inventory truth to influence recognition.
- **Kiwi modelling has an explicit animation hook and truthful-answer port.**
  The controller speaks independently and waits for both the animation and
  speech. Integration supplies the answer from current holdings; without it
  Kiwi models both answer forms. TTS closes capture synchronously before
  playback; stopping speech never reopens the mic. A second mic press or
  opening a panel pauses capture without adding a miss. Rejected: guessing
  “yes”, holding a trackpad button, and queued mic presses during TTS.
- **The optional coach is lazy and advisory.** Only item near-misses request
  it; it uses the vendor adapter and lives inside the prompt. Coach Listen
  closes capture and holds an independent audio ducking lock so overlapping
  game speech cannot restore music early. Mic-free and `?coach=off` disable
  it. Recognizer/TTS/coach ports are injectable for later e2e without adding
  the integration slice's window hook. Rejected: editing either vendor or
  letting a pronunciation hint change the recognized verdict.
- **One procedural Web Audio scheduler owns backgrounds and crossfades.**
  Each district and celebration has a retained track; per-track gains fade
  over 1.5 seconds. Music has its own volume bus, ambience shares Effects,
  and speech ducks both backgrounds. Listening sets background gains to
  exactly zero, including native recognizer startup. TTS cancellation settles
  all promises, and its watchdog cancels actual browser playback before
  releasing the speech lock. Rejected: recorded assets, one context per
  effect, and a listening fade with a tail that can bleed into recognition.

## 2026-10-27 — Chromebook presentation and review fixtures

- **Warm paper cards carry the interface, with system fonts and the existing
  art-kit SVGs/portraits.** The nine-slot backpack stays visible above talk;
  its compact icons have 44px targets rather than the draft's 40px sketch.
  English dialogue is 30px, prompt sentences 28px and JP/support at least
  16px. Large panels scroll internally; dialogs trap/restore keyboard focus.
  Item inspection uses a small R3F canvas and shared art-kit geometry, with
  an icon fallback without WebGL. Rejected: smaller text to fit all states,
  downloaded fonts, duplicate item drawings and disposing shared geometry.
- **The UI gallery is deliberately independent of real game wiring.** It
  auto-registers through the existing gallery discovery and presents mocked
  core state, explicit ladder snapshots and a lightweight DOM landscape.
  The 44 named views include confirmations, Japanese-only dialogue, coach
  layout, all journal tabs, error/rescue states and all five tips. Screenshot
  specs add 1366×768 views plus 1280×800/touch Ask layouts. Rejected: chapter
  scripts solely to reach screenshots and edits to the frozen World API.

## 2026-10-28 — Playable integration and persistence

- **Async game flows coordinate the frozen model, World and UI APIs.**
  `flow/game.ts` owns conversations, input locks, menus and chapter boundaries;
  `flow/presentation.ts` translates model beats into dialogue, gestures, item
  arcs and cutscenes. An epoch invalidates cancelled conversations before late
  input can apply. Rules remain in the pure model. Rejected: duplicating trade
  or truth rules in React components, or expanding the frozen presentation APIs.
- **A vanilla zustand store keeps the current game and retained campaign
  separately.** Phase, busy state, hint level and teacher settings belong to
  integration; the complete generated instance remains in the model state.
  Replays use `tt.replay.v1` and retain `tt.save.v1` for Continue and chapter
  selection. Per-frame movement stays in the world runtime. Rejected: a React
  update on every movement frame or replay overwriting campaign progress.
- **Save at completed beat sequences, arrivals and completed chapter
  transitions.** Apply each atomic model Step before its presentation, then
  checkpoint after presentation and before the next prompt. Cutscenes do not
  save halfway through a chapter transition. Persist only `x`, `z`, `yaw` from
  the renderer player so Continue's safe relocation preserves the same save
  shape. Rejected: persisting renderer height/speed, saving every frame, or
  restoring halfway through a presentation without a resumable beat cursor.
- **World taps have a 48 CSS pixel nearest-interactable fallback.** Thin
  stationery can be missed by an exact mesh ray even when a child taps the
  visible item. Nearby targets use the same walk-and-interact command as mesh
  hits. Rejected: enlarging visible models or requiring pixel-perfect taps.

## 2026-10-28 — Integration e2e isolation and progress waits

- **Each full campaign has its own spec file and Playwright project.** A single
  worker runs the short group, mic-free campaign and speech campaign serially;
  project boundaries create fresh workers and browsers for both long runs.
  `e2e` still covers everything, with `e2e:short` and `e2e:campaign` for focused
  runs. Rejected: separate files alone, which can reuse the same browser worker,
  or parallel SwiftShader campaigns competing for GPU/memory resources.
- **Campaigns retain named review screenshots and failure screenshots, without
  continuous tracing.** This avoids retaining hundreds of DOM snapshots and
  screencast frames during long software-rendered runs. Short tests retain
  failure traces. JSON results preserve per-spec durations. Rejected: dropping
  required visual evidence or reducing real-input coverage to shorten tests.
- **Dialogue settling waits for progress, and retries identify fresh prompts.**
  The contradiction failure trace showed successful Continue clicks taking
  about 25 and 55 seconds under browser pressure; a 45-second total deadline
  expired while Kiwi/re-ask dialogue still advanced. Each real acknowledgement
  now resets the inactivity deadline, within the overall test timeout. Re-asks
  must have fresh question IDs, and accepted Yes must clear the latest retry.
  Rejected: assuming the Mayor asks first, waiting on an old prompt, or raising
  every timeout without checking actual progress. Playwright runs are serial
  so their shared output directory cannot be deleted by a competing run.

## 2026-10-28 — Chapter 5 projected-target race

- **Wait for a stable rendered target before automated screen clicks/taps.**
  A narrow canonical Chapter 5 checkpoint reproduced the notebook-to-Ken stall.
  The path to Ken was reachable; the test sampled his position while the pickup
  conversation camera eased back to follow. Instrumentation measured Ken moving
  roughly 239 CSS pixels between projection and pointer-down. The stale click
  selected ground, producing a path with `pending: null`, then no interaction.
  The helper now requires four rendered frames with less than 0.5 pixel target
  movement before clicking; it still uses real mouse/touch input. A focused
  checkpoint regression retains collection and Ken dialogue through the real
  flows. Read-only `__tt` navigation diagnostics distinguish ground walks from
  cancelled or blocked interaction approaches. Rejected: increasing the 1.9m
  interaction range or 48px tap tolerance, altering collision geometry that was
  already reachable, retrying missed clicks until success, or replacing visible
  target clicks with hook-driven walks. No World/UI API change is needed.

## 2026-10-28 — Keyboard interaction and unlocks never drop input

- **E/Enter resolves focus on the keypress when none is cached.** Locked
  frames clear focus and it was only rebuilt on the next rendered frame, so an
  E pressed right after leaving a conversation (Esc, then E) was silently
  ignored on a slow Chromebook-class renderer. The keyboard handler now runs
  the same focus calculation as the frame loop. Rejected: queueing the press
  for the next frame (could act on a stale target) and keeping focus while
  locked (stale across state changes); waiting for focus in the e2e test would
  have hidden a child-facing dropped input.
- **Only locking cancels a walk.** The flow re-publishes the lock state on
  every store update, and `setInputLocked(false)` used to clear the path and
  pending target each time, so any unrelated update (hint timer, settings)
  during a tapped approach could strand the player. WORLD_API.md now states
  that unlocking leaves an active walk alone. Rejected: diffing the lock state
  in the flow, which leaves the world API trap in place for other callers.

## 2026-11-03 — Graphics and visual polish

The teacher supplied a 14-section upgrade plan ("a living 3D storybook"). It was
accepted with these changes. Gameplay, English, chapters, saves and collision
behaviour are unchanged except where noted.

- **The muddy look had two causes, and neither was the art.** R3F's default ACES
  tone mapping desaturates everything, so all canvases are now `flat`: authored
  colours reach the screen, at no shader cost. And `PartBuilder(0)`, meant as "no
  ambient occlusion", darkened anything at or below y = 0 to 58%, which covered
  all paving, grass, bunting and the lower half of every lantern. Fixed at source.
  Rejected: brightening every colour to compensate.
- **The "beige beam" was the raised drawbridge,** a 13.6 m leaf at 78° standing
  right where the follow camera sits. The plan asked both to remove the beam and
  to keep the drawbridge animation unchanged. Hinge, easing and collision are
  unchanged; the raised angle drops to about 29°. At that angle the follow camera
  clears it everywhere, because a ray from the camera to the player climbs faster
  than the leaf does. Rejected: fading a 13 m slab in and out of the main view.
- **Occlusion is a dithered hole, not transparency.** Scenery shaders discard a
  stipple pattern in a screen-space circle around the player and their partner
  (or the two nearest people), only for fragments more than 1.1 m in front of
  them, and fade anything within 3 m of the lens. This costs no draw calls and has
  no sort problems, and it works on one merged mesh holding a whole district.
  Depth and pixel position are computed once per frame; the fragment test is about
  20 operations, on scenery only. Rejected: per-object alpha fades, which would
  mean splitting the merged meshes (draw calls) and sorting transparency.
- **The conversation camera chooses its side.** `cameraRig.ts` tries both sides at
  several distances against a list of solids, trees, cottages, awnings and posts,
  and takes the best view of both heads. The old fixed side was blocked in 9 of
  174 approaches; the new one in 0 (unit tested, with the old formula kept as the
  known-bad control). It is chosen once per pairing so the view never jumps.
- **Merged scenery is split into map-cell chunks.** One district-sized mesh has a
  bounding sphere that is never culled, so every district drew every frame.
  `PartBuilder.buildChunks` gives frustum culling something to work with. Roughly
  three times the scenery now costs about the same triangles per view as before.
- **Nothing is strung south of the player or across the middle of a play area.**
  The camera looks north, so anything south of the player hangs between them and
  the lens, right across the screen. First renders with lantern wires crossing the
  market street proved it. Market lanterns hang on stalls and along the north
  fence; the festival's pennants run north from the maypole and along both edges.
- **New colliders, festival and square only.** Four corner planters in the square;
  in the grounds a prize tent, drawing booth, two picnic tables, a maypole and two
  stage planters. "Keep the collision unchanged" and "add a stage, stalls, a tent
  and tables" cannot both hold if furniture is to be solid, and walking through
  a visible table is worse. All stand at the edges away from routes, spots and
  placements; the unit tests re-solve every chapter's routes through them. Fences
  that stood inside walk areas moved just outside them, with no collision change.
- **The chest stands on the stage in Chapter 5,** as SPEC §6.5 always said, instead
  of beside it on open grass where players could walk through it. It is also 1.5×
  larger (inside its existing footprint in the square) so its medallions can be read.
- **Reject: stationery on display at the stalls.** The plan offered it "where
  appropriate" and warned against spoilers. It would show which trader has what
  before the child asks, which removes the reason to ask ("Ask before you get",
  and the earlier rejection of visible giveaways). A trader shows the item in hand
  once asked, as before.
- **State still applies first; what a deposit reveals waits for the item to land.**
  `holdDecorations` and `setFinale` hold the chest lid, dusk and decorations back
  during the beats, then each chapter's clear plays a short camera shot of the town
  getting more festive. Previously the lid opened and the lanterns appeared before
  the pen had left the player's hand. World API v1.1 adds these and a few character
  commands (see WORLD_API.md); nothing existing changed meaning.
- **Dusk comes with the ninth item.** Fireworks and lanterns need a dark sky, and
  additive sparks on a pale one are what read as "faint confetti". The day also
  warms slightly with each deposit. Only light colours and fog change, so it adds
  no lights. Kept bright enough to play in, since free roam stays at dusk.
- **Fireworks run on the GPU.** Every spark's whole flight is vertex data and one
  uniform drives it: a salvo of four shells (about 1,300 points) is one draw call
  and no per-frame CPU work. Rejected: more instanced matrices per frame.
- **Characters ease toward a target pose every frame,** so all state changes blend
  without a transition table. Faces build lazily (expression × blink × talking) since
  most combinations never appear. Limb segments were reduced so a full cast of 19 fits
  the triangle budget; the head stays round for portraits and conversations.
- **Fixed in passing:** helped NPCs re-cheered on every state sync and never strolled
  (they now keep a happy face and cheer once, when helped); the `talk` state never
  ended (it is now timed); NPCs faced away from the camera by default (they now face
  it unless busy); coplanar grass slabs z-fought at the edges of the square.
- **The interface draws its own icons.** Emoji render differently per OS and some
  managed Chromebooks lack the glyphs. `UiIcon` matches the item icons' ink and
  stroke. ✓ and ✗ stay as text so Yes and No are never colour-only. The empty-slot
  silhouettes of pen, marker and pencil got separate drawings, since a one-colour
  outline loses the only thing that told them apart.
- **The backpack bar hides during the finale.** Final review of real game renders
  found the empty bar sitting over the opening chest. `setBackpackHidden` keeps its
  layout, so slot rects stay valid, and it comes back for free roam. Rejected:
  moving the finale camera, since the dialogue panel leaves little room to frame it.
- **Pushing to `main` deploys,** because the Pages workflow runs on push. The plan
  said not to deploy; the teacher then explicitly approved pushing to `main`.

## 2026-11-03: the 22 visual, collision and interaction fixes

The teacher's list of 22 problems, reviewed against the source before work began.

- **The bench turns to the follow camera; the camera stays.** The follow camera sits at
  offset (+4, +8, +11), a yaw of `atan2(4, 11)` (about 20 degrees). A line along the
  camera's right vector projects level on screen from anywhere, so Grandma Ume's bench,
  its collider and her seat use exactly that yaw, as one constant. Rejected: rotating the
  square's camera, which was tried and deliberately reverted.
- **A raised bridge is stopped at its hinge.** The leaf hinges at z=17.2 and rises over
  `bridge-approach`, which is ungated and walkable to z=20, so players walked under and
  through it; the old collider at z=24 was out of reach. The closed collider now covers
  z=17.2 to z=20. Rejected: gating the whole approach area, which leaves no boundary to
  match the visible hinge.
- **Gate collision opens when the animation finishes, not when the state flips.** Skipping
  an intro next to a gate could otherwise let a player cross while it was still moving.
  Closing is immediate. With no renderer (unit tests) gates count as settled.
- **The school gate has a slot through its east post and slides at a watchable pace.** The
  post becomes a stone portal: piers in front and behind, solid above the panel. The panel
  parks with its west end still in the slot. It eases over about 3 s rather than the shared
  exponential, which moved 8 m in about a second and hid the wheels; the unlock shot must
  cover it.
- **The stage steps are a real route.** Rejected: solid steps. A stone path leads to them,
  so a wall there reads as a bug, and the stage is a good place for a child to stand. Each
  step is a walk area at its visible height and the player's y eases between them. The
  stage's edges become thin solids with the step opening left clear. The stage is reachable
  only once the arch opens (Chapter 5), which is also when the Festival Chest stands on it,
  so that chest's stage collider can be a static solid.
- **E no longer depends on which way the player faces.** The facing cone made E look
  unreliable; facing now only breaks ties. Items also need a line of sight, since E could
  reach a library item through the wall from outside. A target's own collider does not
  count as blocking it.
- **The harbor chest's collider is static,** because its model is visible in every chapter
  and only its interaction depends on Chapter 4.
- **Z-fighting is audited, not eyeballed.** A headless screenshot cannot show flicker
  during movement, so a unit test scans built static geometry for overlapping coplanar
  faces of different colours. Rejected: polygon offset or global depth changes, which the
  teacher ruled out.

### Batch 1 implementation details

- **Gate progress has an exact settled endpoint.** The existing exponential
  animation snaps its last 0.001 to the target; navigation opens only at 1 and
  closing blocks immediately. Walk requests made while a gate opens wait for
  settlement. Continue sets restored gates to their final pose before relocation;
  no gate timing enters the save format. With no renderer, logical gates are
  settled. The e2e hook reads the actual progress and effective navigation gates.
- **Interaction visibility tests the direct segment.** Items ignore their own
  supporting furniture, and the sea chest ignores its own footprint; walls and
  other scenery still block them. Facing only resolves equal-distance focus.
  Keyboard and tap approaches share a short duplicate-input cooldown and the
  same range and visibility checks, with an E/Enter marker on the focused target.
- **Review snapshots can hold rendered gate poses.** Only the world gallery
  passes this override, allowing exact quarter-progress school-gate views without
  altering normal animation. Gameplay review views retain the specified follow
  offset, including inside the library; normal library camera behavior is unchanged.

### Batch 2 implementation details

- **The library entrance is complete outside and cuts with its walls inside.**
  A masonry lintel spans the existing 3.2m gap; two open leaves fold against the
  outer east wall without changing its walkable opening or adding collision.
  The indoor threshold now matches the library camera's actual room bounds.
  North/west walls remain standing, the south wall lowers indoors, and east
  wall sections lower only when the actual eased camera's body sightlines cross
  them. The entrance assembly cuts with an obstructing adjoining wall or lintel,
  avoiding a freestanding frame during the doorway transition. Premerged
  alternatives keep this at one visible shell draw call.
- **The school portal is sized from the moving geometry.** Its slot runs from
  local z=-0.16 to +0.33 and up to y=2.2, clearing cones and projecting rollers.
  The plinth shares the slot; masonry bridges above it. Travel is 8.05m, leaving
  the panel's west edge at x=3.85 inside the east post while clearing the passage.
  Roller centres at y=0.29 rest on the track top at y=0.04; rotation remains
  negative displacement divided by the 0.25m radius. The tree at (12,-20.2)
  stays in place: swept geometry bounds including wind clear it.
- **The three-second school motion belongs to its unlock shot.** The first
  campaign Chapter 2 clear holds rendered progress at zero during the deposit
  and clear card, then releases it after the school shot's camera lead-in.
  The shot covers the full sweep, and the new-area card waits for settlement.
  Core progression and saves are unchanged; Continue starts settled. Other
  gates retain their existing timing. Read-only `__tt.readGates()` exposes the
  hold, actual progress, effective navigation, displacement and wheel rotation.
- **Ms Page keeps a supporting arm while carrying her book.** Her right palm
  supports its lower edge with a bent elbow and the pages toward her. Her other
  arm, head and body can gesture across states; showing a traded item keeps the
  normal item presentation pose.
- **The audit gates repaired regions and reports future work.** It scans actual
  merged vertex-coloured triangles, including hidden contacts, and counts
  different-colour, same-facing overlaps with positive area inside each named
  region. The 1.907mm plane tolerance is two 24-bit depth steps at 40m with the
  real near=0.1/far=420 camera (normal follow distances are 9–14m; fog starts at
  40m). Shelf carcasses use butt joints; shelf footprints, solids and spot
  positions remain unchanged. The gate audit also found duplicated kerbs,
  grass-coloured verges and foundation sides at the square/school junction:
  shared mitres and disjoint foundations fix that same issue 9 overlap. Sign
  painting uses a headless canvas stub; textured lettering is excluded because
  its colours are not vertex data. Later-batch objects are measured, not fixed.

### Batch 3 implementation details

- **The bench and its support frame share the authored follow offset.**
  `FOLLOW_CAMERA` retains (+4,+8,+11) and the 0.8m look height; its x/z offset
  derives `GRANDMA_BENCH_YAW`. Every bench part rotates about (-10,4), together
  with its box collider and Ume's seat/home frame. Crossrails finish beneath
  the wooden planks, with narrower sides than the legs; arm supports butt
  against the arm undersides. Projection tests use that actual follow frame
  at several player positions, with no camera change.
- **Ume's seat support is independent of her upper-body state.** Her pelvis
  rests at y=0.42, at bench-local z=0.35; the walkable interaction point is
  local z=1.15. A Ume-only articulated seated skirt and concealed shin length
  put her knees forward and her original-size shoes on the ground. Supported
  hips and lower joints stay fixed during speech, moods and gesture blends;
  her standing geometry returns when she leaves the bench. Per-frame skinned
  contact tests cover transitions, and front/side routes exercise keyboard
  and tap approaches. Read-only `CharacterRig.seated` and scene
  `group.userData.seated` expose the support state for inspection.
- **The chest has one sole and true support surfaces.** Hidden carcass/strap
  bottoms and front-panel backing faces are separated geometrically; the
  original visible panel fronts remain in place. Gold medallion borders fit
  the existing 0.262m row pitch instead of overlapping adjoining rows; icon
  centres and slots are unchanged. The square dais uses disjoint stone,
  carpet and gold inlays finishing at 0.15m. Stage decking finishes at the
  existing 0.60m walking/chest height. A fitted shadow lies 6mm above either
  support, using the same geometry in the renderer and audit. Base and slot
  transforms stay fixed while the lid opens; the sole remains grounded during
  the existing deposit pulse.
- **The Coming Soon sign hangs between its ropes.** The atlas-measured label
  sets the board width with a 16cm border. Its painted face points east (+x),
  with a separate rope from each short post to the corresponding upper board
  corner. Board, ropes, posts and lettering share the existing lowering group,
  so unlock removes the complete barrier. Merging the board into its barrier
  geometry also removes a draw call.
- **Cottage joints are repaired in the shared cottage builder.** Roof courses
  abut instead of overlapping, timber rails butt against posts, window layers
  have distinct depths, and the door arch contains only its upper semicircle.
  The step clears the foundation by 1cm. All twelve houses share these fixes,
  including the northeast house and the east harbor house anticipated for
  Batch 4. House locations, materials and ridge directions are preserved;
  the library's roof and window helpers are unchanged.
- **The repaired regions are zero-count audit gates.** The bench, square and
  stage chest assemblies (including platforms and actual shadow planes), and
  all `HOUSES` are gated at the existing depth tolerance. Chest lid checks
  include closed, intermediate and open poses. Issue 9's existing school-gate
  ground gate reports zero, so no additional ground edit was needed. Expanded
  inspection also found inherited overlaps inside filled stationery plaques
  and at their medallion contacts. Those unchanged item models remain an
  explicit, separately reported finding outside this chest-base repair;
  the required assembly gate retains its original empty-slot scope. No depth
  settings, polygon offsets or render-order workaround was introduced.

### Batch 4 implementation details

- **The harbor easel belongs to the merged district geometry.** The old standalone
  scaled prop is replaced at (-10,32), facing east as before. Two splayed front
  legs and one rear leg have horizontal-cut soles at paving height, within the
  existing collider. A wooden ledge carries the canvas; it leans back against
  the front frame. Painted bands have separate face depths. Leo stays at (-8,32).
- **Fish clearance comes from the actual land outline.** `isOpenWater` uses the
  same sampled river bank, harbor polygon and outward sand slope as `landGeometry`,
  plus existing pier/bridge bounds and shared mooring transforms. A conservative
  0.8m margin exceeds the fish's full radius. Tests sample 201 phases and every
  transformed body vertex. The old (-11,39) spawn really was on grass: a raycast
  against the built land mesh proves it. The old (-3,41) spot also intruded into
  the yacht clearance. New spots retain the 1.2m, 1.05m-high jumps and nine-second
  stagger; the first remains near the normal harbor view. Splashes share those
  endpoints. Idle instances collapse so lowered scenery cannot expose them.
- **The east harbor house needed no further edit.** Its Batch 3 cottage gate
  remains zero. Expanded coverage includes the adjacent fence, tree and barrel
  at (20,33), and found overlapping rectangular rope segments in the fence.
  These and the pier rails now use continuous four-sided tubes with shared
  rings; their bends no longer place differently coloured faces on one plane.
- **The pier end has distinct structural joints.** End trim now abuts the deck
  instead of sharing its top plane; the lantern has a projecting wooden bracket
  rather than an unsupported water placement. Deck bounds and walking height
  stay fixed. The expanded gate includes the life ring, rails, supports, trim,
  lamp and actual water plane, and reports zero; adjacent east harbor scenery,
  the easel and the prize board also have zero-count gates.
- **Bridge ropes divide the leaf by span count.** Six equal spans join seven
  posts on each side. Both end-post feet lie entirely on real deck planks, with
  their soles at plank height. Tests check attachments at both ends/sides in
  raised and lowered transforms, equal sag, and the unchanged Batch 1 rail
  collider bounds. No new animation/state machine is introduced; existing
  `__tt.readGates()` remains the read-only gate inspection surface.
- **The prize sign mounts below the roof hem.** A dark wooden board on two short
  front counter posts carries the full atlas sign at y=1.44, on the +z-facing
  side. Its top is 1.90m, below the lowest 2.35m scallop, without changing the
  tent footprint, location or camera. Final readability at both requested
  viewports remains for the controller's visual acceptance.

## 2026-11-04 — Camera, dialogue, library door, debug menu

- **Village Square looks straight along the bridge, and the bridge keeps that view.**
  The bridge belongs to the harbor district, but the alignment exists to show it, and
  the square's edge is at its foot. The view holds across the square, approach and deck,
  then eases out by distance over 5m (`followOffset`), so standing on a boundary cannot
  flicker. Rejected: switching at the square's edge, which swung the camera at the
  moment the bridge was in view. Other districts keep their angle beyond the blend.
- **Only Continue ends a line.** `say` no longer awaits speech at all, because Continue
  cancels it anyway. A lost browser completion event therefore cannot hold the game.
- **Continue acts on pointerdown; keyboard and assistive clicks arrive as detail-0 clicks.**
  Finger slip can no longer lose a tap. A 300ms guard after an accepted press stops the
  second half of a double tap, or a held key, from skipping the next line. Rejected:
  claiming the resolver alone, which only protected until the next line was published.
- **A button focused by a pointer does not capture Space or Enter during a line.** Only a
  button reached with Tab keeps its own key behavior. Rejected: `:focus-visible`, which a
  key press turns on for a clicked button in Chromium, as a real-input test showed.
- **The dialogue key handler reads live state, not an effect's captured state.** The effect
  re-subscribes after paint, so a key pressed during a slow frame could see no line at all
  and be lost. A real-input test caught this intermittently under SwiftShader.
- **Gable triangles wind outward.** They were wound inward and culled from outside, which
  left a see-through hole under the library roof and on every cottage. The library's now
  sits flush with its walls' outer faces, so no ledge shows between wall and gable.
- **The library door is 1.8m with one open leaf that has a collider.** The frame shows on
  both faces. Cutaway starts at the wall's outer face, since the narrower frame would
  otherwise hide a player standing in the doorway.
- **Route shortcuts keep 2cm of spare clearance.** Samples 0.2m apart could miss a corner
  by up to 1.5cm between them, which the narrower door exposed.
- **Debug menu on Ctrl+Alt+D, in the live build too.** It rewrites the campaign save and
  reloads, rather than jumping live, so no running cutscene can touch the new chapter;
  the reload also leaves the title's click to restore speech activation. Ctrl+Alt+D was
  chosen because it collides with no Chrome or ChromeOS shortcut we know of and is hard
  to press by accident. Chapter 5 is the state with every area open.
- **The published page names its commit** in `<meta name="tt-build">`, shown in the debug
  menu, so a stale deployment can be told apart from a broken change.

## 2026-11-04 — One follow yaw and frozen scenery corrections

- **All districts share the straight north-facing follow frame.** The canonical
  offset is (0,8,12), looking at player height 0.8; there is no district blend.
  The library retains its closer height and pitch with offset (0,6.2,7) and a
  target half a metre north. Movement still follows the actual eased camera yaw.
  Authored conversations and paths retain their angles, except chest close-ups.
  This supersedes the earlier square-only alignment and camera-derived bench yaw.
- **Ume's bench has its own world frame.** Its centre is (-10.6,8.2), east of the lamp's
  line because the first placement at x=-12.6 put the lamp column across Ume on screen, yaw PI/2,
  with Ume facing the fountain along +x. Seat, interaction home, geometry and
  collision share that frame; the south end leaves 0.79m before lamp-square-0's
  collision circle. The flowerbed and its eraser move together to (-9.8,-6.2),
  leaving the whole footprint at least 0.45m outside the gold ring.
- **Ring gaps reveal grout.** A continuous square-only annulus uses the existing
  paving grout at y=0.004 between square stones at y=0 and unchanged ring stones
  at y=0.008. Gold shares the ring-stone height; the Festival Grounds are unchanged.
  Geometry separation resolves the overlap without depth or rendering overrides.
- **The library roof lifts as one slab.** The existing 0.5 pitch and overhang stay.
  Lift includes the outer timber face, the slab's 0.14m normal thickness and 1cm
  clearance; gables meet its underside, flush with the wall faces. The cutaway
  includes the projecting doorway frame so both body sightlines remain clear
  during the transition with the new yaw.
- **Harbor balloons clear the whole sign board.** The -7 post cluster moves to
  -4. The radius-inclusive sign check also catches -13, so that cluster moves to
  the free post at 5, flanking the bridge opposite -4. Rejected: sharing post -16,
  which would stack two identical clusters in the same place. All eight clusters,
  their colours and offsets are preserved.
- **The Festival chest is centred on the stage sun.** Chapter 5 uses (-63,0.6,0),
  yaw zero, between the drums. Chest close-ups look straight from +z above the
  south drum; fireworks originate at the moved chest and the cast stays clear.
  The e2e-only chest preview changes renderer state without campaign/save changes;
  readScenery exposes its semantic finale state and actual lid angle for waits.
  Gameplay screenshots at both requested sizes are controller-owned artifacts in
  .tmp/shots/scenery; implementation does not claim visual acceptance.

## 2026-11-04 — District cameras, stalls, stage, rope, entrance ground

- **The Market looks east and the Festival Grounds look west; everywhere else looks north.**
  This supersedes the single-yaw decision above, at the teacher's request. The follow
  frame keeps radius 12 and height 8 and varies only its yaw. Blends run by distance over
  6m (about x 18..24 and x -22..-28), so Village Square keeps exactly its own view and
  standing on a boundary cannot flicker. The angle is interpolated, not the position:
  a straight line between two offsets would pull the camera in toward the player.
- **Held movement keeps its heading through a camera turn.** Input is camera-relative, so
  holding Right through the Market neck would otherwise bend into south and into a wall.
  The yaw is latched until every movement key is released or input locks; a fresh press
  uses the new view, so Up walks east in the Market and west on the Grounds.
- **The Festival chest faces east (yaw PI/2).** It now faces the same way as the sun and
  toward the Festival camera, which removes last round's conflict of a chest turned side-on
  to its stage. Chest close-ups shoot from +x. Its position is unchanged.
- **Fruit and Flower stalls turn exactly 190 degrees, the Games stall exactly 180.** The 190 is
  deliberate, so its 10 degree skew shows; colliders use the same yaw and shopkeepers stay put.
- **The rope has a collider only where it crosses walkable ground.** That is the first east
  pier span and its two posts; the pier's west edge is an opening. Generic collider shadows
  exclude it.
- **Entrance ground is fixed at its source.** The school neck's mitred edge clipping and
  disjoint foundations now serve the Market and Festival necks too, and the Festival path's
  stones are trimmed against paving laid earlier. A built-geometry audit
  (`town/entranceAudit.ts`) gates faces, stacked stones and flowers on paving.
- **The visible sign says Market.** District names, chapter titles and vocabulary keep their words.

## 2026-11-04 — Straight stalls, one stage sign, prompt intro, visible bridge

- **Fruit and Flower stalls face the stalls across the aisle (yaw PI).** This supersedes the
  190 degree rotation. At yaw 0 a stall's front faces +z, like the Bakery and Toy fronts, so PI
  makes them exactly parallel and facing. Lily and Sara stand at yaw PI, looking over the aisle.
- **The stage has one permanent sign, on the roof.** It reads School Festival in the former Welcome
  board's red style. The old header board and the scallops around it are gone. Rejected: keeping it
  as the milestone pop-in Welcome was, because the only sign would then appear at the finale, leaving
  the stage nameless for all of Chapter 5.
- **The Festival Grounds signpost is gone.** The arch names the place.
- **The intro ends with its last line.** A 25 second minimum held the mission card back from anyone
  who read quickly, with nothing on screen to explain it. The wind's 3.6s opening stays.
- **The bridge lowers on camera over a finite three seconds.** It used to ease exponentially from
  the moment the chapter completed, behind the clear card. It now shares the school gate's clock
  and hold, so navigation still opens only on the exact final frame. Cart and arch keep their
  old timing; they were not part of this request.

## 2026-11-05 — Supported roofs, working painters, and accessible Bye

- **Every market/festival stall uses the same full-depth local awning.** Its
  low edge is at z-hz-0.35, y=2.95, and high edge at z+hz+0.35, y=3.72.
  Four posts stand at x±(hx-0.16), z±(hz-0.14). World z no longer decides
  roof depth. Flower, Fruit and Games retain yaw PI, all stall footprints,
  counters, goods, signs and shopkeeper positions stay fixed except attachments:
  Flower's basket beam/baskets and Fruit's banana beam/hanging bananas move
  together onto the full-depth rear supports. Existing front lantern hooks
  remain seated inside the new roof slab at their unchanged positions.
- **Post caps meet the actual roof slab.** A shared pure calculation uses the
  awning line and its rotated 0.07m thickness to place flat caps strictly inside
  both faces across their 0.13m width. The drawing booth uses this calculation
  for its rear posts and two matching front posts seated on the table ends.
  Stage pillars retain their existing slope-cut caps, embedded 0.012m rather
  than exactly coplanar with the underside. The prize tent's four poles move
  inside its polygonal canopy and meet its panel planes; the picnic parasol
  pole reaches its peak. Their original fabric tops/hem keep their silhouette,
  with a 0.07m underside added in the same merged batch. The school entrance
  braces, cottage/building roof attachments, stage bunting and lantern hooks
  were audited and need no relocation. No lights or draw calls were added.
- **Notice-board papers have separate vertical space.** The middle upper/lower
  papers start at y=1.50/0.92, within the cork. Text bars and pins sit outside
  the paper faces. Roof halves butt at their ridge, removing a further overlap
  exposed by the new whole-board z-fight gate (80 pairs before, zero after).
- **Both school fence rails end on capped posts.** Include z=-35 west and
  z=-47 east once, with the original materials and dimensions. Source inspection
  corrected the brief: there are no fence-specific colliders; the existing
  courtyard walk boundary excludes these posts. The west endpoint is south of
  the library walls and approach. Collision/navigation boundaries are unchanged.
- **Painters stand within brush reach of their fixed artwork.** Ken's home is
  (10.79,6), Leo's (-8.92,32), with their original +x/-x facing. The actual rig
  gives about 0.059m/0.075m closest brush clearance through the animation cycle;
  Ken's arm/checking pose now reaches poster height. Home painters resume that
  facing after conversation. Chapter overrides still use their authored spots,
  presentation resolves Ken through world.positionOf, and saves store no NPC
  home coordinates. NPC rig radii are about 0.279/0.296m; interaction range is
  still 2.4m. Open-side paths/interactions are tested. No camera changes needed.
- **Bye belongs above the microphone.** Ask and answer prompts share a centered
  112×56px pill with bold 20px text and an 8px column gap. Mic-free mode keeps
  Bye in that column with its mode label beneath it. Replay stays right-aligned
  in the header. Existing close behavior, keyboard handling and dialogue rules
  remain. Read-only `__tt.readScenery().painters` exposes rendered cycle moment,
  position, yaw, home status and visibility for the controller's gameplay shots;
  no new state machine is introduced. Added E2E checks and screenshot captures
  are controller-run; implementation does not claim visual acceptance.
