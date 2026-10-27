import type { UIOptions } from '../ui';
import type { RecognizerOptions } from '../audio/vendor';

export type SpeechInjection = { kind: 'text'; text: string; interim?: boolean } | { kind: 'unavailable' | 'transient' | 'fallbackSuggested' };

/** Native-session shaped stubs, installed only in an explicit e2e session. */
export function createGameStubs() {
  let callbacks: RecognizerOptions | undefined;
  let listening = false;
  let speaking = false;
  let held = false;
  let finish: (() => void) | undefined;
  const listeners = new Set<(value: boolean) => void>();
  const publish = (value: boolean) => { speaking = value; listeners.forEach(fn => fn(value)); };
  const cancel = () => { finish?.(); finish = undefined; publish(false); };
  const voice: NonNullable<UIOptions['voice']> = {
    async speak() {
      cancel(); publish(true);
      if (held) await new Promise<void>(resolve => { finish = resolve; });
      else await Promise.resolve();
      finish = undefined; publish(false);
    },
    cancel, isSpeaking: () => speaking,
    onSpeakingChange(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    configure() {}
  };
  const recognizerFactory: NonNullable<NonNullable<UIOptions['speech']>['recognizerFactory']> = options => {
    callbacks = options;
    return {
      supported: true, get state() { return listening ? 'listening' : 'idle'; }, consecutiveEmptySessions: 0,
      start() { listening = true; options.onStart?.(); return true; },
      stop() { listening = false; }, cancel() { listening = false; }, destroy() { listening = false; callbacks = undefined; }
    };
  };
  return {
    voice, recognizerFactory,
    tts: { hold(value: boolean) { held = value; if (!value) cancel(); }, finish: cancel, isSpeaking: () => speaking },
    speech(event: SpeechInjection) {
      if (!listening || !callbacks) return false;
      if (event.kind === 'text') {
        const alternatives = [{ transcript: event.text, normalized: event.text.toLowerCase(), confidence: 1, final: !event.interim, index: 0 }];
        if (event.interim) callbacks.onInterim?.(alternatives);
        else { listening = false; callbacks.onEnd?.({ alternatives, final: true, reason: 'final' }); }
      } else {
        listening = false;
        callbacks.onError?.({ kind: event.kind === 'fallbackSuggested' ? 'silence' : event.kind, code: event.kind === 'unavailable' ? 'not-allowed' : 'network', message: event.kind, fallbackSuggested: event.kind === 'fallbackSuggested' });
      }
      return true;
    }
  };
}
