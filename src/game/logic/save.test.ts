import { describe, expect, it } from "vitest";
import { autoplayChapter } from "./plan";
import {
  BACKUP_KEY,
  DEFAULT_SETTINGS,
  MIGRATIONS,
  SAVE_KEY,
  loadSettings,
  loadSlot,
  memoryStorage,
  problemWith,
  saveSettings,
  saveSlot,
  SETTINGS_KEY
} from "./save";
import { startChapter } from "./state";

describe("save and load (SPEC §12)", () => {
  it("round-trips a mid-chapter state exactly", () => {
    const steps = autoplayChapter(startChapter(4, { mode: "campaign", campaignSeed: 8 }));
    const mid = { ...steps[3].state, position: { x: 3, z: -4, yaw: 1 } };
    const store = memoryStorage();
    expect(saveSlot(store, SAVE_KEY, mid)).toBe(true);
    const loaded = loadSlot(store, SAVE_KEY);
    expect(loaded.notice).toBeNull();
    expect(loaded.state).toEqual(mid);
  });

  it("relocates an invalid saved position through the world's callback", () => {
    const s = { ...startChapter(2, { mode: "campaign", campaignSeed: 1 }), position: { x: 999, z: 999, yaw: 0 } };
    const store = memoryStorage();
    saveSlot(store, SAVE_KEY, s);
    const loaded = loadSlot(store, SAVE_KEY, () => ({ x: 0, z: 0, yaw: 0 }));
    expect(loaded.state?.position).toEqual({ x: 0, z: 0, yaw: 0 });
  });

  it("backs up and discards corrupt JSON with a notice", () => {
    const store = memoryStorage();
    store.setItem(SAVE_KEY, "{not json");
    const r = loadSlot(store, SAVE_KEY);
    expect(r).toEqual({ state: null, notice: "corrupt" });
    expect(store.getItem(BACKUP_KEY)).toBe("{not json");
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });

  it("reports an unknown version separately", () => {
    const store = memoryStorage();
    store.setItem(SAVE_KEY, JSON.stringify({ ...startChapter(1, { mode: "campaign", campaignSeed: 1 }), version: 7 }));
    expect(loadSlot(store, SAVE_KEY).notice).toBe("unknownVersion");
  });

  it("rejects a save whose items were duplicated or lost", () => {
    const s = startChapter(2, { mode: "campaign", campaignSeed: 1 });
    expect(problemWith(s)).toBeNull();
    const cheated = structuredClone(s);
    cheated.holdings.player = { pen: 1, ruler: 1 };
    expect(problemWith(cheated)).toBe("item totals");
    const broken = structuredClone(s) as unknown as Record<string, unknown>;
    broken.chapter = 9;
    expect(problemWith(broken)).not.toBeNull();
  });

  it("runs registered migrations before validating", () => {
    const store = memoryStorage();
    const current = startChapter(1, { mode: "campaign", campaignSeed: 1 });
    store.setItem(SAVE_KEY, JSON.stringify({ ...current, version: 0 }));
    MIGRATIONS[0] = (raw) => ({ ...raw, version: 1 });
    try {
      expect(loadSlot(store, SAVE_KEY).state?.chapter).toBe(1);
    } finally {
      delete MIGRATIONS[0];
    }
  });

  it("validates and defaults settings", () => {
    const store = memoryStorage();
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    store.setItem(SETTINGS_KEY, JSON.stringify({ music: 5, voiceSpeed: "turbo", micFree: true, seenTips: ["move", 3] }));
    const s = loadSettings(store);
    expect(s.music).toBe(1);
    expect(s.voiceSpeed).toBe("normal");
    expect(s.micFree).toBe(true);
    expect(s.seenTips).toEqual(["move"]);
    saveSettings(store, { ...s, japanese: false });
    expect(loadSettings(store).japanese).toBe(false);
  });

  it("survives a storage that throws", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      }
    };
    expect(loadSlot(throwing, SAVE_KEY)).toEqual({ state: null, notice: null });
    expect(saveSlot(throwing, SAVE_KEY, startChapter(1, { mode: "campaign", campaignSeed: 1 }))).toBe(false);
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
  });
});
