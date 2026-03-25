/**
 * Shown immediately when navigating to any agent sub-page
 * (knowledge, chat, conversations, analytics) before data loads.
 */
export default function AgentWorkspaceLoading() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Tab bar skeleton */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
        {[80, 56, 104, 80].map((w, i) => (
          <div key={i} className={`h-7 rounded-md bg-slate-200`} style={{ width: w }} />
        ))}
      </div>

      {/* Toolbar row */}
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-20 rounded bg-slate-200" />
        <div className="h-8 w-28 rounded-lg bg-slate-200" />
      </div>

      {/* Document list skeleton */}
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