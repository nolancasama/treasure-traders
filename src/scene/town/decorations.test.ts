import { afterEach, expect, it, vi } from "vitest";
import { BALLOON_RADIUS, HARBOR_BALLOON_OFFSETS, HARBOR_BALLOON_POSTS } from "./decorations";
import { SignBatch } from "./signs";

afterEach(() => { vi.unstubAllGlobals(); });

it("keeps every harbor balloon clear of the sign board's full width and height", () => {
  const context = { measureText: (text: string) => ({ width: text.length * 30 }), beginPath() {}, roundRect() {}, fill() {}, fillText() {} };
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const width = SignBatch.width("harbor", 0.8) + 0.18;
  const left = -9.4 - width / 2, right = -9.4 + width / 2;
  const bottom = 3.1 - 0.8 - 0.08, top = 3.1 + 0.08;
  const overlaps = (post: readonly number[]) => HARBOR_BALLOON_OFFSETS.some(offset => {
    const x = post[0] + offset[0], y = post[1] + offset[1];
    return x + BALLOON_RADIUS >= left && x - BALLOON_RADIUS <= right
      && y + BALLOON_RADIUS * 1.22 >= bottom && y - BALLOON_RADIUS * 1.22 <= top;
  });
  expect(overlaps([-7, 1.05, 27.82])).toBe(true);
  expect(overlaps([-13, 1.05, 27.82])).toBe(true);
  expect(HARBOR_BALLOON_POSTS).toHaveLength(8);
  for (const post of HARBOR_BALLOON_POSTS) expect(overlaps(post), `post ${post}`).toBe(false);
});
