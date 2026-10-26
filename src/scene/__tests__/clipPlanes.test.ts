import { describe, expect, it } from "vitest";
import { MAX_DEPTH_RATIO, computeClipPlanes } from "../clipPlanes";

/**
 * The property that matters: across every camera distance the app allows,
 * nothing on screen is ever clipped away. This is the bug that showed up as
 * the scene going black at certain zoom levels, and as bodies blinking while
 * they orbited across a fixed near plane.
 */
describe("clip planes", () => {
  const cases: Array<{ name: string; nearest: number; farthest: number }> = [
    { name: "framed on a system from far out", nearest: 90, farthest: 260 },
    { name: "mid approach", nearest: 4.2, farthest: 120 },
    { name: "close to a star", nearest: 0.4, farthest: 96 },
    { name: "very close to a planet", nearest: 0.0004, farthest: 5 },
    { name: "grazing a planet's surface", nearest: 1e-6, farthest: 3 },
    { name: "huge system, Alpha Centauri scale", nearest: 40, farthest: 11000 },
    { name: "tiny system, tight binary", nearest: 0.002, farthest: 0.4 },
  ];

  for (const c of cases) {
    it(`keeps everything visible: ${c.name}`, () => {
      const { near, far } = computeClipPlanes(c.nearest, c.farthest);

      expect(near).toBeGreaterThan(0);
      expect(Number.isFinite(near)).toBe(true);
      expect(Number.isFinite(far)).toBe(true);

      // Nothing is ever sliced off the front. This is the guarantee that
      // matters, and it is never traded away.
      expect(near).toBeLessThan(c.nearest);

      // The far plane covers the content unless the depth budget cannot
      // stretch that far, in which case it sits exactly at the budget.
      const budgetLimited = far < c.farthest;
      if (budgetLimited) {
        expect(far / near).toBeCloseTo(MAX_DEPTH_RATIO, -2);
      } else {
        expect(far).toBeGreaterThan(c.farthest);
      }

      // Depth precision stays within what the buffer can resolve.
      expect(far / near).toBeLessThanOrEqual(MAX_DEPTH_RATIO * 1.000001);
    });
  }

  it("survives the camera being inside the nearest object", () => {
    // Zooming into a star's corona puts the camera inside the billboard, so
    // the nearest surface distance goes negative.
    const { near, far } = computeClipPlanes(-0.3, 50);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(50);
  });

  it("survives a system with no bodies left", () => {
    const { near, far } = computeClipPlanes(Infinity, 0);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(0);
    expect(Number.isFinite(near)).toBe(true);
  });

  it("never returns a degenerate projection across a continuous zoom", () => {
    // Walk the camera in from 1000 AU to a millionth of an AU and check every
    // step, which is the sweep that used to go black part way through.
    for (let d = 1000; d > 1e-6; d *= 0.8) {
      const { near, far } = computeClipPlanes(d, d + 400);
      expect(near).toBeGreaterThan(0);
      expect(near).toBeLessThan(d);
      expect(far).toBeGreaterThan(near * 999);
      expect(far / near).toBeLessThanOrEqual(MAX_DEPTH_RATIO * 1.000001);
    }
  });
});
