/**
 * Shown by Next.js immediately on every admin page navigation
 * while the server/client is loading. Prevents the blank-screen flash.
 */
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-5">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 rounded-lg bg-slate-200" />
        <div className="h-8 w-24 rounded-lg bg-slate-200" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div className="h-3 w-16 rounded bg-slate-200" />
            <div className="mt-2 h-7 w-10 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Content card skeleton */}
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