"use client";

import { useAdmin } from "@/components/AdminProvider";

export default function ToastViewport() {
  const { toasts } = useAdmin();

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            "pointer-events-auto rounded-2xl border px-4 py-3 shadow-xl backdrop-blur",
            toast.variant === "error"
              ? "border-rose-200 bg-white/95 text-rose-950"
              : "border-emerald-200 bg-white/95 text-slate-900",
          ].join(" ")}
        >
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? <p className="mt-1 text-sm text-slate-600">{toast.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
