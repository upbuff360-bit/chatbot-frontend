"use client";

/**
 * PageTransition
 *
 * Wraps the <main> content area in the admin layout.
 * The instant a nav click fires (NavigationContext active=true),
 * it immediately hides the old content and shows the skeleton.
 * When the new route completes (active=false), it shows new content.
 *
 * This gives auth-page-speed instant feedback on all admin nav clicks.
 */

import { ReactNode } from "react";
import { useNavigation } from "@/components/NavigationContext";
import { usePathname } from "next/navigation";

// Detect if the active route is inside an agent workspace
function isAgentRoute(pathname: string) {
  return /^\/agents\/[^/]+\//.test(pathname);
}

// ── General admin skeleton ────────────────────────────────────────────────────
function AdminSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 rounded-lg bg-slate-200" />
        <div className="h-8 w-24 rounded-lg bg-slate-200" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div className="h-3 w-16 rounded bg-slate-200" />
            <div className="mt-2 h-7 w-10 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <div className="h-4 w-28 rounded bg-slate-200" />
        </div>
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-slate-200" />
                <div className="h-3.5 w-48 rounded bg-slate-200" />
              </div>
              <div className="h-3 w-16 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Agent workspace skeleton ─────────────────────────────────────────────────
function AgentSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
        {[80, 56, 104, 80].map((w, i) => (
          <div key={i} className="h-7 rounded-md bg-slate-200" style={{ width: w }} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-20 rounded bg-slate-200" />
        <div className="h-8 w-28 rounded-lg bg-slate-200" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-2 w-2 flex-shrink-0 rounded-full bg-slate-200" />
              <div>
                <div className="h-3.5 w-52 rounded bg-slate-200" />
                <div className="mt-1.5 h-2.5 w-24 rounded bg-slate-100" />
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <div className="h-6 w-10 rounded-md bg-slate-200" />
              <div className="h-6 w-14 rounded-md bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Wrapper ───────────────────────────────────────────────────────────────────
export default function PageTransition({ children }: { children: ReactNode }) {
  const { active, completing } = useNavigation();
  const pathname               = usePathname();

  // While navigating (active=true and not yet completing), show skeleton
  if (active && !completing) {
    return isAgentRoute(pathname) ? <AgentSkeleton /> : <AdminSkeleton />;
  }

  return <>{children}</>;
}