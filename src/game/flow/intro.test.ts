import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startChapter } from "../logic";
import { createWorld, worldStateFromGame } from "../runtime";
import type { UIAPI } from "../../ui";
import { createPresenter } from "./presentation";

/** The wind's opening beat, the only timed wait a first-time player sits through. */
const WIND_MS = 3600;

function harness() {
  const world = createWorld(worldStateFromGame(startChapter(1, { mode: "campaign", campaignSeed: 101 })));
  const shown: string[] = [];
  const ui = {
    say: vi.fn(async (beat: { en: string }) => { shown.push(beat.en); }),
    card: vi.fn(async () => { shown.push("card"); })
  };
  return { presenter: createPresenter(world, ui as unknown as UIAPI), ui, shown };
}

describe("the Big Wind introduction", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("shows the mission card as soon as the last line ends, with no minimum duration", async () => {
    const { presenter, ui, shown } = harness();
    const done = presenter.intro(1);
    await vi.advanceTimersByTimeAsync(WIND_MS - 1);
    expect(ui.say).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(shown.length).toBeGreaterThanOrEqual(4);
    expect(shown.at(-1)).toBe("card");
    await done;
  });

  it("goes straight to the mission card when skipped, without any lines", async () => {
    const { presenter, ui, shown } = harness();
    const skip = new AbortController();
    const done = presenter.intro(1, skip.signal);
    await vi.advanceTimersByTimeAsync(100);
    skip.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(ui.say).not.toHaveBeenCalled();
    expect(shown).toEqual(["card"]);
    await done;
  });

  it("stops the remaining lines when skipped partway through them", async () => {
    const { presenter, ui, shown } = harness();
    const skip = new AbortController();
    ui.say.mockImplementationOnce(async (beat: { en: string }) => { shown.push(beat.en); skip.abort(); });
    const done = presenter.intro(1, skip.signal);
    await vi.advanceTimersByTimeAsync(WIND_MS);
    expect(ui.say).toHaveBeenCalledOnce();
    expect(shown.at(-1)).toBe("card");
    await done;
  });
});
