"use client";

/**
 * NavigationProgress
 *
 * Top progress bar + page overlay — reads from NavigationContext.
 * No click listener here; NavigationProvider owns that.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigation } from "@/components/NavigationContext";

export default function NavigationProgress() {
  const { active, completing } = useNavigation();

  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef   = useRef<number | null>(null);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current)   cancelAnimationFrame(rafRef.current);
  };

  useEffect(() => {
    if (active && !completing) {
      clearTimers();
      setProgress(8);
      let current = 8;
      const tick = () => {
        const remaining = 85 - current;
        const step      = Math.max(remaining * 0.08, 0.4);
        current         = Math.min(current + step, 85);
        setProgress(current);
        if (current < 84.5) {
          timerRef.current = setTimeout(() => { rafRef.current = requestAnimationFrame(tick); }, 120);
        }
      };
      timerRef.current = setTimeout(() => { rafRef.current = requestAnimationFrame(tick); }, 80);
    }
    if (completing)            { clearTimers(); setProgress(100); }
    if (!active && !completing){ clearTimers(); setProgress(0); }
    return clearTimers;
  }, [active, completing]);

  if (!active) return null;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed", top: 0, left: 0,
          height: "2px", width: `${progress}%`,
          background: "var(--foreground, #0f172a)",
          zIndex: 9999, pointerEvents: "none",
          transition: completing
            ? "width 0.18s ease, opacity 0.25s ease 0.15s"
            : "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          opacity: completing ? 0 : 1,
          borderRadius: "0 1px 1px 0",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "fixed", top: 0, left: `${progress}%`,
          width: "60px", height: "2px",
          background: completing ? "transparent" : "linear-gradient(to right, transparent, rgba(15,23,42,0.25))",
          zIndex: 9999, pointerEvents: "none",
          transform: "translateX(-60px)",
          opacity: completing ? 0 : 1,
        }}
      />
    </>
  );
}