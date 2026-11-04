import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { audio } from "../audio/audio";
import { itemsOf } from "../game/logic";
import { PromptPanel } from "./prompts";
import { BackpackBar, BackpackPanel, Card, ChapterSelect, DebugMenu, DialoguePanel, FirstTimeTip, Hud, JournalPanel, ResultsScreen, SettingsPanel, TitleScreen } from "./components";
import type { UIAPI, JournalTab } from "./api";
import "./host.css";

/** Mount above the world; the caller owns game transitions and input locking. */
export function UIHost({ ui, hasSave = false, titleBackdrop }: { ui: UIAPI; hasSave?: boolean; titleBackdrop?: React.ReactNode }) {
  const state = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
  const speech = useSyncExternalStore(ui.speech.subscribe, ui.speech.getSnapshot);
  const panel = useRef<HTMLDivElement>(null), tabbed = useRef(false);
  const [micStatus, setMicStatus] = useState("");
  const game = state.game;
  const openJournal = (tab?: JournalTab) => ui.screen("journal", { tab });
  const activePanel = Boolean(state.beat || speech.prompt);
  useEffect(() => {
    const element = panel.current;
    if (!element || !activePanel) { ui.setBottomPanel(0); return; }
    const report = () => ui.setBottomPanel(element.getBoundingClientRect().height);
    report(); const observer = new ResizeObserver(report); observer.observe(element);
    return () => { observer.disconnect(); ui.setBottomPanel(0); };
  }, [ui, activePanel]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      // Read live: an effect re-subscribes only after paint, so on a slow frame its
      // captured state can still be the gap between two lines, and drop the key.
      const state = ui.getSnapshot(), speech = ui.speech.getSnapshot();
      if (event.key === "Tab") tabbed.current = true;
      // During a line these keys mean Continue, unless the child tabbed to a button on purpose.
      // A key press makes a clicked button match :focus-visible too, so that cannot tell them apart.
      const advanceKey = event.code === "Space" || event.key === "Enter", tag = (event.target as HTMLElement)?.tagName;
      if (state.beat && advanceKey && !event.altKey && !event.ctrlKey && !event.metaKey && !speech.prompt && !state.screen && !state.card && !state.tip && !/INPUT|SELECT|TEXTAREA/.test(tag) && (event.repeat || !tabbed.current || tag !== "BUTTON")) {
        event.preventDefault();
        if (!event.repeat) ui.advance();
        return;
      }
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || /INPUT|SELECT|TEXTAREA|BUTTON/.test((event.target as HTMLElement)?.tagName)) return;
      if (speech.prompt) return;
      if (event.key === "Escape") { if (state.screen) ui.back(); else ui.screen("settings"); event.preventDefault(); return; }
      if (state.screen || state.card || state.tip) return;
      const letter = event.key.toLowerCase();
      if (letter === "b") ui.screen("backpack");
      if (letter === "j") ui.screen("journal");
      if (letter === "h") ui.action("hint");
    };
    const pointer = () => { tabbed.current = false; };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", pointer, true);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("pointerdown", pointer, true); };
  }, [ui]);
  const checkMic = async () => {
    if (speech.prompt || speech.micFree) { setMicStatus(speech.micFree ? "マイクなしモードです。" : "会話のあとでチェックしてね。"); return; }
    setMicStatus("Say ‘Yes, I do.’ / マイクに話してね。");
    const pending = ui.speech.begin({ kind: "answer", target: "pom", item: "pen", count: 1, questionId: "ui-mic-check", questionEn: "Say ‘Yes, I do.’", questionJa: "マイクのチェック" });
    ui.speech.tap();
    const result = await pending;
    setMicStatus(result.kind === "cancelled" ? "もう一度チェックできます。" : "✓ 聞こえたよ！");
  };
  return <div className="tt-ui" onPointerDown={() => { audio.unlock(); }}>
    {game && state.screen !== "title" && <>
      {state.objective && <Hud objective={state.objective} chestCount={itemsOf(game.holdings, "chest").length} japanese={state.settings.japanese} kiwiHint={state.kiwiHint} onJournal={openJournal} onHint={() => ui.action("hint")} onSettings={() => ui.screen("settings")} onReplay={() => void ui.hear(state.objective?.sentence ?? state.objective?.en ?? "")} />}
      <div className={`tt-host-backpack ${activePanel ? "tt-host-compact" : ""} ${state.backpackHidden ? "tt-host-backpack-hidden" : ""}`} style={activePanel ? { bottom: state.bottomPanel + 8 } : undefined}><BackpackBar inventory={game.holdings.player ?? {}} compact={activePanel} onOpen={() => ui.screen("backpack")} onInspect={item => ui.screen("backpack", { inspect: item })} onSlotRects={ui.setSlotRects} measureKey={state.bottomPanel} /></div>
    </>}
    <div className="tt-host-bottom" ref={panel}>
      {state.beat && <DialoguePanel beat={state.beat} japanese={state.settings.japanese} speaking={speech.speaking} onReplay={() => void ui.replay()} onContinue={ui.advance} />}
      {speech.prompt && state.screen !== "settings" && <PromptPanel prompt={speech.prompt} state={speech} japanese={state.settings.japanese} onMic={() => { ui.speech.tap(); }} onChoose={ui.speech.choose} onClose={ui.cancel} onReplay={() => void ui.hear(speech.prompt?.kind === "answer" ? speech.prompt.questionEn : "Do you have a pen?")} onCoachContainer={ui.speech.setCoachContainer} />}
    </div>
    {state.screen === "title" && <TitleScreen hasSave={hasSave} micFree={state.settings.micFree} onNewGame={() => ui.action("new-game")} onContinue={() => ui.action("continue")} onChapters={() => ui.screen("chapters")} onSettings={() => ui.screen("settings")} onMicFree={value => ui.configure({ ...state.settings, micFree: value })} backdrop={titleBackdrop} />}
    {state.screen === "backpack" && game && <BackpackPanel inventory={game.holdings.player ?? {}} japanese={state.settings.japanese} inspect={state.inspect} bagCheck={state.bagCheck} onInspect={item => ui.screen("backpack", { inspect: item, bagCheck: state.bagCheck })} onSpeak={text => { void ui.hear(text); }} onClose={ui.back} />}
    {state.screen === "journal" && game && <JournalPanel state={game} tab={state.journalTab} onTab={tab => ui.screen("journal", { tab })} japanese={state.settings.japanese} onSpeak={text => { void ui.hear(text); }} onClose={ui.back} />}
    {state.screen === "settings" && <SettingsPanel settings={state.settings} onChange={ui.configure} onMicCheck={() => void checkMic()} micStatus={speech.listening ? "Listening… / 聞いているよ" : micStatus || speech.tip?.en} onReset={() => ui.action("reset")} onClose={() => { if (speech.prompt?.kind === "answer" && speech.prompt.questionId === "ui-mic-check") ui.speech.cancel(); ui.back(); }} />}
    {state.screen === "chapters" && <ChapterSelect current={game?.chapter ?? 1} completed={game?.completedChapters ?? []} onSelect={chapter => ui.action("chapter", chapter)} japanese={state.settings.japanese} onClose={ui.back} />}
    {state.screen === "debug" && <DebugMenu current={game?.chapter ?? 1} completed={game?.completedChapters ?? []} build={document.querySelector<HTMLMetaElement>('meta[name="tt-build"]')?.content ?? "dev"} onChapter={chapter => ui.action("debug-chapter", chapter)} onUnlockAll={() => ui.action("debug-unlock-all")} onClose={ui.back} />}
    {state.screen === "results" && game && <div className={state.settings.japanese ? undefined : "tt-no-japanese"}><ResultsScreen state={game} onReplay={() => ui.action("replay")} onTitle={() => ui.action("title")} onExplore={() => ui.action("explore")} /></div>}
    {state.card && <Card {...state.card} ja={state.settings.japanese ? state.card.ja : undefined} onContinue={ui.dismissCard} />}
    {state.tip && <FirstTimeTip tip={state.tip} onDismiss={ui.dismissTip} />}
    {state.notice && <div className="tt-host-notice" role="status"><span>{state.notice}</span><button data-testid="notice-dismiss" onClick={() => ui.notice(null)} aria-label="Close notice">×</button></div>}
  </div>;
}
