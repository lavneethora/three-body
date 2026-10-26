import { deflateSync, inflateSync } from "fflate";
import { DEFAULT_SETTINGS, type BodyClass, type BodySpec, type SimSettings } from "@/physics/types";

/**
 * Systems encoded into a link.
 *
 * Every scenario in this app is just a list of bodies and a few settings, so
 * it can travel in a URL. That is the whole mechanic behind sharing one:
 * someone opens the link and gets exactly the system you built, rather than
 * a screenshot of it.
 *
 * Unmodified presets get the short form (?p=trisolaris) because a readable
 * link is worth more than a clever one. Anything else is deflated and
 * base64url encoded.
 */
export const SHARE_VERSION = 1;

/** Index-encoded for compactness; append only, never reorder. */
const CLASS_ORDER: BodyClass[] = [
  "star",
  "white-dwarf",
  "neutron-star",
  "black-hole",
  "rocky",
  "ocean",
  "desert",
  "ice",
  "lava",
  "gas-giant",
  "ringed-giant",
];

type BodyTuple = [
  string, // name
  number, // mass
  number, // radius
  number, number, number, // position
  number, number, number, // velocity
  number, // class index
  string, // colour
  number, // temperature, 0 when absent
];

interface Payload {
  v: number;
  b: BodyTuple[];
  s?: Partial<SimSettings>;
  vd?: number;
  dps?: number;
}

export interface SharedSystem {
  bodies: BodySpec[];
  settings: Partial<SimSettings>;
  viewDistance?: number;
  daysPerSecond?: number;
}

/**
 * Ten significant digits.
 *
 * Enough that the recipient's run follows the same path as the sender's for
 * a long while, without writing out seventeen digits of float noise per
 * coordinate and tripling the length of the link. In a chaotic system the
 * two will eventually diverge no matter how many digits travel, because that
 * is what chaotic means.
 */
function round(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Number(n.toPrecision(10));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Only the settings that differ from the defaults need to travel. */
function changedSettings(settings: SimSettings): Partial<SimSettings> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof SimSettings>) {
    if (settings[key] !== DEFAULT_SETTINGS[key]) out[key] = settings[key];
  }
  return out as Partial<SimSettings>;
}

export function encodeSystem(
  bodies: BodySpec[],
  settings: SimSettings,
  viewDistance?: number,
  daysPerSecond?: number,
): string {
  const payload: Payload = {
    v: SHARE_VERSION,
    b: bodies.map((b): BodyTuple => {
      const cls = CLASS_ORDER.indexOf(b.bodyClass);
      return [
        b.name,
        round(b.mass),
        round(b.radius),
        round(b.position[0]),
        round(b.position[1]),
        round(b.position[2]),
        round(b.velocity[0]),
        round(b.velocity[1]),
        round(b.velocity[2]),
        cls < 0 ? 0 : cls,
        b.color,
        b.temperature ? Math.round(b.temperature) : 0,
      ];
    }),
  };

  const s = changedSettings(settings);
  if (Object.keys(s).length > 0) payload.s = s;
  if (viewDistance !== undefined) payload.vd = round(viewDistance);
  if (daysPerSecond !== undefined) payload.dps = daysPerSecond;

  const json = JSON.stringify(payload);
  const deflated = deflateSync(new TextEncoder().encode(json), { level: 9 });
  return toBase64Url(deflated);
}

/**
 * Decode a shared system.
 *
 * Returns null rather than throwing on anything malformed. A link is a
 * hostile input: it can be truncated by a chat client, mangled by an email
 * wrapper, or simply made up, and none of that should break the page.
 */
export function decodeSystem(encoded: string): SharedSystem | null {
  try {
    const bytes = fromBase64Url(encoded);
    const json = new TextDecoder().decode(inflateSync(bytes));
    const payload = JSON.parse(json) as Payload;

    if (!payload || payload.v !== SHARE_VERSION || !Array.isArray(payload.b)) {
      return null;
    }
    // A link claiming thousands of bodies would lock the tab solid.
    if (payload.b.length === 0 || payload.b.length > 64) return null;

    const bodies: BodySpec[] = [];
    for (let i = 0; i < payload.b.length; i++) {
      const t = payload.b[i];
      if (!Array.isArray(t) || t.length < 12) return null;

      const nums = [t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8]];
      if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n))) return null;
      if (t[1] < 0 || t[2] < 0) return null;

      bodies.push({
        id: `shared-${i}`,
        name: typeof t[0] === "string" ? t[0].slice(0, 40) : `Body ${i + 1}`,
        mass: t[1],
        radius: t[2],
        position: [t[3], t[4], t[5]],
        velocity: [t[6], t[7], t[8]],
        bodyClass: CLASS_ORDER[t[9]] ?? "rocky",
        color: /^#[0-9a-fA-F]{6}$/.test(t[10]) ? t[10] : "#ffffff",
        temperature: t[11] > 0 ? t[11] : undefined,
      });
    }

    return {
      bodies,
      settings: payload.s ?? {},
      viewDistance: payload.vd,
      daysPerSecond: payload.dps,
    };
  } catch {
    return null;
  }
}
