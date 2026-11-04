import { audio } from "../../audio/audio";
import type { SayBeat, UIAPI } from "../../ui";
import { CHAPTERS, DISTRICT_NAMES } from "../content/chapters";
import { ITEM_IDS, NPC_IDS, type ChapterId, type ItemId, type NpcId } from "../content/ids";
import { ITEMS } from "../content/items";
import { itemExclaim, K, L } from "../content/lines";
import type { GameEvent, HolderId, Step } from "../logic";
import { chestPose, DISTRICTS, FINALE_CREW, FINALE_VIEW, type Position, type WorldAPI } from "../world";

const wait = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));
const isNpc = (id: string): id is NpcId => NPC_IDS.some(npc => npc === id);
const gateScenes = { 1: "cart", 2: "school", 3: "bridge", 4: "arch" } as const;
type MoveEvent = Extract<GameEvent, { type: "itemMoved" }>;
/** How long a character's mouth keeps moving for a line, without waiting on the real voice. */
const speakingTime = (line: string) => Math.max(0.9, Math.min(3.4, line.length * 0.075));

/** A camera shot of each festival milestone as it happens, ending back on the player. */
const MILESTONE_SHOTS: Partial<Record<number, { position: Position; target: Position }>> = {
  2: { position: { x: 7, y: 6.2, z: 13 }, target: { x: 0, y: 3, z: -4 } },
  4: { position: { x: 42, y: 5.4, z: 13.6 }, target: { x: 37, y: 3.3, z: -3 } },
  6: { position: { x: 4, y: 5.4, z: -26 }, target: { x: 1, y: 5.3, z: -48 } },
  8: { position: { x: 3, y: 4.8, z: 21 }, target: { x: 5, y: 2.2, z: 31 } }
};

/** Only presentation lives here: the caller applies and persists each core Step. */
export function createPresenter(world: WorldAPI, ui: UIAPI) {
  let gathered = false;
  const playerHand = (): Position => ({ ...world.runtime.player, y: world.runtime.player.y + 1.05 });
  const chest = (): Position => {
    const pose = chestPose(world.runtime.state.chapter);
    return { x: pose.x, y: pose.y + 1.05, z: pose.z };
  };
  const holderPosition = (holder: HolderId, item: ItemId): Position | undefined => {
    if (holder === "player") return playerHand();
    if (holder === "chest") return world.chestSlot(item);
    if (holder === "spare") return chest();
    if (holder === "seaChest") return world.positionOf({ kind: "seaChest" });
    if (holder.startsWith("spot:")) return world.positionOf({ kind: "spot", id: holder.slice(5) });
    if (isNpc(holder)) {
      const position = world.positionOf({ kind: "npc", id: holder });
      if (position) return { ...position, y: position.y + 1.2 };
    }
    return undefined;
  };
  const say = async (beat: SayBeat) => {
    if (isNpc(beat.speaker)) {
      const speaker = beat.speaker;
      if (beat.showItem) world.hold(speaker, beat.showItem);
      else if (beat.gesture === "shake" || beat.gesture === "sad") world.hold(speaker, null);
      // bagCheck is a core presentation cue, rather than an art-kit gesture.
      const gesture = beat.gesture === "bagCheck" ? "think" : beat.gesture ?? (beat.showItem ? "show" : "talk");
      world.gesture(speaker, gesture);
      // A "No" reads on the face as well as the head, even when the line names no mood.
      world.mood(speaker, beat.mood ?? (beat.gesture === "shake" ? "sorry" : "neutral"));
      if (!beat.jaOnly) world.speak(speaker, speakingTime(beat.en));
    } else if (beat.speaker === "kiwi") {
      world.kiwiSpeak(speakingTime(beat.jaOnly ? beat.ja : beat.en));
    } else if (beat.speaker === "seaChest" && beat.gesture === "shake") {
      const at = world.positionOf({ kind: "seaChest" });
      if (at) world.fx({ kind: "lock", at });
      audio.play("tryAgain");
    }
    await ui.say(beat);
  };

  /**
   * One exchange, or both halves of a trade at once: givers present, receivers
   * reach, the items cross, then sparkles and a happy reaction on arrival.
   * Only real itemMoved events reach here, so a refused trade or a "No" can never play it.
   */
  const exchange = async (moves: MoveEvent[], trade: boolean, alive: () => boolean) => {
    for (const move of moves) {
      if (isNpc(move.from)) { world.hold(move.from, move.item); world.gesture(move.from, "give"); world.mood(move.from, "happy"); }
      else if (move.from === "player") { world.playerHold(move.item); world.playerGesture("give"); world.playerMood("happy"); }
      if (isNpc(move.to)) world.gesture(move.to, "reach");
      else if (move.to === "player" && !moves.some(other => other.from === "player")) world.playerGesture("reach");
    }
    await wait(300);
    if (!alive()) return;
    for (const move of moves) {
      if (isNpc(move.from)) world.hold(move.from, null);
      else if (move.from === "player") world.playerHold(null);
      const from = holderPosition(move.from, move.item), to = holderPosition(move.to, move.item);
      if (from && to) world.fx({ kind: move.to === "chest" ? "deposit" : trade ? "trade" : "give", item: move.item, from, to });
    }
    audio.play(trade ? "trade" : "give");
    await wait(move0IsDeposit(moves) ? 620 : 680);
    if (!alive()) return;
    for (const move of moves) {
      if (move.to === "chest") continue;
      const to = holderPosition(move.to, move.item);
      if (to) world.fx({ kind: "sparkles", at: to });
      if (isNpc(move.to)) { world.hold(move.to, move.item); world.gesture(move.to, "hop"); world.mood(move.to, "happy"); }
      else if (move.to === "player") { world.playerGesture("hop"); world.playerMood("happy"); }
    }
    await wait(320);
    if (moves.some(move => move.to === "player" || move.from === "player")) world.playerMood(null);
  };
  const move0IsDeposit = (moves: MoveEvent[]) => moves[0]?.to === "chest";

  const pickup = async (item: ItemId, spotId: string, alive: () => boolean) => {
    const nameCard = ui.say({ kind: "say", speaker: "kiwi", en: itemExclaim(item), ja: ITEMS[item].ja, showItem: item });
    // Let the compact backpack measure its slots above the new name panel.
    await wait(32);
    if (!alive()) return;
    const from = world.positionOf({ kind: "spot", id: spotId });
    const slot = ui.slotRects()[item];
    if (from && slot) world.fx({ kind: "pickup", item, from, screen: { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 } });
    else if (from) world.fx({ kind: "give", item, from, to: playerHand() });
    if (from) world.fx({ kind: "sparkles", at: from });
    world.playerGesture("hop");
    world.playerMood("happy");
    audio.play("pickup");
    await Promise.all([nameCard, wait(1050)]);
    world.playerMood(null);
  };

  async function beats(step: Step, alive: () => boolean = () => true): Promise<void> {
    // collect emits a pickup plus the corresponding itemMoved; present it once.
    const pickups = new Set(step.beats.flatMap(beat => beat.kind === "event" && beat.event.type === "pickup" ? [`${beat.event.spotId}:${beat.event.item}`] : []));
    const hasFinale = step.beats.some(beat => beat.kind === "event" && beat.event.type === "finale");
    let bagCheckOpen = false;
    for (let index = 0; index < step.beats.length && alive(); index++) {
      const beat = step.beats[index];
      if (beat.kind === "say") {
        // These core lines are presented once, after the finale's fireworks.
        if (hasFinale && beat.speaker === "pom" && (beat.en === L.mayorOpen.en || beat.en === L.mayorThanks.en)) continue;
        // Keep the spotlight visible through Kiwi's explanation and optional model.
        // The next NPC line is the re-ask and must return to the normal dialogue.
        if (bagCheckOpen && beat.speaker !== "kiwi") { ui.screen(null); bagCheckOpen = false; }
        await say(beat);
        continue;
      }
      const event = beat.event;
      switch (event.type) {
        case "pickup":
          await pickup(event.item, event.spotId, alive);
          break;
        case "itemMoved": {
          if (event.from.startsWith("spot:") && event.to === "player") {
            if (!pickups.has(`${event.from.slice(5)}:${event.item}`)) await pickup(event.item, event.from.slice(5), alive);
            break;
          }
          const next = step.beats[index + 1];
          const reverse = next?.kind === "event" && next.event.type === "itemMoved" && next.event.from === event.to && next.event.to === event.from ? next.event : null;
          // Both halves of a trade fly together. A borrow/return uses distinct
          // intervening beats, so it remains two successive give animations.
          const trade = !!reverse && isNpc(event.to) && step.state.roles[event.to]?.kind === "trader";
          if (trade && reverse) { await exchange([event, reverse], true, alive); index++; }
          else await exchange([event], false, alive);
          break;
        }
        case "bagCheck":
          audio.play("tryAgain");
          ui.screen("backpack", { bagCheck: event.item });
          bagCheckOpen = true;
          break;
        case "journalFact":
        case "journalWant":
        case "journalNeed":
          audio.play("journal");
          break;
        case "chestDeposit":
          audio.play("correct");
          for (const item of event.items) world.fx({ kind: "sparkles", at: world.chestSlot(item) });
          world.fx({ kind: "decoration", at: chest() });
          break;
        case "decorationLevel":
          // The chapter-clear shot shows it being put up; only an unfinished chapter reveals it here.
          if (!step.state.chapterComplete) {
            world.holdDecorations(null);
            world.fx({ kind: "decoration", at: { ...DISTRICTS.square, y: 3 }, index: event.count });
          }
          audio.play("correct");
          await wait(500);
          break;
        case "lockOpened": {
          const at = world.positionOf({ kind: "seaChest" });
          if (at) world.fx({ kind: "lock", at: { ...at, y: at.y + 0.5 }, index: event.index });
          audio.play("lockClick");
          await wait(350);
          break;
        }
        case "seaChestOpened": {
          const at = world.positionOf({ kind: "seaChest" });
          if (at) world.fx({ kind: "decoration", at: { ...at, y: at.y + 0.3 } });
          audio.play("chestOpen");
          await wait(700);
          break;
        }
        case "seaChestUnlocked": {
          const at = world.positionOf({ kind: "seaChest" });
          if (at) world.fx({ kind: "sparkles", at });
          audio.play("correct");
          break;
        }
        case "sticker":
          audio.play("correct");
          world.fx({ kind: "sparkles", at: playerHand() });
          world.playerGesture("hop");
          break;
        case "posterDone": {
          const at = world.positionOf({ kind: "npc", id: "ken" });
          if (at) world.fx({ kind: "decoration", at: { ...at, y: at.y + 1.5 } });
          world.gesture("ken", "show");
          await wait(650);
          break;
        }
        case "missionComplete":
          audio.play("correct");
          world.fx({ kind: "sparkles", at: playerHand() });
          break;
        case "missionStarted":
          audio.play("journal");
          break;
        // Chapter transitions belong to the outer flow and its save boundary.
        case "chapterComplete":
        case "areaUnlocked":
        case "finale":
          break;
      }
    }
    if (alive() && bagCheckOpen) ui.screen(null);
  }

  async function intro(chapter: ChapterId, skip?: AbortSignal): Promise<void> {
    const pause = (milliseconds: number) => new Promise<void>(resolve => {
      if (skip?.aborted) { resolve(); return; }
      const finish = () => { clearTimeout(timer); skip?.removeEventListener("abort", finish); resolve(); };
      const timer = setTimeout(finish, milliseconds);
      skip?.addEventListener("abort", finish, { once: true });
    });
    const introSay = async (beat: SayBeat) => { if (!skip?.aborted) await say(beat); };
    audio.celebrate(false);
    if (chapter === 1) {
      const started = Date.now();
      world.playCutscene("intro");
      world.fx({ kind: "wind", from: { x: 14, y: 1.6, z: 1 }, targets: ITEM_IDS.map((_, index) => ({ ...DISTRICTS[CHAPTERS[(index % 5 + 1) as ChapterId].district], y: 1.1 })) });
      await pause(3600);
      await introSay({ kind: "say", speaker: "pom", ...L.mayorOhNo, gesture: "sad" });
      await introSay({ kind: "say", speaker: "pom", ...L.mayorHelp, gesture: "talk" });
      await introSay({ kind: "say", speaker: "pom", ...L.mayorBackpack, gesture: "give" });
      if (!skip?.aborted) world.setKiwi("hint", playerHand());
      await introSay({ kind: "say", speaker: "kiwi", ...K.hello });
      // The introduction remains a real cutscene with stubbed TTS, too.
      await pause(Math.max(0, 25_000 - (Date.now() - started)));
      world.setKiwi("follow");
    } else if (chapter === 2) {
      await say({ kind: "say", speaker: "pom", ...L.mayorMarketPen, gesture: "give", showItem: "pen" });
    } else if (chapter === 3) {
      await say({ kind: "say", speaker: "kiwi", en: "Let's help at the school!", ja: "学校で、みんなを手つだおう！" });
    } else if (chapter === 4) {
      await say({ kind: "say", speaker: "pom", ...L.mayorHarborGift, gesture: "give" });
    } else {
      const pose = chestPose(5);
      // The chest on its stage, eight slots glowing and one empty.
      world.setCamera({ mode: "path", elapsed: 0, keys: [
        { position: { x: pose.x + 9, y: 3.8, z: pose.z }, target: { x: pose.x, y: 1.5, z: pose.z }, duration: 1.8 },
        { position: { x: pose.x + 6.6, y: 2.9, z: pose.z }, target: { x: pose.x, y: 1.6, z: pose.z }, duration: 60 }
      ] });
      await say({ kind: "say", speaker: "pom", ...L.mayorNeedPen, gesture: "think" });
    }
    world.setCamera({ mode: "follow" });
    await ui.card({ kind: "mission", title: CHAPTERS[chapter].title.en, ja: CHAPTERS[chapter].title.ja, items: CHAPTERS[chapter].targets });
  }

  async function clear(chapter: ChapterId, replay: boolean): Promise<void> {
    audio.celebrate();
    world.gesture("pom", "cheer");
    world.mood("pom", "happy");
    world.fx({ kind: "decoration", at: chest(), index: chapter });
    // Show the town getting more festive while it happens, not after the card is gone.
    const count = world.runtime.state.chestCount, shot = MILESTONE_SHOTS[count];
    if (shot) {
      world.setCamera({ mode: "path", elapsed: 0, keys: [{ position: shot.position, target: shot.target, duration: 1 }, { position: shot.position, target: shot.target, duration: 60 }] });
      await wait(650);
    }
    world.holdDecorations(null);
    if (shot) {
      world.fx({ kind: "decoration", at: { x: shot.target.x, y: shot.target.y, z: shot.target.z } });
      await wait(1900);
    }
    await ui.card({ kind: "chapter-clear", title: "Chapter clear!", ja: "やったね！", items: CHAPTERS[chapter].targets, chestCount: world.runtime.state.chestCount });
    audio.celebrate(false);
    world.mood("pom", null);
    if (replay || chapter === 5) { world.setCamera({ mode: "follow" }); return; }
    world.playCutscene(gateScenes[chapter]);
    audio.play("correct");
    if (chapter === 2) {
      // Let the camera arrive before the full three-second school-gate travel.
      await wait(700);
      world.runtime.schoolGateHeld = false;
      await wait(3500);
      // A slow/backgrounded renderer must finish the actual slide before a
      // new-area card can cover it. Headless flows have no renderer to await.
      while (world.runtime.state.gates.school && world.runtime.gateProgress && world.runtime.gateProgress.school < 1) await wait(16);
    } else await wait(2300);
    const district = CHAPTERS[chapter].unlocks!;
    await ui.card({ kind: "new-area", title: "New area!", ja: DISTRICT_NAMES[district].ja });
    world.setCamera({ mode: "follow" });
  }

  /** Everyone in a crescent facing the stage and the camera, well clear of the lens. */
  function gather(): void {
    // A copied render snapshot gathers the cast; the frozen core state remains
    // untouched. Integration retains this arrangement for finished free roam.
    const snapshot = structuredClone(world.runtime.state);
    for (const [npc, spot] of Object.entries(FINALE_CREW)) snapshot.npcs[npc as NpcId] = { ...spot, y: 0, district: "festival", indicator: null };
    world.setState(snapshot);
    if (!gathered) {
      gathered = true;
      world.setParty(true);
      world.setKiwi("perch");
      for (const npc of NPC_IDS) { world.hold(npc, null); world.mood(npc, "happy"); }
    }
  }

  /** Fireworks salvos overhead until `stop` is called. Launched from the open chest. */
  function launchFireworks() {
    const pose = chestPose(5);
    const fire = (index: number) => {
      world.fx({ kind: "fireworks", at: { x: pose.x, y: pose.y + 1.2, z: pose.z }, index });
      audio.play("fireworks");
    };
    let index = 0;
    fire(index++);
    const timer = window.setInterval(() => fire(index++), 2400);
    return () => window.clearInterval(timer);
  }

  async function finale(): Promise<void> {
    // The empty bar would sit directly over the opening chest.
    ui.setBackpackHidden(true);
    try { await playFinale(); } finally { ui.setBackpackHidden(false); }
  }

  async function playFinale(): Promise<void> {
    const pose = chestPose(5);
    world.mood("pom", "happy");
    // 1. Every slot lights in turn; 2. gold light spreads across the chest.
    world.setFinale("blaze");
    audio.play("correct");
    await wait(1500);
    // 3. The lid throws open, with a burst of gold.
    world.setFinale("open");
    world.holdDecorations(null);
    audio.celebrate();
    audio.play("chestOpen");
    world.fx({ kind: "decoration", at: { x: pose.x, y: pose.y + 1.4, z: pose.z } });
    await wait(1000);
    // 4–7. Fireworks climb from the chest, dusk falls, the lanterns come on, and the
    // cast is out celebrating as the camera pulls back over the decorated grounds.
    gather();
    world.teleport({ x: -50.6, z: 2.6, yaw: -Math.PI / 2 });
    world.setCamera({ mode: "path", elapsed: 0, keys: [
      { position: { x: pose.x + 9, y: 3.8, z: pose.z }, target: { x: pose.x, y: 2.8, z: pose.z }, duration: 2.2 },
      { position: FINALE_VIEW.position, target: FINALE_VIEW.target, duration: 60 }
    ] });
    world.setKiwi("cheer");
    world.playerGesture("cheer");
    world.playerMood("happy");
    const stop = launchFireworks();
    await wait(3400);
    await say({ kind: "say", speaker: "pom", ...L.mayorOpen, gesture: "cheer", mood: "happy" });
    world.setKiwi("perch");
    await say({ kind: "say", speaker: "pom", ...L.mayorThanks, gesture: "cheer", mood: "happy" });
    stop();
    world.playerMood(null);
    world.setFinale("none");
    world.setCamera({ mode: "follow" });
  }

  /** The gathered festival belongs to the finished campaign; replays and restarts undo it. */
  function reset(): void {
    gathered = false;
    world.runtime.schoolGateHeld = false;
    world.setParty(false);
    world.setFinale("none");
    world.holdDecorations(null);
  }

  return { beats, intro, clear, finale, gather, reset };
}
