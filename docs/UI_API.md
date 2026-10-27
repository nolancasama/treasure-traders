# UI/audio API v1 — frozen 2026-10-27

This is the integration boundary for the UI/audio slice. Import `createUI`,
`UIHost` and their types from `src/ui`; audio commands from `src/audio/audio`.
The shape and semantics below are frozen. The model's `Beat`, `Prompt`,
`GameState`, `Objective`, `Settings`, `ChapterId`, `DistrictId` and `ItemId`
are used directly. `docs/WORLD_API.md` remains unchanged.

The host is a presentation layer. It never runs chapter scripts, changes
holdings, writes saves or creates `window.__tt`. Integration owns those tasks,
applies each core transition before presentation, and dispatches returned input
to `ask`/`answer`. Recognition never checks whether an answer is truthful.

## Mount and present

```tsx
const ui = createUI({
  settings,
  onSettingsChange: persistSettings,
  onBottomPanel: pixels => world.setBottomPanel(pixels),
  onAction: (action, chapter) => handleMenuAction(action, chapter),
  speech: {
    modelAnswer: prompt => playerHoldsEnough(prompt) ? 'yes' : 'no',
    onKiwiModel: async (sentence, prompt) => animateKiwiModel(sentence, prompt)
  }
});
// Render above the world. titleBackdrop is an optional caller-owned orbit view.
<UIHost ui={ui} hasSave={hasSave} titleBackdrop={titleBackdrop} />
ui.setGame(state, objectives(state)[0] ?? null);
await ui.say(sayBeat);
const result = await ui.prompt(corePrompt);
```

The example callbacks are supplied by integration; they are not additional API
exports. `modelAnswer` must read current real holdings/count. If omitted, Kiwi
models **both** yes/no sentences rather than guessing a truthful answer.
`onKiwiModel` is an animation hook: the speech controller separately speaks the
sentence in Kiwi's voice and keeps the mic closed until both finish.

`createUI(options?)` returns a frozen command object with these methods:

| Command | Semantics |
| --- | --- |
| `setGame(game, objective = null)` | Presents a read-only model reference; does not derive or apply rules. Pass an objective to show HUD chrome. |
| `say(beat): Promise<void>` | Takes only `Extract<Beat,{kind:'say'}>`. Shows portrait/mood/EN/JP and speaks EN; waits for initial TTS **and** Continue/Space/Enter. JP-only beats never speak Japanese. |
| `advance()` | Acknowledges the current line; does not cut off its initial TTS. |
| `replay(): Promise<void>` | Cancels previous playback, repeats the current line, leaves Continue pending. |
| `hear(text, speaker = 'player'): Promise<void>` | Vocabulary/question playback through the same TTS interlock. |
| `prompt(prompt): Promise<PromptResult>` | Takes `NonNullable<Prompt>`; cancels a line, resets per-prompt ladder, shows speech input. Mic-free/rescue choices are spoken in the player voice before resolving. |
| `screen(name, details?)` | `title`, `backpack`, `journal`, `settings`, `chapters`, `results`, or `null`. Opening closes capture without cancelling pending input. Same-screen details updates do not add navigation entries. `null` clears screen history and returns to HUD. |
| `back()` | Returns to previous screen, including returning from Settings/Chapters to Title. |
| `card(command): Promise<void>` | Shows a card and resolves when dismissed/replaced/cancelled. |
| `dismissCard()` | Acknowledges the current card. |
| `notice(messageOrNull)` | Independent dismissible status notice; does not erase mission/hint. |
| `hint(japaneseOrUndefined)` | Sets/clears the Kiwi JP bubble. Hint escalation remains integration's job. |
| `tip(idOrNull)`, `dismissTip()` | First-time JP guidance; dismissal adds id to `Settings.seenTips` and calls settings callback. |
| `configure(settings)` | Copies settings, updates TTS/audio/speech buses and calls `onSettingsChange`. Does not persist by itself. |
| `slotRects()` | Returns a fresh partial map `ItemId → DOMRectReadOnly`, in viewport CSS pixels, for world pickup/give/trade FX. |
| `setSlotRects(rects)` | BackpackBar measurement sink; copies the map. |
| `setBottomPanel(pixels)` | Measured bottom panel height, rounded/nonnegative; calls `onBottomPanel` only when changed. |
| `setDistrict(district)` | Delegates district music selection, safe before audio unlock. |
| `action(action, chapter?)` | Forwards a menu action to integration. |
| `cancel()` | Clears line/prompt/card; settles their promises (`cancelled` for input). |
| `dispose()` | Cancels pending work, disposes recognizer/coach/subscriptions, clears slot rects. |
| `getSnapshot()`, `subscribe(listener)` | Stable external-store snapshot and unsubscribe function. Treat snapshots and model references as read-only. |

Screen details are `{tab?, inspect?, bagCheck?}`. Journal tabs are
`Festival | People | Words | Stickers`; inspect/bagCheck are `ItemId`.
Tip ids are `moving | mic | asking | backpack | journal`.
Card commands are `{kind, title, ja?, items?, chestCount?}` with kind
`mission | chapter-clear | new-area | notice`. No timers or scores appear.
Actions are `new-game | continue | chapters | title | explore | replay |
reset | hint | chapter`, with optional `ChapterId`. New Game overwrite and
save reset confirmations happen before the callback. Integration performs
reset and can then call `notice` to confirm it succeeded.

Integration subscribes to presentation state to lock world movement during
screens/cards/tips/conversations and to restore conversation framing afterward.
This slice does not call world commands. `UIHost` observes its actual dialogue/
prompt height with ResizeObserver; `getSnapshot().bottomPanel` is also available.
Closing removes the shift (zero). The compact backpack dock remains visible
above the bottom panel. `BackpackBar` reports all nine fixed slot rects on
mount, compact-layout change, resize and scroll. Read rects after layout;
before mount/after disposal the map can be empty. Coordinates are not 3D units.

## Prompt results and controller

```ts
type PromptResult =
  | { kind: 'ask'; item: ItemId; source: 'speech' | 'choice' }
  | { kind: 'answer'; answer: 'yes' | 'no'; source: 'speech' | 'choice' }
  | { kind: 'cancelled' };
```

`ui.speech` is `createSpeechController(SpeechOptions)` from `src/audio/speech`.
Methods: `begin(prompt)` (`start` is the same function), `tap(): boolean`,
`pause()`, `choose(ItemId|'yes'|'no'): boolean`, `setMicFree(boolean)`,
`setCoachContainer(HTMLElement|null)`, `cancel()`, `dispose()`, `subscribe`,
`getSnapshot`. `begin` returns `Promise<PromptResult>` without player-choice
TTS; use `ui.prompt` for the complete presentation command. Replacing a prompt
resolves the previous one as cancelled. `pause` preserves its promise/ladder.
Leaving/replacing/disposal during the player-choice voice also resolves as
cancelled, so delayed playback cannot apply input after the conversation ended.

Snapshots expose `prompt`, `misses`, `choicesEnabled`, `micFree`, `listening`,
`startedAt` (Date.now milliseconds or null), `modelling`, `speaking`, `heard`,
`tip: {en,ja}|null`, `coach: {target,hint}|null`. Subscribe before reading
updates; React's useSyncExternalStore is supported.

One tap/Space starts an 8-second vendor session; a second tap closes it without
a miss. No press is queued during TTS/model/coach speech. TTS starting while
listening cancels capture synchronously; finishing never reopens the mic.
Interims use the frozen live judges. Final results use the frozen full judges,
including ranking, incomplete question and near-miss rules. All nine spoken
items are accepted even when only the chapter's cumulative cards are shown.
Keyboard 1–9 / 1–2 and clicks use the same controller choice gate.

- Miss 1: retry + JP tip (incomplete gets “Say the whole question!”).
- Miss 2: mic closed; Kiwi models the sentence; animation and TTS settle.
- Miss 3: cards enabled for this prompt; speech still available.
- Silence/unclear is one miss; vendor error/end pairs are not double counted.
- `unavailable`: session-only mic-free plus notice, persisting for controller
  lifetime. Teacher settings are not silently saved/changed.
- `transient`: manual retry on next press, no ladder increment.
- `fallbackSuggested`: cards unlock for the current prompt independently of
  miss count; changing teacher settings cannot accidentally relock them.

Item near-misses lazy-load the coach through `audio/vendor.ts` and pass
`toCoachAttempt` output to `createGameCoach`. The hint stays in the prompt
panel. Listen pauses capture and independently ducks background audio;
finishing requires a fresh mic press. Coach never changes the judge verdict.
Coach is off in mic-free mode, with `coachEnabled:false`, or `?coach=off`.

## Deterministic speech injection

There is no window hook in this slice. Integration can retain the callbacks
passed to `recognizerFactory`, then drive normalized onInterim/onEnd/onError
events using the public vendor types. Example:

```ts
let callbacks: RecognizerOptions;
const ui = createUI({
  voice: fakeVoice,
  speech: {
    recognizerFactory(options) {
      callbacks = options;
      return fakeRecognizer; // Recognizer from src/audio/vendor.ts
    },
    coachLoader: fakeCoachLoader
  }
});
```

`UIOptions.voice` implements `speak`, `cancel`, `isSpeaking`,
`onSpeakingChange`, `configure`; `speak(text,{speaker,pitch?,rate?})` returns a
Promise. Its speaking notification must be synchronous before audio starts.
`SpeechOptions.speech` can override only the controller's narrower speech port;
normally pass the shared fake through `voice` so all playback is interlocked.
The unit tests demonstrate unavailable, transient, fallback, silence, live
acceptance, pending Kiwi speech and late callbacks. A scripted stub should emit
callbacks only for its current native session, matching the vendor adapter.

## Audio

`audio` is the singleton `AudioEngine`. Call `unlock()` from a trusted user
gesture (UIHost does this on pointer presses; keyboard Start should also call
it). No AudioContext/network request is created before unlock.

| Command | Behaviour |
| --- | --- |
| `configure(settings)` | Music volume; effects controls effects **and ambience**. Voice is configured through `tts.configure`. |
| `setDistrict(DistrictId)` | Five retained looping arrangements, 1.5-second gain crossfade; safe before unlock. |
| `celebrate(on = true)` | Loops celebration; `false` restores retained district. |
| `play(SfxName)` | pickup, give, trade, correct, tryAgain, lockClick, chestOpen, fireworks, micOn, micOff, tap, footstep, journal. Call from integration event/FX handling. |
| `setListening(boolean)` | Exactly zero music/ambience gain during capture, including recognizer startup. Controller owns this lock. |
| `setSpeaking(boolean)` | TTS ducking lock (automatically subscribed on unlock). |
| `setExternalSpeaking(boolean)` | Independent coach speech ducking lock; overlaps safely with TTS. |
| `dispose()` | Stops scheduler/waves, closes context and releases subscriptions; integration calls this on final app teardown. |

Synthesized ambience includes birds, wordless market chatter, school bell,
waves and gulls. Scheduling suspends with document visibility. No audio files.
`tts.speak(text,{speaker?,pitch?,rate?})`, `tts.configure(settings)`,
`tts.setRate(scale)`, `tts.cancel()`, `tts.isSpeaking()`, `tts.available` and
`tts.onSpeakingChange(listener)` are public. Cast/player/Kiwi/chest presets use
one installed English voice; slow scales rate to .76. Missing voices leave
subtitles and bounded completion. Cancel settles all pending promises; a
watchdog cancels browser synthesis before releasing the microphone lock.

## Components and review evidence

Controlled components are exported from `src/ui`: TitleScreen, Hud,
BackpackBar, BackpackPanel, DialoguePanel, AskPrompt, AnswerPrompt,
PromptPanel, JournalPanel, SettingsPanel, ChapterSelect, Card, ResultsScreen,
FirstTimeTip. Item inspection uses the art-kit model in a small rotating R3F
canvas; its shared cached geometry stays owned by the art kit. WebGL failure
uses the existing item icon; portraits use the existing initial fallback.
Modal focus is trapped/restored; English stays at least 26px in dialogue,
Japanese/support at least 16px, and interactive targets at least 44px. Compact
slots use 44px targets rather than the draft's 40px sketch.

The gallery auto-registers through the existing import.meta.glob mechanism;
`src/dev/Gallery.tsx` needs no edit. `?gallery=ui&view=...` uses mocked core
state, a lightweight DOM landscape, and silent speech. Prompt previews are
explicit snapshots rather than a substitute game flow. `ask-coach` previews
the hint layout; actual lazy coach behaviour is unit-tested with injected ports.

Views: title, title-confirm, title-new, hud, backpack-bar, backpack-compact,
backpack, inspect, bag-check, dialogue, dialogue-happy, dialogue-ja-only,
ask-0, ask-1, ask-incomplete, ask-2, ask-3, ask-listening, ask-all, ask-coach,
answer, answer-3, answer-listening, mic-free, unavailable, transient, fallback,
journal-festival, journal-people, journal-words, journal-stickers, settings,
settings-reset, chapters, mission, chapter-clear, new-area, notice, results,
tip-moving, tip-mic, tip-asking, tip-backpack, tip-journal.

`npm run shots -- tests/shots/ui.spec.ts` captures these at 1366×768 in
`.tmp/shots/ui/`, plus 1280×800 and touch Ask layouts. `npm run shots` also
includes them with the existing art/world galleries. Headless snapshots do not
prove real microphone permission/recognition quality, installed English voice
quality, audible music balance, or physical Chromebook performance.
