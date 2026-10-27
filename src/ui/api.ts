import { audio } from "../audio/audio";
import { createSpeechController, type SpeechOptions, type PromptResult } from "../audio/speech";
import { tts } from "../audio/tts";
import type { ChapterId, DistrictId, ItemId } from "../game/content/ids";
import { askSentence } from "../game/content/items";
import { DEFAULT_SETTINGS, type Beat, type GameState, type Objective, type Prompt, type Settings } from "../game/logic";

export type SayBeat = Extract<Beat, { kind: "say" }>;
export type Screen = "title" | "backpack" | "journal" | "settings" | "chapters" | "results" | null;
export type JournalTab = "Festival" | "People" | "Words" | "Stickers";
export type Tip = "moving" | "mic" | "asking" | "backpack" | "journal";
export interface CardCommand {
  kind: "mission" | "chapter-clear" | "new-area" | "notice";
  title: string;
  ja?: string;
  items?: ItemId[];
  chestCount?: number;
}
export interface Presentation {
  game: GameState | null;
  objective: Objective | null;
  settings: Settings;
  screen: Screen;
  journalTab: JournalTab;
  inspect: ItemId | undefined;
  bagCheck: ItemId | undefined;
  beat: SayBeat | null;
  card: CardCommand | null;
  notice: string | null;
  tip: Tip | null;
  kiwiHint: string | undefined;
  bottomPanel: number;
}
export interface UIOptions {
  settings?: Settings;
  speech?: SpeechOptions;
  voice?: Pick<typeof tts, "speak" | "cancel" | "isSpeaking" | "onSpeakingChange" | "configure">;
  onAction?: (action: "new-game" | "continue" | "chapters" | "title" | "explore" | "replay" | "reset" | "hint" | "chapter", chapter?: ChapterId) => void;
  onSettingsChange?: (settings: Settings) => void;
  onBottomPanel?: (pixels: number) => void;
}

/** Presentation only: never applies a model transition or writes a save. */
export function createUI(options: UIOptions = {}) {
  const voice = options.voice ?? tts;
  const listeners = new Set<() => void>();
  let state: Presentation = {
    game: null, objective: null, settings: { ...DEFAULT_SETTINGS, ...options.settings, seenTips: [...(options.settings?.seenTips ?? [])] },
    screen: null, journalTab: "Festival", inspect: undefined, bagCheck: undefined,
    beat: null, card: null, notice: null, tip: null, kiwiHint: undefined, bottomPanel: 0
  };
  let slots: Partial<Record<ItemId, DOMRectReadOnly>> = {};
  let resolveSay: (() => void) | null = null;
  let resolveCard: (() => void) | null = null;
  let generation = 0;
  let disposed = false;
  const screenHistory: Screen[] = [];
  const publish = (patch: Partial<Presentation>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    listeners.forEach(fn => fn());
  };
  const speech = createSpeechController({
    ...options.speech,
    speech: options.speech?.speech ?? voice,
    micFree: state.settings.micFree,
    onListeningChange: listening => { audio.setListening(listening); options.speech?.onListeningChange?.(listening); },
    onNotice: message => { publish({ notice: `${message.en} ${message.ja}` }); options.speech?.onNotice?.(message); }
  });
  const stopSay = () => {
    generation++;
    voice.cancel();
    resolveSay?.(); resolveSay = null;
    publish({ beat: null });
  };
  const configure = (settings: Settings) => {
    publish({ settings: { ...settings, seenTips: [...settings.seenTips] } });
    voice.configure(settings); audio.configure(settings); speech.setMicFree(settings.micFree);
    options.onSettingsChange?.(state.settings);
  };
  voice.configure(state.settings); audio.configure(state.settings);
  const api = {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    speech,
    setGame(game: GameState, objective: Objective | null = null) { publish({ game, objective }); },
    configure,
    async say(beat: SayBeat): Promise<void> {
      if (disposed) return;
      speech.cancel(); stopSay();
      const current = generation;
      publish({ beat });
      const advanced = new Promise<void>(resolve => { resolveSay = resolve; });
      const spoken = beat.jaOnly ? Promise.resolve() : voice.speak(beat.en, { speaker: beat.speaker });
      await Promise.all([advanced, spoken]);
      if (current === generation) { resolveSay = null; publish({ beat: null }); }
    },
    advance() { resolveSay?.(); },
    async replay() {
      if (!state.beat || state.beat.jaOnly) return;
      voice.cancel();
      await voice.speak(state.beat.en, { speaker: state.beat.speaker });
    },
    hear(text: string, speaker: SayBeat["speaker"] = "player") { return voice.speak(text, { speaker }); },
    async prompt(prompt: NonNullable<Prompt>): Promise<PromptResult> {
      stopSay();
      const current = generation;
      const result = await speech.begin(prompt);
      if (current !== generation || disposed) return { kind: "cancelled" };
      if (result.kind !== "cancelled" && result.source === "choice") {
        await voice.speak(result.kind === "ask" ? askSentence(result.item) : result.answer === "yes" ? "Yes, I do." : "No, I don't.", { speaker: "player" });
      }
      return current !== generation || disposed ? { kind: "cancelled" } : result;
    },
    screen(screen: Screen, details: { tab?: JournalTab; inspect?: ItemId; bagCheck?: ItemId } = {}) {
      speech.pause();
      if (screen === null) screenHistory.length = 0;
      else if (screen !== state.screen) screenHistory.push(state.screen);
      publish({ screen, journalTab: details.tab ?? state.journalTab, inspect: details.inspect, bagCheck: details.bagCheck });
    },
    back() { speech.pause(); publish({ screen: screenHistory.pop() ?? null, inspect: undefined, bagCheck: undefined }); },
    card(command: CardCommand): Promise<void> {
      if (disposed) return Promise.resolve();
      resolveCard?.(); publish({ card: { ...command } });
      return new Promise(resolve => { resolveCard = resolve; });
    },
    dismissCard() { resolveCard?.(); resolveCard = null; publish({ card: null }); },
    notice(message: string | null) { publish({ notice: message }); },
    hint(message: string | undefined) { publish({ kiwiHint: message }); },
    tip(tip: Tip | null) { if (!tip || !state.settings.seenTips.includes(tip)) { speech.pause(); publish({ tip }); } },
    dismissTip() {
      const tip = state.tip;
      publish({ tip: null });
      if (tip) configure({ ...state.settings, seenTips: [...new Set([...state.settings.seenTips, tip])] });
    },
    setSlotRects(rects: Partial<Record<ItemId, DOMRectReadOnly>>) { slots = { ...rects }; },
    slotRects: () => ({ ...slots }),
    setBottomPanel(pixels: number) {
      const height = Math.max(0, Math.round(pixels));
      if (height === state.bottomPanel) return;
      publish({ bottomPanel: height }); options.onBottomPanel?.(height);
    },
    setDistrict(district: DistrictId) { audio.setDistrict(district); },
    action(action: Parameters<NonNullable<UIOptions["onAction"]>>[0], chapter?: ChapterId) { options.onAction?.(action, chapter); },
    cancel() { stopSay(); speech.cancel(); api.dismissCard(); },
    dispose() { api.cancel(); speech.dispose(); slots = {}; listeners.clear(); disposed = true; }
  };
  return Object.freeze(api);
}
export type UIAPI = ReturnType<typeof createUI>;
export type { PromptResult } from "../audio/speech";
