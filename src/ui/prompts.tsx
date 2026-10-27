import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { createSpeechController } from "../audio/speech";
import type { Prompt } from "../game/logic";
import { ITEMS } from "../game/content/items";
import { Portrait } from "./icons/Portrait";
import { ItemIcon } from "./icons/ItemIcon";
import { speakerName } from "../game/content/cast";
import "./prompts.css";

type Controller = ReturnType<typeof createSpeechController>;
export type SpeechView = ReturnType<Controller["getSnapshot"]>;
export interface PromptPanelProps {
  prompt: NonNullable<Prompt>;
  state: SpeechView;
  japanese?: boolean;
  onMic: () => void;
  onChoose: Controller["choose"];
  onClose: () => void;
  onReplay: () => void;
  onCoachContainer?: (container: HTMLElement | null) => void;
}

/** Shared keyboard and tap paths both obey the controller's choice gate. */
export function PromptPanel(props: PromptPanelProps) {
  const { prompt, state, japanese = true, onMic, onChoose, onClose, onReplay, onCoachContainer } = props;
  const [now, setNow] = useState(Date.now());
  const coach = useRef<HTMLDivElement>(null);
  useEffect(() => { onCoachContainer?.(coach.current); return () => onCoachContainer?.(null); }, [onCoachContainer]);
  useEffect(() => {
    if (!state.listening) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [state.listening]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.metaKey || event.ctrlKey || /INPUT|SELECT|TEXTAREA/.test((event.target as HTMLElement)?.tagName)) return;
      if ((event.target as HTMLElement)?.tagName === "BUTTON" && event.key !== "Escape" && !/^[1-9]$/.test(event.key)) return;
      if (event.code === "Space") { event.preventDefault(); onMic(); }
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (!state.choicesEnabled) return;
      const index = Number(event.key) - 1;
      if (index < 0 || !Number.isInteger(index)) return;
      if (prompt.kind === "ask" && prompt.cards[index]) { event.preventDefault(); onChoose(prompt.cards[index]); }
      if (prompt.kind === "answer" && index < 2) { event.preventDefault(); onChoose(index === 0 ? "yes" : "no"); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onMic, onChoose, onClose, prompt, state.choicesEnabled]);
  const progress = state.listening && state.startedAt !== null ? Math.max(0, 1 - (now - state.startedAt) / 8000) : 1;
  const disabled = !state.choicesEnabled || state.modelling || state.speaking;
  const name = prompt.target === "seaChest" ? "Sea chest" : speakerName(prompt.target).en;
  return <section className="tt-prompt" data-testid={`${prompt.kind}-prompt`} aria-label={prompt.kind === "ask" ? "Ask a question" : "Answer the question"}>
    <header className="tt-prompt-header"><span className="tt-turn">きみの番！</span><span className="tt-prompt-partner"><Portrait id={prompt.target} size={48} />{name}</span><button data-testid="prompt-replay" onClick={onReplay} disabled={state.listening || state.modelling || state.speaking} aria-label="Hear the question">🔊</button><button data-testid="prompt-bye" onClick={onClose}>Bye ×</button></header>
    <div className="tt-prompt-main"><div className="tt-prompt-content">
      <h2>{prompt.kind === "ask" ? "Do you have a ___?" : prompt.questionEn}</h2>
      {japanese && <p className="tt-prompt-jp">{prompt.kind === "ask" ? "何を持っているか、聞いてみよう！" : prompt.questionJa}</p>}
      {prompt.kind === "ask" ? <div className="tt-ask-choices">{prompt.cards.map((item, index) => <button data-testid={`ask-choice-${item}`} className="tt-choice" key={item} disabled={disabled} onClick={() => onChoose(item)}><ItemIcon id={item} size={48} /><span>{ITEMS[item].en}</span><span className="tt-choice-key">{index + 1}</span></button>)}</div> : <div className="tt-answer-choices">{(["yes", "no"] as const).map((answer, index) => <button data-testid={`answer-choice-${answer}`} className="tt-choice" key={answer} disabled={disabled} onClick={() => onChoose(answer)}><span>{answer === "yes" ? "✓ Yes, I do." : "✗ No, I don't."}</span>{japanese && <span>{answer === "yes" ? "持っているよ。" : "持っていないよ。"}</span>}<span className="tt-choice-key">{index + 1}</span></button>)}</div>}
    </div><div className="tt-mic-area">{!state.micFree && <button data-testid="prompt-mic" className={`tt-mic ${state.listening ? "is-listening" : ""}`} style={{ "--remaining": `${progress * 360}deg` } as CSSProperties} onClick={onMic} disabled={state.speaking || state.modelling} aria-label={state.listening ? "Stop listening" : "Start listening"}><span>🎤</span></button>}
      <span>{state.micFree ? "マイクなしモード" : state.modelling ? "Kiwi is speaking…" : state.listening ? "Listening…" : "Tap / Space"}</span>
      {state.listening && <div className="tt-listening-bars" aria-label="Listening"><i /><i /><i /><i /><i /></div>}
    </div></div>
    <div className="tt-prompt-feedback" role="status">{state.tip ? <><strong>{state.tip.en}</strong>{japanese && <span>{state.tip.ja}</span>}</> : <span>{state.micFree ? "Tap a card to answer!" : state.choicesEnabled ? "Tap a card or say it!" : "Say it with the microphone."}</span>}</div>
    <div ref={coach} className="tt-coach" data-testid="pronunciation-coach">{!onCoachContainer && state.coach && <aside className="tt-coach-preview"><strong>{state.coach.target}</strong><p>{state.coach.hint}</p><button data-testid="coach-preview-listen" onClick={onReplay}>🔊 Listen / 聞く</button></aside>}</div>
  </section>;
}
export function AskPrompt(props: PromptPanelProps & { prompt: Extract<NonNullable<Prompt>, { kind: "ask" }> }) { return <PromptPanel {...props} />; }
export function AnswerPrompt(props: PromptPanelProps & { prompt: Extract<NonNullable<Prompt>, { kind: "answer" }> }) { return <PromptPanel {...props} />; }
