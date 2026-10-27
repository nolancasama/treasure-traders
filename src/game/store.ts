import { createStore } from "zustand/vanilla";
import {
  REPLAY_KEY,
  SAVE_KEY,
  clearSlot,
  loadSettings,
  loadSlot,
  memoryStorage,
  saveSettings,
  saveSlot,
  type GameState,
  type Settings,
  type StorageLike
} from "./logic";

export type GamePhase = "title" | "playing" | "cutscene" | "results";
export type SavedPosition = NonNullable<GameState["position"]>;

export interface GameStoreState {
  /** The current campaign or replay. Only the pure model changes game rules. */
  game: GameState | null;
  /** The separately retained campaign is used by title and chapter select. */
  campaign: GameState | null;
  hasSave: boolean;
  settings: Settings;
  phase: GamePhase;
  busy: boolean;
  hintLevel: number;
  loadNotice: string | null;
  setGame(game: GameState | null): void;
  setPhase(phase: GamePhase): void;
  setBusy(busy: boolean): void;
  setHintLevel(hintLevel: number): void;
  configure(settings: Settings): void;
  /** Explicit checkpoint, called by flows after a step or completed cutscene. */
  persist(position?: SavedPosition): void;
  load(key?: string, relocate?: (position: SavedPosition) => SavedPosition): GameState | null;
  /** Erases both progress slots while retaining teacher settings. */
  reset(): void;
}

function browserStorage(): StorageLike {
  try {
    if (typeof window !== "undefined") return window.localStorage;
  } catch {
    // Restricted browsers can still play using a session-local slot.
  }
  return memoryStorage();
}

function noticeFor(notice: "corrupt" | "unknownVersion" | null): string | null {
  if (notice === "unknownVersion") {
    return "This save is from another version. We kept a backup. Let's start a new adventure!";
  }
  if (notice === "corrupt") {
    return "We couldn't open your save. We kept a backup. Let's start a new adventure!";
  }
  return null;
}

/** Integration state and explicit save boundaries; no game rules live here. */
export function createGameStore(storage: StorageLike = browserStorage()) {
  const initial = loadSlot(storage, SAVE_KEY);
  return createStore<GameStoreState>((set, get) => ({
    game: null,
    campaign: initial.state,
    hasSave: initial.state !== null,
    settings: loadSettings(storage),
    phase: "title",
    busy: false,
    hintLevel: 0,
    loadNotice: noticeFor(initial.notice),
    setGame: (game) => set({ game }),
    setPhase: (phase) => set({ phase }),
    setBusy: (busy) => set({ busy }),
    setHintLevel: (hintLevel) => set({ hintLevel }),
    configure: (settings) => {
      const snapshot = { ...settings, seenTips: [...settings.seenTips] };
      saveSettings(storage, snapshot);
      set({ settings: snapshot });
    },
    persist: (position) => {
      const { game, phase } = get();
      if (!game || phase === "cutscene") return;
      const checkpoint = position ? { ...game, position: { x: position.x, z: position.z, yaw: position.yaw } } : game;
      const saved = saveSlot(storage, game.mode === "replay" ? REPLAY_KEY : SAVE_KEY, checkpoint);
      if (game.mode === "campaign") {
        set({ game: checkpoint, ...(saved ? { campaign: checkpoint, hasSave: true } : {}) });
      } else if (checkpoint !== game) {
        set({ game: checkpoint });
      }
    },
    load: (key = SAVE_KEY, relocate) => {
      const result = loadSlot(storage, key, relocate);
      const campaignSlot = key === SAVE_KEY;
      set({
        game: result.state,
        loadNotice: noticeFor(result.notice),
        hintLevel: 0,
        ...(campaignSlot ? { campaign: result.state, hasSave: result.state !== null } : {})
      });
      return result.state;
    },
    reset: () => {
      clearSlot(storage, SAVE_KEY);
      clearSlot(storage, REPLAY_KEY);
      set({ game: null, campaign: null, hasSave: false, phase: "title", busy: false, hintLevel: 0, loadNotice: null });
    }
  }));
}

export type GameStore = ReturnType<typeof createGameStore>;
