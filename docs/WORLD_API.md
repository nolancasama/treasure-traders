# World API — frozen v1 (2026-10-27), additive v1.1 (2026-11-03)

Import `createWorld`, `worldStateFromGame`, and types from `src/game/world`.
Create one API instance per world, then mount `<World world={world} />` from
`src/scene/World.tsx` inside an R3F Canvas (`flat`, perspective camera, fov 46,
near 0.1, far 420, dpr `Math.min(devicePixelRatio, 1.5)`). The world owns
lighting, movement, camera, scenery, actors, and effects. No HUD, dialogue,
audio, chapter transitions, or model mutations occur here.

## State in

`world.setState(worldStateFromGame(game))` copies a complete snapshot. Call
after model transitions; it cancels walking and relocates invalid player
positions. The adapter reads core placements, indicators, objectives, holdings,
active spots, unlocked areas, and sea-chest flags without modifying the game.
Custom snapshots use the exported `WorldState`:

- `chapter: 1 | 2 | 3 | 4 | 5`
- `gates: { cart, school, bridge, arch }` — booleans; true means open.
- `chestCount: number`, `chestItems: ItemId[]` — decoration tier and filled slots.
- `npcs: Partial<Record<NpcId, NpcPlacement>>` — `{x,y,z,district,yaw?,indicator?}`;
  indicator is `!`, `?`, `sticker`, `star`, or null. Omit a resident to hide them.
- `items: {spotId,item,kind,active}[]` — `collect`, `hidden`, or `distractor`;
  hidden objects show nearby sparkles, without revealing their item type.
- `seaChest: {items:ItemId[],locks:boolean[],open:boolean}` — locks use silhouette order.

Coordinates are metres: +x east, -z north, +y up. `SPOTS` contains all sixteen
core spot IDs on actual support tops. `DISTRICTS`, `NPC_HOMES`, `WALK_AREAS`,
`SOLIDS`, and `SURFACES` document the layout. Harbor is compressed to a bank
at z=28–37 and pier ending z=49; all five district centres are within about
12 seconds of the square at 4.5 m/s. The library doorway is at (-12,-42).

## Commands

| Method | Meaning |
|---|---|
| `setInputLocked(boolean)` | Locking stops and cancels walking and suppresses taps/keys/interactions; unlocking leaves an active walk alone. Flow owns unlocking. |
| `setBottomPanel(heightPx)` | Lens shift for the UI's covered bottom region, capped at 30% of viewport height. |
| `setCamera({mode:"follow"})` | Resume smooth follow. Library cutaway is automatic while inside. |
| `setCamera({mode:"conversation",target:{x,y,z}})` | Three-quarter view over the player's shoulder. Lock input separately. |
| `setCamera({mode:"path",elapsed:0,keys})` | Each key has `{position,target,duration}`. Duration is seconds to the next key; last key holds, then follow resumes. |
| `playCutscene(name)` | Preset `intro`, `cart`, `school`, `bridge`, `arch`, or `finale` camera path. Lock input and trigger FX separately. |
| `gesture(npc,state)` | Art-kit gesture (`nod`, `shake`, `cheer`, `give`, `show`, `wave`, `reach`, `hop`, `clap`) or loop (`think`, `sad`, `sit`, `present`, `walk`, `run`, `dance`). `idle` returns to the person's resting pose; `talk` moves mouth and hands for about 2.4 s, then stops by itself. |
| `hold(npc,itemOrNull)` | Show an art-kit item in hand, or clear it. |
| `mood(npc,expressionOrNull)` | Face until told otherwise: `happy`, `sad`, `surprised`, `sorry`; null is neutral. |
| `speak(npc,seconds)` | Mouth and hands move for this long, over whatever else they are doing. |
| `playerGesture` / `playerHold` / `playerMood` | The same three for the player's character. |
| `setKiwi(mode,target?)` | `follow`, shoulder `perch`, `hint` flight to a world position, or delighted `cheer` circles. |
| `kiwiSpeak(seconds)` | Kiwi's head bobs along with its line. |
| `holdDecorations(levelOrNull)` | Decorations show at most this chest count. The flow holds a deposit's reveal until the item has landed. |
| `setFinale(stage)` | `armed`: chest stays shut and dusk waits, even at 9/9. `blaze`: gold light on a shut chest. `open`: lid opens. `none`: follows state. |
| `setParty(boolean)` | Everyone's resting pose becomes `dance`; ambient festival folk make way. |
| `fx(command)` | Starts an independent effect; returns its numeric ID. See below. |
| `walkTo({x,z},interaction?)` | Plans a collision-safe path; returns false when locked or no path. Optional target interacts on approach. |
| `teleport({x,z,yaw?})` | Safe relocation and cancellation of the current walk. |
| `relocate({x,z,yaw})` | Pure callback compatible with core save loading. Closes over current gates and preserves yaw. |
| `positionOf(interaction)` | Position of an NPC, spot, or sea chest; undefined for missing NPCs/spots. |
| `chestSlot(item)` | Current festival-chest slot world position for deposit FX (chest moves to festival in Chapter 5). |

`Interaction` is `{kind:"npc",id:NpcId}`, `{kind:"spot",id:string}`, or
`{kind:"seaChest"}`. `findPath`, `moveCircle`, `isWalkable`, `standY`, and
`nearestWalkable(x,z,gates,radius=0.35)` are exported pure geometry helpers.
Paths steer around scenery on a 1m grid; movement uses 0.14m substeps and sliding.

FX commands (all positions `{x,y,z}`):

- `{kind:"pickup",item,from,screen:{x,y}}` — pop, spin, fly to CSS viewport pixels.
- `{kind:"trade"|"give"|"deposit",item,from,to}` — an item arc; invoke twice for crossing trade arcs. Deposit adds slot glow.
- `{kind:"sparkles"|"decoration"|"lock"|"fireworks",at,index?}` — particle bursts. State drives lock opening; `index` is available to the flow for bookkeeping.
- `{kind:"wind",from,targets:Position[]}` — nine art-kit items scatter to the supplied district targets.

Effects expire themselves; none mutate game state. Fireworks are one salvo of
four shells per command, launched from `at`. Decoration pop-ins and gate
animations happen automatically from state (decorations within `holdDecorations`,
one piece at a time, so they arrive in about two seconds rather than appearing).
Gate collision switches immediately
with state; visual opening eases over the following second. A camera path does
not implicitly start wind, fireworks, or a model transition.

## Events and lifetime

`onInteract(listener)` and `onArrive(listener)` return unsubscribe functions.
Interactions fire once per click approach, or once per fresh E/Enter press for
the nearest focus within 2.4m in front. Arrival emits a copied `{x,y,z}` when a
walk finishes or reaches an interaction approach distance. A manual movement,
lock, state update, or teleport cancels the walk without an arrival event.

The API object is `Object.freeze`d. `runtime` is the mutable renderer handle;
integration may read `runtime.player` for saving and `runtime.focus` for UI,
but should use commands for writes. Per-frame state lives outside React.
Unsubscribe listeners on flow disposal; unmounting World removes input listeners
and releases owned GPU resources. Cached art-kit geometry/materials remain shared.

Review at `?gallery=world`; optional `view=` (districts, `*-play` follow views,
`conversation`, `stall-talk`, `bench`, `title`, `finale`, `fireworks`, `wind`, `trade`,
`deposit`, `chest-close`, `sea-chest`, `sky`, gate views), `chapter=1..5`, `chest=2|4|6|8|9`,
`age=` (holds an effect at this many seconds) and `clean=1` (no review overlay).
Gallery controls and renderer probe are development tools, not a game HUD.
`npm run shots` writes PNGs and renderer metric JSON to `.tmp/shots/world/` at
1366×768. `PERF_LABEL=x npx playwright test --config=playwright.shots.config.ts
tests/shots/perf.spec.ts` writes relative frame cost to `.tmp/shots/perf/x.json`.

## Batch 1 collision and interaction additions (2026-11-03)

The gate timing and focus descriptions above are superseded as follows. Closing
blocks immediately; opening permits movement and pathfinding only at rendered
progress 1. `navigationGates(runtime)` returns those effective gates. The renderer
publishes `runtime.gateProgress` (0 closed, 1 open), or null without a renderer;
headless worlds treat logical gates as settled. `setState(state,
{settleGates:true})` initializes restored gates at their final positions, as used
by Continue. The default continues to animate state changes. A requested walk
waits in `runtime.deferredWalk` while an opening gate settles, and is cancelled by
the same commands as an active walk.

E/Enter focus uses the nearest visible target within 2.4m regardless of facing;
facing only breaks equal-distance ties. Spot items also require line of sight,
excluding their own support. The focused target has a visible E/Enter marker.
Interaction emissions share a short cooldown to suppress rapid duplicate input.

Only `?e2e=1` exposes `__tt.teleport({x,z,yaw?})` and `__tt.readGates()` (copied
rendered progress and effective navigation gates). `__tt.read()` also includes
gate progress and any deferred walk. Review-only World/Town gate-progress props
hold gallery poses without changing the game's animation or progression.
