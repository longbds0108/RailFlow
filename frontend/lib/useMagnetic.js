"use client";

import { useRef } from "react";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Nudges an element a few px toward the cursor; no-op under reduced motion.
export function useMagnetic(maxOffset = 8) {
  const ref = useRef(null);
  const onMouseMove = (e) => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const rect = el.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--mx", `${relX * maxOffset}px`);
    el.style.setProperty("--my", `${relY * maxOffset}px`);
  };
  const onMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", "0px");
    el.style.setProperty("--my", "0px");
  };
  return { ref, onMouseMove, onMouseLeave };
}
