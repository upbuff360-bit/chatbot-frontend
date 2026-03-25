"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/components/AdminProvider";
import { cachedFetch, invalidate } from "@/lib/client-cache";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";
function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("chatbot_access_token") : "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const AVG_CHAT_TOKENS        = 500;
const AVG_SUMMARY_TOKENS     = 300;
const TOTAL_TOKENS_PER_MSG   = 800;
const COST_PER_1M_TOKENS_USD = 1.0;    // $1.00 per 1M tokens (OpenAI gpt-4o-mini approx)
const FALLBACK_USD_TO_INR    = 83.5;   // Fallback if API fails
const INFRA_BUFFER           = 1.3;
const PRICE_MULTIPLIER       = 3;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Plan {
  id: string;
  name: string;
  description: string;
  totalMessages: number;
  totalTokens: number;
  estimatedCost: number;
  sellingPrice: number;
  createdAt: string;
}

interface CalcResult {
  totalTokens: number;
  chatTokens: number;
  summaryTokens: number;
  chatCost: number;
  summaryCost: number;
  baseCost: number;
  finalCost: number;
  recommendedPrice: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(n);
}


function calcFromMessages(messages: number): CalcResult {
  const totalTokens   = messages * TOTAL_TOKENS_PER_MSG;
  const chatTokens    = messages * AVG_CHAT_TOKENS;
  const summaryTokens = messages * AVG_SUMMARY_TOKENS;
  // USD costs
  const chatCost      = (chatTokens    / 1_000_000) * COST_PER_1M_TOKENS_USD;
  const summaryCost   = (summaryTokens / 1_000_000) * COST_PER_1M_TOKENS_USD;
  const baseCost      = (totalTokens   / 1_000_000) * COST_PER_1M_TOKENS_USD;
  const finalCost     = baseCost * INFRA_BUFFER;
  const recommendedPrice = finalCost * PRICE_MULTIPLIER;
  return { totalTokens, chatTokens, summaryTokens, chatCost, summaryCost, baseCost, finalCost, recommendedPrice };
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function PlanModal({
  editing,
  onSave,
  onClose,
  usdToInr,
}: {
  editing: Plan | null;
  onSave: (plan: Omit<Plan, "id" | "createdAt">) => Promise<void>;
  onClose: () => void;
  usdToInr: number;
}) {
  const [name,         setName]         = useState(editing?.name ?? "");
  const [description,  setDescription]  = useState(editing?.description ?? "");
  const [messages,     setMessages]     = useState(editing?.totalMessages ?? 0);
  const [customPrice,  setCustomPrice]  = useState(editing?.sellingPrice ?? 0);
  const [advanced,     setAdvanced]     = useState(false);
  const [chatTokenMod, setChatTokenMod] = useState(AVG_CHAT_TOKENS);
  const [sumTokenMod,  setSumTokenMod]  = useState(AVG_SUMMARY_TOKENS);

  const totalPerMsg = chatTokenMod + sumTokenMod;
  const calc = (() => {
    const totalTokens   = messages * totalPerMsg;
    const chatTokens    = messages * chatTokenMod;
    const summaryTokens = messages * sumTokenMod;
    const chatCost      = (chatTokens    / 1_000_000) * COST_PER_1M_TOKENS_USD;
    const summaryCost   = (summaryTokens / 1_000_000) * COST_PER_1M_TOKENS_USD;
    const baseCost      = (totalTokens   / 1_000_000) * COST_PER_1M_TOKENS_USD;
    const finalCost     = baseCost * INFRA_BUFFER;
    const recommendedPrice = finalCost * PRICE_MULTIPLIER;
    return { totalTokens, chatTokens, summaryTokens, chatCost, summaryCost, baseCost, finalCost, recommendedPrice };
  })();

  useEffect(() => {
    if (!editing) setCustomPrice(parseFloat(calc.recommendedPrice.toFixed(2)));
  }, [messages, chatTokenMod, sumTokenMod]);

  const margin      = customPrice - calc.finalCost;
  const profitPct   = calc.finalCost > 0 ? ((margin / calc.finalCost) * 100).toFixed(1) : "0";
  const isValid     = name.trim() && messages > 0 && customPrice > 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      totalMessages: messages,
      totalTokens: calc.totalTokens,
      estimatedCost: calc.finalCost,
      sellingPrice: customPrice,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div className="flex min-h-full items-start justify-center px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">{editing ? "Edit Plan" : "Create Plan"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Basic inputs */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Plan Name <span className="text-red-400">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Starter, Growth, Enterprise"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder="Describe who this plan is for..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:bg-white resize-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Total Messages <span className="text-red-400">*</span></label>
              <input type="number" min={1} value={messages || ""} onChange={e => setMessages(parseInt(e.target.value) || 0)}
                placeholder="e.g. 1000"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
            </div>
            <div className="flex items-end">
              <button type="button" onClick={() => setAdvanced(v => !v)}
                className={["flex items-center gap-2 h-9 rounded-lg border px-3 text-xs font-medium transition w-full justify-center",
                  advanced ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"].join(" ")}>
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="4" r="1.5"/><circle cx="12" cy="12" r="1.5"/>
                  <path d="M4 6.5V2M4 9.5V14M8 2.5V2M8 5.5V14M12 10.5V2M12 13.5V14"/>
                </svg>
                Advanced Mode {advanced ? "On" : "Off"}
              </button>
            </div>
          </div>

          {/* Advanced mode */}
          {advanced && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Token Assumptions per Message</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Chat tokens</label>
                  <input type="number" value={chatTokenMod} onChange={e => setChatTokenMod(parseInt(e.target.value) || 0)}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Summary tokens</label>
                  <input type="number" value={sumTokenMod} onChange={e => setSumTokenMod(parseInt(e.target.value) || 0)}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">Total per message: <strong>{totalPerMsg}</strong> tokens</p>
            </div>
          )}

          {/* Calculation breakdown */}
          {messages > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Cost Breakdown</p>
                <div className="group relative">
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-slate-400 cursor-help" fill="currentColor">
                    <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm9 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.92 6.085c.081-.16.19-.299.34-.398.145-.097.371-.187.74-.187.28 0 .553.087.738.225A.613.613 0 0 1 9 6.25c0 .177-.04.264-.077.318a.956.956 0 0 1-.277.245c-.076.051-.158.1-.258.161l-.007.004a7.728 7.728 0 0 0-.313.195 2.416 2.416 0 0 0-.692.661.75.75 0 0 0 1.248.832 1.142 1.142 0 0 1 .292-.283 4.85 4.85 0 0 1 .223-.143c.1-.065.232-.15.369-.25.265-.185.586-.473.741-.895C10.73 6.525 10.75 6.32 10.75 6.25a2.11 2.11 0 0 0-.75-1.62c-.47-.386-1.089-.63-1.75-.63a2.99 2.99 0 0 0-1.803.572 2.34 2.34 0 0 0-.822 1.032.75.75 0 0 0 1.396.554Z"/>
                  </svg>
                  <div className="absolute right-0 bottom-6 hidden group-hover:block w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-[10px] text-slate-500 z-10">
                    Based on ${COST_PER_1M_TOKENS_USD}/1M tokens (≈ ₹{(COST_PER_1M_TOKENS_USD * usdToInr).toFixed(0)}/1M) with {((INFRA_BUFFER-1)*100).toFixed(0)}% infra buffer. Recommended = {PRICE_MULTIPLIER}× final cost.
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {/* Tokens row */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-700">Total Tokens</p>
                    <p className="text-[10px] text-slate-400">{messages.toLocaleString()} msgs × {totalPerMsg} tokens</p>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{formatTokens(calc.totalTokens)}</p>
                </div>
                {/* Chat cost */}
                <div className="px-4 py-3 flex items-center justify-between bg-orange-50/40">
                  <div>
                    <p className="text-xs font-medium text-orange-700">Chat Token Cost</p>
                    <p className="text-[10px] text-orange-400">{formatTokens(calc.chatTokens)} tokens</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-600">{formatUSD(calc.chatCost)}</p>
                    <p className="text-[10px] text-orange-400">{formatINR(calc.chatCost * usdToInr)}</p>
                  </div>
                </div>
                {/* Summary cost */}
                <div className="px-4 py-3 flex items-center justify-between bg-orange-50/40">
                  <div>
                    <p className="text-xs font-medium text-orange-700">AI Summary Cost</p>
                    <p className="text-[10px] text-orange-400">{formatTokens(calc.summaryTokens)} tokens</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-600">{formatUSD(calc.summaryCost)}</p>
                    <p className="text-[10px] text-orange-400">{formatINR(calc.summaryCost * usdToInr)}</p>
                  </div>
                </div>
                {/* Final cost */}
                <div className="px-4 py-3 flex items-center justify-between border-t border-orange-100 bg-orange-50">
                  <div>
                    <p className="text-xs font-semibold text-orange-800">Total Cost (with infra buffer)</p>
                    <p className="text-[10px] text-orange-500">Base {formatUSD(calc.baseCost)} × {INFRA_BUFFER}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-orange-700">{formatUSD(calc.finalCost)}</p>
                    <p className="text-xs text-orange-500">{formatINR(calc.finalCost * usdToInr)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selling price */}
          {messages > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-semibold text-emerald-800">Selling Price (₹) <span className="text-red-400">*</span></label>
                  <p className="text-[10px] text-emerald-600 mb-2">Price is auto-calculated based on usage. You can adjust it.</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-emerald-700">₹</span>
                    <input type="number" min={0.01} step={0.01}
                      value={customPrice || ""}
                      onChange={e => setCustomPrice(parseFloat(e.target.value) || 0)}
                      className="h-10 w-full rounded-lg border border-emerald-200 bg-white pl-7 pr-3 text-sm font-semibold text-emerald-900 outline-none focus:border-emerald-400" />
                  </div>
                </div>
                {customPrice > 0 && calc.finalCost > 0 && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-emerald-600">Margin</p>
                    <p className="text-lg font-bold text-emerald-700">{formatUSD(margin)}</p>
                    <p className="text-[10px] text-emerald-500">{formatINR(margin * usdToInr)}</p>
                    <p className="text-[10px] font-semibold text-emerald-500">{profitPct}% profit</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={!isValid}
            className="flex-1 h-9 rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">
            {editing ? "Update Plan" : "Create Plan"}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SubscriptionPlansPage() {
  const { permissionsLoaded, hasAnyForResource, hasPermission } = useAdmin();
  const [plans,       setPlans]       = useState<Plan[]>([]);
  const [showModal,   setShowModal]   = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [usdToInr,    setUsdToInr]    = useState(FALLBACK_USD_TO_INR);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError,   setRateError]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);

  const token = typeof window !== "undefined" ? localStorage.getItem("chatbot_access_token") : "";
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const canReadPlans = permissionsLoaded ? hasAnyForResource("plans") : false;
  const canWritePlans = permissionsLoaded ? hasPermission("plans:write") : false;
  const canDeletePlans = permissionsLoaded ? hasPermission("plans:delete") : false;

  const fetchPlans = async (bust = false) => {
    if (!canReadPlans) {
      setPlans([]);
      setPlansLoading(false);
      return;
    }
    if (bust) invalidate("plans");
    setPlansLoading(true);
    try {
      const plans = await cachedFetch("plans", () =>
        fetch(`${BASE}/plans`, { headers }).then(r => r.ok ? r.json() : []),
        60_000,
      );
      setPlans(plans);
    } finally { setPlansLoading(false); }
  };

  useEffect(() => {
    if (!permissionsLoaded) return;
    if (canReadPlans) void fetchPlans();
    else setPlansLoading(false);
    setRateLoading(true);
    fetch("https://api.exchangerate-api.com/v4/latest/USD")
      .then(r => r.json())
      .then(d => {
        const rate = d?.rates?.INR;
        if (rate && rate > 0) { setUsdToInr(rate); setRateError(false); }
        else setRateError(true);
      })
      .catch(() => setRateError(true))
      .finally(() => setRateLoading(false));
  }, [permissionsLoaded, canReadPlans]);

  if (!permissionsLoaded) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
      </div>
    );
  }

  if (!canReadPlans) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <svg viewBox="0 0 16 16" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="7" width="10" height="8" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">Access Restricted</p>
          <p className="mt-1 text-xs text-slate-400">Your role does not have plans access.</p>
        </div>
      </div>
    );
  }

  const openCreate = () => { setEditingPlan(null); setShowModal(true); };
  const openEdit   = (p: Plan) => { setEditingPlan(p); setShowModal(true); };

  const handleSave = async (data: Omit<Plan, "id" | "createdAt">) => {
    setSaving(true);
    try {
      const body = {
        ...data,
        chatTokenLimit:    data.totalMessages * 500,
        summaryTokenLimit: data.totalMessages * 300,
        tokensPerMessage:  800,
      };
      if (editingPlan) {
        await fetch(`${BASE}/plans/${editingPlan.id}`, {
          method: "PUT", headers, body: JSON.stringify(body),
        });
      } else {
        await fetch(`${BASE}/plans`, {
          method: "POST", headers, body: JSON.stringify(body),
        });
      }
      await fetchPlans(true);
      setShowModal(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this plan? Users assigned to this plan will keep their current allocation.")) return;
    await fetch(`${BASE}/plans/${id}`, { method: "DELETE", headers });
    await fetchPlans(true);
  };

  const totalRevenue = plans.reduce((s, p) => s + p.sellingPrice, 0);
  const totalCost    = plans.reduce((s, p) => s + p.estimatedCost, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Subscription Plans</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage AI message credit plans with automatic cost estimation.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live exchange rate indicator */}
          <div className={["flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs",
            rateLoading ? "border-slate-200 text-slate-400" :
            rateError   ? "border-amber-200 bg-amber-50 text-amber-600" :
                          "border-emerald-200 bg-emerald-50 text-emerald-700"].join(" ")}>
            <span className={["h-1.5 w-1.5 rounded-full",
              rateLoading ? "bg-slate-300 animate-pulse" :
              rateError   ? "bg-amber-400" : "bg-emerald-500"].join(" ")} />
            {rateLoading ? "Fetching rate..." :
             rateError   ? `Fallback: $1 = ₹${FALLBACK_USD_TO_INR}` :
                           `Live: $1 = ₹${usdToInr.toFixed(2)}`}
          </div>
          <button type="button" onClick={openCreate} disabled={!canWritePlans}
            className="h-8 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">
            + Create Plan
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs text-slate-400">Total Plans</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{plans.length}</p>
        </div>
        <div className="rounded-xl border border-orange-100 bg-orange-50 px-5 py-4">
          <p className="text-xs text-orange-500">Total Cost Exposure</p>
          <p className="text-2xl font-bold text-orange-700 mt-0.5">{formatUSD(totalCost)}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4">
          <p className="text-xs text-emerald-600">Total Revenue Potential</p>
          <p className="text-2xl font-bold text-emerald-700 mt-0.5">{formatUSD(totalRevenue)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {plansLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          </div>
        ) : plans.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-slate-500">No plans yet</p>
            <p className="mt-1 text-xs text-slate-400">Click &quot;+ Create Plan&quot; to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Plan</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Messages</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Token Usage</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-orange-500">Est. Cost</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-emerald-600">Selling Price</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Margin</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.map((plan) => {
                const margin   = plan.sellingPrice - plan.estimatedCost;
                const profitPct = plan.estimatedCost > 0 ? ((margin / plan.estimatedCost) * 100).toFixed(0) : "0";
                return (
                  <tr key={plan.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{plan.name}</p>
                      {plan.description && <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs truncate">{plan.description}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-slate-700">{plan.totalMessages.toLocaleString()}</span>
                      <span className="text-xs text-slate-400 ml-1">msgs</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5">
                        {formatTokens(plan.totalTokens)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-orange-600">{formatUSD(plan.estimatedCost)}</p>
                      <p className="text-[10px] text-orange-400">{formatINR(plan.estimatedCost * usdToInr)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-emerald-600">{formatUSD(plan.sellingPrice)}</p>
                      <p className="text-[10px] text-emerald-400">{formatINR(plan.sellingPrice * usdToInr)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-700">{formatUSD(margin)}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-[10px] text-slate-400">{formatINR(margin * usdToInr)}</p>
                        <span className={["text-[10px] font-bold rounded-full px-1.5 py-0.5",
                          parseFloat(profitPct) >= 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"].join(" ")}>
                          {profitPct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => openEdit(plan)} disabled={!canWritePlans}
                          className="text-xs font-medium text-slate-500 hover:text-slate-800 transition disabled:opacity-50">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(plan.id)} disabled={!canDeletePlans}
                          className="text-xs font-medium text-red-400 hover:text-red-600 transition disabled:opacity-50">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <PlanModal editing={editingPlan} onSave={handleSave} onClose={() => setShowModal(false)} usdToInr={usdToInr} />
      )}
    </div>
  );
}
