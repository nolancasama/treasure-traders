/** Browser speech with classroom pacing, explicit cancellation and bounded completion. */
import type { CharacterId } from "../game/content/ids";
import type { Settings } from "../game/logic";

type Listener = (speaking: boolean) => void;
export type Speaker = CharacterId | "seaChest";
export interface SpeakOptions { speaker?: Speaker; pitch?: number; rate?: number }
interface VoicePreset { pitch: number; rate: number }

/** The same installed English voice stays intelligible across the whole cast. */
export const VOICE_PRESETS: Readonly<Record<Speaker, VoicePreset>> = Object.freeze({
  player: { pitch: 1.12, rate: 0.84 }, kiwi: { pitch: 1.38, rate: 0.87 },
  pom: { pitch: 0.9, rate: 0.85 }, ume: { pitch: 1.07, rate: 0.79 },
  ken: { pitch: 1.19, rate: 0.88 }, bruno: { pitch: 0.84, rate: 0.86 },
  lily: { pitch: 1.22, rate: 0.87 }, max: { pitch: 1.05, rate: 0.9 },
  sara: { pitch: 1.14, rate: 0.88 }, green: { pitch: 1.08, rate: 0.84 },
  page: { pitch: 1.02, rate: 0.8 }, yuki: { pitch: 1.24, rate: 0.86 },
  tom: { pitch: 1.13, rate: 0.86 }, emma: { pitch: 1.27, rate: 0.87 },
  bo: { pitch: 0.76, rate: 0.8 }, finn: { pitch: 0.95, rate: 0.85 },
  mia: { pitch: 1.16, rate: 0.87 }, leo: { pitch: 1.01, rate: 0.85 },
  dan: { pitch: 0.92, rate: 0.89 }, aya: { pitch: 1.23, rate: 0.86 },
  seaChest: { pitch: 0.7, rate: 0.8 }
});

const synth: SpeechSynthesis | null = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
let voice: SpeechSynthesisVoice | null = null;
let rateScale = 1;
let volume = 1;
let speaking = 0;
const listeners = new Set<Listener>();
// Chrome can lose utterance events if references are garbage collected.
const live = new Set<SpeechSynthesisUtterance>();
const pending = new Set<() => void>();

function chooseVoice(): void {
  const english = synth?.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang)) ?? [];
  const preferences = [/Google US English/i, /Samantha/i, /Microsoft (Aria|Jenny|Ana|Zira)/i];
  voice = preferences.map((pattern) => english.find((v) => pattern.test(v.name))).find(Boolean)
    ?? english.find((v) => /^en[-_]US/i.test(v.lang)) ?? english[0] ?? null;
}
if (synth) {
  chooseVoice();
  synth.addEventListener?.("voiceschanged", chooseVoice);
}
function setSpeaking(delta: number): void {
  const before = speaking > 0;
  speaking = Math.max(0, speaking + delta);
  if (before !== (speaking > 0)) listeners.forEach((listener) => listener(speaking > 0));
}

export const tts = {
  available: Boolean(synth),
  onSpeakingChange(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  isSpeaking: (): boolean => speaking > 0,
  /** 1 = normal classroom speed, less than 1 = slower. */
  setRate(scale: number): void { rateScale = Number.isFinite(scale) ? Math.min(2, Math.max(0.5, scale)) : 1; },
  configure(settings: Settings): void {
    volume = Math.min(1, Math.max(0, settings.voice));
    rateScale = settings.voiceSpeed === "slow" ? 0.76 : 1;
  },
  speak(text: string, options: SpeakOptions = {}): Promise<void> {
    if (!text.trim()) return Promise.resolve();
    return new Promise((resolve) => {
      const preset = VOICE_PRESETS[options.speaker ?? "player"];
      const rate = Math.min(2, Math.max(0.4, (options.rate ?? preset.rate) * rateScale));
      const estimate = 900 + text.length * 75 / rate;
      let done = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let utterance: SpeechSynthesisUtterance | undefined;
      const finish = () => {
        if (done) return;
        done = true;
        if (timer !== undefined) clearTimeout(timer);
        if (utterance) {
          utterance.onend = null;
          utterance.onerror = null;
          live.delete(utterance);
        }
        pending.delete(finish);
        setSpeaking(-1);
        resolve();
      };
      pending.add(finish);
      // Notify synchronously, before synth.speak, so an open mic closes first.
      setSpeaking(+1);
      if (done) return; // A speaking-state listener may synchronously cancel.
      if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
        timer = setTimeout(finish, estimate);
        return;
      }
      try {
        if (!voice) chooseVoice();
        utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = voice?.lang ?? "en-US";
        if (voice) utterance.voice = voice;
        utterance.rate = rate;
        utterance.pitch = Math.min(2, Math.max(0, options.pitch ?? preset.pitch));
        utterance.volume = volume;
        live.add(utterance);
        utterance.onend = finish;
        utterance.onerror = finish;
        // Cancel audio as well as releasing the lock if Chrome omits onend.
        timer = setTimeout(() => tts.cancel(), estimate * 2.2 + 1500);
        synth.speak(utterance);
      } catch { finish(); }
    });
  },
  cancel(): void {
    try { synth?.cancel(); } catch { /* Missing browser speech service. */ }
    for (const finish of [...pending]) finish();
  }
};
