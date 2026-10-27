import { expect, it } from 'vitest';
import { memoryStorage, newCampaign, SAVE_KEY } from '../logic';
import { createGameStore } from '../store';

it('checkpoints only save coordinates and preserves the exact state on Continue', () => {
  const storage = memoryStorage();
  const store = createGameStore(storage);
  store.getState().setGame(newCampaign(101));
  store.getState().setPhase('playing');
  const player = { x: 3, z: 7, yaw: 1.2, y: 0, speed: 4.5 };
  store.getState().persist(player);
  const saved = JSON.parse(storage.getItem(SAVE_KEY)!);
  expect(saved.position).toEqual({ x: 3, z: 7, yaw: 1.2 });
  const continued = createGameStore(storage).getState().load(undefined, ({ x, z, yaw }) => ({ x, z, yaw }));
  expect(continued).toEqual(saved);
});
