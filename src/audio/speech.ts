import type { ItemId } from "../game/content/ids";
import { askSentence, ITEMS, NO_SENTENCE, YES_SENTENCE } from "../game/content/items";
import type { Prompt } from "../game/logic";
import { judgeAnswer, judgeAnswerLive, judgeAsk, judgeAskLive, type AskJudgement } from "../game/logic/speechJudge";
import { createRecognizer, loadCoach, toCoachAttempt, type Alternatives, type NormalizedAlternative, type Recognizer, type RecognizerOptions } from "./vendor";
import { tts } from "./tts";
import { audio } from "./audio";

export type SpeechPrompt = NonNullable<Prompt>;
export type PromptValue = ItemId | "yes" | "no";
export type PromptResult =
  | { kind: "ask"; item: ItemId; source: "speech" | "choice" }
  | { kind: "answer"; answer: "yes" | "no"; source: "speech" | "choice" }
  | { kind: "cancelled" };

export interface SpeechSnapshot {
  prompt: SpeechPrompt | null;
  misses: number;
  choicesEnabled: boolean;
  micFree: boolean;
  listening: boolean;
  startedAt: number | null;
  modelling: boolean;
  speaking: boolean;
  tip: { en: string; ja: string } | null;
  heard: string;
  coach: { target: string; hint: string } | null;
}

/** The structural ports also support integration's deterministic speech stubs. */
export interface SpeechPort {
  isSpeaking(): boolean;
  onSpeakingChange(listener: (speaking: boolean) => void): () => void;
  speak(text: string, options?: { speaker?: "kiwi" | "player" }): Promise<void>;
}

export interface SpeechOptions {
  micFree?: boolean;
  speech?: SpeechPort;
  recognizerFactory?: (options: RecognizerOptions) => Recognizer;
  onListeningChange?: (listening: boolean) => void;
  onNotice?: (notice: { en: string; ja: string }) => void;
  /** Animation hook; controller independently speaks the model and keeps the mic closed. */
  onKiwiModel?: (sentence: string, prompt: SpeechPrompt) => void | Promise<void>;
  /** Integration can supply the truthful answer. Without it Kiwi models both options. */
  modelAnswer?: (prompt: Extract<SpeechPrompt, { kind: "answer" }>) => "yes" | "no";
  coachEnabled?: boolean;
  coachLoader?: typeof loadCoach;
}

type CoachModule = Awaited<ReturnType<typeof loadCoach>>;
type GameCoach = ReturnType<CoachModule["createGameCoach"]>;

/** Tap-to-talk, one bounded recognizer session per press. Never decides holdings/truth. */
export function createSpeechController(options: SpeechOptions = {}) {
  const speech = options.speech ?? tts;
  const subscribers = new Set<() => void>();
  let sessionMicFree = false;
  let teacherMicFree = options.micFree ?? false;
  let disposed = false;
  let generation = 0;
  let resolvePrompt: ((result: PromptResult) => void) | null = null;
  let attemptOpen = false;
  let promptFallback = false;
  let coachSpeaking = false;
  let coachContainer: HTMLElement | null = null;
  let coach: GameCoach | null = null;
  let coachPending: Promise<CoachModule> | null = null;
  let state: SpeechSnapshot = {
    prompt: null, misses: 0, choicesEnabled: teacherMicFree, micFree: teacherMicFree,
    listening: false, startedAt: null, modelling: false, speaking: speech.isSpeaking(),
    tip: null, heard: "", coach: null
  };

  function patch(next: Partial<SpeechSnapshot>) {
    state = { ...state, ...next };
    subscribers.forEach((listener) => listener());
  }

  function listening(value: boolean) {
    if (state.listening === value) return;
    patch({ listening: value, startedAt: value ? Date.now() : null });
    audio.setListening(value);
    options.onListeningChange?.(value);
  }

  function stopAttempt() {
    attemptOpen = false;
    listening(false);
    recognizer.cancel();
  }

  function complete(value: PromptValue, source: "speech" | "choice"): boolean {
    const prompt = state.prompt;
    if (!prompt) return false;
    if (prompt.kind === "answer" && value !== "yes" && value !== "no") return false;
    if (prompt.kind === "ask" && (value === "yes" || value === "no")) return false;
    const result: PromptResult = prompt.kind === "ask"
      ? { kind: "ask", item: value as ItemId, source }
      : { kind: "answer", answer: value as "yes" | "no", source };
    const resolve = resolvePrompt;
    resolvePrompt = null;
    generation++;
    stopAttempt();
    coach?.clear();
    patch({ prompt: null, modelling: false, coach: null });
    resolve?.(result);
    return true;
  }

  function alternativesHeard(alternatives: readonly NormalizedAlternative[]): string {
    return alternatives[0]?.transcript ?? "";
  }

  async function modelSentence(prompt: SpeechPrompt, nearItem?: ItemId) {
    const current = generation;
    let sentence: string;
    if (prompt.kind === "ask") sentence = askSentence(nearItem ?? prompt.cards[0] ?? "pen");
    else if (options.modelAnswer) sentence = options.modelAnswer(prompt) === "yes" ? YES_SENTENCE : NO_SENTENCE;
    else sentence = `${YES_SENTENCE} ${NO_SENTENCE}`;
    patch({ modelling: true, tip: { en: "Listen to Kiwi!", ja: "キウイを聞いて、もう一度言ってみよう。" } });
    try {
      await Promise.all([speech.speak(sentence, { speaker: "kiwi" }), Promise.resolve(options.onKiwiModel?.(sentence, prompt))]);
    } finally {
      if (current === generation && !disposed) patch({ modelling: false });
    }
  }

  function coachIsEnabled() {
    return !state.micFree && options.coachEnabled !== false &&
      !(typeof location !== "undefined" && new URLSearchParams(location.search).get("coach") === "off");
  }

  async function offerCoach(judgement: Extract<AskJudgement, { kind: "nearMiss" }>) {
    if (!coachIsEnabled()) return;
    const current = generation;
    const attempt = toCoachAttempt(judgement.result, { target: ITEMS[judgement.item].en });
    if (!attempt || attempt.correct) return;
    try {
      coachPending ??= (options.coachLoader ?? loadCoach)();
      const module = await coachPending;
      if (disposed || current !== generation || !state.prompt || !coachIsEnabled()) return;
      if (!coach) {
        coach = module.createGameCoach({
          coach: { learnerLanguage: "ja", hintLanguage: "ja", ageGroup: "elementary", maxHints: 1 },
          ui: coachContainer ? {
            container: coachContainer, placement: "inline", language: "ja", showTryAgain: false,
            labels: { listen: "Listen / 聞く", ariaLabel: "発音のヒント" },
            theme: { fontSize: 16, fontFamily: "system-ui, sans-serif" }
          } : false,
          pauseListening: () => { coachSpeaking = true; stopAttempt(); audio.setExternalSpeaking(true); patch({ speaking: true }); },
          // Ending coach playback never opens the microphone without another press.
          resumeListening: () => { coachSpeaking = false; audio.setExternalSpeaking(false); patch({ speaking: speech.isSpeaking() }); },
          onHint: (result) => {
            if (result.hint) patch({ coach: { target: result.coachedWord ?? ITEMS[judgement.item].en, hint: result.hint.texts.ja || result.hint.text } });
          }
        });
      }
      coach.attempt({
        correct: false, exerciseId: `prompt-${current}`, target: ITEMS[judgement.item].en,
        transcript: attempt.transcript,
        alternatives: attempt.alternatives.map((alt) => ({ transcript: alt.transcript, confidence: alt.confidence ?? undefined }))
      });
      // Vendor UI is mounted outside React; add the same test/target affordances.
      coachContainer?.querySelectorAll("button").forEach((button, index) => {
        button.dataset.testid = `coach-button-${index}`;
        button.style.minWidth = "44px";
        button.style.minHeight = "44px";
        button.style.fontSize = "16px";
      });
    } catch {
      // Optional pronunciation hints must never block the speech ladder.
      coachPending = null;
    }
  }

  function miss(judgement?: AskJudgement) {
    const prompt = state.prompt;
    if (!prompt) return;
    const misses = Math.min(3, state.misses + 1);
    const incomplete = judgement?.kind === "incomplete";
    patch({
      misses, choicesEnabled: state.choicesEnabled || misses >= 3,
      tip: {
        en: incomplete ? "Say the whole question!" : misses >= 3 ? "You can tap a card, too!" : "Try again!",
        ja: incomplete ? "「Do you have a …?」をさいごまで言ってみよう。" : misses >= 3 ? "カードをタップしてもいいよ。" : "もう一度、ゆっくり言ってみよう。"
      }
    });
    if (misses === 2) void modelSentence(prompt, judgement && "item" in judgement ? judgement.item ?? undefined : undefined).catch(() => undefined);
    if (judgement?.kind === "nearMiss") void offerCoach(judgement);
  }

  function judgeFinal(alternatives: Alternatives) {
    if (!state.prompt) return;
    if (state.prompt.kind === "ask") {
      const judgement = judgeAsk(alternatives);
      patch({ heard: judgement.heard });
      if (judgement.kind === "item") complete(judgement.item, "speech");
      else miss(judgement);
    } else {
      const judgement = judgeAnswer(alternatives);
      if (judgement === "yes" || judgement === "no") complete(judgement, "speech");
      else miss();
    }
  }

  const recognizer = (options.recognizerFactory ?? createRecognizer)({
    lang: "en-US", timeoutMs: 8000, interimResults: true, maxAlternatives: 5,
    onStart: () => {
      if (!attemptOpen || speech.isSpeaking() || coachSpeaking) { stopAttempt(); return; }
      listening(true);
    },
    onInterim: (alternatives) => {
      if (!attemptOpen || !state.prompt) return;
      patch({ heard: alternativesHeard(alternatives) });
      const value = state.prompt.kind === "ask" ? judgeAskLive(alternatives) : judgeAnswerLive(alternatives);
      if (value) complete(value, "speech");
    },
    onFinal: (alternatives) => { if (attemptOpen) patch({ heard: alternativesHeard(alternatives) }); },
    onError: (error) => {
      if (!attemptOpen || !state.prompt) return;
      attemptOpen = false;
      listening(false);
      if (error.kind === "unavailable") {
        sessionMicFree = true;
        coach?.clear();
        patch({ micFree: true, choicesEnabled: true, coach: null });
        options.onNotice?.({ en: "Mic-free mode is on.", ja: "マイクが使えないので、カードでつづけよう。" });
      } else if (error.kind === "transient") {
        patch({ tip: { en: "Please try the mic again.", ja: "もう一度マイクをおしてみよう。" } });
      } else miss();
      if (error.fallbackSuggested) { promptFallback = true; patch({ choicesEnabled: true }); }
    },
    onEnd: (event) => {
      if (!attemptOpen || !state.prompt) return;
      attemptOpen = false;
      listening(false);
      if (event.reason === "cancelled" || event.reason === "stopped") return;
      patch({ heard: alternativesHeard(event.alternatives) });
      judgeFinal(event.alternatives);
    }
  });

  const unsubscribeSpeech = speech.onSpeakingChange((speaking) => {
    if (speaking && attemptOpen) stopAttempt();
    patch({ speaking: speaking || coachSpeaking });
  });

  function cancel() {
    generation++;
    const resolve = resolvePrompt;
    resolvePrompt = null;
    stopAttempt();
    coach?.clear();
    coachSpeaking = false;
    audio.setExternalSpeaking(false);
    patch({ prompt: null, modelling: false, speaking: speech.isSpeaking(), coach: null });
    resolve?.({ kind: "cancelled" });
  }

  function begin(prompt: SpeechPrompt): Promise<PromptResult> {
    if (disposed) return Promise.resolve({ kind: "cancelled" });
    cancel();
    promptFallback = false;
    const micFree = teacherMicFree || sessionMicFree;
    // Own the cards array so the frozen integration boundary cannot be mutated by a caller.
    const copied = prompt.kind === "ask" ? { ...prompt, cards: [...prompt.cards] } : { ...prompt };
    patch({ prompt: copied, misses: 0, choicesEnabled: micFree, micFree, tip: null, heard: "" });
    return new Promise((resolve) => { resolvePrompt = resolve; });
  }

  return Object.freeze({
    begin,
    start: begin,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; },
    /** Modal panels can pause capture without settling or resetting this prompt. */
    pause: stopAttempt,
    tap(): boolean {
      if (disposed || !state.prompt || state.micFree || state.modelling || state.speaking || speech.isSpeaking() || coachSpeaking) return false;
      if (attemptOpen) { stopAttempt(); return true; }
      coach?.clear();
      patch({ coach: null, tip: null, heard: "" });
      attemptOpen = true;
      listening(true); // Includes native startup latency, which also needs silent music.
      const started = recognizer.start();
      if (!started && attemptOpen) { attemptOpen = false; listening(false); }
      return started;
    },
    choose(value: PromptValue): boolean {
      if (disposed || !state.choicesEnabled || state.modelling || state.speaking) return false;
      if (state.prompt?.kind === "ask" && !state.prompt.cards.includes(value as ItemId)) return false;
      return complete(value, "choice");
    },
    setMicFree(value: boolean) {
      teacherMicFree = value;
      const micFree = teacherMicFree || sessionMicFree;
      if (micFree) { stopAttempt(); coach?.clear(); }
      patch({ micFree, choicesEnabled: micFree || promptFallback || state.misses >= 3, coach: micFree ? null : state.coach });
    },
    setCoachContainer(container: HTMLElement | null) {
      if (container === coachContainer) return;
      coach?.destroy(); coach = null; coachSpeaking = false;
      audio.setExternalSpeaking(false);
      coachContainer = container;
    },
    cancel,
    dispose() {
      if (disposed) return;
      cancel(); disposed = true;
      unsubscribeSpeech(); recognizer.destroy(); coach?.destroy(); subscribers.clear();
    }
  });
}

export type SpeechController = ReturnType<typeof createSpeechController>;
