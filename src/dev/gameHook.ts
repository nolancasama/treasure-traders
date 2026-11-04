import type { UIOptions } from '../ui';
import type { RecognizerOptions } from '../audio/vendor';
import type { WorldAPI } from '../game/runtime';
import { navigationGates } from '../game/runtime';
import type { GateId, Interaction, Point } from '../game/world/types';
import { findPath, isWalkable } from '../game/world/collision';
import { ITEM_IDS } from '../game/content/ids';
import type { PerspectiveCamera, Scene } from 'three';

/** Installed on __tt only by the explicit e2e bridge, never normal play. */
export function createWorldControls(world: WorldAPI, scene: Scene, camera: PerspectiveCamera) {
  if (new URLSearchParams(location.search).get('e2e') !== '1') return {};
  return {
    teleport(position: Point & { yaw?: number }) { world.teleport(position); },
    setGate(id: GateId, open: boolean) { world.setState({ ...world.runtime.state, gates: { ...world.runtime.state.gates, [id]: open } }); },
    /** Rendering fixture only: campaign rules, inventory and saved progress never change. */
    previewChest(open: boolean) {
      if (world.runtime.state.chapter !== 5) return false;
      world.setState({ ...world.runtime.state, chestCount: open ? 9 : 8, chestItems: ITEM_IDS.slice(0, open ? 9 : 8) });
      world.setFinale(open ? 'open' : 'armed');
      return true;
    },
    readScenery() {
      const rt = world.runtime;
      return {
        walkable: isWalkable(rt.player.x, rt.player.z, navigationGates(rt)),
        finale: rt.finale, chestCount: rt.state.chestCount,
        lidAngle: scene.getObjectByName('festival-chest-lid')?.rotation.x ?? null,
        cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        // These are the last rendered rig samples, not a separate animation clock.
        painters: {
          ken: structuredClone(scene.getObjectByName('character:ken')?.userData.painter ?? null),
          leo: structuredClone(scene.getObjectByName('character:leo')?.userData.painter ?? null)
        }
      };
    },
    approachPath(target: Interaction) {
      const at = world.positionOf(target);
      return at ? structuredClone(findPath(world.runtime.player, at, navigationGates(world.runtime))) : [];
    },
    readGates() {
      return structuredClone({ progress: world.runtime.gateProgress, open: navigationGates(world.runtime), school: world.runtime.schoolGateMotion ?? null, schoolHeld: !!world.runtime.schoolGateHeld, camera: world.runtime.camera, cameraYaw: world.runtime.cameraYaw, manualInputYaw: world.runtime.manualInputYaw });
    }
  };
}

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
