# Treasure Traders: The School Festival Quest — SPEC (frozen v1)

Frozen 2026-10-25. Source requirements: `docs/BRIEF.md`. Where this spec and
the brief differ, this spec wins; DESIGN_DECISIONS.md records why. Changing a
frozen rule needs a new dated entry in DESIGN_DECISIONS.md first.

JP title: 「トレジャー・トレーダーズ 〜学校まつり大さくせん〜」

## 1. Product

- A small 3D adventure for Japanese grade-4 students (9–10), aligned with
  Let's Try! 2 Unit 5 "Do you have a pen?".
- Target: managed school Chromebooks in Chrome. Tune and verify at 1366×768
  first, then 1280×800 and a 1366×768 touchscreen. Phone layout is an untuned
  fallback only.
- A 15–25 minute campaign in five chapters, each chapter 3–5 minutes, with a
  checkpoint at every chapter start. Completed chapters can be replayed with
  new seeded puzzles.
- English is the verb: asking and answering change what happens. There is no
  score, no timer, no penalty and no speed reward.

## 2. English

**Produced by the student**

- "Do you have a ___?" (always "an eraser")
- "Yes, I do." / "No, I don't."

**Heard only** (NPC and Kiwi lines). Short, about seven words at most: "This is
for you!", "Here you are!", "Thank you!", "Let's trade!", "Sorry!", "Great!",
"Oh no!", "I lost it!", "Please find a ___!", "Bring me a ___, please!",
"Hi! I'm Lily!", "Hi again!". Plurals appear only in heard lines ("my
notebooks") and count badges. The student never has to produce a plural.

Every English line has a short Japanese support line under it (smaller, muted),
switchable in Settings (default on). Japanese uses hiragana/katakana and only
grade 1–3 kanji.

**Vocabulary** (canonical order: backpack slots, journal, festival chest)

| id | English | article | Japanese |
|---|---|---|---|
| pen | pen | a | ペン |
| marker | marker | a | マーカー |
| ruler | ruler | a | じょうぎ |
| stapler | stapler | a | ホッチキス |
| calendar | calendar | a | カレンダー |
| notebook | notebook | a | ノート |
| eraser | eraser | an | けしゴム |
| pencil | pencil | a | えんぴつ |
| pencilCase | pencil case | a | ふでばこ |

One helper produces every article (`withArticle(id)` → "a pen", "an eraser").

**Introduction order.** These are the item cards shown in Ask prompts, cumulative.
Speech recognition always accepts all nine words.

| Chapter | Cards |
|---|---|
| 1 | (no Ask prompt; pencil, eraser, pen are heard and answered about; ruler is mentioned at the end) |
| 2 | pen, pencil, eraser, ruler, marker |
| 3 | + notebook, pencil case |
| 4–5 | all nine |

## 3. World rules (the logic model)

1. **Items.** Nine types. Holders: the player, an NPC, a world spot (a collectible
   or hidden item), the Festival Chest, the Captain's sea chest, or the spare box
   (out of play). Holdings are counts per type, usually 0/1 (the library has
   three notebooks).
2. **Truth.** Every answer to "Do you have a X?" is computed from holdings at
   that moment. NPCs never lie. The student's yes/no is accepted only if it
   matches the player's holdings. A contradicting answer is never rewarded.
3. **Ask before you get.** No item changes hands with an NPC until the matching
   question has been asked and answered "Yes". Either the student asked "Do you
   have a X?" and the NPC said "Yes, I do!", or the NPC asked "Do you have a
   X?" and the student truthfully said "Yes, I do."
4. **NPC roles** (data per chapter; a character's role can change between
   chapters):
   - **trader**: holds offer O and wants W. Asked about O: "Yes, I do!", then the
     trader asks "Do you have a W?" A truthful "Yes, I do." swaps the items (O to
     the player, W to the trader). A truthful "No, I don't." gets "Bring me a W,
     please!" and the journal notes the want. After a swap the trader's offer and
     want swap as well, so **every trade can be undone with the same person.**
   - **giver**: holds G. Asked about G: "Yes, I do! This is for you!" and gives
     it, once.
   - **requester**: needs N. When talked to, asks "Do you have a N?" A truthful
     "Yes" means N is handed over and the reward follows (an item or an event).
     A truthful "No" gets "Please find a N!" and the journal notes the need. If the
     requester also holds the reward item and is asked about it: "Yes, I do! But
     I need a N." and then asks for N.
   - **bystander**: holds items only so that the world stays consistent. Answers
     truthfully, never trades ("Yes, I do! I need it." / "No, I don't.").
   - **sticker asker**: an optional side character (see §6.6).
   - **Mayor Pom**: keeps the Festival Chest. He answers truthfully about its
     contents ("Yes, I do! It's in the festival chest!"). He collects the current
     chapter's targets only, and only when the player holds all of the chapter's
     remaining targets and the chapter's other missions are complete. In the
     Chapter 1 tutorial he collects each item as soon as it is brought. He asks
     about one target ("Do you have a ruler?"). A truthful Yes deposits all of
     them ("And the marker too! Great!").
5. **Exactly once.** Every gift, reward, deposit and unlock has a transaction id
   and happens once, even across save and reload.
6. **Chapter boundary.** At chapter completion, anything left in the backpack
   that is not a deposited target goes to the spare box ("We'll use these at the
   festival too!"). The next chapter starts from its canonical start state: start
   inventory, chest contents, unlocked areas.
7. **Unstuck guarantee.** From every reachable state the chapter goal is still
   reachable (validated, §7). Trades are reversible. Deliveries and deposits only
   accept what the goal path needs.

## 4. Interaction flow

1. **Talk**: come near an NPC (focus within about 2.4 m, nearest wins, with an
   indicator over them) and press E / Enter, click, or tap. Clicking a far NPC
   walks there first.
2. If the NPC has something to ask, the NPC asks first. This covers a requester,
   a trader who remembers their want, a scripted question, a sticker asker, and
   the Mayor with targets. Otherwise the Ask prompt opens (from Chapter 2).
   After an NPC's question resolves, the Ask prompt is offered. The student may
   ask the same NPC as many questions as they like, then press Bye (×) or walk
   away.
3. **Ask prompt**: "Do you have a ___?" plus the chapter's item cards (icon +
   English word). In speech mode the student says the whole question, the
   recognized item decides, and the cards are inert visual support. In mic-free
   mode or after the miss ladder, tapping a card (or keys 1–9) asks the
   question. The game shows "Do you have a ruler?" and speaks it in the player
   voice.
4. **Answer prompt** (the NPC asked): "Yes, I do." / "No, I don't." These are
   inert in speech mode, and tappable (keys 1/2) in mic-free mode or after the
   ladder.
5. **Reactions**: "Yes, I do!" means the item pops into the NPC's hand and they
   nod. "No, I don't." means empty hands and a head shake. Each new fact pings
   the journal.
6. **Contradicting answer**: the NPC says "Hmm? Let's look!", the backpack panel
   opens with the slot in question highlighted, Kiwi explains in Japanese, and
   the NPC asks again. After a second contradiction Kiwi says the correct
   sentence aloud. There is no penalty.
7. **Leaving** (more than about 4 m away, Esc, or Bye) ends the talk. State that
   has already been applied stays.
8. **Memory**: NPCs remember meeting the player (the greeting changes to "Hi
   again!"), answers, trades and help. Once their part is done they keep a happy
   idle and a thank-you line. After a chapter is cleared, its people comment on
   the festival's progress.

## 5. Speech

Use the vendored `vendor/esl-stt` (v1.0.0) and
`vendor/esl-pronunciation-coach` (v1.1.0). Never edit vendored files. Extend
them only through their options (aliases, profiles).

- **Tap-to-talk.** One press of 🎤 or Space opens one bounded session (esl-stt
  `createRecognizer`, default 8 s cap). The mic never opens without a press and
  never while the game is speaking.
- **Live acceptance.** `matchLive` runs on interim results. A correct interim
  result is accepted at once and the session stops. There is no confirm button.
- **Ranking.** Only the top hypothesis judges. Later alternatives can only rescue
  a result that matched nothing (esl-stt controlled-answer rank order).
- **Ask matching** uses the `controlledAnswer` profile:
  - The vocabulary is all nine items. The item word is required. The frame
    needs at least one of "have" or "do you".
  - A bare item word counts as `incomplete`, which is a miss with the tip
    "Say the whole question!".
  - The longest phrase wins ("pencil case" over "pencil"). "pen case" means
    pencil case. Plurals map to the singular.
  - Game aliases extend the defaults. Examples: marker: maker, marca. ruler:
    roller, rula, rular. eraser: razor, a razor, laser, racer. stapler: staple,
    stapla, stable. calendar: calender, karenda. notebook: note book, note.
    pencil: pensil. pen: penn.
  - Corpus tests cover every item, accent variants, the confusable sets
    (pen/pencil/pencil case, marker/maker), bare nouns and unrelated speech.
- **Answer matching** decides yes or no:
  - The yes family: yes, yeah, yep, "yes I do".
  - The no family: no, nope, know, "no I don't", "I don't", "I do not".
  - "I do" without a negation means yes. "don't" or "do not" means no.
  - Hearing both or neither is unclear: a retry, never wrong.
  - Recognition decides only what was said. Game logic then checks it against
    holdings.
- **Miss ladder (per prompt).** A miss is speech that was not understood, unclear,
  incomplete or silent. Miss 1: "Try again!" plus a Japanese tip. Miss 2: Kiwi
  says the sentence (the mic stays closed while it speaks). Miss 3: the choices
  become tappable for this prompt; speech still works. Silence alone never
  switches the whole game to buttons.
- **Errors.**
  - esl-stt `unavailable` (permission, hardware or unsupported) switches to
    mic-free for the session at once, with a short notice.
  - `transient` errors retry.
  - `fallbackSuggested` (three empty sessions in a row) makes the choices
    tappable for that prompt.
- **Coach.** On an item-word `near-miss`, build `toCoachAttempt(result)` and pass
  it to `createGameCoach`. It shows a Japanese hint card inside the dialogue
  panel, and its Listen button pauses the mic. The coach never changes a
  verdict. It is lazy-loaded (dynamic import), off in mic-free mode, and
  `?coach=off` is honoured.
- **Audio hygiene.** Music and ambience go silent while listening and duck under
  speech.
- **Mic-free mode** is a teacher setting, on the title screen and in Settings.
  There is no per-prompt opt-out button for students. In mic-free mode every
  prompt shows tappable choices. The logic and progression are identical.

## 6. Chapters

The Festival Treasure Chest stands in the Village Square beside Mayor Pom. Its
lid has nine item-shaped slots. Chapters deposit **2 / 2 / 2 / 2 / 1** items:
pencil and eraser; ruler and marker; notebook and pencil case; calendar and
stapler; and finally the pen. Each deposit lights its slot gold.
Decorations appear as the count rises (§9).

### 6.1 Chapter 1 — Village Square: "The Big Wind" (fixed, about 3–4 min)

Start: inventory {}, chest {}. Targets: pencil, eraser. The pen stays in the bag
and carries over into Chapter 2. No Ask prompt yet; every NPC starts the talk.

1. **Intro** (about 25 s; Skip appears only after it has been seen once). The
   supply cart stands in the square. A gust scatters all nine supplies over the
   town in nine sparkling arcs toward the districts. Mayor Pom: "Oh no! The
   festival things!" / "Please help us!" The backpack bar slides in. Kiwi flies
   down: "Hi! I'm Kiwi! Let's go!"
2. **"Find the pencil!"** ★ appears at once over the pencil by the fountain.
   First-time movement tips appear in Japanese. Pick-up animation (§10).
3. **"Talk to Mayor Pom."** He asks "Do you have a pencil?" This is the first
   answer prompt, with a mic tutorial. "Yes, I do." gets "Great! Into the
   festival chest!" and deposits the pencil (1/9).
4. **"Find the eraser!"** It is in the flower bed by the benches; ★ appears
   after 15 s.
5. **Grandma Ume** calls out from her bench when the player comes within about
   5 m: "Do you have a pen?" "No, I don't." gets "Oh! This is for you!" and the
   pen she found. A wrong "Yes" triggers the bag check (§4.6).
6. **Ken** is at the notice board: "Do you have an eraser?" "Yes, I do." He
   borrows it, rubs a smudge off his festival poster (the poster is finished and
   goes up on the board), then says "Thank you! Here you are!" and returns the
   eraser.
7. **Mayor**: "Do you have an eraser?" "Yes, I do." deposits it (2/9) and
   bunting appears over the square. Mayor: "Do you have a ruler?" "No, I
   don't." gets "The ruler flew to the market! Keep the pen for trading!" →
   Chapter clear → the toppled cart rolls out of the market street (camera
   shot) → "New area!"

Five answer prompts: three Yes, two No. The steps run in a guided, linear order.

### 6.2 Chapter 2 — Stationery Market: "Market Trades" (seeded, about 4 min)

Start: inventory {pen}, chest {pencil, eraser}. Targets: ruler, marker. People:
four merchants at their stalls — Bruno (bakery), Lily (flowers), Max (toys),
Sara (fruit).

Seeded template:

- X ∈ {pencil, eraser}; Y is the other one.
- The merchants are shuffled into the roles R, M, G and D:
  - **R**, a trader: offer ruler, want a.
  - **M**, a trader: offer marker, want b, where (a, b) is (pen, X) or (X, pen).
  - **G**, a giver: holds X.
  - **D**, a bystander: holds Y.

Flow: first-time Ask tutorial at the first merchant (the JP tip shows "Do you
have a ruler?"). Objectives "Find the ruler!" and "Find the marker!" are open
together, in any order, then "Bring them to Mayor Pom." At least three item
transactions (one gift, two trades), then the deposit. No wrong trade is
possible: only R and M trade, and each wants exactly one thing.

Clear: the deposit (4/9), lanterns along the market street, and Ms. Green opens
the school gate.

### 6.3 Chapter 3 — Schoolhouse: "Lost and Found" (seeded, about 5 min)

Start: inventory {}, chest +{ruler, marker}. Targets: notebook, pencil case.
People: Ms. Green (teacher, Lost & Found table in the courtyard), Ms. Page
(librarian, library room), and the students Yuki, Tom and Emma (courtyard).
The two missions can be done in either order.

**3A Library (help + hidden-object search)**

- Ms. Page asks "Do you have a notebook?" "No, I don't." gets "Oh no! My
  notebooks are all over the library! Please find three!"
- The library room has three notebooks at seeded spots among eight candidates.
  4–6 other spots hold distractor stationery of other types.
- Clicking or pressing E on a distractor makes Kiwi say "That's a stapler!" (EN +
  JP). Distractors are not collected.
- Notebooks sparkle faintly within about 5 m. The objective card counts them
  (1/3).
- Until all three are found, Ms. Page says "Please find three notebooks!" With
  three: "Do you have my notebooks?" "Yes, I do." She takes them: "Thank you!
  This notebook is for the festival!" and gives one notebook (a target).

**3B Lost & Found (match owners by their answers)**

- Ms. Green says "Three lost things! Please find the owners!" and gives the
  player three lost items. They are three distinct types from {pen, pencil,
  eraser, ruler, marker}, never a chapter target.
- Each student lost exactly one of them (a seeded permutation). Each student
  holds the other two types and a notebook.
- Asking a student about a lost item the player is carrying:
  - The owner says "No, I don't. I lost it!" (sad), then sees it: "That's my
    pen! Thank you!" The item goes back automatically.
  - The others say "Yes, I do!" and hold theirs up.
- Kiwi's first-time tip: 「持っていない人が、なくした人かも！」
- At most five questions are ever needed.
- When all three are returned, Ms. Green says "Great job! This pencil case is
  for the festival!" (a target).

Clear: the deposit (6/9), flags on the school, and the river drawbridge lowers.

### 6.4 Chapter 4 — Riverside & Harbor: "Harbor Deliveries" (seeded, about 5 min)

Start: Mayor Pom gives inventory {B, C} ("Take these to the harbor! You can
trade!"), chest +{notebook, pencil case}. Targets: calendar, stapler. People:
Captain Bo (pier), Finn (fisher, pier end), Mia (sailor, her boat), Leo
(painter, riverside by the bridge).

Seeded template:

- A, B, C and D are distinct, from {pen, pencil, eraser, ruler, marker,
  notebook, pencil case}.
- Finn, Mia and Leo are shuffled into the roles T1, T2 and T3:
  - **T1**, a trader: offer calendar, want A.
  - **T2**, a trader: offer A, want B.
  - **T3**, a decoy trader: offer D, want B or C (seeded). D is wanted by
    nobody else.
- **Captain Bo**, a requester, needs C to mark his map. The reward is his old
  sea chest.
- **Sea chest mini-game**:
  - The lid shows three engraved silhouettes: the stapler and two other seeded
    types. The chest holds exactly those three items.
  - The student asks the chest "Do you have a stapler?" and so on. A correct
    item gets "Yes, I do!" and its lock clicks open. A wrong item gets "No, I
    don't." and a rattle, with no penalty.
  - With all three open, the chest gives the stapler and a sticker. The other
    two items stay in the chest.

The calendar chain is B → A → calendar (two trades). The stapler chain is the C
delivery plus the chest. The decoy tempts the student to spend B or C wrongly.
Swapping back with T3 always recovers it: this is the "plan which items to
obtain first" lesson. At least four transactions.

Clear: the deposit (8/9), balloons over the harbor, the festival arch lights,
and the Festival Grounds open.

### 6.5 Chapter 5 — Festival Grounds: "Festival Day!" (seeded, about 4–5 min)

Start: inventory {}, chest +{calendar, stapler}. Target: pen. Intro: the chest
is wheeled onto the stage; eight slots glow and the pen slot is empty. Mayor:
"We need a pen! Then the festival can start!" People: Coach Dan (stage) and Aya
(lanterns), with returning helpers Grandma Ume, Ken and Mia.

Seeded template:

- W and R are distinct, from the eight non-pen types.
- The five people are shuffled into the roles P, H, b1, b2 and b3:
  - **P**, a trader: offer pen, want W.
  - **H**, a requester: needs R, holds W, and the reward is giving W.
  - **b1–b3**, bystanders: hold seeded items, never pen, W or R.
- **R** lies at one of six hidden spots on the grounds (seeded, sparkle).

The chain:

1. Find P ("Who has a pen?").
2. P wants W.
3. Find H: "Yes, I do! But I need a R."
4. Find R.
5. Deliver R and receive W.
6. Trade W for the pen.
7. Bring it to the Mayor.

This uses investigation, help/delivery, finding and trading. At least four
transactions.

**Finale**: the Mayor asks "Do you have a pen?" "Yes, I do!" The pen flies
into the last slot (9/9), all nine slots blaze, and the lid opens. Fireworks
burst out of the chest (the chest held the festival's fireworks). Lanterns
light, music starts, all the characters gather and dance, Kiwi sits on the
player's shoulder, and the stations visibly use the supplies:

- the marker writes the welcome sign
- the ruler measures the ribbon
- the stapler fixes the lanterns
- the calendar shows "TODAY!"
- the notebook is the guestbook
- the pens and pencils are at the drawing table
- the pencil case is the prize

Mayor: "The School Festival is open! Thank you, Treasure Trader!" → results
card → free festival roam, or back to the title.

### 6.6 Sticker questions (optional side missions, Chapters 2–5)

- Each chapter seeds two sticker askers. They are characters from earlier
  chapters who have come to help, standing in the current district or the
  square. A small sticker bubble marks them.
- Each asks "Do you have a X?" X is chosen when they ask: about half the time it
  is an item the player holds, when there is one, so answers vary.
- A truthful answer earns a sticker and a happy reaction. A contradicting answer
  gets the bag check, and nothing is lost.
- There are eight festival stickers in all: balloon, star, fish, flower, bell,
  lantern, kite, fireworks. They are cosmetic, shown in the journal, and each
  asker gives once per run.

### 6.7 Hints (every step)

- Each step has a Japanese level-1 hint (general), a level-2 hint (names the
  person, place or item) and a level-3 target, where Kiwi flies to it and ★
  shows.
- After about 45 s without progress Kiwi flutters with a "!" and offers a hint.
  🦜 or H steps through the levels.
- ★ shows at once in Chapter 1. From Chapter 2 it shows at level 3 or after 60 s
  (discovery is part of the fun).
- After level 1 in an investigation, people who have not been asked yet show a
  small "?".
- Investigations are bounded (five people at most), every "No" is a journal fact,
  and hints escalate. Nothing ever needs blind guessing.

## 7. Generation and validation

- A seeded PRNG drives it. Each campaign has a `campaignSeed`; the chapter seed
  is hash(campaignSeed, chapter). A replay draws a fresh random seed. `?seed=N`
  overrides it for development and teachers.
- Chapter 1 is fixed data. Chapters 2–5 are template + seed → `ChapterInstance`.
  An instance holds NPC roles, holdings and wants, hidden and distractor spots,
  the sea-chest silhouettes, sticker askers and the start inventory.
- **The save stores the instance, not just the seed**, so a save never changes
  meaning when generation code changes.
- **Validator** (pure):
  1. **Consistency.** Every item instance has exactly one holder. Traders hold
     their offer. Nobody wants what they hold. Lost & Found holdings obey the
     "lost exactly one" rule. Vocabulary stays within the chapter. Chapter
     targets are never trade goods except on the goal path.
  2. **Solver.** It searches abstract states (holdings + mission/once flags).
     Actions: collect, gift, trade both ways, deliver, quest reward, chest
     unlock, deposit. The goal is the chapter targets deposited.
  3. **Solvable** from the start, within the chapter's band of minimum
     transactions (as in §6).
  4. **No dead ends.** Every reachable state can still reach the goal.
  5. **No circular dependency.** No item is needed in order to obtain itself.
- A failing seed tries seed+1, up to 50 times, then falls back to the
  template's hand-checked canonical instance.
- Unit tests sweep at least 2,000 seeds per chapter. Expect zero fallbacks, every
  instance valid, and roles that genuinely vary.
- Generation plus validation should take under 50 ms on a Chromebook. It runs at
  chapter start.

## 8. Cast

| id | Name | Where | Look | Personality / voice |
|---|---|---|---|---|
| player | (the player) | — | grade-4 kid, big yellow backpack, red cap, gender-neutral | — |
| kiwi | Kiwi | follows the player | green parrot, yellow cheeks, red tail tip | cheeky helper; high, quick |
| pom | Mayor Pom | Square, at the chest | round, white mustache, top hat, red festival sash | jolly; low |
| ume | Grandma Ume | Square bench | small, grey bun, purple cardigan, knitting | gentle; slow |
| ken | Ken | Square notice board | boy, blue cap, overalls with paint spots, brush | energetic; quick |
| bruno | Bruno | Market bakery | big, chef hat, white apron | jolly |
| lily | Lily | Market flower stall | flower crown, green dress | soft-spoken |
| max | Max | Market toy stall | glasses, bow tie, vest | excitable |
| sara | Sara | Market fruit stall | headscarf, orange top | brisk, friendly |
| green | Ms. Green | School courtyard | teacher, glasses, green cardigan | warm |
| page | Ms. Page | School library | bun, long skirt, glasses on a chain | quiet |
| yuki | Yuki | School courtyard | pigtails, red backpack | shy |
| tom | Tom | School courtyard | spiky hair, yellow T-shirt | sporty |
| emma | Emma | School courtyard | ponytail, blue dress | curious |
| bo | Captain Bo | Harbor pier | captain hat, beard, navy coat | booming |
| finn | Finn | Harbor pier end | yellow raincoat and boots, fishing rod | laid-back |
| mia | Mia | Harbor boat | striped shirt, red bandana | adventurous |
| leo | Leo | Riverside by the bridge | beret, easel | dreamy |
| dan | Coach Dan | Festival stage | tracksuit, whistle | loud, encouraging |
| aya | Aya | Festival lanterns | ribbons, happi coat | cheerful |

After each chapter, one or two of its people move to the square to prepare for
the festival (characters returning). Chapter 5 brings Ume, Ken and Mia to the
grounds, and the ending gathers everyone.

## 9. World and art

- **One compact hub town**, about 140 m across:
  - Village Square in the centre.
  - Stationery Market to the east.
  - Schoolhouse to the north: a courtyard, plus a library room with a cutaway
    camera that hides the roof and the camera-side wall while inside.
  - Riverside & Harbor to the south, across a drawbridge.
  - Festival Grounds to the west, through a festival arch.
  Walking from the square to any district takes about 12 s at most.
- **Gates**:
  - the market street is blocked by the toppled supply cart (cleared after
    Chapter 1)
  - the school gate is closed (opens after Chapter 2)
  - the drawbridge is raised (lowers after Chapter 3)
  - the festival arch is roped off with a "Coming soon!" sign (opens after
    Chapter 4)
  Each opening gets a short camera shot, a jingle and a "New area!" card.
- **Decorations by chest count**:
  - 2: bunting over the square
  - 4: lanterns along the market street
  - 6: flags on the school
  - 8: balloons at the harbor, and the arch lights
  - 9: the grounds fully lit, with fireworks
- **Liveliness**:
  - fountain water, pigeons, swaying bunting and flags, bobbing boats, gulls,
    jumping fish, market awnings
  - some NPCs walk short loops
  - 4–6 cheap non-interactive townsfolk walk about
- **Style**:
  - bright, soft, toy-like low-poly
  - merged vertex-coloured primitives (`src/scene/partBuilder.ts`) with height
    ambient occlusion
  - a hemisphere light plus one directional light, blob shadows, soft fog, warm
    late-afternoon palette
  - rounded, chunky shapes; characters about 2.5 heads tall
  - tiny canvas textures only where needed (ruler ticks, calendar grid, signs)
- **Items** use one signature look in 3D and in icons. Each must read clearly at
  about 40 px and in a hand:

| Item | Look |
|---|---|
| pen | blue #2F6FE4, with a clip |
| marker | red #E5484D, thick, with a cap |
| ruler | pale wood #E9C46A, with black ticks and numbers |
| stapler | charcoal #3A3F4B top on a silver base |
| calendar | white pages, red top binding with rings, a grid |
| notebook | green #3DAA6B cover, white page edge, spiral |
| eraser | white block with a sky-blue #6CC4F0 sleeve |
| pencil | yellow #F6C945, hexagonal, pink eraser, sharpened tip |
| pencil case | purple #8E6CEF zip pouch |
- **No asset files, webfonts or CDNs**, because school networks block them.
  Models are procedural, icons are inline SVG, audio is synthesised, and fonts
  use the system stack.

## 10. UI and controls

**Layout at 1366×768**

- **Top-left**: objective card. The English target sentence is large, the
  Japanese instruction small, plus a counter when there is one.
- **Top-right**:
  - festival chest badge (n/9; opens the journal's Festival page)
  - journal 📖 (J)
  - Kiwi hint 🦜 (H)
  - settings ⚙ (Esc)
- **Bottom-centre**: the backpack bar. Nine fixed slots in canonical order:
  - owned: full-colour icon on a bright card, solid border, a count badge above 1
  - not owned: faint dashed outline with a very light silhouette
  - The 🎒 button (B) opens the backpack panel.
  - The bar stays visible during dialogue, so the student can always see what
    they have while answering.
- **Dialogue panel** (bottom):
  - the portrait, name, English line (≥ 26 px), Japanese support line (≥ 16 px)
    and 🔊 replay
  - on the student's turn:
    - a 「きみの番！」 chip and the sentence card(s)
    - a big 🎤 (Space) with an 8 s listening ring
    - the item cards for Ask
    - the choices: visible, but inert in speech mode until the ladder unlocks them
  - The camera lens shifts up above the panel (the monster-island technique).
  - Conversations use a three-quarter shot over the player's shoulder.
- **World indicators**: "!" (wants to ask), "?" (can be asked), a sticker bubble,
  the ★ objective marker, and a sparkle on collectibles.
- **Backpack panel**: a 3×3 grid of icon, English word (big), Japanese (small) and
  count. Tapping a card inspects the item: a rotating 3D model, "a pencil" spoken,
  and "Do you have a pencil?" to tap and hear.
- **Journal**:
  - **Festival**: the chest slots.
  - **People**: portrait, name and place; ✓ has / ✗ doesn't have for each item
    asked about, as icons; wants and needs as thought bubbles; helped ♥.
    Facts update when the student sees a trade.
  - **Words**: the nine items and three sentences, tap to hear.
  - **Stickers**.
- **Title**:
  - a slowly orbiting 3D town backdrop and the logo
  - New Game 「はじめから」, Continue 「つづきから」, Chapters 「チャプター」,
    Settings 「せってい」
  - the teacher's mic-free toggle 「マイクなしモード」
  - confirmation before New Game overwrites a save
- **Chapter select**: five cards (locked / current / cleared). Cleared chapters
  offer "Play again — new puzzle!".
- **Settings**: Music, Effects and Voice volume; voice speed (normal/slow);
  Japanese support on/off; mic-free mode; a mic check; reset save (confirm).
- **Feedback**:
  - **Pick-up**: the item pops up and spins, a name card shows and the name is
    spoken, then it flies to its slot, which bounces with a jingle.
  - **Losing an item**: it flies out toward the NPC.
  - **Trade**: two crossing arcs.
  - **Gratitude**: a jump with hearts or confetti.
  - **Cards**: a mission banner, a chapter-clear card (no times) and a new-area
    card.
- **Readability**: text at least 16 px, hit targets at least 44 px, and ✓/✗ are
  never colour-only.
- **Japanese guidance**: first-time tips (moving, the mic, asking, the backpack,
  the journal) and all hints.

**Controls.**

| Input | Action |
|---|---|
| WASD / arrows | move |
| click or tap the ground | walk there |
| click or tap a person or object | walk there and interact |
| E / Enter | interact |
| Space | mic |
| 1–9 | item cards (when tappable) |
| 1–2 | answers (when tappable) |
| B | backpack |
| J | journal |
| H | hint |
| Esc | pause/settings |

The camera is a smooth third-person follow, with no manual orbit needed.

## 11. Audio

- **Speech**: every English line uses `speechSynthesis`, with a pitch/rate preset
  per character, a player voice for mic-free sentences, and a slow-voice
  setting. If no voice exists, subtitles carry everything.
- **Music**: synthesised with Web Audio, one piece per district — square: light
  marimba; market: bouncy; school: gentle chimes; harbor: breezy; festival:
  drums — plus a celebration tune.
- **Effects and ambience**:
  - SFX: pick-up, give, trade, correct, soft try-again, lock click, chest open,
    fireworks, mic on/off, UI tap, subtle footsteps
  - ambience: birds, market chatter, school bell, waves and gulls
  - Music and ambience go silent while listening and duck under speech.

## 12. Save, chapters, replay

- **Storage keys**: campaign `tt.save.v1`, replay `tt.replay.v1`, settings
  `tt.settings.v1`, all in localStorage.
- **Loading**: saves are versioned and schema-validated on load. An invalid or
  unknown save goes to `tt.save.bak` (the raw string), then the game starts
  fresh with a friendly notice. A migration hook exists for later versions.
- **What is saved**: version, campaignSeed, chapter, the chapter instance,
  holdings everywhere, mission and once flags, NPC memory, journal facts,
  stickers, unlocked areas, chest contents, `finished`, and the player position
  (moved to the nearest walkable spot on load).
- **When**: after every transaction or step and at chapter end. Never
  mid-cutscene. Logic applies each change atomically before its animation
  plays, and the save follows.
- **Continue** resumes at the last step, at the saved position. After the ending,
  Continue opens free festival roam.
- **Chapter replay** uses its own slot and starts from the chapter's canonical
  start state. Finishing returns to chapter select, and the campaign save is
  untouched.
- No accounts and no personal data.

## 13. Architecture and budgets

- **Stack**: as the sibling games — React 19, @react-three/fiber 9, three
  0.186, zustand 5, TypeScript, Vite 8, Vitest and Playwright.
- **Folders**:

| Folder | Holds |
|---|---|
| `src/game/logic/` | pure rules (no React, three or DOM), unit-tested: items, holdings, truth, roles and transactions, missions, generator, solver/validator, save, speech judges |
| `src/game/content/` | data: items, cast, chapter templates, lines (EN + JP), hints |
| `src/game/flow/` | async scripted flows (`await say/ask/answer`), chapter scripts, cutscenes |
| `src/game/world/` | layout, colliders, walkable areas, gates, spots |
| `src/game/runtime.ts` | per-frame state, outside React |
| `src/game/store.ts` | zustand UI state |
| `src/scene/` | R3F components; `src/scene/models/` holds procedural builders |
| `src/ui/` | React DOM HUD; `src/ui/icons/` holds inline SVG |
| `src/audio/` | TTS, SFX/music, the speech wrapper over esl-stt, the coach adapter |
| `src/dev/galleries/*.tsx` | review galleries at `?gallery=<name>` (dev, or with `?e2e=1`) |
| `vendor/` | the vendored packages, never edited |

- **Test hook**: `window.__tt`, only with `?e2e=1`. It reads state and drives
  the speech stubs.
- **Budgets** (1366×768; a SwiftShader measurement is acceptable):
  - about 100 draw calls typical, 120 worst; 120k triangles or fewer per view
  - dpr is min(devicePixelRatio, 1.5), dropping to 1 once if frames stay under
    28 fps for 4 s
  - no real-time shadows; fog; instanced repeated props
  - districts far from the camera are hidden
- **Build and deploy**: `base: './'`. The GitHub Pages workflow is the same as
  the siblings'.

## 14. Testing and acceptance

**Unit (Vitest)**

- articles; holdings operations; the truth function
- trades: exact add/remove, reversibility
- gifts and rewards happen exactly once; the Mayor deposits only targets and only
  when allowed
- the chapter boundary clears leftovers; Lost & Found consistency
- the generator: at least 2,000 seeds per chapter, all valid, solvable, inside
  their bands, with no dead ends
- save: round trip, corrupt and unknown-version saves, position relocation
- the speech-judge corpus

**E2E (Playwright, TTS and recognition stubs, `?e2e=1`, 1366×768)**

- the full campaign, Chapter 1 to the ending, in mic-free mode
- the full campaign with stubbed speech, including misses, the ladder and the
  tap rescue
- a contradicting answer: bag check, no reward
- permission denied: mic-free
- save mid-chapter, reload, identical state
- a chapter replay with a different seed
- keyboard, click and touch-tap movement and interaction
- a renderer.info probe in each district, within budget

**Screenshots**: the title, each district, dialogue (ask and answer), the
backpack, the journal, the celebration and the ending at 1366×768, with a
selection at 1280×800 and on touch. Claude reviews the rendered screenshots;
visual work is judged from renders, never from source.

**Brief §15 map**

| Brief §15 | Covered by |
|---|---|
| 1–2 | item gallery + collection e2e |
| 3–4 | truth unit tests + e2e |
| 5–6 | transaction unit tests |
| 7–9 | solver sweeps |
| 10 | e2e progression |
| 11 | save tests + e2e reload |
| 12 | input e2e |
| 13 | speech e2e |
| 14 | collision/reachability unit tests + camera e2e |
| 15 | budget probe |

## 15. Out of scope for v1

Recorded voice audio, accounts, online services, analytics, a teacher
dashboard, multiplayer, phone-layout tuning, and grammar targets beyond §2.
