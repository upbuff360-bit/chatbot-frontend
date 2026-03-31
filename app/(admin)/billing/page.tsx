"use client";

import { useEffect, useRef, useState } from "react";
import { useAdmin } from "@/components/AdminProvider";
import { cachedFetch, invalidate } from "@/lib/client-cache";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("chatbot_access_token") : "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

interface Plan { id: string; name: string; totalMessages: number; sellingPrice: number; }
interface BillingRecord {
  user_id: string; email: string; plan_id: string; plan_name: string;
  selling_price: number; duration_months: number;
  cycle_start_date: string; cycle_end_date: string; assigned_at: string;
  remaining_messages: number; monthly_message_limit: number;
  billing_status: "active" | "paused" | "stopped";
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return "—"; }
}
function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function StatusBadge({ status, end }: { status: string; end: string }) {
  const daysLeft = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
  if (status === "paused")  return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">⏸ Paused</span>;
  if (status === "stopped") return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-red-50 text-red-600 border border-red-100">⛔ Stopped</span>;
  if (daysLeft < 0)         return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-red-50 text-red-600 border border-red-100">Expired</span>;
  if (daysLeft <= 7)        return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100">Expires in {daysLeft}d</span>;
  return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100">● Active</span>;
}

// ── Row kebab menu ─────────────────────────────────────────────────────────
function RowMenu({ record, canManageBilling, onAction }: {
  record: BillingRecord;
  canManageBilling: boolean;
  onAction: (action: string, record: BillingRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  if (!canManageBilling) return null;

  const status = record.billing_status ?? "active";

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
          <circle cx="8" cy="3" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="8" cy="13" r="1.2"/>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {/* Renew */}
          <button type="button" onClick={() => { setOpen(false); onAction("renew", record); }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 4v4h4M15 12v-4h-4"/><path d="M13.5 5A6 6 0 0 0 3.2 7.2M2.5 11a6 6 0 0 0 10.3 1.8"/>
            </svg>
            Renew Plan
          </button>

          <div className="my-1 border-t border-slate-100" />

          {/* Pause / Resume */}
          {status === "paused" ? (
            <button type="button" onClick={() => { setOpen(false); onAction("resume", record); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition">
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M3 2.5 13 8 3 13.5V2.5Z"/>
              </svg>
              Resume
            </button>
          ) : (
            <button type="button" onClick={() => { setOpen(false); onAction("pause", record); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-amber-600 hover:bg-amber-50 transition"
              disabled={status === "stopped"}>
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/>
              </svg>
              Pause
            </button>
          )}

          {/* Stop */}
          <button type="button" onClick={() => { setOpen(false); onAction("stop", record); }}
            disabled={status === "stopped"}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <rect x="2" y="2" width="12" height="12" rx="2"/>
            </svg>
            Stop
          </button>
        </div>
      )}
    </div>
  );
}

// ── Renew Modal ───────────────────────────────────────────────────────────────
function RenewModal({ record, plans, onConfirm, onClose }: {
  record: BillingRecord;
  plans: Plan[];
  onConfirm: (planId: string, duration: number) => Promise<void>;
  onClose: () => void;
}) {
  const currentPlan = plans.find(p => p.id === record.plan_id) ?? plans[0];
  const [selectedPlanId, setSelectedPlanId] = useState(currentPlan?.id ?? "");
  const [duration,       setDuration]       = useState(record.duration_months ?? 1);
  const [saving,         setSaving]         = useState(false);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  const handleConfirm = async () => {
    if (!selectedPlanId) return;
    setSaving(true);
    try { await onConfirm(selectedPlanId, duration); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Renew Plan</h2>
        <p className="text-xs text-slate-400 mb-4">Renewing plan for <strong>{record.email}</strong></p>

        <div className="space-y-4">
          {/* Plan selection */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Select Plan</label>
            {plans.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">No plans available.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {plans.map(p => (
                  <label key={p.id}
                    className={["flex items-center justify-between rounded-xl border-2 px-4 py-2.5 cursor-pointer transition",
                      selectedPlanId === p.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"].join(" ")}>
                    <div className="flex items-center gap-3">
                      <input type="radio" name="plan" value={p.id} checked={selectedPlanId === p.id}
                        onChange={() => setSelectedPlanId(p.id)} className="accent-slate-900" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.totalMessages.toLocaleString()} msgs/mo</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-emerald-600">{formatUSD(p.sellingPrice)}</p>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Duration */}
          {selectedPlanId && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Duration</label>
              <div className="relative">
                <select value={duration} onChange={e => setDuration(Number(e.target.value))}
                  className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm outline-none transition focus:border-slate-400">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <option key={m} value={m}>{m} {m === 1 ? "Month" : "Months"}</option>
                  ))}
                </select>
                <svg viewBox="0 0 16 16" fill="currentColor" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400">
                  <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
                </svg>
              </div>
              {selectedPlan && (
                <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex justify-between items-center">
                  <p className="text-xs text-slate-500">New cycle ends</p>
                  <p className="text-xs font-semibold text-slate-800">
                    {new Date(Date.now() + duration * 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm}
            disabled={saving || !selectedPlanId}
            className="flex-1 h-9 rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
            {saving ? "Renewing..." : "Renew Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const { permissionsLoaded, hasAnyForResource, hasPermission } = useAdmin();

  // Read role from JWT synchronously — no extra render cycle needed
  const isSuperAdmin = (() => {
    if (typeof window === "undefined") return false;
    try {
      const p = JSON.parse(atob((localStorage.getItem("chatbot_access_token") ?? "").split(".")[1]));
      return p?.role === "super_admin";
    } catch { return false; }
  })();

  const canReadBilling = permissionsLoaded ? hasAnyForResource("billing") : false;
  const canReadPlans = permissionsLoaded ? hasAnyForResource("plans") : false;
  const canManageBilling = permissionsLoaded ? hasPermission("billing:manage") : isSuperAdmin;

  const [records,     setRecords]     = useState<BillingRecord[]>([]);
  const [plans,       setPlans]       = useState<Plan[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [renewRecord, setRenewRecord] = useState<BillingRecord | null>(null);
  const [toastMsg,    setToastMsg]    = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const billingCacheKey = isSuperAdmin ? "billing:all" : "billing:me";

  const fetchData = async (bust = false) => {
    if (!canReadBilling) {
      setRecords([]);
      setPlans([]);
      setLoading(false);
      return;
    }
    if (bust) { invalidate(billingCacheKey); invalidate("plans"); }
    setLoading(true);
    try {
      const url = isSuperAdmin ? `${BASE}/billing/all` : `${BASE}/billing/me`;
      const [records, plans] = await Promise.all([
        cachedFetch(billingCacheKey, () => fetch(url, { headers: authHeaders(), cache: "no-store" }).then(r => r.ok ? r.json() : []), 60_000),
        canReadPlans
          ? cachedFetch("plans", () => fetch(`${BASE}/plans`, { headers: authHeaders() }).then(r => r.ok ? r.json() : []), 60_000)
          : Promise.resolve([]),
      ]);
      setRecords(records);
      setPlans(plans);
    } finally { setLoading(false); }
  };

  // Fire fetch immediately on mount — no mounted gate needed
  useEffect(() => {
    if (!permissionsLoaded) return;
    void fetchData(true);
  }, [permissionsLoaded, canReadBilling, canReadPlans, isSuperAdmin]);

  if (!permissionsLoaded) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
      </div>
    );
  }

  if (!canReadBilling) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <svg viewBox="0 0 16 16" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="7" width="10" height="8" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">Access Restricted</p>
          <p className="mt-1 text-xs text-slate-400">Your role does not have billing access.</p>
        </div>
      </div>
    );
  }

  const handleAction = async (action: string, record: BillingRecord) => {
    if (action === "renew") { setRenewRecord(record); return; }

    const confirmMsg = {
      pause:  `Pause billing for ${record.email}? Their agents will stop responding.`,
      stop:   `Stop billing for ${record.email}? Agents will be permanently stopped until renewed.`,
      resume: `Resume billing for ${record.email}?`,
    }[action];

    if (!confirm(confirmMsg ?? "Are you sure?")) return;

    const res = await fetch(`${BASE}/billing/${record.user_id}/${action}`, {
      method: "PATCH", headers: authHeaders(),
    });
    if (res.ok) {
      const pastTense = action === "resume" ? "resumed" : action === "stop" ? "stopped" : action + "d";
      showToast(`Billing ${pastTense} successfully.`);
      // Optimistically update UI immediately without waiting for refetch
      const newStatus = action === "pause" ? "paused" : action === "stop" ? "stopped" : "active";
      setRecords(prev => prev.map(r =>
        r.user_id === record.user_id ? { ...r, billing_status: newStatus as BillingRecord["billing_status"] } : r
      ));
      // Then refetch to sync with server
      fetchData(true);
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err?.detail ?? `Failed to ${action} billing.`);
    }
  };

  const handleRenew = async (planId: string, duration: number) => {
    if (!renewRecord) return;
    const res = await fetch(`${BASE}/billing/${renewRecord.user_id}/renew`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ plan_id: planId, duration_months: duration }),
    });
    if (res.ok) {
      showToast("Plan renewed successfully.");
      setRenewRecord(null);
      fetchData(true);
    }
  };

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    if (!q) return true;
    return r.email?.toLowerCase().includes(q) || r.plan_name?.toLowerCase().includes(q);
  });

  const totalRevenue = records.reduce((s, r) => s + (r.selling_price ?? 0), 0);
  const activeCount  = records.filter(r => r.billing_status === "active" && new Date(r.cycle_end_date).getTime() > Date.now()).length;
  const pausedCount  = records.filter(r => r.billing_status === "paused").length;
  const stoppedCount = records.filter(r => r.billing_status === "stopped").length;

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-base font-semibold text-slate-900">Billing</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isSuperAdmin ? "Manage all users' subscription billing." : "Your subscription billing history."}
        </p>
      </div>

      {/* Summary cards */}
      <div className={`grid gap-4 ${isSuperAdmin ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"}`}>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs text-slate-400">Total Plans</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{records.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4">
          <p className="text-xs text-emerald-600">Active</p>
          <p className="text-2xl font-bold text-emerald-700 mt-0.5">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4">
          <p className="text-xs text-amber-600">Paused</p>
          <p className="text-2xl font-bold text-amber-700 mt-0.5">{pausedCount}</p>
        </div>
        {isSuperAdmin ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
            <p className="text-xs text-blue-500">Total Revenue</p>
            <p className="text-2xl font-bold text-blue-700 mt-0.5">{formatUSD(totalRevenue)}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4">
            <p className="text-xs text-red-500">Stopped</p>
            <p className="text-2xl font-bold text-red-600 mt-0.5">{stoppedCount}</p>
          </div>
        )}
      </div>

      {/* Search */}
      {isSuperAdmin && (
        <div className="relative">
          <svg viewBox="0 0 16 16" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="4"/><path d="m9.5 9.5 3 3"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by email or plan name..."
            autoComplete="off"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-400" />
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-slate-500">No billing records</p>
            <p className="mt-1 text-xs text-slate-400">{records.length === 0 ? "No plans have been assigned yet." : `No results for "${search}"`}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {isSuperAdmin && <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">User</th>}
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Plan</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Duration</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Start Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">End Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Usage</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Status</th>
                {isSuperAdmin && <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r, idx) => {
                const usagePct = r.monthly_message_limit > 0
                  ? Math.min(((r.monthly_message_limit - r.remaining_messages) / r.monthly_message_limit) * 100, 100)
                  : 0;
                return (
                  <tr key={idx} className={["hover:bg-slate-50 transition",
                    r.billing_status === "paused"  ? "bg-amber-50/30" :
                    r.billing_status === "stopped" ? "bg-red-50/30" : ""
                  ].join(" ")}>
                    {isSuperAdmin && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">
                            {(r.email?.[0] ?? "U").toUpperCase()}
                          </div>
                          <p className="text-xs font-medium text-slate-700 truncate max-w-[140px]">{r.email}</p>
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{r.plan_name}</p>
                      <p className="text-[10px] text-slate-400">{r.monthly_message_limit?.toLocaleString()} msgs/mo</p>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-emerald-600">{formatUSD(r.selling_price ?? 0)}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{r.duration_months ?? 1} {(r.duration_months ?? 1) === 1 ? "mo" : "mos"}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{formatDate(r.cycle_start_date)}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{formatDate(r.cycle_end_date)}</td>
                    <td className="px-5 py-3.5">
                      <div className="w-24">
                        <div className="h-1.5 w-full rounded-full bg-slate-100">
                          <div className={["h-1.5 rounded-full",
                            usagePct > 90 ? "bg-red-500" : usagePct > 70 ? "bg-amber-500" : "bg-emerald-500"
                          ].join(" ")} style={{ width: `${usagePct}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{usagePct.toFixed(0)}% used</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={r.billing_status ?? "active"} end={r.cycle_end_date} />
                    </td>
                    {isSuperAdmin && (
                      <td className="px-5 py-3.5 text-right">
                        <RowMenu record={r} canManageBilling={canManageBilling} onAction={handleAction} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Renew modal */}
      {renewRecord && (
        <RenewModal
          record={renewRecord}
          plans={plans}
          onConfirm={handleRenew}
          onClose={() => setRenewRecord(null)}
        />
      )}
    </div>
  );
}