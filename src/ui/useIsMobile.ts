"use client";

import { useEffect, useState } from "react";

/**
 * True on phone-width screens.
 *
 * Starts false and corrects on mount, because the server has no viewport to
 * measure. The desktop layout is the safer thing to render first: it is the
 * one that degrades into a usable mess, rather than a phone layout briefly
 * stretched across a monitor.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}
