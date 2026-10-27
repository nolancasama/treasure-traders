import { expect, test } from '@playwright/test';
import { DEFAULT_SETTINGS, startChapter } from '../../src/game/logic';
import { approach, play, read, settle } from './game.helpers';

test('Chapter 5 pickup camera returns before a real click approaches Ken', async ({ page }) => {
  const game = startChapter(5, { mode: 'campaign', seed: 165939, campaignSeed: 101 });
  game.position = { x: -48, z: 4, yaw: Math.PI };
  // A canonical chapter checkpoint narrows the original late-campaign failure;
  // collection, walking, dialogue acknowledgements and the NPC click stay real.
  await page.addInitScript(({ game, settings }) => {
    localStorage.setItem('tt.save.v1', JSON.stringify(game));
    localStorage.setItem('tt.settings.v1', JSON.stringify(settings));
  }, { game, settings: { ...DEFAULT_SETTINGS, micFree: false, seenTips: ['intro', 'moving', 'mic', 'asking'] } });
  await page.goto('/?e2e=1&coach=off');
  await page.getByTestId('title-continue').click();
  await play(page, { mode: 'speech', until: state => !!state.game?.holdings.player?.notebook && !state.busy });
  expect(await approach(page, { kind: 'talk', target: 'ken' })).toBe('click');
  await settle(page, state => state.prompt?.kind === 'answer' && state.prompt.target === 'ken');
  expect((await read(page)).game?.question?.item).toBe('notebook');
});
