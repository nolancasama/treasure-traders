import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import { CAST, speakerName } from "../game/content/cast";
import { CHAPTERS, DISTRICT_NAMES } from "../game/content/chapters";
import { CHAPTER_IDS, ITEM_IDS, type ChapterId, type ItemId } from "../game/content/ids";
import { ITEMS, askSentence, withArticle, YES_SENTENCE, NO_SENTENCE } from "../game/content/items";
import { STICKERS, STICKER_IDS } from "../game/content/stickers";
import type { Beat, GameState, Inventory, Objective, Settings } from "../game/logic";
import { buildItem, itemSize } from "../scene/models/items";
import { ItemIcon, ItemSilhouette } from "./icons/ItemIcon";
import { Portrait } from "./icons/Portrait";
import { StickerIcon } from "./icons/StickerIcon";
import "./ui.css";

export type JournalTab = "Festival" | "People" | "Words" | "Stickers";
export type SlotRects = Record<ItemId, DOMRectReadOnly>;
export type SayBeat = Extract<Beat, { kind: "say" }>;

const dialogStack: HTMLElement[] = [];
function useDialogFocus(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controls = () => [...node.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter(el => el.getClientRects().length > 0);
    dialogStack.push(node);
    const frame = requestAnimationFrame(() => { if (dialogStack.at(-1) === node) (controls()[0] ?? node).focus(); });
    const key = (event: KeyboardEvent) => {
      if (dialogStack.at(-1) !== node) return;
      // A modal owns its keys, including Space and number keys used by the
      // speech panel beneath it. Native controls retain their default actions.
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); close.current(); return; }
      if (event.key !== "Tab") return;
      const focusable = controls();
      const first = focusable[0] ?? node;
      const last = focusable.at(-1) ?? node;
      if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", key, true);
      const index = dialogStack.indexOf(node);
      if (index >= 0) dialogStack.splice(index, 1);
      if (previous?.isConnected) previous.focus();
    };
  }, [ref]);
}

function Button({ id, children, onClick, primary = false, disabled = false, label, className = "" }: {
  id: string; children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; label?: string; className?: string;
}) {
  return <button type="button" data-testid={id} className={`tt-button ${primary ? "tt-primary" : ""} ${className}`} disabled={disabled} onClick={onClick} aria-label={label}>{children}</button>;
}

function Modal({ title, subtitle, id, onClose, children, className = "" }: {
  title: string; subtitle?: string; id: string; onClose: () => void; children: ReactNode; className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, onClose);
  return <div className="tt-shade"><section ref={ref} tabIndex={-1} className={`tt-modal tt-paper ${className}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} data-testid={id}>
    <header className="tt-modal-head"><div><span className="tt-eyebrow">TREASURE TRADERS</span><h1 id={`${id}-heading`}>{title}</h1>{subtitle && <p className="tt-ja">{subtitle}</p>}</div><Button id={`${id}-close`} onClick={onClose} label="Close">✕</Button></header>
    <div className="tt-modal-content">{children}</div>
  </section></div>;
}

function Confirm({ title, ja, onConfirm, onCancel, id }: { title: string; ja: string; onConfirm: () => void; onCancel: () => void; id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onCancel);
  return <div ref={ref} tabIndex={-1} className="tt-confirm" role="alertdialog" aria-modal="true" aria-label={title}><div className="tt-paper"><h2>{title}</h2><p className="tt-ja">{ja}</p><div className="tt-actions"><Button id={`${id}-cancel`} onClick={onCancel}>もどる</Button><Button id={`${id}-confirm`} primary onClick={onConfirm}>はい</Button></div></div></div>;
}

export interface TitleScreenProps {
  hasSave: boolean; micFree: boolean; onNewGame: () => void; onContinue: () => void;
  onChapters: () => void; onSettings: () => void; onMicFree: (value: boolean) => void; backdrop?: ReactNode;
}
export function TitleScreen({ hasSave, micFree, onNewGame, onContinue, onChapters, onSettings, onMicFree, backdrop }: TitleScreenProps) {
  const [confirm, setConfirm] = useState(false);
  return <section className="tt-title" data-testid="title-screen">
    <div className="tt-title-backdrop">{backdrop}</div><div className="tt-title-wash" />
    <div className="tt-title-card tt-paper tt-bunting"><span className="tt-eyebrow">THE SCHOOL FESTIVAL QUEST</span><div className="tt-title-emblem" aria-hidden="true">✦</div><h1>Treasure<br /><span>Traders</span></h1><p className="tt-title-subtitle">ことばでつながる、おまつりの町。</p>
      <div className="tt-title-actions"><Button id="title-new" primary onClick={() => hasSave ? setConfirm(true) : onNewGame()}>はじめから <span>New game</span></Button><Button id="title-continue" disabled={!hasSave} onClick={onContinue}>つづきから <span>Continue</span></Button><div className="tt-actions"><Button id="title-chapters" onClick={onChapters}>チャプター</Button><Button id="title-settings" onClick={onSettings}>せってい</Button></div></div>
      <label className="tt-toggle tt-teacher"><input data-testid="title-mic-free" type="checkbox" checked={micFree} onChange={e => onMicFree(e.target.checked)} /><span>マイクなしモード<span className="tt-ja">先生用 / Teacher setting</span></span></label>
    </div><p className="tt-title-foot">Ask. Trade. Help. Bring the festival to life!</p>
    {confirm && <Confirm id="new-game" title="Start a new adventure?" ja="いまのぼうけんを消して、はじめからあそぶ？" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onNewGame(); }} />}
  </section>;
}

export interface HudProps {
  objective: Objective; chestCount: number; japanese?: boolean; kiwiHint?: string;
  onJournal: (tab?: JournalTab) => void; onHint: () => void; onSettings: () => void; onReplay: (text: string) => void;
}
export function Hud({ objective, chestCount, japanese = true, kiwiHint, onJournal, onHint, onSettings, onReplay }: HudProps) {
  return <div className="tt-hud" data-testid="hud"><section className="tt-objective tt-paper" aria-label="Current mission"><span className="tt-eyebrow">✦ MISSION</span><h2>{objective.en}</h2>{objective.sentence && <button type="button" className="tt-sentence-chip" data-testid="objective-replay" onClick={() => onReplay(objective.sentence!)} aria-label={`Hear ${objective.sentence}`}>🔊 {objective.sentence}</button>}{japanese && <p className="tt-ja">{objective.ja}</p>}{objective.counter && <div className="tt-counter">{objective.counter.item && <ItemIcon id={objective.counter.item} size={28} />}<strong>{objective.counter.current} / {objective.counter.total}</strong><span>found</span></div>}</section>
    <nav className="tt-hud-tools" aria-label="Game tools"><Button id="hud-chest" onClick={() => onJournal("Festival")} className="tt-chest-badge" label={`Festival chest ${chestCount} of 9`}>▣ <strong>{chestCount}<span> / 9</span></strong></Button><Button id="hud-journal" onClick={() => onJournal()} label="Journal (J)">📖<span>J</span></Button><Button id="hud-kiwi" onClick={onHint} label="Kiwi hint (H)">🦜<span>H</span></Button><Button id="hud-settings" onClick={onSettings} label="Settings (Escape)">⚙</Button></nav>
    {kiwiHint && <aside className="tt-kiwi-bubble tt-paper"><Portrait id="kiwi" size={58} /><p>{kiwiHint}</p><Button id="kiwi-hint-next" onClick={onHint} label="Another Kiwi hint">➜</Button></aside>}
  </div>;
}

export interface BackpackBarProps {
  inventory: Inventory; compact?: boolean; onOpen: () => void; onInspect?: (item: ItemId) => void; onSlotRects?: (rects: SlotRects) => void; measureKey?: number;
}
export function BackpackBar({ inventory, compact = false, onOpen, onInspect, onSlotRects, measureKey }: BackpackBarProps) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!onSlotRects || !root.current) return;
    const node = root.current;
    const measure = () => {
      const rects = {} as SlotRects;
      for (const item of ITEM_IDS) {
        const slot = node.querySelector<HTMLElement>(`[data-slot="${item}"]`);
        if (slot) rects[item] = slot.getBoundingClientRect();
      }
      onSlotRects(rects);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [compact, onSlotRects, measureKey]);
  return <div ref={root} className={`tt-backpack-bar ${compact ? "tt-compact" : ""}`} data-testid="backpack-bar" aria-label="Your backpack">
    <Button id="backpack-open" onClick={onOpen} label="Open backpack (B)" className="tt-bag-button">🎒<span>B</span></Button>
    {ITEM_IDS.map(item => { const n = inventory[item] ?? 0; return <button type="button" key={item} data-slot={item} data-testid={`backpack-slot-${item}`} className={`tt-bag-slot ${n ? "tt-owned" : "tt-empty"}`} onClick={() => onInspect ? onInspect(item) : onOpen()} aria-label={`${ITEMS[item].en}: ${n}`}>
      {n ? <ItemIcon id={item} size={compact ? 34 : 46} /> : <ItemSilhouette id={item} size={compact ? 30 : 42} />}{n > 1 && <span className="tt-count">{n}</span>}
    </button>; })}
  </div>;
}

function RotatingItem({ item }: { item: ItemId }) {
  const root = useRef<Group>(null);
  const mesh = useMemo(() => buildItem(item), [item]);
  const scale = 0.6 / Math.max(itemSize(item).x, itemSize(item).y, itemSize(item).z);
  useFrame((_, delta) => { if (root.current) root.current.rotation.y += delta * 0.5; });
  // Art-kit geometry and materials are cached and shared with the world.
  // Disposing this presentation mesh would invalidate those shared resources.
  // The inner diagonal tilt keeps long items (pen, pencil) from spinning end-on.
  return <group ref={root} rotation={[0.2, 0, 0]}><group rotation={[0.35, 0, 0.6]} scale={scale}><primitive object={mesh} position={mesh.geometry.boundingBox!.getCenter(new Vector3()).negate()} dispose={null} /></group></group>;
}

function ItemInspect({ item }: { item: ItemId }) {
  const [webgl] = useState(() => {
    try { const canvas = document.createElement("canvas"); const gl = canvas.getContext("webgl2"); if (!gl) return false; gl.getExtension("WEBGL_lose_context")?.loseContext(); return true; } catch { return false; }
  });
  return <div className="tt-inspect-model" data-testid="item-inspect-model" aria-label={`Rotating ${ITEMS[item].en}`}>
    {webgl ? <Canvas camera={{ position: [0, 0, 1.2], fov: 36 }} dpr={1}><ambientLight intensity={1.4} /><directionalLight position={[-2, 3, 4]} intensity={2} /><RotatingItem item={item} /></Canvas> : <ItemIcon id={item} size={160} />}
  </div>;
}

export interface BackpackPanelProps {
  inventory: Inventory; japanese?: boolean; inspect?: ItemId; bagCheck?: ItemId;
  onInspect: (item: ItemId) => void; onSpeak: (text: string) => void; onClose: () => void;
}
export function BackpackPanel({ inventory, japanese = true, inspect, bagCheck, onInspect, onSpeak, onClose }: BackpackPanelProps) {
  return <Modal id="backpack-panel" title={bagCheck ? "Let's check your bag!" : "My backpack"} subtitle={japanese ? "かばんの中を見てみよう" : undefined} onClose={onClose} className={inspect ? "tt-backpack-with-inspect" : ""}>
    <div className="tt-backpack-body"><div className="tt-item-grid">{ITEM_IDS.map(item => { const n = inventory[item] ?? 0; return <button type="button" key={item} data-testid={`backpack-card-${item}`} className={`tt-item-card ${n ? "tt-owned" : "tt-empty"} ${bagCheck === item ? "tt-spotlight" : bagCheck ? "tt-dimmed" : ""} ${inspect === item ? "tt-selected" : ""}`} onClick={() => { onInspect(item); onSpeak(withArticle(item)); }} aria-label={`Inspect ${withArticle(item)}, ${n} in your bag`}>
      {n ? <ItemIcon id={item} size={60} /> : <ItemSilhouette id={item} size={60} />}<strong>{ITEMS[item].en}</strong>{japanese && <span className="tt-ja">{ITEMS[item].ja}</span>}<span className="tt-inventory-count">{n ? `× ${n}` : "—"}</span>
    </button>; })}</div>
    {inspect && <aside className="tt-inspect"><span className="tt-eyebrow">TAKE A CLOSER LOOK</span><ItemInspect item={inspect} /><h2>{withArticle(inspect)}</h2>{japanese && <p className="tt-ja">{ITEMS[inspect].ja}</p>}<Button id="inspect-name-replay" onClick={() => onSpeak(withArticle(inspect))}>🔊 {withArticle(inspect)}</Button><Button id="inspect-question-replay" onClick={() => onSpeak(askSentence(inspect))}>🔊 {askSentence(inspect)}</Button></aside>}
    </div>{bagCheck && <p className="tt-bag-check-status" role="status">{(inventory[bagCheck] ?? 0) > 0 ? "✓ Yes, I do." : "✗ No, I don't."}{japanese && <span className="tt-ja">{(inventory[bagCheck] ?? 0) > 0 ? "かばんに入っているね！" : "かばんには入っていないね。"}</span>}</p>}
  </Modal>;
}

export interface DialoguePanelProps {
  beat: SayBeat; japanese?: boolean; speaking?: boolean; onReplay: () => void; onContinue?: () => void; children?: ReactNode;
}
export function DialoguePanel({ beat, japanese = true, speaking = false, onReplay, onContinue, children }: DialoguePanelProps) {
  const name = beat.speaker === "seaChest" ? "Sea chest" : speakerName(beat.speaker).en;
  return <section className="tt-dialogue tt-paper" data-testid="dialogue-panel" aria-label={`${name} speaking`} data-mood={beat.mood ?? "neutral"}>
    <div className="tt-dialogue-row"><div className="tt-dialogue-portrait"><Portrait id={beat.speaker} mood={beat.mood} size={100} /><strong>{name}</strong></div><div className="tt-dialogue-lines" aria-live="polite">{!beat.jaOnly && <p className="tt-dialogue-en">{beat.en}</p>}{(japanese || beat.jaOnly) && <p className="tt-ja">{beat.ja}</p>}{beat.showItem && <span className="tt-shown-item"><ItemIcon id={beat.showItem} size={40} />{withArticle(beat.showItem)}</span>}</div><div className="tt-dialogue-buttons">{!beat.jaOnly && <Button id="dialogue-replay" onClick={onReplay} label={speaking ? "Replay spoken line" : "Hear again"}>🔊</Button>}{onContinue && <Button id="dialogue-continue" primary onClick={onContinue} label="Continue dialogue">➜</Button>}</div></div>{children}
  </section>;
}

export interface JournalPanelProps {
  state: GameState; tab: JournalTab; japanese?: boolean; onTab: (tab: JournalTab) => void; onSpeak: (text: string) => void; onClose: () => void;
}
const JOURNAL_TABS: { id: JournalTab; en: string; ja: string; icon: string }[] = [
  { id: "Festival", en: "Festival", ja: "おまつり", icon: "✦" }, { id: "People", en: "People", ja: "町の人", icon: "☻" }, { id: "Words", en: "Words", ja: "ことば", icon: "Aa" }, { id: "Stickers", en: "Stickers", ja: "シール", icon: "★" }
];
export function JournalPanel({ state, tab, japanese = true, onTab, onSpeak, onClose }: JournalPanelProps) {
  const chest = state.holdings.chest ?? {};
  return <Modal id="journal" title="My journal" subtitle={japanese ? "ぼうけんのきろく" : undefined} onClose={onClose} className="tt-journal">
    <div className="tt-journal-tabs" role="tablist" aria-label="Journal pages">{JOURNAL_TABS.map(t => <button type="button" role="tab" aria-selected={tab === t.id} aria-controls={`journal-page-${t.id}`} key={t.id} data-testid={`journal-tab-${t.id}`} className={tab === t.id ? "tt-active" : ""} onClick={() => onTab(t.id)}><span aria-hidden="true">{t.icon}</span> {t.en}{japanese && <span className="tt-ja">{t.ja}</span>}</button>)}</div>
    <div role="tabpanel" id={`journal-page-${tab}`} className="tt-journal-page">
      {tab === "Festival" && <><div className="tt-section-intro"><div><span className="tt-eyebrow">THE FESTIVAL TREASURE CHEST</span><h2>Every little treasure helps.</h2>{japanese && <p className="tt-ja">みんなの文ぼう具をあつめて、おまつりをひらこう！</p>}</div><strong className="tt-big-counter">{ITEM_IDS.filter(i => (chest[i] ?? 0) > 0).length}<span> / 9</span></strong></div><div className="tt-festival-grid">{ITEM_IDS.map(item => <div className={`tt-festival-slot ${(chest[item] ?? 0) ? "tt-filled" : ""}`} key={item}>{chest[item] ? <ItemIcon id={item} size={68} /> : <ItemSilhouette id={item} size={68} />}<strong>{ITEMS[item].en}</strong><span>{chest[item] ? "✓" : "·"}</span></div>)}</div></>}
      {tab === "People" && <>{state.journal.met.length === 0 && <p>Say hello to someone! {japanese && <span className="tt-ja">町の人に話しかけてみよう。</span>}</p>}<div className="tt-people-grid">{state.journal.met.map(npc => <article className="tt-person-card" key={npc}><header><Portrait id={npc} size={68} /><div><h2>{CAST[npc].name} {state.memory[npc]?.helped && <span className="tt-helped" aria-label="Helped">♥</span>}</h2><p className="tt-ja">{DISTRICT_NAMES[CAST[npc].district][japanese ? "ja" : "en"]}</p></div></header><div className="tt-facts">{ITEM_IDS.filter(item => state.journal.facts[npc]?.[item] !== undefined).map(item => <span className={`tt-fact ${state.journal.facts[npc]?.[item] ? "tt-fact-yes" : "tt-fact-no"}`} key={item} aria-label={`${CAST[npc].name} ${state.journal.facts[npc]?.[item] ? "has" : "does not have"} ${withArticle(item)}`}><b>{state.journal.facts[npc]?.[item] ? "✓" : "✗"}</b><ItemIcon id={item} size={36} /><span>{ITEMS[item].en}</span></span>)}</div>{state.journal.wants[npc] && <div className="tt-thought">💭 Wants <ItemIcon id={state.journal.wants[npc]} size={32} /><strong>{ITEMS[state.journal.wants[npc]].en}</strong></div>}{state.journal.needs[npc] && <div className="tt-thought">💭 Needs <ItemIcon id={state.journal.needs[npc]} size={32} /><strong>{ITEMS[state.journal.needs[npc]].en}</strong></div>}</article>)}</div></>}
      {tab === "Words" && <><div className="tt-word-sentences">{[askSentence("pen"), YES_SENTENCE, NO_SENTENCE].map((line, i) => <Button key={line} id={`journal-sentence-${i}`} onClick={() => onSpeak(line)}><span>🔊 {line}{japanese && <span className="tt-ja">{["ペンを持っている？", "うん、持っているよ。", "ううん、持っていないよ。"][i]}</span>}</span></Button>)}</div><div className="tt-word-grid">{ITEM_IDS.map(item => <button type="button" data-testid={`journal-word-${item}`} className="tt-word" key={item} onClick={() => onSpeak(withArticle(item))}><ItemIcon id={item} size={50} /><span><strong>{withArticle(item)}</strong>{japanese && <span className="tt-ja">{ITEMS[item].ja}</span>}</span><span aria-hidden="true">🔊</span></button>)}</div></>}
      {tab === "Stickers" && <><div className="tt-section-intro"><div><span className="tt-eyebrow">LITTLE THANK-YOUS</span><h2>My festival stickers</h2>{japanese && <p className="tt-ja">町の人のしつもんにこたえて、あつめよう。</p>}</div><strong className="tt-big-counter">{state.stickers.length}<span> / {STICKER_IDS.length}</span></strong></div><div className="tt-sticker-grid">{STICKER_IDS.map(id => <div key={id} className={`tt-sticker ${state.stickers.includes(id) ? "tt-sticker-owned" : ""}`}><StickerIcon id={id} size={80} owned={state.stickers.includes(id)} /><strong>{state.stickers.includes(id) ? STICKERS[id].en : "?"}</strong>{japanese && <span className="tt-ja">{state.stickers.includes(id) ? STICKERS[id].ja : "まだひみつ"}</span>}</div>)}</div></>}
    </div>
  </Modal>;
}

export interface SettingsPanelProps {
  settings: Settings; onChange: (settings: Settings) => void; onMicCheck: () => void; micStatus?: string; onReset: () => void; onClose: () => void;
}
export function SettingsPanel({ settings, onChange, onMicCheck, micStatus, onReset, onClose }: SettingsPanelProps) {
  const [confirm, setConfirm] = useState(false);
  return <><Modal id="settings" title="Settings" subtitle="せってい" onClose={onClose} className="tt-settings"><div className="tt-settings-grid"><section><h2>Sound <span className="tt-ja">音</span></h2>{([ ["music", "Music", "音楽"], ["effects", "Effects", "こうか音"], ["voice", "Voice", "声"] ] as const).map(([key, name, ja]) => <label className="tt-volume" key={key}><span>{name} <span className="tt-ja">{ja}</span></span><input data-testid={`settings-${key}`} type="range" min="0" max="1" step="0.05" value={settings[key]} onChange={e => onChange({ ...settings, [key]: Number(e.target.value) })} /><output>{Math.round(settings[key] * 100)}%</output></label>)}<label className="tt-select-label">Voice speed <span className="tt-ja">話すはやさ</span><select data-testid="settings-voice-speed" value={settings.voiceSpeed} onChange={e => onChange({ ...settings, voiceSpeed: e.target.value as Settings["voiceSpeed"] })}><option value="normal">Normal / ふつう</option><option value="slow">Slow / ゆっくり</option></select></label></section><section><h2>Play <span className="tt-ja">あそび方</span></h2><label className="tt-toggle"><input data-testid="settings-japanese" type="checkbox" checked={settings.japanese} onChange={e => onChange({ ...settings, japanese: e.target.checked })} /><span>Japanese support<span className="tt-ja">日本語のヒント</span></span></label><label className="tt-toggle"><input data-testid="settings-mic-free" type="checkbox" checked={settings.micFree} onChange={e => onChange({ ...settings, micFree: e.target.checked })} /><span>Mic-free mode<span className="tt-ja">マイクなしモード（先生用）</span></span></label><Button id="settings-mic-check" onClick={onMicCheck}>🎤 Mic check / マイクテスト</Button><p className="tt-mic-status" role="status">{micStatus ?? "Tap to check your microphone."}</p></section></div><footer className="tt-settings-footer"><p className="tt-ja">ぼうけんは自動でほぞんされるよ。</p><Button id="settings-reset" className="tt-danger" onClick={() => setConfirm(true)}>Reset save / データを消す</Button></footer></Modal>{confirm && <Confirm id="reset-save" title="Reset your adventure?" ja="ぼうけんのデータを消す？ もとにはもどせないよ。" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onReset(); }} />}</>;
}

export interface ChapterSelectProps { current: ChapterId; completed: ChapterId[]; onSelect: (chapter: ChapterId) => void; onClose: () => void; japanese?: boolean }
export function ChapterSelect({ current, completed, onSelect, onClose, japanese = true }: ChapterSelectProps) {
  return <Modal id="chapter-select" title="Choose an adventure" subtitle={japanese ? "チャプターをえらぼう" : undefined} onClose={onClose}><div className="tt-chapters">{CHAPTER_IDS.map(id => { const done = completed.includes(id); const locked = id > current && !done; const info = CHAPTERS[id]; return <button type="button" data-testid={`chapter-${id}`} key={id} className={`tt-chapter ${done ? "tt-cleared" : ""} ${current === id ? "tt-current" : ""}`} disabled={locked} onClick={() => onSelect(id)}><span className="tt-chapter-number">{locked ? "🔒" : id}</span><span className="tt-eyebrow">{locked ? "LOCKED" : done ? "✓ CLEARED" : "CURRENT ADVENTURE"}</span><h2>{info.title.en}</h2>{japanese && <p className="tt-ja">{info.title.ja}</p>}<div className="tt-chapter-items">{info.targets.map(item => <ItemIcon id={item} key={item} size={42} />)}</div><span className="tt-chapter-link">{locked ? "Keep exploring!" : done ? "Play again — new puzzle!" : "Continue ➜"}</span></button>; })}</div></Modal>;
}

export interface CardProps {
  kind: "mission" | "chapter-clear" | "new-area" | "notice"; title: string; ja?: string; items?: ItemId[]; chestCount?: number; onContinue: () => void;
}
export function Card({ kind, title, ja, items = [], chestCount, onContinue }: CardProps) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, onContinue);
  const label = { mission: "A LITTLE ADVENTURE", "chapter-clear": "CHAPTER COMPLETE!", "new-area": "SOMEWHERE NEW", notice: "A NOTE FOR YOU" }[kind];
  return <div className="tt-shade"><section ref={ref} tabIndex={-1} className={`tt-card tt-paper tt-bunting tt-card-${kind}`} data-testid={`card-${kind}`} role="dialog" aria-modal="true" aria-label={title}><span className="tt-card-symbol" aria-hidden="true">{kind === "chapter-clear" ? "✦" : kind === "new-area" ? "➜" : kind === "mission" ? "⚑" : "☀"}</span><span className="tt-eyebrow">{label}</span><h1>{title}</h1>{ja && <p className="tt-ja">{ja}</p>}{items.length > 0 && <div className="tt-card-items">{items.map(item => <div key={item}><ItemIcon id={item} size={76} /><strong>{ITEMS[item].en}</strong></div>)}</div>}{chestCount !== undefined && <div className="tt-chest-progress"><span>Festival Treasure Chest</span><div className="tt-progress-track"><span style={{ width: `${Math.min(9, Math.max(0, chestCount)) / 9 * 100}%` }} /></div><strong>{chestCount} / 9</strong></div>}<Button id={`card-${kind}-continue`} primary onClick={onContinue}>Let's go! / つづける ➜</Button></section></div>;
}

export interface ResultsScreenProps { state: GameState; onReplay: () => void; onTitle: () => void; onExplore: () => void }
export function ResultsScreen({ state, onReplay, onTitle, onExplore }: ResultsScreenProps) {
  return <div className="tt-results" data-testid="results-screen"><div className="tt-confetti" aria-hidden="true">{Array.from({ length: 30 }, (_, i) => <i key={i} style={{ left: `${(i * 37 + 3) % 100}%`, top: `${(i * 23 + 3) % 100}%`, transform: `rotate(${i * 37}deg)`, background: ["#e5484d", "#ffcf3f", "#3daa6b", "#6cc4f0"][i % 4] }} />)}</div><section className="tt-results-card tt-paper tt-bunting"><span className="tt-eyebrow">THE FESTIVAL IS HERE!</span><h1>Thank you,<br /><span>Treasure Trader!</span></h1><p className="tt-ja">きみのことばで、みんながえがおになったよ。</p><div className="tt-results-items">{ITEM_IDS.map(item => <ItemIcon key={item} id={item} size={52} />)}</div><div className="tt-results-stats"><div><strong>{state.stats.helped}</strong><span>friends helped</span><span className="tt-ja">たすけた人</span></div><div><strong>{state.stats.questionsAsked}</strong><span>questions asked</span><span className="tt-ja">しつもんした数</span></div><div><strong>{state.stats.answersGiven}</strong><span>answers given</span><span className="tt-ja">こたえた数</span></div><div><strong>{state.stickers.length}<small>/{STICKER_IDS.length}</small></strong><span>stickers collected</span><span className="tt-ja">あつめたシール</span></div></div><div className="tt-actions"><Button id="results-replay" primary onClick={onReplay}>Play again</Button><Button id="results-explore" onClick={onExplore}>Keep exploring</Button><Button id="results-title" onClick={onTitle}>Title</Button></div></section></div>;
}

export type FirstTimeTipId = "moving" | "mic" | "asking" | "backpack" | "journal";
export interface FirstTimeTipProps { tip: FirstTimeTipId; onDismiss: () => void }
const TIPS: Record<FirstTimeTipId, { title: string; text: string; key: string }> = {
  moving: { title: "町をあるいてみよう！", text: "地面をタップすると、そこまであるくよ。やじるしキーでもうごけるよ。人をタップして話しかけよう。", key: "↑ ← ↓ →" },
  mic: { title: "きみの声をとどけよう！", text: "マイクを１回タップして、英語で話そう。おしつづけなくていいよ。話し終わったら、少しまってね。", key: "🎤 Space" },
  asking: { title: "何を持っているかな？", text: "「Do you have a ___?」と、文をぜんぶ言ってみよう。絵を見ながら、聞きたいものをえらんでね。", key: "Do you have a ___?" },
  backpack: { title: "かばんを見てみよう！", text: "手に入れた文ぼう具は、下のかばんに入るよ。かばんをひらいて、ことばを聞いてみよう。", key: "🎒 B" },
  journal: { title: "聞いたことは、ここにあるよ！", text: "だれが何を持っているか、手ちょうにのこるよ。こまったときは、見てみよう。", key: "📖 J" }
};
export function FirstTimeTip({ tip, onDismiss }: FirstTimeTipProps) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, onDismiss);
  const content = TIPS[tip];
  return <aside ref={ref} tabIndex={-1} className="tt-first-tip tt-paper" data-testid={`tip-${tip}`} role="dialog" aria-modal="true" aria-label={content.title}><Portrait id="kiwi" size={66} /><div><span className="tt-eyebrow">KIWI'S TIP</span><h2>{content.title}</h2><p>{content.text}</p><span className="tt-tip-key">{content.key}</span></div><Button id={`tip-${tip}-dismiss`} primary onClick={onDismiss}>わかった！</Button></aside>;
}
