"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAdmin } from "@/components/AdminProvider";
import { getConversations } from "@/lib/api";
import { cachedFetch } from "@/lib/client-cache";
import { ConversationSummary } from "@/lib/types";
import dynamic from "next/dynamic";

// Lazy-load recharts — it's ~200 KB and not needed until the chart renders
const ReBarChart      = dynamic(() => import("recharts").then(m => ({ default: m.BarChart })),      { ssr: false });
const Bar             = dynamic(() => import("recharts").then(m => ({ default: m.Bar })),             { ssr: false });
const XAxis           = dynamic(() => import("recharts").then(m => ({ default: m.XAxis })),           { ssr: false });
const YAxis           = dynamic(() => import("recharts").then(m => ({ default: m.YAxis })),           { ssr: false });
const CartesianGrid   = dynamic(() => import("recharts").then(m => ({ default: m.CartesianGrid })),   { ssr: false });
const Tooltip         = dynamic(() => import("recharts").then(m => ({ default: m.Tooltip })),         { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => ({ default: m.ResponsiveContainer })), { ssr: false });

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));
}
function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "is","it","i","you","we","they","what","how","do","does","can","would",
  "are","was","be","have","has","that","this","my","your","our","me","hi",
  "hello","hey","ok","okay","yes","no","please","thanks","thank","about",
  "tell","me","more","any","there","will","get","need","want","know","like",
]);
function extractTopics(conversations: ConversationSummary[]): { word: string; count: number }[] {
  const freq: Record<string, number> = {};
  conversations.forEach((c) => {
    const words = c.title.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    words.forEach((w) => { if (!STOP_WORDS.has(w)) freq[w] = (freq[w] || 0) + 1; });
  });
  return Object.entries(freq).map(([word, count]) => ({ word, count })).sort((a,b) => b.count - a.count).slice(0, 12);
}

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 flex items-start gap-3">
      <div className="mt-0.5 h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <ReBarChart data={data} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,.08)" }}
          cursor={{ fill: "#f8fafc" }}
        />
        <Bar dataKey="value" fill="#0f172a" radius={[4, 4, 0, 0]} name="Conversations" />
      </ReBarChart>
    </ResponsiveContainer>
  );
}

type Tab = "overview" | "topics" | "chats";

export default function AnalyticsPage() {
  const { agentId }  = useParams<{ agentId: string }>();
  const { addToast } = useAdmin();
  const [conversations,  setConversations]  = useState<ConversationSummary[]>([]);
  const [analyticsData,  setAnalyticsData]  = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [subscription,   setSubscription]   = useState<any>(null);
  const [loading,        setLoading]        = useState(true);
  const [activeTab,      setActiveTab]      = useState<Tab>("overview");

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("chatbot_access_token") : "";
    const base  = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";
    Promise.all([
      cachedFetch(`conversations:${agentId}`, () => getConversations(agentId), 30_000),
      cachedFetch(`analytics:${agentId}`,     () => fetch(`${base}/agents/${agentId}/analytics`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null), 60_000),
      cachedFetch(`subscription:me`,          () => fetch(`${base}/users/me/subscription`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null), 120_000),
    ])
      .then(([convs, analytics, subData]) => {
        setConversations(convs);
        setAnalyticsData(analytics);
        setSubscription(subData?.subscription ?? null);
      })
      .catch(() => addToast({ title: "Failed to load analytics", variant: "error" }))
      .finally(() => setLoading(false));
  }, [agentId]);

  const totalConversations = conversations.length;
  const totalMessages      = conversations.reduce((s, c) => s + (c.message_count ?? 0), 0);
  const avgMessages        = totalConversations ? Math.round(totalMessages / totalConversations) : 0;
  const today = new Date();
  const last7 = conversations.filter((c) => (today.getTime() - new Date(c.updated_at).getTime()) / 86400000 < 7).length;
  const last14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - (13 - i)); return dayKey(d.toISOString()); });
  const convByDay = last14.map((key) => ({ label: formatDate(key + "T00:00:00"), value: conversations.filter((c) => dayKey(c.updated_at) === key).length }));
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const convByWeekday = dayNames.map((name, i) => ({ label: name, value: conversations.filter((c) => new Date(c.updated_at).getDay() === i).length }));
  const hourCounts = Array(24).fill(0);
  conversations.forEach((c) => { hourCounts[new Date(c.updated_at).getHours()]++; });
  const busiestHour = hourCounts.indexOf(Math.max(...hourCounts));
  const busiestHourLabel = busiestHour === 0 ? "12 AM" : busiestHour < 12 ? `${busiestHour} AM` : busiestHour === 12 ? "12 PM" : `${busiestHour-12} PM`;
  const topics = extractTopics(conversations);
  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "topics",   label: "Topics" },
    { id: "chats",    label: "Chats" },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-base font-semibold text-slate-900">Analytics</h1>
        <p className="text-xs text-slate-400 mt-0.5">Track performance and discover insights from your agent conversations.</p>
      </div>

      <div className="flex border-b border-slate-200">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={["px-4 py-2.5 text-sm font-medium border-b-2 transition", activeTab === tab.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-700"].join(" ")}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW ══ */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* ── Plan messages stat cards ── */}
          {subscription && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Messages Used"
                value={Math.round(subscription.used_messages ?? 0)}
                sub={`of ${(subscription.monthly_message_limit ?? 0).toLocaleString()} limit`}
                icon={<svg viewBox="0 0 16 16" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 1v6l3 3"/><circle cx="8" cy="8" r="7"/></svg>}
              />
              <StatCard
                label="Messages Remaining"
                value={Math.round(subscription.remaining_messages ?? 0)}
                sub={`${(((subscription.used_messages ?? 0) / (subscription.monthly_message_limit || 1)) * 100).toFixed(1)}% used`}
                icon={<svg viewBox="0 0 16 16" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 8h12M8 2l6 6-6 6"/></svg>}
              />
              <StatCard
                label="Chat Tokens Used"
                value={((subscription.chat_tokens_used ?? 0) / 1000).toFixed(1) + "K"}
                sub={`of ${((subscription.chat_token_limit ?? 0) / 1000).toFixed(0)}K limit`}
                icon={<svg viewBox="0 0 16 16" className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12M2 8h8M2 12h5"/></svg>}
              />
              <StatCard
                label="Summary Tokens Used"
                value={((subscription.summary_tokens_used ?? 0) / 1000).toFixed(1) + "K"}
                sub={`of ${((subscription.summary_token_limit ?? 0) / 1000).toFixed(0)}K limit`}
                icon={<svg viewBox="0 0 16 16" className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M5 6h6M5 10h4"/></svg>}
              />
            </div>
          )}

          {/* ── Plan usage ── */}
          {subscription && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Plan Usage</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {subscription.plan_name} · Renews {new Date(subscription.cycle_end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className="text-xs font-medium bg-slate-100 text-slate-600 rounded-full px-2.5 py-1">
                  {Math.round(subscription.remaining_messages ?? 0)} msgs left
                </span>
              </div>

              <div className="space-y-4">
                {/* Messages used */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-700">Messages Used</span>
                    <span className="text-slate-500">
                      {(Math.round(subscription.used_messages ?? 0)).toLocaleString()} / {(subscription.monthly_message_limit ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div className={["h-2 rounded-full transition-all duration-700",
                      ((subscription.used_messages ?? 0) / (subscription.monthly_message_limit || 1)) > 0.9 ? "bg-red-500" :
                      ((subscription.used_messages ?? 0) / (subscription.monthly_message_limit || 1)) > 0.7 ? "bg-amber-500" : "bg-slate-800"
                    ].join(" ")}
                      style={{ width: `${Math.min(((subscription.used_messages ?? 0) / (subscription.monthly_message_limit || 1)) * 100, 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {(((subscription.used_messages ?? 0) / (subscription.monthly_message_limit || 1)) * 100).toFixed(1)}% of monthly limit used
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Chat tokens */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-700">Chat Tokens</span>
                      <span className="text-slate-500">{(subscription.chat_tokens_used ?? 0).toLocaleString()} used</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-blue-500 transition-all duration-700"
                        style={{ width: `${Math.min(((subscription.chat_tokens_used ?? 0) / (subscription.chat_token_limit ?? 1)) * 100, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{(subscription.chat_tokens_remaining ?? 0).toLocaleString()} remaining</p>
                  </div>

                  {/* Summary tokens */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-700">Summary Tokens</span>
                      <span className="text-slate-500">{(subscription.summary_tokens_used ?? 0).toLocaleString()} used</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-amber-500 transition-all duration-700"
                        style={{ width: `${Math.min(((subscription.summary_tokens_used ?? 0) / (subscription.summary_token_limit ?? 1)) * 100, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{(subscription.summary_tokens_remaining ?? 0).toLocaleString()} remaining</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-800 mb-4">Conversations — Last 14 Days</p>
              {totalConversations ? <BarChart data={convByDay} /> : <div className="flex h-32 items-center justify-center text-sm text-slate-400">No data yet</div>}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-800 mb-4">By Day of Week</p>
              {totalConversations ? <BarChart data={convByWeekday} /> : <div className="flex h-32 items-center justify-center text-sm text-slate-400">No data yet</div>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-800 mb-4">Insights</p>
            {totalConversations === 0 ? (
              <p className="text-sm text-slate-400">No conversations yet. Start chatting to see insights.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3.5">
                  <p className="text-xs text-slate-400">Busiest Hour</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{busiestHourLabel}</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3.5">
                  <p className="text-xs text-slate-400">Most Active Day</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{[...convByWeekday].sort((a,b) => b.value - a.value)[0]?.label ?? "—"}</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3.5">
                  <p className="text-xs text-slate-400">Avg Session Length</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{avgMessages} message{avgMessages !== 1 ? "s" : ""}</p>
                </div>
              </div>
            )}
          </div>

          {analyticsData && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Response Coverage</p>
                  <p className="text-xs text-slate-400 mt-0.5">How often the bot answered vs said it didn&apos;t know.</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{100 - (analyticsData.fallback_rate ?? 0)}%</p>
                  <p className="text-xs text-slate-400">answered from context</p>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${100 - (analyticsData.fallback_rate ?? 0)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>✅ Answered: {100 - (analyticsData.fallback_rate ?? 0)}%</span>
                <span>❌ Fallback: {analyticsData.fallback_rate ?? 0}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TOPICS ══ */}
      {activeTab === "topics" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-800 mb-1">Most Discussed Topics</p>
            <p className="text-xs text-slate-400 mt-0.5 mb-4">Discover key themes and interests from user conversations.</p>
            {topics.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-400">No topics yet — start chatting.</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {topics.map((t, i) => {
                    const sizes = ["text-2xl font-bold","text-xl font-semibold","text-lg font-semibold","text-base font-medium","text-sm font-medium","text-xs font-medium"];
                    return (
                      <span key={t.word} className={`${sizes[Math.min(i, sizes.length-1)]} text-slate-900 rounded-lg bg-slate-50 border border-slate-100 px-3 py-1.5`}
                        style={{ opacity: Math.max(1 - i * 0.06, 0.4) }} title={`${t.count} conversation${t.count !== 1 ? "s" : ""}`}>
                        {t.word}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-6 space-y-2.5">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Frequency</p>
                  {topics.slice(0, 8).map((t) => (
                    <div key={t.word} className="flex items-center gap-3">
                      <span className="w-24 text-sm text-slate-700 font-medium capitalize truncate">{t.word}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${Math.round((t.count / topics[0].count) * 100)}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs text-slate-400">{t.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {analyticsData?.starting_questions?.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-800 mb-1">Most Common Starting Questions</p>
              <p className="text-xs text-slate-400 mb-4">The most frequent first messages users send.</p>
              <div className="space-y-2">
                {analyticsData.starting_questions.map((q: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                    <span className="h-5 w-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-center flex-shrink-0">{i+1}</span>
                    <p className="flex-1 text-sm text-slate-700 truncate">{q.question}</p>
                    <span className="flex-shrink-0 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">{q.count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
            <div className="flex items-start gap-2.5 mb-4">
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 11h.01"/>
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">Unanswered Questions</p>
                <p className="text-xs text-amber-600 mt-0.5">Questions the bot couldn&apos;t answer — add these to your knowledge base.</p>
              </div>
              {analyticsData?.fallback_count > 0 && (
                <span className="ml-auto flex-shrink-0 text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2.5 py-0.5">{analyticsData.fallback_count} total</span>
              )}
            </div>
            {analyticsData?.unanswered_questions?.length > 0 ? (
              <div className="space-y-2">
                {analyticsData.unanswered_questions.map((q: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-white border border-amber-100 px-3 py-2.5">
                    <p className="flex-1 text-sm text-slate-700">{q.question}</p>
                    {q.count > 1 && <span className="flex-shrink-0 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">{q.count}× asked</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-amber-600 text-center py-3">
                {analyticsData ? "🎉 No unanswered questions yet!" : "No data yet — start chatting."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══ CHATS ══ */}
      {activeTab === "chats" && (
        <div className="space-y-5">

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Conversations" value={totalConversations} icon={<svg viewBox="0 0 16 16" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 10a2 2 0 0 1-2 2H4l-3 3V3a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v7Z"/></svg>} />
            <StatCard label="Total Messages" value={totalMessages} icon={<svg viewBox="0 0 16 16" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 2"/></svg>} />
            <StatCard label="Avg Messages / Chat" value={avgMessages} sub="per conversation" icon={<svg viewBox="0 0 16 16" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 12 6 7l3 3 5-6"/></svg>} />
            <StatCard label="Last 7 Days" value={last7} sub="new conversations" icon={<svg viewBox="0 0 16 16" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M5 1v2M11 1v2M2 7h12"/></svg>} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-800 mb-1">Conversation Tracker</p>
            <p className="text-xs text-slate-400 mt-0.5 mb-4">Track all conversations to monitor AI agent performance and identify improvement areas.</p>
            <div className="grid grid-cols-3 gap-3">
              {[{ label: "Total", value: totalConversations }, { label: "This Week", value: last7 }, { label: "Avg Length", value: `${avgMessages} msgs` }].map((s) => (
                <div key={s.label} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 text-center">
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">All Conversations</p>
              <p className="text-xs text-slate-400">{totalConversations} total</p>
            </div>
            {conversations.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-slate-500">No conversations yet.</p>
                <p className="mt-1 text-xs text-slate-400">Conversations will appear here once users start chatting.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {conversations.map((c) => {
                  const msgCount = c.message_count ?? 0;
                  const quality = msgCount >= 6 ? "High" : msgCount >= 3 ? "Medium" : "Short";
                  const qColor  = msgCount >= 6 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : msgCount >= 3 ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-slate-50 text-slate-500 border-slate-100";
                  return (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition">
                      <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM2 14a6 6 0 0 1 12 0"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{c.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(c.updated_at)}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-slate-400">{msgCount} msg{msgCount !== 1 ? "s" : ""}</span>
                        <span className={`text-[10px] font-medium rounded-full border px-2 py-0.5 ${qColor}`}>{quality}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}