import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, objectives, startChapter, type Prompt } from "../../game/logic";
import { ITEM_IDS } from "../../game/content/ids";
import { STICKER_IDS } from "../../game/content/stickers";
import { createUI, type JournalTab, type Tip } from "../../ui/api";
import { UIHost } from "../../ui/UIHost";
import { BackpackBar } from "../../ui/components";
import { PromptPanel, type SpeechView } from "../../ui/prompts";
import { markGalleryReady } from "../ready";
import "../../ui/gallery.css";

export const UI_VIEWS = [
  "title", "title-confirm", "title-new", "hud", "backpack-bar", "backpack-compact", "backpack", "inspect", "bag-check",
  "dialogue", "dialogue-happy", "dialogue-ja-only", "ask-0", "ask-1", "ask-incomplete", "ask-2", "ask-3", "ask-listening", "ask-all", "ask-coach",
  "answer", "answer-3", "answer-listening", "mic-free", "unavailable", "transient", "fallback",
  "journal-festival", "journal-people", "journal-words", "journal-stickers", "settings", "settings-reset", "chapters",
  "mission", "chapter-clear", "new-area", "notice", "results", "tip-moving", "tip-mic", "tip-asking", "tip-backpack", "tip-journal"
] as const;
type View = typeof UI_VIEWS[number];
const initial = new URLSearchParams(location.search).get("view");
const isPrompt = (view: View) => /^(ask-|answer|mic-free|unavailable|transient|fallback)/.test(view);

function makeGame() {
  const state = startChapter(4, { mode: "replay", campaignSeed: 31 });
  state.holdings.player = { pen: 1, marker: 1, ruler: 1, notebook: 3, pencil: 1 };
  state.journal = { met: ["pom", "lily", "bruno", "page"], facts: { lily: { ruler: true, eraser: false }, bruno: { marker: true, pen: false }, page: { notebook: false } }, wants: { lily: "pen", bruno: "pencil" }, needs: { page: "notebook" } };
  state.memory.lily = { met: true, helped: true, wantKnown: true, traded: 1 };
  state.stickers = [...STICKER_IDS.slice(0, 5)];
  state.completedChapters = [1, 2, 3];
  state.stats = { helped: 12, questionsAsked: 28, answersGiven: 19 };
  return state;
}
const silentVoice = { configure() {}, cancel() {}, isSpeaking: () => false, onSpeakingChange: () => () => {}, speak: async () => {} };

function promptSnapshot(view: View): SpeechView {
  const answer = view.startsWith("answer");
  const prompt: NonNullable<Prompt> = answer
    ? { kind: "answer", target: "pom", item: "ruler", count: 1, questionId: "review", questionEn: "Do you have a ruler?", questionJa: "じょうぎを持っている？" }
    : { kind: "ask", target: "lily", cards: view === "ask-all" ? [...ITEM_IDS] : ["pen", "pencil", "eraser", "ruler", "marker"] };
  const misses = view === "ask-1" || view === "ask-incomplete" ? 1 : view === "ask-2" ? 2 : view === "ask-3" || view === "answer-3" ? 3 : 0;
  const micFree = view === "mic-free" || view === "unavailable";
  return {
    prompt, misses, choicesEnabled: micFree || misses === 3 || view === "fallback", micFree,
    listening: view.endsWith("listening"), startedAt: view.endsWith("listening") ? Date.now() : null,
    modelling: view === "ask-2", speaking: view === "ask-2", heard: "",
    coach: view === "ask-coach" ? { target: "ruler", hint: "舌を少しまるめて、r の音を言ってみよう。" } : null,
    tip: view === "ask-incomplete" ? { en: "Say the whole question!", ja: "「Do you have a …?」をさいごまで言ってみよう。" }
      : misses === 1 ? { en: "Try again!", ja: "もう一度、ゆっくり言ってみよう。" }
      : misses === 2 ? { en: "Listen to Kiwi!", ja: "キウイを聞いて、もう一度言ってみよう。" }
      : view === "transient" ? { en: "Please try the mic again.", ja: "もう一度マイクをおしてみよう。" }
      : misses === 3 || view === "fallback" ? { en: "You can tap a card, too!", ja: "カードをタップしてもいいよ。" } : null
  };
}

export default function UIGallery() {
  const [view, setView] = useState<View>(() => UI_VIEWS.find(value => value === initial) ?? "title");
  const game = useMemo(makeGame, []);
  const [preview, setPreview] = useState<SpeechView>(() => promptSnapshot(view));
  const ui = useMemo(() => createUI({ voice: silentVoice, speech: { recognizerFactory: () => ({ supported: true, state: "idle", consecutiveEmptySessions: 0, start: () => true, stop() {}, cancel() {}, destroy() {} }) } }), []);
  useEffect(() => () => ui.dispose(), [ui]);
  useEffect(() => {
    document.body.removeAttribute("data-gallery-ready");
    ui.cancel(); ui.screen(null); ui.notice(null); ui.hint(undefined);
    ui.configure({ ...DEFAULT_SETTINGS, seenTips: [] });
    ui.setGame(game, { ...objectives(game)[0], id: "review", en: "Find the ruler!", ja: "市場の人に聞いてみよう！", sentence: "Do you have a ruler?", counter: { current: 1, total: 2, item: "ruler" }, target: null, hint1: "市場へ行こう。", hint2: "花屋さんに聞いてみよう。", hint3: null });
    setPreview(promptSnapshot(view));
    if (view.startsWith("title")) ui.screen("title");
    if (view === "hud") ui.hint("持っているものは、下のかばんで見られるよ！");
    if (["backpack", "inspect", "bag-check"].includes(view)) ui.screen("backpack", { inspect: view === "inspect" ? "pencil" : undefined, bagCheck: view === "bag-check" ? "eraser" : undefined });
    if (view.startsWith("dialogue") || view === "backpack-compact") void ui.say(view === "dialogue-ja-only" ? { kind: "say", speaker: "kiwi", en: "", ja: "かばんに入っているものを見てみよう！", jaOnly: true } : { kind: "say", speaker: "lily", en: "Yes, I do! Let's trade!", ja: "うん、持っているよ！こうかんしよう！", mood: view === "dialogue-happy" ? "happy" : "neutral", showItem: "ruler" });
    if (view.startsWith("journal-")) ui.screen("journal", { tab: (view.slice(8).charAt(0).toUpperCase() + view.slice(9)) as JournalTab });
    if (view.startsWith("settings")) ui.screen("settings");
    if (view === "chapters") ui.screen("chapters");
    if (view === "results") ui.screen("results");
    if (view === "mission") void ui.card({ kind: "mission", title: "Market Trades", ja: "じょうぎとマーカーをさがそう！", items: ["ruler", "marker"] });
    if (view === "chapter-clear") void ui.card({ kind: "chapter-clear", title: "Great teamwork!", ja: "おまつりに、また一歩近づいたね！", items: ["ruler", "marker"], chestCount: 4 });
    if (view === "new-area") void ui.card({ kind: "new-area", title: "Schoolhouse", ja: "学校へ行けるようになったよ！" });
    if (view === "notice") void ui.card({ kind: "notice", title: "Mic-free mode is on.", ja: "マイクが使えないので、カードでつづけよう。" });
    if (view === "unavailable") ui.notice("Mic-free mode is on. マイクが使えないので、カードでつづけよう。");
    if (view.startsWith("tip-")) ui.tip(view.slice(4) as Tip); else ui.tip(null);
    const timer = setTimeout(() => {
      if (view === "title-confirm") document.querySelector<HTMLButtonElement>('[data-testid="title-new"]')?.click();
      if (view === "settings-reset") document.querySelector<HTMLButtonElement>('[data-testid="settings-reset"]')?.click();
      markGalleryReady();
    }, 250);
    return () => clearTimeout(timer);
  }, [ui, view, game]);
  return <main className="tt-gallery" data-testid="ui-gallery" data-ui-view={view}>
    <div className="tt-gallery-backdrop" aria-hidden="true"><div className="tt-gallery-sun" /><div className="tt-gallery-hill" /><div className="tt-gallery-path" /><div className="tt-gallery-stand"><span>✿</span><i /><i /><i /></div><div className="tt-gallery-sign">FESTIVAL<br />SQUARE</div></div>
    <UIHost ui={ui} hasSave={view !== "title-new"} />
    {isPrompt(view) && <div className="tt-gallery-prompt"><div className="tt-gallery-prompt-dock"><BackpackBar inventory={game.holdings.player ?? {}} compact onOpen={() => ui.screen("backpack")} /></div><PromptPanel prompt={preview.prompt!} state={preview} onMic={() => setPreview(old => ({ ...old, listening: !old.listening, startedAt: Date.now() }))} onChoose={value => { ui.notice(`You said: ${value}`); return true; }} onClose={() => ui.notice("Bye! またね！")} onReplay={() => {}} /></div>}
    <label className="tt-gallery-tools">UI review <select data-testid="ui-gallery-view" value={view} onChange={event => { const next = event.target.value as View; history.replaceState(null, "", `?gallery=ui&view=${next}`); setView(next); }}>{UI_VIEWS.map(value => <option key={value}>{value}</option>)}</select></label>
  </main>;
}
