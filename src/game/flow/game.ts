import { audio } from '../../audio/audio';
import { createUI, type UIAPI, type UIOptions } from '../../ui';
import { createGameStubs } from '../../dev/gameHook';
import { DISTRICT_IDS, NPC_IDS, type ChapterId, type DistrictId } from '../content/ids';
import { L } from '../content/lines';
import { answer, ask, collect, inspect, leave, newCampaign, nextChapter, objectives, playerHolds, randomSeed, replayChapter, type Step, type Prompt } from '../logic';
import { intentsFor, remainingPlan, type Intent } from '../logic/plan';
import { createWorld, worldStateFromGame, DISTRICTS } from '../world';
import type { Interaction } from '../world/types';
import { createGameStore } from '../store';
import { createPresenter } from './presentation';

export function createGame() {
  const store = createGameStore();
  const params = new URLSearchParams(location.search);
  const stubs = params.get('e2e') === '1' ? createGameStubs() : undefined;
  const world = createWorld(worldStateFromGame(store.getState().campaign ?? newCampaign(1)));
  let epoch = 0, disposed = false, active: Interaction | null = null;
  let progressAt = Date.now(), hintOffered = false, autoUme = false;
  let district: DistrictId | undefined;
  let introAbort: AbortController | null = null;
  let endingPresented = false;
  const state = () => store.getState();
  const ui: UIAPI = createUI({
    settings: state().settings,
    voice: stubs?.voice,
    onSettingsChange: settings => state().configure(settings),
    onBottomPanel: pixels => world.setBottomPanel(pixels),
    onAction: (action, chapter) => { void menu(action, chapter); },
    speech: {
      recognizerFactory: stubs?.recognizerFactory,
      modelAnswer: prompt => playerHolds(state().game!, prompt.item) >= prompt.count ? 'yes' : 'no',
      onKiwiModel: () => { world.setKiwi('perch'); }
    }
  });
  const presenter = createPresenter(world, ui);
  if (state().campaign) ui.setGame(state().campaign!);
  ui.screen('title');
  if (state().loadNotice) ui.notice(state().loadNotice);

  function sync() {
    const game = state().game;
    if (!game) return;
    const snapshot = worldStateFromGame(game);
    const elapsed = Date.now() - progressAt;
    if (game.chapter > 1 && state().hintLevel < 3 && elapsed < 60_000) {
      for (const npc of Object.values(snapshot.npcs)) if (npc?.indicator === 'star') npc.indicator = null;
    }
    if (state().hintLevel < 1) for (const npc of Object.values(snapshot.npcs)) if (npc?.indicator === '?') npc.indicator = null;
    world.setState(snapshot);
    if (game.finished && endingPresented) presenter.gather();
    for (const id of NPC_IDS) if (game.memory[id]?.helped || game.memory[id]?.traded) world.gesture(id, 'cheer');
    ui.setGame(game, objectives(game)[0] ?? null);
  }
  function lock() {
    const p = ui.getSnapshot();
    world.setInputLocked(state().phase !== 'playing' || state().busy || !!active || !!p.screen || !!p.card || !!p.tip);
    if (active && !p.screen && state().phase === 'playing') {
      const target = world.positionOf(active);
      if (target) world.setCamera({ mode: 'conversation', target });
    }
  }
  function save() { state().persist(world.runtime.player); }
  function cancelTalk() {
    epoch++; active = null; ui.cancel();
    if (state().game) state().setGame(leave(state().game!));
    state().setBusy(false); world.setCamera({ mode: 'follow' }); world.setKiwi('follow');
    if (state().phase === 'playing') { save(); sync(); }
    lock();
  }
  async function tip(id: 'moving' | 'mic' | 'asking') {
    if (state().settings.seenTips.includes(id)) return;
    ui.tip(id);
    await new Promise<void>(resolve => {
      const off = ui.subscribe(() => { if (!ui.getSnapshot().tip || disposed) { off(); resolve(); } });
    });
  }
  async function chapterIntro() {
    const game = state().game!;
    state().setBusy(true);
    state().setPhase('cutscene'); lock();
    introAbort = new AbortController();
    await presenter.intro(game.chapter, introAbort.signal);
    introAbort = null;
    if (disposed) return;
    if (game.chapter === 1 && !state().settings.seenTips.includes('intro')) ui.configure({ ...state().settings, seenTips: [...state().settings.seenTips, 'intro'] });
    state().setPhase('playing'); state().setBusy(false); save(); sync(); lock();
    if (game.chapter === 1) await tip('moving');
  }
  async function finishChapter() {
    active = null;
    const game = state().game!;
    state().setPhase('cutscene'); lock();
    if (game.chapter === 5) { await presenter.finale(); endingPresented = true; if (game.mode === 'replay') await presenter.clear(5, true); }
    else await presenter.clear(game.chapter, game.mode === 'replay');
    if (disposed) return;
    state().setPhase('playing'); save();
    if (game.mode === 'replay') {
      state().setGame(state().campaign); state().setPhase('title');
      if (state().campaign) ui.setGame(state().campaign!);
      ui.screen('chapters');
    } else if (game.chapter === 5) {
      state().setPhase('results'); ui.screen('results');
    } else {
      const next = nextChapter(state().game!);
      if (next) { state().setGame(next); progressAt = Date.now(); sync(); await chapterIntro(); }
    }
    state().setBusy(false); lock();
  }
  async function run(first: Step) {
    const token = ++epoch;
    const alive = () => token === epoch && !disposed;
    let step = first;
    state().setBusy(true); lock();
    while (alive()) {
      const old = state().game;
      state().setGame(step.state);
      if (!old || JSON.stringify([old.holdings, old.flags, old.journal]) !== JSON.stringify([step.state.holdings, step.state.flags, step.state.journal])) {
        progressAt = Date.now(); hintOffered = false; state().setHintLevel(0); ui.hint(undefined);
      }
      sync(); lock();
      await presenter.beats(step, alive);
      if (!alive()) return;
      // Persist the atomic step only after its complete presentation, before input.
      if (!step.state.chapterComplete) save();
      if (step.state.chapterComplete && !old?.chapterComplete) { await finishChapter(); return; }
      if (!step.prompt) break;
      if (step.prompt.kind === 'answer') await tip('mic');
      else await tip('asking');
      if (!alive()) return;
      const input = await ui.prompt(step.prompt);
      if (!alive()) return;
      if (input.kind === 'cancelled') break;
      const game = state().game!;
      step = input.kind === 'ask' ? ask(game, step.prompt.target, input.item)
        : step.prompt.kind === 'answer' ? answer(game, step.prompt.target, step.prompt.questionId, input.answer)
        : { state: game, beats: [], prompt: null };
    }
    if (alive()) cancelTalk();
  }
  function interact(target: Interaction) {
    if (state().phase !== 'playing' || state().busy || ui.getSnapshot().screen || ui.getSnapshot().tip || !state().game) return;
    active = target;
    const game = state().game!;
    const step = target.kind === 'spot'
      ? (game.instance.spots.find(s => s.id === target.id)?.kind === 'distractor' ? inspect(game, target.id) : collect(game, target.id))
      : talkStep(game, target.kind === 'npc' ? target.id : 'seaChest');
    void run(step).catch(fail);
  }
  function fail(error: unknown) {
    console.error(error); cancelTalk(); ui.notice('Please try again. もう一度ためしてね。');
  }
  function hint() {
    const objective = state().game && objectives(state().game!)[0];
    if (!objective) return;
    const level = Math.min(3, state().hintLevel + 1); state().setHintLevel(level);
    ui.hint(level === 1 ? objective.hint1 : objective.hint2);
    const target = objective.hint3;
    if (level === 3 && target) {
      const at = target.kind === 'area' ? { ...DISTRICTS[target.id], y: 1 } : world.positionOf(target);
      if (at) world.setKiwi('hint', at);
    }
    sync(); lock();
  }
  async function menu(action: Parameters<NonNullable<UIOptions['onAction']>>[0], chapter?: ChapterId) {
    audio.unlock();
    if (action === 'hint') { hint(); return; }
    if (action === 'explore') { ui.screen(null); state().setPhase('playing'); world.setCamera({ mode: 'follow' }); lock(); return; }
    if (action === 'chapters' || action === 'replay') { ui.screen('chapters'); return; }
    cancelTalk();
    if (action === 'reset') { state().reset(); ui.screen('title'); ui.notice('Your adventure was reset. はじめからあそべるよ。'); lock(); return; }
    if (action === 'title') { state().setPhase('title'); if (state().campaign) ui.setGame(state().campaign!); ui.screen('title'); lock(); return; }
    if (action === 'chapter') {
      const campaign = state().campaign;
      if (!chapter || !campaign || (!campaign.completedChapters.includes(chapter) && chapter !== campaign.chapter)) return;
      if (!campaign.completedChapters.includes(chapter)) { await menu('continue'); return; }
      let seed = randomSeed(); if (seed === campaign.instance.seed) seed = (seed + 1) % 1_000_000;
      state().setGame(replayChapter(chapter, seed));
    } else if (action === 'continue') {
      const game = state().load();
      if (!game) { ui.notice(state().loadNotice); return; }
      world.setState(worldStateFromGame(game));
      const loaded = state().load(undefined, world.relocate);
      if (!loaded) return;
    } else if (action === 'new-game') {
      const requested = params.get('seed');
      state().setGame(newCampaign(requested !== null && Number.isFinite(Number(requested)) ? Number(requested) : randomSeed()));
    } else return;
    endingPresented = action === 'continue' && !!state().game?.finished;
    ui.screen(null); state().setPhase('playing'); progressAt = Date.now(); autoUme = false; sync();
    const game = state().game!;
    world.teleport(game.position ?? { x: 0, z: 8, yaw: Math.PI });
    if (action === 'continue') {
      if (game.finished) { world.teleport(game.position ?? { x: -48, z: 4 }); world.setKiwi('perch'); }
      else if (game.chapterComplete) { await finishChapter(); return; }
      else if (game.question) {
        const q = game.question, line = q.kind === 'libraryReturn' ? L.askMyNotebooks : L.ask(q.item);
        const prompt: Prompt = { kind: 'answer', target: q.target, item: q.item, count: q.count, questionId: q.id, questionEn: line.en, questionJa: line.ja };
        active = q.target === 'seaChest' ? { kind: 'seaChest' } : { kind: 'npc', id: q.target };
        void run({ state: game, beats: [], prompt }).catch(fail);
      }
      lock();
    } else await chapterIntro();
  }
  function tick() {
    const game = state().game;
    if (!game || state().phase !== 'playing') return;
    const p = world.runtime.player;
    const current = DISTRICT_IDS.reduce((best, id) => Math.hypot(p.x - DISTRICTS[id].x, p.z - DISTRICTS[id].z) < Math.hypot(p.x - DISTRICTS[best].x, p.z - DISTRICTS[best].z) ? id : best, 'square');
    if (current !== district) { district = current; ui.setDistrict(current); }
    if (active) {
      const at = world.positionOf(active);
      if (at && Math.hypot(p.x - at.x, p.z - at.z) > 4.2) cancelTalk();
    }
    if (!state().busy && !ui.getSnapshot().screen && !game.finished) {
      const elapsed = Date.now() - progressAt;
      if (elapsed > 45_000 && !hintOffered) { hintOffered = true; ui.hint('こまったら H か キウイをおしてね！'); }
      if (elapsed > 60_000 && state().hintLevel < 3) { state().setHintLevel(3); sync(); lock(); }
      const ume = world.positionOf({ kind: 'npc', id: 'ume' });
      if (!autoUme && game.chapter === 1 && game.holdings.chest?.pencil && !game.flags['gave:ume'] && ume && Math.hypot(p.x - ume.x, p.z - ume.z) < 5) {
        autoUme = true; world.walkTo(ume, { kind: 'npc', id: 'ume' });
      }
    }
  }
  const offUI = ui.subscribe(lock), offStore = store.subscribe(lock), offInteract = world.onInteract(interact);
  const offArrive = world.onArrive(() => { if (!state().busy) save(); });
  const timer = window.setInterval(tick, 250);
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && active && state().phase === 'playing' && !ui.getSnapshot().screen) { event.preventDefault(); event.stopImmediatePropagation(); cancelTalk(); }
    if (event.code === 'Enter' || event.code === 'Space') audio.unlock();
  };
  window.addEventListener('keydown', key, true);
  lock();
  return {
    store, ui, world, stubs,
    intents(): Intent[] { const game = state().game; if (!game || game.chapterComplete) return []; const first = remainingPlan(game)[0]; return first ? intentsFor(game, first) : []; },
    intent(intent: Intent) {
      if (state().busy || state().phase !== 'playing') return false;
      const target: Interaction = intent.kind === 'collect' ? { kind: 'spot', id: intent.spot } : intent.target === 'seaChest' ? { kind: 'seaChest' } : { kind: 'npc', id: intent.target };
      const at = world.positionOf(target);
      return at ? world.walkTo(at, target) : false;
    },
    skipIntro() { if (introAbort && state().settings.seenTips.includes('intro')) { introAbort.abort(); ui.cancel(); } },
    get canSkipIntro() { return !!introAbort && state().settings.seenTips.includes('intro'); },
    dispose() { disposed = true; epoch++; introAbort?.abort(); clearInterval(timer); offUI(); offStore(); offInteract(); offArrive(); window.removeEventListener('keydown', key, true); ui.dispose(); audio.dispose(); }
  };
}

// Imported here to keep every rule transition visibly delegated to the model.
import { talk as talkStep } from '../logic';
export type Game = ReturnType<typeof createGame>;
