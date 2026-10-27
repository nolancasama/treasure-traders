import { audio } from "../../audio/audio";
import type { SayBeat, UIAPI } from "../../ui";
import { CHAPTERS, DISTRICT_NAMES } from "../content/chapters";
import { ITEM_IDS, NPC_IDS, type ChapterId, type ItemId, type NpcId } from "../content/ids";
import { ITEMS } from "../content/items";
import { itemExclaim, K, L } from "../content/lines";
import type { GameEvent, HolderId, Step } from "../logic";
import { DISTRICTS, type Position, type WorldAPI } from "../world";

const wait = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));
const isNpc = (id: string): id is NpcId => NPC_IDS.some(npc => npc === id);
const gateScenes = { 1: "cart", 2: "school", 3: "bridge", 4: "arch" } as const;
type MoveEvent = Extract<GameEvent, { type: "itemMoved" }>;

/** Only presentation lives here: the caller applies and persists each core Step. */
export function createPresenter(world: WorldAPI, ui: UIAPI) {
  const playerHand = (): Position => ({ ...world.runtime.player, y: world.runtime.player.y + 1.1 });
  const chest = (): Position => ({ x: world.runtime.state.chapter === 5 ? -55 : 0, y: 1.2, z: world.runtime.state.chapter === 5 ? 0 : -8 });
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
      if (beat.showItem) world.hold(beat.speaker, beat.showItem);
      else if (beat.gesture === "shake" || beat.gesture === "sad") world.hold(beat.speaker, null);
      // bagCheck is a core presentation cue, rather than an art-kit gesture.
      world.gesture(beat.speaker, beat.gesture === "bagCheck" ? "think" : beat.gesture ?? (beat.showItem ? "show" : "talk"));
    } else if (beat.speaker === "seaChest" && beat.gesture === "shake") {
      const at = world.positionOf({ kind: "seaChest" });
      if (at) world.fx({ kind: "lock", at });
      audio.play("tryAgain");
    }
    await ui.say(beat);
  };
  const arc = (event: MoveEvent, trade = false) => {
    const from = holderPosition(event.from, event.item), to = holderPosition(event.to, event.item);
    if (from && to) world.fx({ kind: event.to === "chest" ? "deposit" : trade ? "trade" : "give", item: event.item, from, to });
    if (isNpc(event.to)) {
      world.hold(event.to, event.item);
      world.gesture(event.to, "give");
    }
    if (isNpc(event.from)) world.gesture(event.from, "give");
  };
  const pickup = async (item: ItemId, spotId: string, alive: () => boolean) => {
    const nameCard = ui.say({ kind: "say", speaker: "kiwi", en: itemExclaim(item), ja: ITEMS[item].ja, showItem: item });
    // Let the compact backpack measure its slots above the new name panel.
    await wait(32);
    if (!alive()) return;
    const from = world.positionOf({ kind: "spot", id: spotId });
    const slot = ui.slotRects()[item];
    if (from && slot) world.fx({ kind: "pickup", item, from, screen: { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 } });
    else if (from) world.fx({ kind: "give", item, from, to: playerHand() });
    audio.play("pickup");
    await Promise.all([nameCard, wait(1050)]);
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
          arc(event, trade);
          if (trade && reverse) { arc(reverse, true); index++; }
          audio.play(trade ? "trade" : "give");
          await wait(800);
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
          break;
        case "decorationLevel": {
          const district = event.count === 2 ? "square" : event.count === 4 ? "market" : event.count === 6 ? "school" : event.count === 8 ? "harbor" : "festival";
          world.fx({ kind: "decoration", at: { ...DISTRICTS[district], y: 3 }, index: event.count });
          if (event.count === 8) world.fx({ kind: "decoration", at: { x: -22, y: 3, z: 0 }, index: 8 });
          audio.play("correct");
          await wait(500);
          break;
        }
        case "lockOpened": {
          const at = world.positionOf({ kind: "seaChest" });
          if (at) world.fx({ kind: "lock", at: { ...at, y: at.y + 0.8 }, index: event.index });
          audio.play("lockClick");
          await wait(350);
          break;
        }
        case "seaChestOpened":
          audio.play("chestOpen");
          await wait(700);
          break;
        case "seaChestUnlocked": {
          const at = world.positionOf({ kind: "seaChest" });
          if (at) world.fx({ kind: "sparkles", at });
          audio.play("correct");
          break;
        }
        case "sticker":
          audio.play("correct");
          world.fx({ kind: "sparkles", at: playerHand() });
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
      await pause(2200);
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
      world.playCutscene("finale");
      await say({ kind: "say", speaker: "pom", ...L.mayorNeedPen, gesture: "think" });
    }
    world.setCamera({ mode: "follow" });
    await ui.card({ kind: "mission", title: CHAPTERS[chapter].title.en, ja: CHAPTERS[chapter].title.ja, items: CHAPTERS[chapter].targets });
  }

  async function clear(chapter: ChapterId, replay: boolean): Promise<void> {
    audio.celebrate();
    world.gesture("pom", "cheer");
    world.fx({ kind: "decoration", at: chest(), index: chapter });
    await ui.card({ kind: "chapter-clear", title: "Chapter clear!", ja: "やったね！", items: CHAPTERS[chapter].targets, chestCount: world.runtime.state.chestCount });
    audio.celebrate(false);
    if (replay || chapter === 5) return;
    world.playCutscene(gateScenes[chapter]);
    audio.play("correct");
    await wait(2300);
    const district = CHAPTERS[chapter].unlocks!;
    await ui.card({ kind: "new-area", title: "New area!", ja: DISTRICT_NAMES[district].ja });
    world.setCamera({ mode: "follow" });
  }

  function gather(): void {
    // A copied render snapshot gathers the cast; the frozen core state remains
    // untouched. Integration retains this arrangement for finished free roam.
    const snapshot = structuredClone(world.runtime.state);
    NPC_IDS.forEach((npc, index) => {
      snapshot.npcs[npc] = { x: -56 + index % 6 * 2.6, y: 0, z: index < 6 ? -7 : index < 12 ? 7 : -11, district: "festival", yaw: index < 6 ? 0 : Math.PI, indicator: null };
    });
    snapshot.npcs.pom = { x: -54, y: 0, z: -2.3, district: "festival", yaw: 0, indicator: null };
    world.setState(snapshot);
    world.setKiwi("perch");
    for (const npc of NPC_IDS) { world.hold(npc, null); world.gesture(npc, "cheer"); }
  }

  async function finale(): Promise<void> {
    gather();
    world.playCutscene("finale");
    audio.celebrate();
    audio.play("chestOpen");
    for (let index = 0; index < 4; index++) {
      world.fx({ kind: "fireworks", at: { x: -55 + (index % 2 ? 4 : -4), y: 4 + index * 0.5, z: index < 2 ? -4 : 4 }, index });
      audio.play("fireworks");
      await wait(700);
    }
    await say({ kind: "say", speaker: "pom", ...L.mayorOpen, gesture: "cheer", mood: "happy" });
    await say({ kind: "say", speaker: "pom", ...L.mayorThanks, gesture: "cheer", mood: "happy" });
    world.setCamera({ mode: "follow" });
  }

  return { beats, intro, clear, finale, gather };
}
