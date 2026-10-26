import { describe, expect, it } from "vitest";
import { decodeSystem, encodeSystem } from "../url";
import { DEFAULT_SETTINGS } from "@/physics/types";
import { PRESETS } from "@/catalog/presets";

describe("share links", () => {
  it("round trips every preset without losing anything that matters", () => {
    for (const p of PRESETS) {
      const settings = { ...DEFAULT_SETTINGS, ...p.settings };
      const encoded = encodeSystem(p.bodies, settings, p.viewDistance, p.daysPerSecond);
      const decoded = decodeSystem(encoded);

      expect(decoded, p.name).not.toBeNull();
      expect(decoded!.bodies.length).toBe(p.bodies.length);

      p.bodies.forEach((original, i) => {
        const back = decoded!.bodies[i];
        expect(back.name).toBe(original.name);
        expect(back.bodyClass).toBe(original.bodyClass);
        expect(back.color).toBe(original.color);

        // Ten significant digits, so a relative tolerance is the right test.
        const close = (a: number, b: number) => {
          const scale = Math.max(Math.abs(a), Math.abs(b), 1e-30);
          expect(Math.abs(a - b) / scale).toBeLessThan(1e-9);
        };
        close(back.mass, original.mass);
        close(back.radius, original.radius);
        for (let k = 0; k < 3; k++) {
          close(back.position[k], original.position[k]);
          close(back.velocity[k], original.velocity[k]);
        }
      });

      expect(decoded!.viewDistance).toBeCloseTo(p.viewDistance, 6);
      expect(decoded!.daysPerSecond).toBe(p.daysPerSecond);
    }
  });

  it("carries only the settings that differ from the defaults", () => {
    const encoded = encodeSystem(PRESETS[0].bodies, DEFAULT_SETTINGS);
    expect(decodeSystem(encoded)!.settings).toEqual({});

    const burrau = PRESETS.find((p) => p.id === "burrau")!;
    const settings = { ...DEFAULT_SETTINGS, ...burrau.settings };
    const back = decodeSystem(encodeSystem(burrau.bodies, settings))!;
    expect(back.settings.collisions).toBe(false);
    expect(back.settings.softening).toBe(burrau.settings!.softening);
  });

  it("stays short enough to paste anywhere", () => {
    for (const p of PRESETS) {
      const settings = { ...DEFAULT_SETTINGS, ...p.settings };
      const encoded = encodeSystem(p.bodies, settings, p.viewDistance, p.daysPerSecond);
      // Comfortably inside the ~2000 characters every browser and chat client
      // handles, with room for the origin and the query key.
      expect(encoded.length, `${p.name}: ${encoded.length} chars`).toBeLessThan(1400);
    }
  });

  it("refuses malformed input instead of throwing", () => {
    // A link is hostile input: truncated by a chat client, mangled by an
    // email wrapper, or simply invented. None of it should break the page.
    const bad = [
      "",
      "not-base64!!",
      "YWJjZGVm",
      "////",
      encodeSystem(PRESETS[0].bodies, DEFAULT_SETTINGS).slice(0, 20),
    ];
    for (const input of bad) {
      expect(() => decodeSystem(input)).not.toThrow();
      expect(decodeSystem(input)).toBeNull();
    }
  });

  it("rejects a system large enough to lock up the tab", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      ...PRESETS[0].bodies[0],
      id: `b${i}`,
    }));
    expect(decodeSystem(encodeSystem(many, DEFAULT_SETTINGS))).toBeNull();
  });

  it("rejects bodies with impossible values", () => {
    const encoded = encodeSystem(
      [{ ...PRESETS[0].bodies[0], mass: -5 }],
      DEFAULT_SETTINGS,
    );
    expect(decodeSystem(encoded)).toBeNull();
  });
});
