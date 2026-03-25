"use client";

/**
 * NavigationContext
 *
 * Single source of truth for "is a navigation in flight?"
 * One click listener, shared by NavigationProgress (top bar) and
 * PageTransition (content skeleton). No duplicate event handlers.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type NavigationContextValue = {
  active: boolean;
  completing: boolean;
};

const NavigationContext = createContext<NavigationContextValue>({
  active:     false,
  completing: false,
});

export function useNavigation() {
  return useContext(NavigationContext);
}

/** Returns true for internal same-app navigation links only */
function isInternalNavClick(e: MouseEvent): boolean {
  const anchor = (e.target as Element).closest<HTMLAnchorElement>("a[href]");
  if (!anchor) return false;

  const href = anchor.getAttribute("href") ?? "";

  if (
    href.startsWith("http") ||
    href.startsWith("//")   ||
    href.startsWith("mailto") ||
    href.startsWith("tel")  ||
    href === "#"            ||
    href.startsWith("#")    ||
    anchor.target === "_blank" ||
    e.defaultPrevented      ||
    e.ctrlKey || e.metaKey || e.shiftKey || e.altKey
  ) return false;

  const dest = href.split("?")[0].split("#")[0];
  if (dest === window.location.pathname) return false;

  return true;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname    = usePathname();
  const prevPath    = useRef(pathname);

  const [active,     setActive]     = useState(false);
  const [completing, setCompleting] = useState(false);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCompleting(true);
    timerRef.current = setTimeout(() => {
      setActive(false);
      setCompleting(false);
    }, 380);
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCompleting(false);
    setActive(true);
  }, []);

  // Detect navigation completion
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      if (active) finish();
    }
  }, [pathname, active, finish]);

  // Single click listener for the whole app
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (isInternalNavClick(e)) start();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [start]);

  // Cleanup
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <NavigationContext.Provider value={{ active, completing }}>
      {children}
    </NavigationContext.Provider>
  );
}