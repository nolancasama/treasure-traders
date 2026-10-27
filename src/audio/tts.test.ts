import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../game/logic";

class Utterance {
  lang = "";
  voice: unknown = null;
  rate = 1;
  pitch = 1;
  volume = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}
const synth = { getVoices: vi.fn(() => []), addEventListener: vi.fn(), speak: vi.fn<(utterance: Utterance) => void>(), cancel: vi.fn() };

describe("classroom TTS", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal("window", { speechSynthesis: synth });
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("holds speaking before browser speech begins, applies cast/slow/volume settings, and releases at end", async () => {
    const { tts, VOICE_PRESETS } = await import("./tts");
    tts.configure({ ...DEFAULT_SETTINGS, voice: 0.4, voiceSpeed: "slow" });
    const state: boolean[] = [];
    tts.onSpeakingChange((speaking) => state.push(speaking));
    synth.speak.mockImplementationOnce(() => expect(tts.isSpeaking()).toBe(true));
    const done = tts.speak("Do you have a pen?", { speaker: "kiwi" });
    const utterance = synth.speak.mock.calls[0][0] as unknown as Utterance;
    expect(utterance.pitch).toBe(VOICE_PRESETS.kiwi.pitch);
    expect(utterance.rate).toBeCloseTo(VOICE_PRESETS.kiwi.rate * 0.76);
    expect(utterance.volume).toBe(0.4);
    utterance.onend?.();
    await done;
    expect(state).toEqual([true, false]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancel settles all queued utterances immediately even if Chrome omits events", async () => {
    const { tts } = await import("./tts");
    const state: boolean[] = [];
    tts.onSpeakingChange((speaking) => state.push(speaking));
    const first = tts.speak("Hello!");
    const second = tts.speak("Here you are!");
    tts.cancel();
    await Promise.all([first, second]);
    expect(synth.cancel).toHaveBeenCalledOnce();
    expect(tts.isSpeaking()).toBe(false);
    expect(state).toEqual([true, false]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("watchdog cancels browser speech before releasing the speaking lock", async () => {
    const { tts } = await import("./tts");
    const events: string[] = [];
    synth.cancel.mockImplementationOnce(() => events.push("cancel browser"));
    tts.onSpeakingChange((speaking) => { if (!speaking) events.push("release mic lock"); });
    const done = tts.speak("Hi!");
    await vi.runAllTimersAsync();
    await done;
    expect(events).toEqual(["cancel browser", "release mic lock"]);
    expect(tts.isSpeaking()).toBe(false);
  });

  it("a browser synthesis error settles once and removes the watchdog", async () => {
    const { tts } = await import("./tts");
    const done = tts.speak("Great!");
    const utterance = synth.speak.mock.calls[0][0] as unknown as Utterance;
    utterance.onerror?.();
    await done;
    expect(tts.isSpeaking()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("supports a bounded subtitle hold with no synthesis and immediate cancellation", async () => {
    vi.stubGlobal("window", {});
    const { tts } = await import("./tts");
    expect(tts.available).toBe(false);
    const done = tts.speak("Thank you!");
    expect(tts.isSpeaking()).toBe(true);
    tts.cancel();
    await done;
    expect(tts.isSpeaking()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
