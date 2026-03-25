"use client";

import { useEffect, useState } from "react";

import { useAdmin } from "@/components/AdminProvider";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("chatbot_access_token") : "";
  return { Authorization: `Bearer ${token}` };
}

interface KPIs {
  total_agents: number;
  total_documents: number;
  total_conversations: number;
  active_chats: number;
  total_messages: number;
  avg_messages: number;
  last7_conversations: number;
  last30_conversations: number;
  user_messages: number;
  ai_messages: number;
}

interface Plan {
  plan_name: string;
  billing_status: string;
  monthly_message_limit: number;
  used_messages: number;
  remaining_messages: number;
  message_used_pct: number;
  chat_token_limit: number;
  chat_tokens_used: number;
  chat_tokens_remaining: number;
  summary_token_limit: number;
  summary_tokens_used: number;
  summary_tokens_remaining: number;
  total_tokens: number;
  used_tokens: number;
  remaining_tokens: number;
  token_used_pct: number;
  cycle_start_date: string;
  cycle_end_date: string;
  days_remaining: number | null;
  high_usage_warning: boolean;
  expiry_warning: boolean;
}

interface TrendDay {
  date: string;
  label: string;
  value: number;
}

interface AgentsSummary {
  total: number;
  active: number;
  inactive: number;
  most_recent: string | null;
  top_agents: { agent_id: string; name: string; conversations: number }[];
}

interface DashData {
  role: string;
  kpis: KPIs;
  plan: Plan | null;
  trend_14d: TrendDay[];
  peak_hour: string;
  agents_summary: AgentsSummary;
  token_summary?: {
    chat_token_limit: number;
    chat_tokens_used: number;
    chat_tokens_remaining: number;
    summary_token_limit: number;
    summary_tokens_used: number;
    summary_tokens_remaining: number;
    total_tokens: number;
    used_tokens: number;
    remaining_tokens: number;
    token_used_pct: number;
    scope?: string;
  };
}

type ChartSegment = {
  label: string;
  value: number;
  color: string;
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

function TrendBar({ data }: { data: TrendDay[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex h-12 items-end gap-0.5">
      {data.map((d, i) => (
        <div key={d.date} className="group relative flex flex-1 flex-col items-center gap-0.5">
          <div
            className="w-full rounded-sm transition-all duration-200 group-hover:opacity-80"
            style={{
              height: `${Math.max((d.value / max) * 100, d.value > 0 ? 8 : 2)}%`,
              background: d.value > 0 ? `hsl(${220 + (i / data.length) * 20}, 70%, ${50 + (d.value / max) * 15}%)` : "#e2e8f0",
            }}
          />
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
            {d.label}: {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function UsageRing({ pct, warn, size = 64 }: { pct: number; warn: boolean; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  const color = pct >= 90 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#3b82f6";

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

function polarPoint(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarPoint(cx, cy, r, endAngle);
  const end = polarPoint(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function DonutChart({
  segments,
  total,
  centerValue,
  centerLabel,
  size = 220,
  thickness = 28,
  showPercentLabels = false,
}: {
  segments: ChartSegment[];
  total: number;
  centerValue: string;
  centerLabel: string;
  size?: number;
  thickness?: number;
  showPercentLabels?: boolean;
}) {
  const safeTotal = Math.max(total, 1);
  const center = size / 2;
  const radius = (size - thickness) / 2 - 8;
  const labelRadius = radius;
  let currentAngle = 0;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full drop-shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
        {segments.map((segment) => {
          const angle = (segment.value / safeTotal) * 360;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          const midAngle = startAngle + angle / 2;
          const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
          const labelPoint = polarPoint(center, center, labelRadius, midAngle);
          currentAngle = endAngle;

          if (segment.value <= 0) return null;

          return (
            <g key={segment.label}>
              <path
                d={describeArc(center, center, radius, startAngle, endAngle)}
                fill="none"
                stroke={segment.color}
                strokeWidth={thickness}
                strokeLinecap="round"
              />
              {showPercentLabels && pct > 0 && (
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={segment.color === "#cbd5e1" ? "#475569" : "#ffffff"}
                >
                  {pct}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-[24%] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <span className="text-2xl font-semibold tracking-tight text-slate-900">{centerValue}</span>
        <span className="mt-1 px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">{centerLabel}</span>
      </div>
    </div>
  );
}

function StackedBar({
  segments,
  total,
}: {
  segments: ChartSegment[];
  total: number;
}) {
  const safeTotal = Math.max(total, 1);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-full bg-slate-100 p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]">
        <div className="flex h-5 overflow-hidden rounded-full">
          {segments.map((segment) => (
            <div
              key={segment.label}
              className="h-full transition-all duration-500"
              style={{
                width: `${(segment.value / safeTotal) * 100}%`,
                backgroundColor: segment.color,
              }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2.5">
        {segments.map((segment) => {
          const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
          return (
            <div key={segment.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-slate-500">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                {segment.label}
              </span>
              <span className="font-semibold text-slate-900">
                {fmt(segment.value)} <span className="ml-1 text-xs font-medium text-slate-400">{pct}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-5 py-4 transition ${warn ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${warn ? "bg-amber-100" : "bg-slate-100"}`}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        <p className={`mt-0.5 text-2xl font-bold ${warn ? "text-amber-700" : "text-slate-900"}`}>{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ pct, warn }: { pct: number; warn?: boolean }) {
  const color = pct >= 90 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : warn ? "bg-amber-400" : "bg-blue-500";

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold text-slate-800">{children}</h2>;
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-6 w-40 rounded bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 rounded-xl bg-slate-200" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { loading: providerLoading } = useAdmin();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${BASE}/dashboard/full`, { headers: authHeaders() });

        if (res.status === 401) {
          localStorage.removeItem("chatbot_access_token");
          window.location.href = "/login";
          return;
        }

        if (res.status === 403) {
          setError("You do not have permission to view the dashboard.");
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail ?? "Failed to load dashboard");
        }

        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || providerLoading) return <Skeleton />;

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, plan, trend_14d, peak_hour, agents_summary, token_summary } = data;
  const isSuperAdmin = data.role === "super_admin";
  const totalMsgForDist = kpis.user_messages + kpis.ai_messages;
  const userPct = totalMsgForDist ? Math.round((kpis.user_messages / totalMsgForDist) * 100) : 50;
  const aiPct = 100 - userPct;
  const messageSegments: ChartSegment[] = [
    { label: "AI messages", value: kpis.ai_messages, color: "#2563eb" },
    { label: "User messages", value: kpis.user_messages, color: "#94a3b8" },
  ];
  const agentSegments: ChartSegment[] = [
    { label: "Active agents", value: agents_summary.active, color: "#16a34a" },
    { label: "Inactive agents", value: agents_summary.inactive, color: "#cbd5e1" },
  ];
  const tokenSummary = {
    scope: token_summary?.scope ?? (isSuperAdmin ? "system" : "user"),
    totalTokens: token_summary?.total_tokens ?? plan?.total_tokens ?? 0,
    tokenUsedPct: token_summary?.token_used_pct ?? plan?.token_used_pct ?? 0,
    chatTokensUsed: token_summary?.chat_tokens_used ?? plan?.chat_tokens_used ?? 0,
    summaryTokensUsed: token_summary?.summary_tokens_used ?? plan?.summary_tokens_used ?? 0,
    remainingTokens: Math.max(token_summary?.remaining_tokens ?? plan?.remaining_tokens ?? 0, 0),
    chatTokensRemaining: token_summary?.chat_tokens_remaining ?? plan?.chat_tokens_remaining ?? 0,
    summaryTokensRemaining: token_summary?.summary_tokens_remaining ?? plan?.summary_tokens_remaining ?? 0,
  };
  const tokenSegments: ChartSegment[] = [
    { label: "Chat tokens used", value: tokenSummary.chatTokensUsed, color: "#2563eb" },
    { label: "Summary tokens used", value: tokenSummary.summaryTokensUsed, color: "#16a34a" },
    { label: "Remaining tokens", value: tokenSummary.remainingTokens, color: "#cbd5e1" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Aggregated across all agents · {isSuperAdmin ? "Super Admin view" : "Your workspace"}
          </p>
        </div>

        {plan?.high_usage_warning && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <svg viewBox="0 0 16 16" className="h-4 w-4 flex-shrink-0 text-amber-500" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3.5c.4 0 .75.35.75.75v3.5a.75.75 0 0 1-1.5 0v-3.5c0-.4.35-.75.75-.75ZM8 11a.875.875 0 1 1 0 1.75A.875.875 0 0 1 8 11Z" />
            </svg>
            <p className="text-xs font-medium text-amber-700">High usage - {plan.message_used_pct}% of messages used</p>
          </div>
        )}

        {plan?.expiry_warning && !plan.high_usage_warning && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <svg viewBox="0 0 16 16" className="h-4 w-4 flex-shrink-0 text-red-500" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3.5c.4 0 .75.35.75.75v3.5a.75.75 0 0 1-1.5 0v-3.5c0-.4.35-.75.75-.75ZM8 11a.875.875 0 1 1 0 1.75A.875.875 0 0 1 8 11Z" />
            </svg>
            <p className="text-xs font-medium text-red-700">
              Plan expires in {plan.days_remaining} day{plan.days_remaining !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={
            <svg viewBox="0 0 16 16" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M14 10a2 2 0 0 1-2 2H4l-3 3V3a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v7Z" />
            </svg>
          }
          label="Total Conversations"
          value={fmt(kpis.total_conversations)}
          sub={`${kpis.last7_conversations} this week`}
        />
        <KpiCard
          icon={
            <svg viewBox="0 0 16 16" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3.5l2 2" />
            </svg>
          }
          label="Total Messages"
          value={fmt(kpis.total_messages)}
          sub={`avg ${kpis.avg_messages} per chat`}
        />
        <KpiCard
          icon={
            <svg viewBox="0 0 16 16" className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3h3" />
            </svg>
          }
          label="Active Chats"
          value={fmt(kpis.active_chats)}
          sub="in last 30 min"
          warn={kpis.active_chats > 0}
        />
        <KpiCard
          icon={
            <svg viewBox="0 0 16 16" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 12 6 7l3 3 5-6" />
            </svg>
          }
          label="Total Messages Used"
          value={plan ? `${fmt(plan.used_messages)} / ${fmt(plan.monthly_message_limit)}` : fmt(kpis.total_messages)}
          sub={plan ? `${plan.message_used_pct}% used` : undefined}
          warn={plan ? plan.message_used_pct >= 80 : false}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {plan ? (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active Plan</p>
                <p className="mt-0.5 text-lg font-bold text-slate-900">{plan.plan_name}</p>
                <span
                  className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    plan.billing_status === "active"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : plan.billing_status === "paused"
                        ? "border border-amber-200 bg-amber-50 text-amber-700"
                        : "border border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {plan.billing_status}
                </span>
              </div>
              <div className="relative flex-shrink-0">
                <UsageRing pct={plan.message_used_pct} warn={plan.high_usage_warning} size={56} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-700">{plan.message_used_pct}%</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Messages</span>
                  <span>
                    {fmt(plan.used_messages)} / {fmt(plan.monthly_message_limit)}
                  </span>
                </div>
                <ProgressBar pct={plan.message_used_pct} warn={plan.message_used_pct >= 80} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Chat tokens</span>
                  <span>
                    {fmt(plan.chat_tokens_used)} / {fmt(plan.chat_token_limit)}
                  </span>
                </div>
                <ProgressBar pct={plan.chat_token_limit ? (plan.chat_tokens_used / plan.chat_token_limit) * 100 : 0} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Summary tokens</span>
                  <span>
                    {fmt(plan.summary_tokens_used)} / {fmt(plan.summary_token_limit)}
                  </span>
                </div>
                <ProgressBar pct={plan.summary_token_limit ? (plan.summary_tokens_used / plan.summary_token_limit) * 100 : 0} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
              <div>
                <p className="text-[10px] text-slate-400">Cycle ends</p>
                <p className={`mt-0.5 text-xs font-semibold ${plan.expiry_warning ? "text-red-600" : "text-slate-700"}`}>
                  {fmtDate(plan.cycle_end_date)}
                  {plan.days_remaining !== null && <span className="ml-1.5 font-normal text-slate-400">({plan.days_remaining}d left)</span>}
                </p>
              </div>
              {(plan.high_usage_warning || plan.expiry_warning) && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">Upgrade</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-5 lg:col-span-2">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">No active plan</p>
              <p className="mt-1 text-xs text-slate-400">Contact admin to assign a subscription.</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-3">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <SectionTitle>14-day Activity Trend</SectionTitle>
              <p className="-mt-2 text-xs text-slate-400">Conversations per day across all agents</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-[10px] text-slate-400">Peak hour</p>
              <p className="text-xs font-semibold text-slate-700">{peak_hour}</p>
            </div>
          </div>
          <TrendBar data={trend_14d} />
          <div className="mt-2 flex justify-between">
            <span className="text-[10px] text-slate-400">{trend_14d[0]?.label}</span>
            <span className="text-[10px] text-slate-400">{trend_14d[trend_14d.length - 1]?.label}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <SectionTitle>Chat & Conversation Insights</SectionTitle>
          <div className="space-y-5">
            <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 px-4 py-5">
              <DonutChart
                segments={messageSegments}
                total={Math.max(totalMsgForDist, 1)}
                centerValue={fmt(kpis.total_messages)}
                centerLabel="total messages"
                showPercentLabels
              />
              <div className="mt-4 flex items-center justify-center gap-5 text-sm text-slate-500">
                {messageSegments.map((segment) => (
                  <span key={segment.label} className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                    {segment.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2 rounded-[20px] border border-slate-100 bg-white px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
              {[
                { label: "Total Conversations", value: fmt(kpis.total_conversations) },
                { label: "User Messages", value: fmt(kpis.user_messages) },
                { label: "AI Messages", value: fmt(kpis.ai_messages) },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                  <span className="text-sm text-slate-500">{item.label}</span>
                  <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <SectionTitle>Agents Summary</SectionTitle>
          <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total", value: agents_summary.total },
              { label: "Active", value: agents_summary.active },
              { label: "Inactive", value: agents_summary.inactive },
            ].map((s) => (
              <div key={s.label} className="rounded-[18px] border border-slate-100 bg-slate-50 px-3 py-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">{s.label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>
          {agents_summary.most_recent && (
            <div className="rounded-[18px] border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[10px] text-slate-400">Most recently active</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">{agents_summary.most_recent}</p>
            </div>
          )}
            <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">Active vs inactive distribution</p>
                <p className="text-xs font-medium text-slate-400">{agents_summary.total} total</p>
              </div>
              <StackedBar total={Math.max(agents_summary.total, 1)} segments={agentSegments} />
            </div>
          {agents_summary.top_agents.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-slate-500">Top agents by conversations</p>
              <div className="space-y-1.5">
                {agents_summary.top_agents.map((a, i) => {
                  const maxConvs = agents_summary.top_agents[0].conversations;
                  return (
                    <div key={a.agent_id} className="flex items-center gap-2">
                      <span className="w-3 text-[10px] font-bold text-slate-400">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="truncate text-[11px] font-medium text-slate-700">{a.name}</span>
                          <span className="ml-2 flex-shrink-0 text-[10px] text-slate-400">{a.conversations}</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-slate-100">
                          <div className="h-1 rounded-full bg-blue-400" style={{ width: `${(a.conversations / maxConvs) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <SectionTitle>Token Summary</SectionTitle>
          <div className="space-y-5">
            <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Token allocation</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{fmt(tokenSummary.totalTokens)}</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {tokenSummary.tokenUsedPct}% used
                </div>
              </div>
              <StackedBar total={Math.max(tokenSummary.totalTokens, 1)} segments={tokenSegments} />
              {tokenSummary.scope === "user" && !plan && tokenSummary.totalTokens === 0 && (
                <p className="mt-3 text-xs text-slate-400">No active plan assigned yet. Token capacity will appear here once a subscription is available.</p>
              )}
              {tokenSummary.scope === "system" && tokenSummary.totalTokens === 0 && (
                <p className="mt-3 text-xs text-slate-400">No system token credits have been assigned yet.</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "Chat used", value: fmt(tokenSummary.chatTokensUsed), tone: "bg-blue-50 text-blue-700 border-blue-100" },
                { label: "Summary used", value: fmt(tokenSummary.summaryTokensUsed), tone: "bg-emerald-50 text-emerald-700 border-emerald-100" },
                { label: "Remaining tokens", value: fmt(tokenSummary.remainingTokens), tone: "bg-slate-50 text-slate-700 border-slate-200" },
              ].map((item) => (
                <div key={item.label} className={`rounded-[18px] border px-4 py-3 ${item.tone}`}>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em]">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[18px] border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] text-slate-400">Chat remaining</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{fmt(tokenSummary.chatTokensRemaining)}</p>
              </div>
              <div className="rounded-[18px] border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] text-slate-400">Summary remaining</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{fmt(tokenSummary.summaryTokensRemaining)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
