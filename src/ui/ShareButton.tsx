"use client";

import { useEffect, useState } from "react";
import { encodeSystem } from "@/share/url";
import { useSimStore } from "@/state/useSimStore";

/**
 * Copies a link to whatever is currently set up.
 *
 * An untouched preset gets the short readable form, ?p=trisolaris, because a
 * link someone can read is worth more than a clever one. Editing anything
 * clears presetId, and the whole system travels in the query string instead.
 *
 * What travels is the authored system, not the evolved one: the arrangement
 * as it was built, so the recipient watches it play out from the start
 * rather than arriving in the middle of a system that has already come
 * apart.
 */
export function ShareButton() {
  const presetId = useSimStore((s) => s.presetId);
  const bodies = useSimStore((s) => s.bodies);
  const settings = useSimStore((s) => s.settings);
  const viewDistance = useSimStore((s) => s.viewDistance);
  const daysPerSecond = useSimStore((s) => s.daysPerSecond);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2200);
    return () => clearTimeout(t);
  }, [state]);

  const share = async () => {
    const base = `${window.location.origin}${window.location.pathname}`;
    const query = presetId
      ? `?p=${encodeURIComponent(presetId)}`
      : `?s=${encodeSystem(bodies, settings, viewDistance, daysPerSecond)}`;
    const url = `${base}${query}`;

    // Keep the address bar in step, so copying from there works too.
    window.history.replaceState(null, "", query);

    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      // Clipboard access can be refused; the address bar still has the link.
      setState("failed");
    }
  };

  return (
    <button
      className={`chip ${state === "copied" ? "chip-active" : ""}`}
      onClick={share}
      title="Copy a link to this system"
    >
      {state === "copied" ? "Link copied" : state === "failed" ? "In address bar" : "Share"}
    </button>
  );
}
