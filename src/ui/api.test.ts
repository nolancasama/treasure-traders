import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, newCampaign } from "../game/logic";
import { createUI, type UIAPI } from "./api";

function harness() {
  const listeners = new Set<(value: boolean) => void>();
  let speaking = false;
  let finish: (() => void) | undefined;
  const voice = {
    configure: vi.fn(),
    isSpeaking: () => speaking,
    onSpeakingChange(fn: (value: boolean) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    speak: vi.fn(() => new Promise<void>(resolve => {
      speaking = true; listeners.forEach(fn => fn(true));
      finish = () => { speaking = false; listeners.forEach(fn => fn(false)); resolve(); };
    })),
    cancel: vi.fn(() => finish?.())
  };
  const onSettingsChange = vi.fn(), onBottomPanel = vi.fn(), onAction = vi.fn();
  const ui = createUI({ voice, onSettingsChange, onBottomPanel, onAction, speech: { recognizerFactory: () => ({ supported: false, state: "idle", consecutiveEmptySessions: 0, start: () => false, stop() {}, cancel() {}, destroy() {} }) } });
  return { ui, voice, finish: () => finish?.(), onSettingsChange, onBottomPanel, onAction };
}
const beat = { kind: "say", speaker: "pom", en: "Great!", ja: "すごい！" } as const;
describe("frozen presentation commands", () => {
  it("waits for both speech and Continue; replay does not complete a line", async () => {
    const h = harness();
    const done = vi.fn(); const pending = h.ui.say(beat).then(done);
    h.finish(); await Promise.resolve(); expect(done).not.toHaveBeenCalled();
    const replay = h.ui.replay(); h.finish(); await replay;
    expect(h.ui.getSnapshot().beat).toEqual(beat);
    h.ui.advance(); await pending;
    expect(done).toHaveBeenCalledOnce(); expect(h.ui.getSnapshot().beat).toBeNull(); h.ui.dispose();
  });
  it("replaces and cancels pending lines and cards without stranding promises", async () => {
    const h = harness();
    const first = h.ui.say(beat); const second = h.ui.say({ ...beat, en: "Thank you!" });
    await first; expect(h.ui.getSnapshot().beat?.en).toBe("Thank you!");
    const card = h.ui.card({ kind: "mission", title: "Find a pen!" });
    const next = h.ui.card({ kind: "new-area", title: "Market" }); await card;
    h.ui.cancel(); await Promise.all([second, next]);
    expect(h.ui.getSnapshot().card).toBeNull(); h.ui.dispose();
  });
  it("returns model input only, and speaks a mic-free choice in the player voice", async () => {
    const h = harness(); const game = newCampaign(7); h.ui.setGame(game);
    h.ui.configure({ ...DEFAULT_SETTINGS, micFree: true });
    const pending = h.ui.prompt({ kind: "ask", target: "pom", cards: ["eraser"] });
    expect(h.ui.speech.choose("eraser")).toBe(true);
    await Promise.resolve(); expect(h.voice.speak).toHaveBeenLastCalledWith("Do you have an eraser?", { speaker: "player" });
    h.finish(); await expect(pending).resolves.toEqual({ kind: "ask", item: "eraser", source: "choice" });
    expect(h.ui.getSnapshot().game).toBe(game); expect(game.stats.questionsAsked).toBe(0); h.ui.dispose();
  });
  it("publishes settings, remembers tips and reports measured panel heights only when changed", () => {
    const h = harness(); const listener = vi.fn(); const unsubscribe = h.ui.subscribe(listener);
    h.ui.tip("mic"); h.ui.dismissTip(); h.ui.tip("mic");
    expect(h.ui.getSnapshot().tip).toBeNull(); expect(h.onSettingsChange).toHaveBeenCalledOnce();
    h.ui.setBottomPanel(203.7); h.ui.setBottomPanel(204); h.ui.setBottomPanel(-1);
    expect(h.onBottomPanel.mock.calls).toEqual([[204], [0]]);
    expect(Object.isFrozen(h.ui)).toBe(true);
    unsubscribe(); const calls = listener.mock.calls.length; h.ui.notice("hello"); expect(listener).toHaveBeenCalledTimes(calls); h.ui.dispose();
  });
  it("copies slot maps and exposes action callbacks without save mutations", () => {
    const h = harness(); const rect = { x: 1, y: 2, width: 44, height: 44 } as DOMRectReadOnly;
    const map = { pen: rect }; h.ui.setSlotRects(map); delete (map as Partial<typeof map>).pen;
    expect(h.ui.slotRects().pen).toBe(rect); const copied = h.ui.slotRects(); delete copied.pen; expect(h.ui.slotRects().pen).toBe(rect);
    h.ui.action("reset"); expect(h.onAction).toHaveBeenCalledWith("reset", undefined); h.ui.dispose();
  });
  it("returns from title settings and chapter select, while an explicit null clears navigation", () => {
    const { ui } = harness();
    ui.screen("title"); ui.screen("settings"); ui.back(); expect(ui.getSnapshot().screen).toBe("title");
    ui.screen("chapters"); ui.back(); expect(ui.getSnapshot().screen).toBe("title");
    ui.screen(null); ui.screen("backpack"); ui.back(); expect(ui.getSnapshot().screen).toBeNull(); ui.dispose();
  });
  it("resolves an active prompt on disposal", async () => {
    const { ui } = harness(); const result = ui.prompt({ kind: "ask", target: "pom", cards: ["pen"] });
    ui.dispose(); await expect(result).resolves.toEqual({ kind: "cancelled" });
    expect((ui as UIAPI).slotRects()).toEqual({});
  });
  it("does not return a choice after leaving while the player voice is still speaking", async () => {
    const h = harness(); h.ui.configure({ ...DEFAULT_SETTINGS, micFree: true });
    const result = h.ui.prompt({ kind: "ask", target: "pom", cards: ["pen"] });
    h.ui.speech.choose("pen"); await Promise.resolve();
    expect(h.voice.isSpeaking()).toBe(true);
    h.ui.cancel(); await expect(result).resolves.toEqual({ kind: "cancelled" }); h.ui.dispose();
  });
});
