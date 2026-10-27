import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Vector3 } from 'three';
import { useStore } from 'zustand';
import { World } from './scene/World';
import { UIHost } from './ui';
import { createGame, type Game } from './game/flow/game';
import type { Interaction } from './game/world/types';

function GameBridge({ game }: { game: Game }) {
  const { camera, gl, size } = useThree();
  useEffect(() => {
    if (!game.stubs) return;
    let renderer = { calls: 0, triangles: 0, dpr: 1 };
    const hook = {
      read() {
        const state = game.store.getState(), presentation = game.ui.getSnapshot();
        return structuredClone({
          game: state.game, chapter: state.game?.chapter ?? null, holdings: state.game?.holdings ?? null,
          objectives: presentation.objective ? [presentation.objective] : [], position: game.world.runtime.player,
          focus: game.world.runtime.focus, prompt: game.ui.speech.getSnapshot().prompt,
          speech: game.ui.speech.getSnapshot(), presentation,
          busy: state.busy, phase: state.phase, renderer, intents: game.intents(),
          navigation: { path: game.world.runtime.path, pending: game.world.runtime.pending, locked: game.world.runtime.locked }
        });
      },
      intent: game.intent,
      speech: game.stubs.speech,
      tts: game.stubs.tts,
      project(target: Interaction) {
        const at = game.world.positionOf(target);
        if (!at) return null;
        const p = new Vector3(at.x, at.y + (target.kind === 'npc' ? 1.1 : 0.1), at.z).project(camera);
        return { x: (p.x + 1) * size.width / 2, y: (1 - p.y) * size.height / 2, visible: Math.abs(p.x) < 0.94 && Math.abs(p.y) < 0.94 && p.z > -1 && p.z < 1 };
      },
      updateRenderer() { renderer = { calls: gl.info.render.calls, triangles: gl.info.render.triangles, dpr: gl.getPixelRatio() }; }
    };
    Object.assign(window, { __tt: hook });
    return () => { Reflect.deleteProperty(window, '__tt'); };
  }, [game, camera, gl, size]);
  useFrame(({ clock }) => {
    if (game.store.getState().phase === 'title') {
      const angle = clock.elapsedTime * 0.035;
      game.world.setCamera({ mode: 'path', elapsed: 0, keys: [{ position: { x: Math.sin(angle) * 24, y: 22, z: Math.cos(angle) * 24 }, target: { x: 0, y: 0, z: -3 }, duration: 1e8 }] });
    }
    const hook = Reflect.get(window, '__tt') as { updateRenderer?(): void } | undefined;
    hook?.updateRenderer?.();
  });
  return null;
}

export function App() {
  const [game] = useState(createGame);
  const hasSave = useStore(game.store, state => state.hasSave);
  const phase = useStore(game.store, state => state.phase);
  const presentation = useSyncExternalStore(game.ui.subscribe, game.ui.getSnapshot);
  useEffect(() => () => game.dispose(), [game]);
  return <main style={{ position: 'fixed', inset: 0 }} data-bag-check={presentation.bagCheck ? 'true' : undefined}>
    <Canvas dpr={Math.min(devicePixelRatio, 1.5)} gl={{ antialias: true }} camera={{ position: [4, 8, 18], fov: 46, near: 0.1, far: 180 }}>
      <World world={game.world} />
      <GameBridge game={game} />
    </Canvas>
    <UIHost ui={game.ui} hasSave={hasSave} titleBackdrop={<div aria-hidden="true" />} />
    {phase === 'cutscene' && game.canSkipIntro && <button data-testid="intro-skip" onClick={game.skipIntro} style={{ position: 'absolute', right: 24, top: 24, zIndex: 50, minHeight: 44, padding: '10px 20px', fontSize: 18 }}>Skip / スキップ</button>}
    <style>{`.tt-title{background:transparent}[data-bag-check=true] .tt-host-bottom{z-index:41}[data-bag-check=true] .tt-shade{align-items:flex-start;padding-top:20px}[data-bag-check=true] .tt-modal{max-height:calc(100vh - 250px)}`}</style>
  </main>;
}
