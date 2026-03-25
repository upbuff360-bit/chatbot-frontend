"use client";

import { useEffect, useRef, useState } from "react";
import { useAdmin } from "@/components/AdminProvider";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";
function authHeaders(extra: Record<string, string> = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("chatbot_access_token") ?? "" : "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...extra };
}

// ── Types ──────────────────────────────────────────────────────────────────
interface UserProfile {
  id: string; email: string; name: string; role: string;
  phone?: string; address?: string; avatar?: string;
  plan: string; created_at: string; tenant_id: string;
  subscription?: {
    plan_name: string; billing_status: string;
    monthly_message_limit: number; used_messages: number; remaining_messages: number;
    chat_token_limit: number; chat_tokens_used: number; chat_tokens_remaining: number;
    summary_token_limit: number; summary_tokens_used: number; summary_tokens_remaining: number;
    cycle_end_date: string; days_remaining?: number;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return s; }
}
function initials(name: string, email: string) {
  const n = name || email;
  const parts = n.split(/[\s@]/);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}
// Colour palette cycles through these for any role key — no hardcoding needed.
// System roles get consistent colours; custom roles get one from the palette.
const ROLE_PALETTE = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-cyan-50 text-cyan-700 border-cyan-200",
  "bg-orange-50 text-orange-700 border-orange-200",
];

function roleBadgeClass(roleKey: string): string {
  // Super admin always purple
  if (roleKey === "super_admin") return "bg-purple-50 text-purple-700 border-purple-200";
  // Derive a stable index from the key string so the same key always gets the same colour
  const idx = roleKey.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % ROLE_PALETTE.length;
  return ROLE_PALETTE[idx];
}

// ── Progress bar ───────────────────────────────────────────────────────────
function Bar({ used, total, warn }: { used: number; total: number; warn?: boolean }) {
  const pct = total ? Math.min(Math.round(used / total * 100), 100) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-blue-500";
  return (
    <div>
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Field ──────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLS = "h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed";

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-6 w-36 rounded bg-slate-200" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="h-96 rounded-xl bg-slate-200" />
        <div className="lg:col-span-2 h-96 rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { addToast } = useAdmin();
  const [profile,  setProfile]  = useState<UserProfile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [roleDisplayName, setRoleDisplayName] = useState("");


  // Editable fields
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [address, setAddress] = useState("");
  const [avatar,  setAvatar]  = useState("");   // base64 data-url
  const [avatarPreview, setAvatarPreview] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  // Load profile
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${BASE}/users/me`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Failed to load profile");
        const data: UserProfile = await res.json();
        setProfile(data);
        setName(data.name    ?? "");
        setPhone(data.phone  ?? "");
        setAddress(data.address ?? "");
        setAvatar(data.avatar   ?? "");
        setAvatarPreview(data.avatar ?? "");
        setRoleDisplayName(data.role?.replace(/_/g, " ") ?? "");
      } catch (e) {
        addToast({ title: "Failed to load profile", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200_000) {
      addToast({ title: "Image too large", description: "Image must be under 200 KB.", variant: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setAvatar(result);
      setAvatarPreview(result);
    };
    reader.readAsDataURL(file);
    // reset input so same file can be re-selected
    e.target.value = "";
  };

  const removeAvatar = () => {
    setAvatar("");
    setAvatarPreview("");
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/users/me`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), address: address.trim(), avatar }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Save failed.");
      }
      const updated: UserProfile = await res.json();
      setProfile(updated);
      addToast({ title: "Profile updated", description: "Your changes have been saved." });
    } catch (e) {
      addToast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton />;

  const sub = profile?.subscription;
  const daysLeft = sub?.cycle_end_date
    ? Math.ceil((new Date(sub.cycle_end_date).getTime() - Date.now()) / 86400000)
    : null;

  const msgPct   = sub ? Math.round(sub.used_messages / Math.max(sub.monthly_message_limit, 1) * 100) : 0;
  const chatPct  = sub ? Math.round(sub.chat_tokens_used / Math.max(sub.chat_token_limit, 1) * 100) : 0;
  const sumPct   = sub ? Math.round(sub.summary_tokens_used / Math.max(sub.summary_token_limit, 1) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-base font-semibold text-slate-900">Profile</h1>
        <p className="mt-0.5 text-xs text-slate-400">Manage your account details and view your plan usage.</p>
      </div>

      {/* Alerts */}


      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* ── Left: Plan Details ── */}
        <div className="space-y-4">

          {/* Plan card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Plan</p>
                <p className="mt-0.5 text-lg font-bold text-slate-900">{sub?.plan_name ?? profile?.plan ?? "Free"}</p>
              </div>
              {sub && (
                <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border ${
                  sub.billing_status === "active"  ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  sub.billing_status === "paused"  ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                     "bg-red-50 text-red-600 border-red-100"
                }`}>{sub.billing_status}</span>
              )}
            </div>

            {sub ? (
              <div className="space-y-3.5">
                {/* Messages */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Messages</span>
                    <span>{fmt(sub.used_messages)} / {fmt(sub.monthly_message_limit)}</span>
                  </div>
                  <Bar used={sub.used_messages} total={sub.monthly_message_limit} />
                  <p className="text-[10px] text-slate-400 mt-0.5">{fmt(sub.remaining_messages)} remaining</p>
                </div>
                {/* Chat tokens */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Chat tokens</span>
                    <span>{fmt(sub.chat_tokens_used)} / {fmt(sub.chat_token_limit)}</span>
                  </div>
                  <Bar used={sub.chat_tokens_used} total={sub.chat_token_limit} />
                </div>
                {/* Summary tokens */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Summary tokens</span>
                    <span>{fmt(sub.summary_tokens_used)} / {fmt(sub.summary_token_limit)}</span>
                  </div>
                  <Bar used={sub.summary_tokens_used} total={sub.summary_token_limit} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No active subscription. Contact your admin to get a plan assigned.</p>
            )}

            {sub?.cycle_end_date && (
              <div className={`rounded-lg px-3 py-2.5 border text-xs ${
                daysLeft !== null && daysLeft <= 7
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-slate-50 border-slate-100 text-slate-600"
              }`}>
                <p className="font-medium">Cycle ends {fmtDate(sub.cycle_end_date)}</p>
                {daysLeft !== null && (
                  <p className="mt-0.5 text-[11px] opacity-75">
                    {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining` : "Expired"}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Account info */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Account</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Role</span>
                <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border ${roleBadgeClass(profile?.role ?? "")}`}>
                  {(roleDisplayName || profile?.role || "").replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Member since</span>
                <span className="text-xs text-slate-700">{profile?.created_at ? fmtDate(profile.created_at) : "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-slate-500 flex-shrink-0">Workspace</span>
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">{profile?.tenant_id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Profile edit ── */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">

          {/* Avatar section */}
          <div className="border-b border-slate-100 px-6 py-5 flex items-center gap-5">
            {/* Avatar display */}
            <div className="relative flex-shrink-0">
              <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-slate-200 bg-slate-100 flex items-center justify-center">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-slate-500 select-none">
                    {initials(name || profile?.name || "", profile?.email || "")}
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">{name || profile?.name || "—"}</p>
              <p className="text-xs text-slate-400 mt-0.5">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="h-7 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition flex items-center gap-1.5"
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2M8 2v8M5 5l3-3 3 3"/>
                  </svg>
                  Upload photo
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="h-7 px-3 rounded-lg border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 transition"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">PNG, JPG or WebP · max 200 KB</p>
            </div>
          </div>

          {/* Form fields */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Personal information</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Display name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Email address">
                <input
                  value={profile?.email ?? ""}
                  disabled
                  className={INPUT_CLS}
                  title="Email cannot be changed here. Contact your admin."
                />
              </Field>
              <Field label="Phone number">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  type="tel"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Role">
                <input value={(roleDisplayName || profile?.role || "").replace("_", " ")} disabled className={INPUT_CLS} />
              </Field>
            </div>

            <Field label="Contact address">
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city, state, country"
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white resize-none"
              />
            </Field>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setName(profile?.name ?? "");
                setPhone(profile?.phone ?? "");
                setAddress(profile?.address ?? "");
                setAvatar(profile?.avatar ?? "");
                setAvatarPreview(profile?.avatar ?? "");
              }}
              className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-5 rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5"/>
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              )}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
