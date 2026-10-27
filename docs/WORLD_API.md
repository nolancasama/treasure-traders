# World API — frozen v1 (2026-10-27)

Import `createWorld`, `worldStateFromGame`, and types from `src/game/world`.
Create one API instance per world, then mount `<World world={world} />` from
`src/scene/World.tsx` inside an R3F Canvas (perspective camera, fov 46,
near 0.1, far 180, dpr `Math.min(devicePixelRatio, 1.5)`). The world owns
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
| `gesture(npc,state)` | Art-kit gesture or loop (`nod`, `shake`, `cheer`, `give`, `show`, `idle`, `talk`, `think`, `sad`, `sit`, `present`, `walk`, `run`). |
| `hold(npc,itemOrNull)` | Show an art-kit item in hand, or clear it. |
| `setKiwi(mode,target?)` | `follow`, shoulder `perch`, or `hint` flight to a world position. |
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

Effects expire themselves; none mutate game state. Decoration pop-ins and gate
animations happen automatically from state. Gate collision switches immediately
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

Review at `?gallery=world`; optional `view=square|market|school|harbor|festival|library`,
`chapter=1..5`, and `chest=2|4|6|8|9`. Gallery controls and renderer probe are
development tools, not a game HUD. `npm run shots` writes district PNGs and
renderer metric JSON to `.tmp/shots/world/` at 1366×768.
