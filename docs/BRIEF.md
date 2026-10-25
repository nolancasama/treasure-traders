# Original brief (verbatim, 2026-10-25)

This is the brief as the teacher supplied it. It is the source of requirements,
but **SPEC.md is the frozen design**: where they differ, SPEC.md wins and
DESIGN_DECISIONS.md says why.

---

# Game Development Prompt: Treasure Traders

## 1. Project Overview

Create a complete, polished, browser-based 3D educational adventure game called **Treasure Traders: The School Festival Quest**.

**Target audience:** Japanese elementary school 4th graders (ages 9–10).

**Platform:** School Chromebooks, using browser-based technology such as Three.js, TypeScript, and Vite.

**Core English:**
- “Do you have a ___?”
- “Yes, I do.”
- “No, I don't.”

The game must be genuinely entertaining, with exploration, puzzle-solving, trading, meaningful objectives, and rewarding progression.

**Design principle:** English is the tool players use to achieve objectives, not an isolated quiz interrupting gameplay.

## 2. Story and Setting

The annual School Festival is approaching, but essential stationery supplies have gone missing or become scattered throughout a colorful little town.

The player is recruited to help prepare the festival by locating supplies, completing tasks, helping townspeople, and trading objects.

Create a charming, explorable, stylized 3D town with interconnected areas:

1. Village Square — introductory area with friendly NPCs.
2. Stationery Market — shops, merchants, trading opportunities.
3. Schoolhouse — classrooms, students, teachers, lost objects.
4. Riverside/Harbor — delivery missions and puzzles.
5. Festival Grounds — the final area where recovered supplies are used.

The town should feel lively, with walking NPCs, animated environmental objects, decorative scenery, and playful character personalities.

Use a cohesive art style: colorful, high-quality, stylized 3D models with appealing lighting, soft shadows, and expressive animations.

Avoid generic developer placeholder graphics in the finished game.

## 3. Vocabulary

The game uses nine principal stationery items:

- Pen
- Marker
- Ruler
- Stapler
- Calendar
- Notebook
- Eraser
- Pencil
- Pencil case

Model these as recognizable 3D objects with appropriate textures and shapes.

Include their English names and natural audio pronunciation.

For the initial curriculum, favor singular questions:

- Do you have a pen?
- Do you have a marker?
- Do you have a ruler?
- Do you have a stapler?
- Do you have a calendar?
- Do you have a notebook?
- Do you have an eraser?
- Do you have a pencil?
- Do you have a pencil case?

Handle articles correctly. Use natural plural forms when needed, but don't require complex plural grammar to complete a mission.

## 4. Core Gameplay Loop

The primary gameplay loop is:

**Receive objective → Explore → Talk to characters → Discover who has an object → Complete a task or trade → Receive object → Use it to accomplish objective → Unlock next mission.**

Crucially, obtaining objects must not always involve trading.

Introduce multiple methods of receiving stationery.

### A. Trading

A shopkeeper has a ruler but wants a pencil.

The player asks:

“Do you have a ruler?”

Shopkeeper:

“Yes, I do!”

The shopkeeper offers an exchange.

If the player possesses the requested item, they can trade.

If not, they must find another way to obtain it.

### B. Helping NPCs

A librarian needs help finding missing notebooks.

The player explores the library, collects them, and answers inventory questions when returning the objects.

Successfully completing the task earns an eraser.

### C. Investigation Puzzles

Three characters possess different stationery objects.

The player must discover who possesses a particular item by asking questions.

Example:

“Do you have a marker?”

“No, I don't.”

After investigating, the player identifies the correct character and earns a reward.

NPC inventories must be logically consistent.

### D. Deliveries

A teacher needs a calendar.

The player must find someone who has one, acquire it, and deliver it.

Along the way, other characters ask questions about the player's inventory.

### E. English-Based Mini-Games

Create short, enjoyable mini-games involving the target vocabulary and sentence structures.

Possible examples:

- Find the correct stationery hidden in a room.
- Match characters to objects based on their answers.
- Remember which character possesses which object.
- Deliver the correct item to a requesting character.
- Open a treasure chest by asking the correct questions.

Every mini-game should meaningfully incorporate the English learning objective.

Do not create unrelated arcade activities with superficial English labels.

## 5. Player Inventory

Provide a polished graphical backpack/inventory interface.

Requirements:

- Show the stationery currently possessed.
- Clearly distinguish owned and unowned objects.
- Allow items to be collected, traded, delivered, and used.
- Update inventory immediately after transactions.
- Allow players to inspect items.
- Provide visual and audio feedback when items are obtained or lost.

Inventory should genuinely affect English interactions.

For example, an NPC asks:

“Do you have a notebook?”

If the notebook is in the player's inventory, the correct response is “Yes, I do.”

Otherwise, “No, I don't.”

Never reward an answer that contradicts the current inventory.

## 6. NPC Dialogue System

NPCs should have distinctive appearances, personalities, locations, possessions, and objectives.

Give them simple, natural animations and expressions.

NPCs may initiate questions or respond to the player's questions.

### Interaction Type 1: NPC asks player

NPC: “Do you have a pencil?”

Player: “Yes, I do.” / “No, I don't.”

The answer is checked against the player's actual inventory.

### Interaction Type 2: Player asks NPC

Player selects an item to ask about and says:

“Do you have a ruler?”

NPC responds truthfully:

“Yes, I do.” or “No, I don't.”

Positive responses may lead to a trade, task, or reward opportunity.

Negative responses may provide useful clues.

### Conversation Design

- Use short dialogue appropriate for 4th graders.
- Display English subtitles.
- Provide natural spoken English.
- Use expressive character reactions.
- Clearly indicate when the player should speak.
- Never require lengthy dialogue outside the target language.
- Make conversations purposeful rather than repetitive.
- Allow dialogue to be replayed.

Characters should remember previous conversations and trades.

## 7. Speech Recognition and Accessibility

Speech interaction is important, but school Chromebook microphones and speech recognition can be unreliable.

Implement:

- Push-to-talk microphone input.
- Clear microphone state and listening indicator.
- Forgiving recognition for Japanese learners.
- Tolerance for ordinary pronunciation variation.
- Recognition of the target sentence, not rigid perfect pronunciation.
- Helpful hints after repeated failures.
- Automatic acceptance once a sufficiently confident correct response is detected.
- No additional confirmation button for a correctly recognized answer.
- Automatic fallback to mouse/touch answer selection.

If reusable ESL speech-recognition and pronunciation-helper modules from my existing projects are available, inspect and integrate them rather than duplicating their functionality.

Never allow pronunciation errors or microphone problems to make the game impossible to complete.

When using answer buttons, preserve the same objective, progression, and learning logic.

## 8. Learning Progression

Create five connected chapters.

### Chapter 1: Village Square

Introduce movement, inventory, and conversations.

Limit vocabulary to a few stationery items.

Characters ask basic Yes/No questions.

Teach collecting and receiving items.

### Chapter 2: Stationery Market

Introduce player-initiated questions and trading.

Require players to discover which merchants have particular objects.

### Chapter 3: Schoolhouse

Introduce lost-and-found missions.

Players gather information from multiple characters and solve small puzzles.

### Chapter 4: Riverside and Harbor

Introduce interconnected objectives, deliveries, and two- or three-step trading chains.

Players must plan which items to obtain first.

### Chapter 5: Festival Grounds

The player completes final preparations for the School Festival.

Combine trading, investigation, helping NPCs, and delivery.

Finish with a celebratory festival scene showing the results of the player's work.

The initial complete adventure should be achievable within approximately 15–25 minutes, with chapter checkpoints so classroom sessions can be shorter.

## 9. Puzzle Difficulty and Fairness

This game is for children, so puzzles should be engaging without becoming frustrating.

Design rules:

- Early missions require one simple interaction.
- Intermediate missions involve two connected interactions.
- Later missions may involve two or three connected trades or tasks.
- Never require blind trial-and-error.
- Provide enough information to reason about solutions.
- Ensure every mission remains solvable.
- Avoid situations where trading away an essential item permanently blocks progression.
- Allow recovery from incorrect decisions.
- Provide graduated hints when players become stuck.

Include a discovery journal showing which characters have been questioned and any stationery they are known to possess.

## 10. Rewards and Motivation

Make progression visually satisfying.

Include:

- Inventory item acquisition animations.
- NPC gratitude animations.
- Mission completion celebrations.
- New areas opening.
- Characters returning to previously completed locations.
- School Festival decorations appearing as progress increases.
- A final celebration.

Avoid unnecessary scoring penalties.

Reward successful English communication and thoughtful problem-solving rather than speed alone.

## 11. Replayability

Avoid making the game identical on every playthrough.

After the first guided chapter, support controlled variation in:

- Which NPC possesses each item.
- Which objects characters request.
- Trading opportunities.
- Locations of hidden stationery.
- Short investigation puzzles.
- Optional side missions.

Use a seeded mission-generation system where appropriate.

**Every generated mission must be validated for solvability**, with no circular dependencies or impossible trades.

Preserve the same curriculum and difficulty progression regardless of randomized content.

Players should be able to replay completed chapters with different item distributions and missions.

## 12. Game Controls and UI

Support Chromebook keyboard, mouse, and touchscreen.

Use a simple third-person 3D camera with comfortable movement controls.

Provide:

- WASD/arrow-key movement.
- Mouse or touch character interaction.
- Clear interaction indicators.
- Objective tracker.
- Backpack button.
- Mission journal.
- Audio replay button.
- Sound controls.
- Pause/settings menu.
- Contextual Japanese guidance.

Ensure dialogue, buttons, and inventory can be read comfortably on smaller Chromebook screens.

Use Japanese only for supporting instructions and accessibility. Keep target English phrases prominent.

Design a polished title screen and consistent interface throughout the game.

## 13. Saving and Progress

Save progress locally so students can return to the game later on the same browser.

Save:

- Completed chapters.
- Mission progress.
- Inventory.
- NPC dialogue and discovery state.
- Unlocked areas.
- Settings.

Include New Game, Continue, and chapter replay options.

Handle save corruption or outdated save formats gracefully.

Do not require accounts or personal student information.

## 14. Technical Quality

Build for efficient performance on school Chromebooks.

Use:

- Lightweight, optimized 3D models.
- Efficient rendering and limited draw calls.
- Reasonable texture sizes.
- Consistent collision detection.
- Solid ground and environmental collisions.
- Predictable NPC interaction distances.
- Smooth camera movement.
- Responsive interfaces.
- Robust dialogue and quest state management.

Avoid characters passing through desks, walls, shops, or other solid scenery.

Avoid floating items, intersecting meshes, and visual z-fighting.

Keep gameplay, dialogue, mission, inventory, speech, and rendering logic modular.

Do not introduce unnecessary external services or paid dependencies.

## 15. Required Testing

Test the complete game, not merely the title screen.

Verify:

1. Every stationery object can be recognized and collected.
2. All nine vocabulary items are used correctly.
3. Yes/No responses reflect the correct inventory state.
4. NPC responses reflect their actual possessions.
5. Trades correctly remove and add inventory items.
6. Mission rewards are awarded exactly once.
7. Missions can always be completed.
8. Randomized missions contain no impossible dependencies.
9. Players cannot become permanently stuck.
10. Chapter progression and unlocks work correctly.
11. Save/load restores a consistent state.
12. Mouse, keyboard, and touch fallback controls work.
13. Speech recognition failures do not block progress.
14. Collision detection and camera behavior are stable.
15. The full game runs smoothly at Chromebook-appropriate settings.

Include automated tests for inventory, dialogue validation, mission dependencies, trading, and saving where practical.

Use browser-based end-to-end tests for important gameplay paths.

## 16. Deliverables

Implement a playable game rather than a static mockup.

Deliver:

- Complete project source code.
- Working title screen.
- Explorable 3D environment.
- Recognizable animated NPCs.
- All nine stationery models.
- Functional inventory.
- English dialogue and audio.
- Trading and task systems.
- All five playable chapters.
- Mission objectives and progress indicators.
- Functional ending celebration.
- Local progress saving.
- Appropriate tests.
- Clear README with installation, development, and deployment instructions.

If working in an existing repository, inspect its structure and conventions before making changes.

Preserve useful existing systems.

Do not claim a feature is implemented unless it is actually functional.

If any feature remains incomplete, explicitly document its status rather than presenting it as finished.

## 17. Final Design Priorities

Prioritize these goals in order:

1. **Fun gameplay:** The adventure must feel like a game, not a vocabulary worksheet.
2. **Meaningful English:** Questions and answers should affect the game state and decisions.
3. **Accessibility:** Japanese 4th graders must be able to play independently, including without microphones.
4. **Variety:** Combine exploration, trading, helping, puzzles, and mini-games.
5. **Polish:** Cohesive visuals, satisfying feedback, reliable controls, and lively NPCs.
6. **Replayability:** Different playthroughs offer new but always-solvable missions.

The final experience should feel like a small, charming 3D adventure game in which speaking and understanding English genuinely helps the player succeed.
