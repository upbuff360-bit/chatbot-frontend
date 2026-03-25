/**
 * Shown by Next.js immediately when navigating between /login and /register
 * before the page component mounts. Matches the visual shape of both forms.
 */
export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm animate-pulse">

        {/* Logo row */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="h-8 w-8 rounded-lg bg-slate-200" />
          <div className="h-4 w-24 rounded bg-slate-200" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-7 shadow-sm space-y-5">

          {/* Heading */}
          <div className="space-y-2">
            <div className="h-5 w-36 rounded bg-slate-200" />
            <div className="h-3.5 w-48 rounded bg-slate-200" />
          </div>

          {/* Email field */}
          <div className="space-y-1.5">
            <div className="h-3 w-10 rounded bg-slate-200" />
            <div className="h-9 w-full rounded-lg bg-slate-100" />
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <div className="h-3 w-16 rounded bg-slate-200" />
            <div className="h-9 w-full rounded-lg bg-slate-100" />
          </div>

          {/* Submit button */}
          <div className="h-9 w-full rounded-lg bg-slate-200" />
        </div>

        {/* Bottom link */}
        <div className="mt-4 flex justify-center gap-1">
          <div className="h-3.5 w-32 rounded bg-slate-200" />
          <div className="h-3.5 w-16 rounded bg-slate-200" />
        </div>

      </div>
    </div>
  );
}