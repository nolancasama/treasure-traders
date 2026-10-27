import { afterEach, describe, expect, it, vi } from "vitest";
import type { Prompt } from "../game/logic";
import * as judges from "../game/logic/speechJudge";
import { normalizeAlternatives, resultFromError, type RecognizerOptions, type RecognitionError } from "./vendor";
import { createSpeechController, type SpeechController, type SpeechOptions, type SpeechPort } from "./speech";

const ASK: NonNullable<Prompt> = { kind: "ask", target: "pom", cards: ["pen", "ruler", "eraser"] };
const ANSWER: NonNullable<Prompt> = {
  kind: "answer", target: "pom", item: "ruler", count: 1, questionId: "test-question",
  questionEn: "Do you have a ruler?", questionJa: "じょうぎを持っている？"
};
const controllers: SpeechController[] = [];
afterEach(() => { controllers.forEach((controller) => controller.dispose()); controllers.length = 0; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function harness(extra: SpeechOptions = {}) {
  let callbacks: RecognizerOptions = {};
  let speaking = false;
  let finishSpeech: (() => void) | undefined;
  const listeners = new Set<(value: boolean) => void>();
  const speech: SpeechPort = {
    isSpeaking: () => speaking,
    onSpeakingChange: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    speak: vi.fn(() => {
      setSpeaking(true);
      return new Promise<void>((resolve) => { finishSpeech = () => { setSpeaking(false); resolve(); }; });
    })
  };
  function setSpeaking(value: boolean) { speaking = value; listeners.forEach((listener) => listener(value)); }
  const start = vi.fn(() => { callbacks.onStart?.(); return true; });
  const cancel = vi.fn();
  const controller = createSpeechController({
    speech,
    recognizerFactory: (options) => {
      callbacks = options;
      return { supported: true, state: "idle", consecutiveEmptySessions: 0, start, cancel, stop: vi.fn(), destroy: vi.fn() };
    },
    ...extra
  });
  controllers.push(controller);
  return {
    controller, start, cancel, speech, setSpeaking,
    end: (text = "") => callbacks.onEnd?.({ alternatives: normalizeAlternatives(text), reason: text ? "final" : "no-speech", final: true }),
    interim: (text: string) => callbacks.onInterim?.(normalizeAlternatives(text)),
    error: (kind: RecognitionError["kind"], fallbackSuggested = false) => callbacks.onError?.({ kind, fallbackSuggested, code: "test", message: "test" }),
    finishSpeech: async () => { finishSpeech?.(); await Promise.resolve(); await Promise.resolve(); },
    get callbacks() { return callbacks; }
  };
}

describe("speech prompt controller", () => {
  it("opens one bounded session only on a press and accepts a live core judgement once", async () => {
    const h = harness();
    const result = h.controller.begin(ASK);
    expect(h.start).not.toHaveBeenCalled();
    expect(h.callbacks.timeoutMs).toBe(8000);
    expect(h.controller.choose("ruler")).toBe(false);
    expect(h.controller.tap()).toBe(true);
    h.interim("do you have a ruler");
    h.end("do you have a marker");
    await expect(result).resolves.toEqual({ kind: "ask", item: "ruler", source: "speech" });
    expect(h.controller.getSnapshot().listening).toBe(false);
  });

  it("advances the ladder per prompt, models on miss 2 with mic closed, and unlocks on miss 3", async () => {
    const onKiwiModel = vi.fn();
    const h = harness({ onKiwiModel });
    const result = h.controller.begin(ASK);
    h.controller.tap(); h.end("ruler");
    expect(h.controller.getSnapshot()).toMatchObject({ misses: 1, choicesEnabled: false, tip: { en: "Say the whole question!" } });
    h.controller.tap(); h.end();
    expect(h.controller.getSnapshot()).toMatchObject({ misses: 2, choicesEnabled: false, modelling: true, listening: false });
    expect(onKiwiModel).toHaveBeenCalledOnce();
    expect(h.speech.speak).toHaveBeenCalledWith("Do you have a pen?", { speaker: "kiwi" });
    expect(h.controller.tap()).toBe(false);
    await h.finishSpeech();
    h.controller.tap(); h.end("hello");
    expect(h.controller.getSnapshot()).toMatchObject({ misses: 3, choicesEnabled: true, micFree: false });
    expect(h.controller.choose("ruler")).toBe(true);
    await expect(result).resolves.toEqual({ kind: "ask", item: "ruler", source: "choice" });
    void h.controller.begin(ASK);
    expect(h.controller.getSnapshot()).toMatchObject({ misses: 0, choicesEnabled: false });
  });

  it("keeps speech available after the choices unlock and never switches the session on silence", async () => {
    const h = harness();
    const result = h.controller.begin(ANSWER);
    h.controller.tap(); h.error("silence"); h.end();
    expect(h.controller.getSnapshot().misses).toBe(1);
    h.controller.tap(); h.error("silence");
    await h.finishSpeech();
    h.controller.tap(); h.error("silence", true);
    expect(h.controller.getSnapshot()).toMatchObject({ misses: 3, choicesEnabled: true, micFree: false });
    h.controller.tap(); h.interim("no");
    await expect(result).resolves.toEqual({ kind: "answer", answer: "no", source: "speech" });
  });

  it("unavailable errors enable mic-free for subsequent prompts and send one short notice", async () => {
    const notice = vi.fn();
    const h = harness({ onNotice: notice });
    const first = h.controller.begin(ASK);
    h.controller.tap(); h.error("unavailable"); h.end();
    expect(h.controller.getSnapshot()).toMatchObject({ misses: 0, micFree: true, choicesEnabled: true, listening: false });
    expect(notice).toHaveBeenCalledOnce();
    h.controller.choose("pen"); await first;
    const second = h.controller.begin(ANSWER);
    h.controller.setMicFree(false);
    expect(h.controller.getSnapshot().micFree).toBe(true);
    expect(h.controller.tap()).toBe(false);
    h.controller.choose("yes");
    await expect(second).resolves.toMatchObject({ answer: "yes", source: "choice" });
  });

  it("transient errors permit a manual retry without a miss and fallbackSuggested unlocks this prompt", () => {
    const h = harness();
    void h.controller.begin(ASK);
    h.controller.tap(); h.error("transient"); h.end();
    expect(h.controller.getSnapshot()).toMatchObject({ misses: 0, choicesEnabled: false, micFree: false, listening: false });
    expect(h.controller.tap()).toBe(true);
    h.error("transient", true);
    h.controller.setMicFree(false);
    expect(h.controller.getSnapshot()).toMatchObject({ choicesEnabled: true, micFree: false });
    void h.controller.begin(ASK);
    expect(h.controller.getSnapshot().choicesEnabled).toBe(false);
  });

  it("counts an unclear answer once and leaves truth checking to the model", async () => {
    const h = harness();
    const result = h.controller.begin(ANSWER);
    h.controller.tap(); h.end("yes no");
    expect(h.controller.getSnapshot().misses).toBe(1);
    h.controller.tap(); h.end("I do not");
    await expect(result).resolves.toMatchObject({ answer: "no" });
  });

  it("models both answer choices when no holdings callback was injected", () => {
    const h = harness();
    void h.controller.begin(ANSWER);
    h.controller.tap(); h.end(); h.controller.tap(); h.end();
    expect(h.speech.speak).toHaveBeenCalledWith("Yes, I do. No, I don't.", { speaker: "kiwi" });
  });

  it("never opens during TTS, closes synchronously when TTS begins and needs a fresh press afterwards", async () => {
    const listening = vi.fn();
    const h = harness({ onListeningChange: listening });
    const result = h.controller.begin(ASK);
    h.setSpeaking(true);
    expect(h.controller.tap()).toBe(false);
    expect(h.start).not.toHaveBeenCalled();
    h.setSpeaking(false);
    h.controller.tap();
    h.setSpeaking(true);
    expect(h.cancel).toHaveBeenCalled();
    expect(h.controller.getSnapshot()).toMatchObject({ listening: false, misses: 0 });
    h.end("do you have a ruler");
    expect(h.controller.getSnapshot().prompt).not.toBeNull();
    h.setSpeaking(false);
    expect(h.start).toHaveBeenCalledOnce();
    h.controller.tap(); h.end("do you have a pen");
    await expect(result).resolves.toMatchObject({ item: "pen" });
    expect(listening.mock.calls.map((call) => call[0])).toEqual([true, false, true, false]);
  });

  it("makes only chapter cards tappable in mic-free mode but recognizes all nine spoken items", async () => {
    const h = harness({ micFree: true });
    const choice = h.controller.begin(ASK);
    expect(h.controller.choose("calendar")).toBe(false);
    h.controller.choose("eraser");
    await expect(choice).resolves.toMatchObject({ item: "eraser", source: "choice" });
    h.controller.setMicFree(false);
    const spoken = h.controller.begin(ASK);
    h.controller.tap(); h.end("do you have a calendar");
    await expect(spoken).resolves.toMatchObject({ item: "calendar", source: "speech" });
  });

  it("settles replaced/cancelled prompts and unsubscribe prevents further notifications", async () => {
    const h = harness();
    const listener = vi.fn();
    const unsubscribe = h.controller.subscribe(listener);
    const first = h.controller.begin(ASK);
    const second = h.controller.begin(ANSWER);
    await expect(first).resolves.toEqual({ kind: "cancelled" });
    unsubscribe(); listener.mockClear();
    h.controller.cancel();
    await expect(second).resolves.toEqual({ kind: "cancelled" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("pauses without a miss or resolution, ignores late callbacks, and the next press starts fresh", async () => {
    const h = harness();
    const result = h.controller.begin(ASK);
    const settled = vi.fn();
    void result.then(settled);
    h.controller.tap();
    h.controller.pause();
    h.interim("do you have a ruler"); h.end("do you have a ruler"); h.error("unavailable");
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot()).toMatchObject({ misses: 0, listening: false, micFree: false, prompt: ASK });
    h.controller.tap();
    expect(h.start).toHaveBeenCalledTimes(2);
    h.end("do you have a ruler");
    await expect(result).resolves.toMatchObject({ item: "ruler" });
  });

  it("a second mic tap closes capture without advancing the miss ladder", () => {
    const h = harness();
    void h.controller.begin(ASK);
    expect(h.controller.tap()).toBe(true);
    expect(h.controller.tap()).toBe(true);
    h.end();
    expect(h.controller.getSnapshot()).toMatchObject({ misses: 0, listening: false, prompt: ASK });
  });
});

describe("optional item pronunciation coach", () => {
  function nearMiss() {
    const result = { ...resultFromError("no-speech"), outcome: "near-miss" as const, nearMiss: true, error: null, transcript: "do you have a pin" };
    vi.spyOn(judges, "judgeAsk").mockReturnValue({ kind: "nearMiss", item: "pen", heard: "do you have a pin", result });
  }

  it("lazy loads only for item near-misses and never changes the miss verdict", async () => {
    nearMiss();
    const attempt = vi.fn(() => ({ classification: "possible-pronunciation" as const, hint: null, coachedWord: "pen", shown: false }));
    const createGameCoach = vi.fn(() => ({ enabled: true, attempt, clear: vi.fn(), reset: vi.fn(), resetAll: vi.fn(), destroy: vi.fn() }));
    const coachLoader = vi.fn(async () => ({ createGameCoach })) as unknown as NonNullable<SpeechOptions["coachLoader"]>;
    const h = harness({ coachLoader });
    void h.controller.begin(ASK);
    expect(coachLoader).not.toHaveBeenCalled();
    h.controller.tap(); h.end("do you have a pin");
    await Promise.resolve(); await Promise.resolve();
    expect(coachLoader).toHaveBeenCalledOnce();
    expect(attempt).toHaveBeenCalledWith(expect.objectContaining({ correct: false, target: "pen" }));
    expect(h.controller.getSnapshot()).toMatchObject({ misses: 1, choicesEnabled: false });
  });

  it.each(["teacher-off", "mic-free", "query-off"])("does not load the coach with %s", async (mode) => {
    nearMiss();
    const coachLoader = vi.fn();
    if (mode === "query-off") vi.stubGlobal("location", { search: "?coach=off" });
    const h = harness({ coachLoader, coachEnabled: mode !== "teacher-off", micFree: mode === "mic-free" });
    void h.controller.begin(ASK);
    h.controller.tap(); h.end("do you have a pin");
    await Promise.resolve();
    expect(coachLoader).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("does not load for incomplete, unrelated, silent or successful attempts", async () => {
    const coachLoader = vi.fn();
    const h = harness({ coachLoader });
    for (const text of ["ruler", "", "hello", "do you have a ruler"]) {
      void h.controller.begin(ASK); h.controller.tap(); h.end(text);
    }
    await Promise.resolve();
    expect(coachLoader).not.toHaveBeenCalled();
  });

  it("the coach Listen hook blocks the mic and playback ending requires a fresh press", async () => {
    nearMiss();
    let pause: (() => void) | undefined;
    let resume: (() => void) | undefined;
    const createGameCoach = (options: { pauseListening?: () => void; resumeListening?: () => void }) => {
      pause = options.pauseListening; resume = options.resumeListening;
      return { enabled: true, attempt: vi.fn(), clear: vi.fn(), reset: vi.fn(), resetAll: vi.fn(), destroy: vi.fn() };
    };
    const coachLoader = vi.fn(async () => ({ createGameCoach })) as unknown as NonNullable<SpeechOptions["coachLoader"]>;
    const h = harness({ coachLoader });
    void h.controller.begin(ASK);
    h.controller.tap(); h.end("do you have a pin");
    await Promise.resolve(); await Promise.resolve();
    pause?.();
    expect(h.controller.getSnapshot()).toMatchObject({ speaking: true, listening: false });
    expect(h.controller.tap()).toBe(false);
    resume?.();
    expect(h.start).toHaveBeenCalledOnce();
    expect(h.controller.tap()).toBe(true);
    expect(h.start).toHaveBeenCalledTimes(2);
  });
});
