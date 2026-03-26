"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/components/AdminProvider";
import { cachedFetch, invalidate } from "@/lib/client-cache";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("chatbot_access_token") : "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}


interface Plan {
  id: string;
  name: string;
  totalMessages: number;
  sellingPrice: number;
}

interface Subscription {
  plan_name: string;
  monthly_message_limit: number;
  remaining_messages: number;
  used_messages: number;
  chat_tokens_remaining: number;
  summary_tokens_remaining: number;
  cycle_start_date: string;
  cycle_end_date: string;
}

interface User {
  id: string;
  email: string;
  role: string;
  plan: string;
  tenant_id: string;
  created_at: string;
  subscription?: Subscription;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

function RoleBadge({ role, availableRoles }: {
  role: string;
  availableRoles: { key: string; name: string }[];
}) {
  // Resolve display name from availableRoles using the stable key.
  // Falls back to title-casing the raw key if no match found.
  const displayName = availableRoles.find(r => r.key === role)?.name
    ?? role.replace(/_/g, " ").replace(/\w/g, c => c.toUpperCase());

  // Derive colour from a hash of the key so it's stable even after renaming.
  const PALETTE = [
    "bg-purple-50 text-purple-700 border-purple-200",
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-emerald-50 text-emerald-700 border-emerald-200",
    "bg-amber-50 text-amber-700 border-amber-200",
    "bg-rose-50 text-rose-700 border-rose-200",
    "bg-cyan-50 text-cyan-700 border-cyan-200",
    "bg-slate-50 text-slate-600 border-slate-200",
  ];
  const colour = role === "super_admin"
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : PALETTE[role.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length];

  return (
    <span className={`text-[10px] font-semibold rounded-full border px-2 py-0.5 ${colour}`}>
      {displayName}
    </span>
  );
}

export default function UsersPage() {
  const { addToast, permissionsLoaded, hasAnyForResource, hasPermission } = useAdmin();

  const [users,        setUsers]        = useState<User[]>([]);
  const [loading,       setLoading]      = useState(true);
  const [refreshing,    setRefreshing]   = useState(false);
  const [isSuperAdmin,  setIsSuperAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  // SSR-safe: read JWT + resolve permissions — mirrors Sidebar pattern exactly
  useEffect(() => {
    try {
      const token = localStorage.getItem("chatbot_access_token");
      if (!token) return;
      const payload = JSON.parse(atob(token.split(".")[1]));
      const role    = payload?.role ?? "";
      setIsSuperAdmin(role === "super_admin");
      setCurrentUserId(payload?.sub ?? "");
    } catch {}
  }, []);

  const canReadUsers = permissionsLoaded ? hasAnyForResource("users") : false;
  const canWriteUsers = permissionsLoaded ? hasPermission("users:write") : false;
  const canDeleteUsers = permissionsLoaded ? hasPermission("users:delete") : false;
  const canReadPlans = permissionsLoaded ? hasAnyForResource("plans") : false;
  const canReadRoles = permissionsLoaded ? hasAnyForResource("roles") : false;

  // Form state
  const [showForm,        setShowForm]        = useState(false);
  const [editingUser,     setEditingUser]      = useState<User | null>(null);
  const [formEmail,       setFormEmail]        = useState("");
  const [formPassword,    setFormPassword]     = useState("");
  const [formRole,        setFormRole]         = useState("customer");
  const [formSubPlanId,   setFormSubPlanId]    = useState("");
  const [formDuration,    setFormDuration]     = useState(1);
  const [saving,          setSaving]           = useState(false);

  // Search
  const [search, setSearch] = useState("");



  const [availablePlans,  setAvailablePlans]  = useState<Plan[]>([]);
  const [availableRoles,  setAvailableRoles]  = useState<{ key: string; name: string }[]>([]);
  const [assigningPlan,  setAssigningPlan]  = useState<User | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [planDuration,   setPlanDuration]   = useState(1);
  const [assigning,      setAssigning]      = useState(false);

  const fetchUsers = async (isInitial = false) => {
    if (!canReadUsers) {
      setUsers([]);
      if (isInitial) setLoading(false); else setRefreshing(false);
      return;
    }
    if (isInitial) setLoading(true); else setRefreshing(true);
    try {
      const res = await fetch(`${BASE}/users`, { headers: authHeaders() });
      if (res.ok) setUsers(await res.json());
    } finally {
      if (isInitial) setLoading(false); else setRefreshing(false);
    }
  };

  const fetchPlans = async () => {
    if (!canReadPlans) {
      setAvailablePlans([]);
      return;
    }
    const plans = await cachedFetch("plans", async () => {
      const res = await fetch(`${BASE}/plans`, { headers: authHeaders() });
      return res.ok ? res.json() : [];
    });
    setAvailablePlans(plans);
  };

  const handleAssignPlan = async () => {
    if (!assigningPlan || !selectedPlanId) return;
    setAssigning(true);
    try {
      const res = await fetch(`${BASE}/users/${assigningPlan.id}/assign-plan`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ plan_id: selectedPlanId, duration_months: planDuration }),
      });
      if (!res.ok) { const e = await res.json(); addToast({ title: "Error", description: e.detail, variant: "error" }); return; }
      addToast({ title: "Plan assigned successfully" });
      void fetchUsers();
      setAssigningPlan(null);
    } catch (err) {
      addToast({ title: "Error", description: err instanceof Error ? err.message : "Please try again.", variant: "error" });
    } finally {
      setAssigning(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!canReadUsers) {
      setLoading(false);
      setAvailablePlans([]);
      setAvailableRoles([]);
      return;
    }
    void fetchUsers(true);
    if (canReadPlans) void fetchPlans();
    else setAvailablePlans([]);
    if (canReadRoles) {
      void fetch(`${BASE}/roles`, { headers: authHeaders(), cache: "no-store" })
        .then(r => r.ok ? r.json() : [])
        .then((roles: { key?: string; name: string; is_super_admin?: boolean }[]) => {
          setAvailableRoles(
            roles.map(r => ({
              key:  r.key ?? r.name.toLowerCase().replace(" ", "_"),
              name: r.name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            }))
          );
        })
        .catch(() => setAvailableRoles([]));
    } else {
      setAvailableRoles([]);
    }
  }, [permissionsLoaded, canReadUsers, canReadPlans, canReadRoles]);

  if (permissionsLoaded && !canReadUsers && !loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
            <svg viewBox="0 0 16 16" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="7" width="10" height="8" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">Super Admin Only</p>
          <p className="mt-1 text-xs text-slate-400">You don&apos;t have permission to manage users.</p>
        </div>
      </div>
    );
  }

  const openNewUser = () => {
    setEditingUser(null); setFormEmail(""); setFormPassword(""); setFormRole(availableRoles[0]?.key ?? "customer"); setFormSubPlanId(""); setFormDuration(1);
    setShowForm(true);
  };

  const openEditUser = (u: User) => {
    setEditingUser(u); setFormEmail(u.email); setFormPassword(""); setFormRole(u.role);
    setFormSubPlanId(u.subscription?.plan_name ? "" : "");
    setShowForm(true);
  };

  const saveUser = async () => {
    if (!formEmail.trim()) return;
    if (!editingUser && formPassword.length < 8) {
      addToast({ title: "Password must be at least 8 characters.", variant: "error" }); return;
    }
    setSaving(true);
    try {
      const url    = editingUser ? `${BASE}/users/${editingUser.id}` : `${BASE}/users`;
      const method = editingUser ? "PUT" : "POST";
      const body: any = { email: formEmail.trim(), role: formRole };
      if (!editingUser) body.password = formPassword;
      if (editingUser && formPassword) body.password = formPassword;

      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) {
        const e = await res.json();
        addToast({ title: "Error", description: e.detail, variant: "error" });
        return;
      }
      const savedUser = await res.json();
      // Assign subscription plan if selected during creation
      if (!editingUser && formSubPlanId && savedUser?.id) {
        await fetch(`${BASE}/users/${savedUser.id}/assign-plan`, {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ plan_id: formSubPlanId, duration_months: formDuration }),
        });
      }
      addToast({ title: editingUser ? "User updated" : "User created" });
      void fetchUsers();
      setShowForm(false);
    } catch (err) {
      addToast({ title: "Error", description: err instanceof Error ? err.message : "Please try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`Delete user ${u.email}? This cannot be undone.`)) return;
    const res = await fetch(`${BASE}/users/${u.id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) {
      const e = await res.json();
      addToast({ title: "Error", description: e.detail, variant: "error" });
      return;
    }
    addToast({ title: "User deleted" });
    void fetchUsers();
  };

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-900">User Management</h1>
          <p className="text-xs text-slate-400 mt-0.5">Create, view, update and delete users across all workspaces.</p>
        </div>
        <button type="button" onClick={openNewUser} disabled={!canWriteUsers}
          className="h-8 rounded-lg bg-slate-950 px-3.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">
          + New user
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total users",   value: users.length },
          ...Array.from(new Set(users.map(u => u.role)))
            .filter(r => r !== "super_admin")
            .map(r => ({
              label: r.replace(/_/g, " ").replace(/\w/g, c => c.toUpperCase()) + "s",
              value: users.filter(u => u.role === r).length,
            })),
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg viewBox="0 0 16 16" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="6.5" cy="6.5" r="4"/><path d="m9.5 9.5 3 3"/>
        </svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or role..." autoComplete="off"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-400" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">User</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Plan</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Joined</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => {
                const isSelf    = u.id === currentUserId;
                const isSA      = u.role === "super_admin";
                const protected_ = isSA;
                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">
                          {u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{u.email}</p>
                          {isSelf && <p className="text-[10px] text-slate-400">You</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><RoleBadge role={u.role} availableRoles={availableRoles} /></td>
                    <td className="px-5 py-3 capitalize text-xs text-slate-500">{u.plan}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{formatDate(u.created_at)}</td>
                    <td className="px-5 py-3">
                      {u.subscription ? (
                        <div>
                          <span className="text-xs font-medium text-slate-700">{u.subscription.plan_name}</span>
                          <div className="mt-1 w-32">
                            <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                              <span>Messages</span>
                              <span>{Math.round(u.subscription.remaining_messages)}/{u.subscription.monthly_message_limit}</span>
                            </div>
                            <div className="h-1 w-full rounded-full bg-slate-100">
                              <div className="h-1 rounded-full bg-emerald-500"
                                style={{ width: `${Math.min((u.subscription.remaining_messages / u.subscription.monthly_message_limit) * 100, 100)}%` }} />
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Renews {new Date(u.subscription.cycle_end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No plan assigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {protected_ ? (
                        <span className="text-[10px] text-slate-400 italic">🔒 Protected</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => { setAssigningPlan(u); setSelectedPlanId(u.subscription?.plan_name ? "" : ""); }}
                            disabled={!canWriteUsers || !canReadPlans}
                            className="h-7 px-3 rounded-lg border border-blue-100 text-xs font-medium text-blue-600 hover:bg-blue-50 transition disabled:opacity-50">
                            {u.subscription ? "Change Plan" : "Assign Plan"}
                          </button>
                          <button type="button" onClick={() => openEditUser(u)} disabled={!canWriteUsers}
                            className="h-7 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
                            Edit
                          </button>
                          <button type="button" onClick={() => deleteUser(u)}
                            disabled={!canDeleteUsers || isSelf}
                            className="h-7 px-3 rounded-lg border border-red-100 text-xs font-medium text-red-500 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* User form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              {editingUser ? "Edit user" : "New user"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Email</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="user@example.com" autoComplete="new-email"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Password {editingUser && <span className="text-slate-400 font-normal">(leave blank to keep current)</span>}
                </label>
                {/* Hidden dummy inputs to prevent browser autofill on nearby fields */}
                <input type="text" style={{ display: "none" }} autoComplete="username" readOnly />
                <input type="password" style={{ display: "none" }} autoComplete="new-password" readOnly />
                <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? "••••••••" : "Min 8 characters"} autoComplete="new-password"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </div>

              <div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">Role</label>
                  <div className="relative">
                    <select value={formRole} onChange={(e) => setFormRole(e.target.value)}
                      className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm outline-none transition focus:border-slate-400">
                      {availableRoles.length > 0
                        ? availableRoles.map(r => (
                            <option key={r.key} value={r.key}>{r.name}</option>
                          ))
                        : null
                      }
                    </select>
                    <svg viewBox="0 0 16 16" fill="currentColor" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400">
                      <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
                    </svg>
                  </div>
                </div>

              </div>

              {/* Subscription plan — only show on create, not edit */}
              {!editingUser && availablePlans.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Subscription Plan <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <select value={formSubPlanId} onChange={(e) => setFormSubPlanId(e.target.value)}
                      className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm outline-none transition focus:border-slate-400">
                      <option value="">— No plan assigned —</option>
                      {availablePlans.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.totalMessages.toLocaleString()} msgs/mo)
                        </option>
                      ))}
                    </select>
                    <svg viewBox="0 0 16 16" fill="currentColor" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400">
                      <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  {formSubPlanId && (
                    <div className="mt-3">
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">Plan Duration</label>
                      <div className="relative">
                        <select value={formDuration} onChange={(e) => setFormDuration(Number(e.target.value))}
                          className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                            <option key={m} value={m}>{m} {m === 1 ? "Month" : "Months"}</option>
                          ))}
                        </select>
                        <svg viewBox="0 0 16 16" fill="currentColor" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400">
                          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Cycle ends: <strong>{new Date(Date.now() + formDuration * 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button type="button" onClick={saveUser}
                disabled={saving || !formEmail.trim()}
                className="flex-1 h-9 rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                {saving ? "Saving..." : editingUser ? "Update user" : "Create user"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Assign Plan Modal */}
      {assigningPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setAssigningPlan(null); }}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Assign Subscription Plan</h2>
            <p className="text-xs text-slate-400 mb-4">Assigning to <strong>{assigningPlan.email}</strong></p>

            {availablePlans.length === 0 ? (
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                No plans available. Create plans in the Plans page first.
              </div>
            ) : (
              <div className="space-y-2">
                {availablePlans.map(p => (
                  <label key={p.id}
                    className={["flex items-center justify-between rounded-xl border-2 px-4 py-3 cursor-pointer transition",
                      selectedPlanId === p.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"].join(" ")}>
                    <div className="flex items-center gap-3">
                      <input type="radio" name="plan" value={p.id} checked={selectedPlanId === p.id}
                        onChange={() => setSelectedPlanId(p.id)} className="accent-slate-900" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.totalMessages.toLocaleString()} messages/month</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-emerald-600">${p.sellingPrice.toFixed(2)}</p>
                  </label>
                ))}
              </div>
            )}

            {/* Duration selector */}
            {selectedPlanId && (
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Plan Duration</label>
                <div className="relative">
                  <select value={planDuration} onChange={(e) => setPlanDuration(Number(e.target.value))}
                    className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={m}>{m} {m === 1 ? "Month" : "Months"}</option>
                    ))}
                  </select>
                  <svg viewBox="0 0 16 16" fill="currentColor" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400">
                    <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
                  </svg>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Cycle ends: <strong>{new Date(Date.now() + planDuration * 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong>
                </p>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setAssigningPlan(null)}
                className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button type="button" onClick={handleAssignPlan}
                disabled={assigning || !selectedPlanId}
                className="flex-1 h-9 rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                {assigning ? "Assigning..." : `Assign for ${planDuration} month${planDuration > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
