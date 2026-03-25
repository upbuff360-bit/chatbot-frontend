"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/components/AdminProvider";
import { cachedFetch, invalidate } from "@/lib/client-cache";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("chatbot_access_token") : "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function checkAuth(res: Response): Response {
  if (res.status === 401) {
    localStorage.removeItem("chatbot_access_token");
    window.location.href = "/login";
    throw new Error("Session expired.");
  }
  return res;
}

interface Permission { id: string; name: string; description: string; resource: string; action: string; }
interface Role       { id: string; name: string; description: string; permissions: string[]; is_system?: boolean; is_super_admin?: boolean; }

const ACTIONS   = ["read", "write", "delete", "manage"];

export default function RolesPage() {
  const { addToast, permissionsLoaded, hasAnyForResource, hasPermission, refreshPermissions } = useAdmin();

  const [permissions,   setPermissions]   = useState<Permission[]>([]);

  // Derived dynamically from fetched permissions — updates automatically when new pages/resources are added
  const resources = Array.from(new Set(permissions.map(p => p.resource))).sort();
  const [roles,         setRoles]         = useState<Role[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState<"roles" | "permissions">("roles");
  const canReadRoles = permissionsLoaded ? hasAnyForResource("roles") : false;
  const canManageRoles = permissionsLoaded ? hasPermission("roles:manage") : false;

  // ── Role form state ──────────────────────────────────────────────────────
  const [showRoleForm,  setShowRoleForm]  = useState(false);
  const [editingRole,   setEditingRole]   = useState<Role | null>(null);
  const [roleName,      setRoleName]      = useState("");
  const [roleDesc,      setRoleDesc]      = useState("");
  const [rolePerms,     setRolePerms]     = useState<string[]>([]);
  const [savingRole,    setSavingRole]    = useState(false);

  // ── Permission form state ────────────────────────────────────────────────
  const [showPermForm,  setShowPermForm]  = useState(false);
  const [editingPerm,   setEditingPerm]   = useState<Permission | null>(null);
  const [permName,      setPermName]      = useState("");
  const [permDesc,      setPermDesc]      = useState("");
  const [permResource,  setPermResource]  = useState("");
  const [permActions,   setPermActions]   = useState<string[]>([]);
  const [savingPerm,    setSavingPerm]    = useState(false);
  const [syncing,       setSyncing]       = useState(false);


  const fetchAll = async (bustCache = false) => {
    if (bustCache) { invalidate("roles"); invalidate("permissions"); }
    setLoading(true);
    try {
      const [roles, permissions] = await Promise.all([
        cachedFetch("roles", async () => {
          const res = checkAuth(await fetch(`${BASE}/roles`, { headers: authHeaders(), cache: "no-store" }));
          if (!res.ok) throw new Error(`${res.status}`);
          return res.json();
        }),
        cachedFetch("permissions", async () => {
          const res = checkAuth(await fetch(`${BASE}/roles/permissions`, { headers: authHeaders(), cache: "no-store" }));
          if (!res.ok) throw new Error(`${res.status}`);
          return res.json();
        }),
      ]);
      setRoles(roles);
      setPermissions(permissions);
    } catch (_) {
      // On auth error bust cache so next attempt re-fetches
      invalidate("roles"); invalidate("permissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!canReadRoles) {
      setRoles([]);
      setPermissions([]);
      setLoading(false);
      return;
    }
    void fetchAll();
  }, [permissionsLoaded, canReadRoles]);

  const syncPermissions = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${BASE}/roles/reseed-permissions`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        addToast({ title: data.message ?? "Permissions synced." });
        void fetchAll(true);
      } else {
        addToast({ title: "Sync failed", description: data.detail ?? "Unable to sync permissions.", variant: "error" });
      }
    } catch (_) { addToast({ title: "Sync failed", description: "Unable to sync permissions.", variant: "error" }); }
    finally { setSyncing(false); }
  };

  if (permissionsLoaded && !canReadRoles && !loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
            <svg viewBox="0 0 16 16" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="7" width="10" height="8" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">Access Restricted</p>
          <p className="mt-1 text-xs text-slate-400">Only owners and super admins can manage roles and permissions.</p>
        </div>
      </div>
    );
  }

  // ── Role CRUD ─────────────────────────────────────────────────────────────

  const openNewRole = () => {
    setEditingRole(null); setRoleName(""); setRoleDesc(""); setRolePerms([]);
    setShowRoleForm(true);
  };

  const openEditRole = (role: Role) => {
    setEditingRole(role); setRoleName(role.name); setRoleDesc(role.description);
    setRolePerms(role.permissions);
    setShowRoleForm(true);
  };

  const saveRole = async () => {
    if (!roleName.trim()) return;
    setSavingRole(true);
    try {
      const url    = editingRole ? `${BASE}/roles/${editingRole.id}` : `${BASE}/roles`;
      const method = editingRole ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: authHeaders(),
        body: JSON.stringify({ name: roleName.trim(), description: roleDesc.trim(), permissions: rolePerms }),
      });
      if (!res.ok) { const e = await res.json(); addToast({ title: "Error", description: e.detail, variant: "error" }); return; }
      addToast({ title: editingRole ? "Role updated" : "Role created" });
      setShowRoleForm(false);
      await refreshPermissions();
      await fetchAll(true);
    } finally { setSavingRole(false); }
  };

  const deleteRole = async (id: string) => {
    if (!confirm("Delete this role? This cannot be undone.")) return;
    const res = await fetch(`${BASE}/roles/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) { const e = await res.json(); addToast({ title: "Error", description: e.detail, variant: "error" }); return; }
    addToast({ title: "Role deleted" });
    void fetchAll(true);
  };

  // ── Permission CRUD ───────────────────────────────────────────────────────

  const openNewPerm = () => {
    setEditingPerm(null); setPermName(""); setPermDesc(""); setPermResource(resources[0] ?? ""); setPermActions([]);
    setShowPermForm(true);
  };

  const openEditPerm = (p: Permission) => {
    setEditingPerm(p); setPermName(p.name); setPermDesc(p.description);
    setPermResource(p.resource); setPermActions(p.action.split(","));
    setShowPermForm(true);
  };

  const savePerm = async () => {
    if (!permName.trim() || permActions.length === 0) return;
    setSavingPerm(true);
    try {
      // Permissions API only supports create/delete — for edit we delete + recreate
      if (editingPerm) {
        await fetch(`${BASE}/roles/permissions/${editingPerm.id}`, { method: "DELETE", headers: authHeaders() });
      }
      const res = await fetch(`${BASE}/roles/permissions`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ name: permName.trim(), description: permDesc.trim(), resource: permResource, action: permActions.join(",") }),
      });
      if (!res.ok) { const e = await res.json(); addToast({ title: "Error", description: e.detail, variant: "error" }); return; }
      addToast({ title: editingPerm ? "Permission updated" : "Permission created" });
      setShowPermForm(false);
      await refreshPermissions();
      void fetchAll(true);
    } finally { setSavingPerm(false); }
  };

  const deletePerm = async (id: string) => {
    if (!confirm("Delete this permission? It will also be removed from all roles.")) return;
    await fetch(`${BASE}/roles/permissions/${id}`, { method: "DELETE", headers: authHeaders() });
    addToast({ title: "Permission deleted" });
    await refreshPermissions();
    void fetchAll(true);
  };

  const togglePerm = (id: string) =>
    setRolePerms(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const toggleAction = (a: string) =>
    setPermActions(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Roles & Permissions</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage access control for your workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "permissions" && (
            <button type="button" onClick={syncPermissions} disabled={!canManageRoles || syncing}
              className="h-8 rounded-lg border border-slate-200 px-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5M13.5 2.5v3h-3"/></svg>
              {syncing ? "Syncing…" : "Sync from registry"}
            </button>
          )}
          <button type="button"
            onClick={() => activeTab === "roles" ? openNewRole() : openNewPerm()}
            disabled={!canManageRoles}
            className="h-8 rounded-lg bg-slate-950 px-3.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">
            + New {activeTab === "roles" ? "role" : "permission"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {(["roles", "permissions"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setActiveTab(t)}
            className={["px-4 py-2.5 text-sm font-medium border-b-2 capitalize transition",
              activeTab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-700"].join(" ")}>
            {t} <span className="ml-1.5 text-xs text-slate-400">({t === "roles" ? roles.length : permissions.length})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* ── Roles tab ── */}
          {activeTab === "roles" && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              {roles.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  No roles yet. Click &quot;+ New role&quot; to create one.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Role</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Description</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Permissions</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Type</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {roles.map((role) => (
                      <tr key={role.id} className={["hover:bg-slate-50 transition", role.is_super_admin ? "bg-amber-50" : ""].join(" ")}>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-800 capitalize">{role.name.replace("_", " ")}</p>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400 max-w-xs">
                          {role.description || "—"}
                        </td>
                        <td className="px-5 py-3">
                          {role.is_super_admin ? (
                            <span className="text-[10px] font-medium bg-amber-100 border border-amber-200 text-amber-800 rounded-full px-2 py-0.5">All permissions</span>
                          ) : role.permissions.includes("*") ? (
                            <span className="text-[10px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-2 py-0.5">All permissions</span>
                          ) : role.permissions.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">None assigned</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {role.permissions.slice(0, 3).map((pname) => (
                                <span key={pname} className="text-[10px] font-medium bg-slate-50 border border-slate-200 text-slate-600 rounded-full px-2 py-0.5">
                                  {pname}
                                </span>
                              ))}
                              {role.permissions.length > 3 && (
                                <span className="text-[10px] font-medium bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                                  +{role.permissions.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {role.is_super_admin ? (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">⭐ Super Admin</span>
                          ) : role.is_system ? (
                            <span className="text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2 py-0.5">🔒 System</span>
                          ) : (
                            <span className="text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">Custom</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {role.is_super_admin ? (
                            // Super admin: fully locked — no edit, no delete
                            <span className="text-[10px] text-slate-400 italic">🔒 Protected</span>
                          ) : role.is_system ? (
                            // System role (customer): can edit name/permissions, cannot delete
                            <div className="flex items-center justify-end gap-2">
                              <button type="button" onClick={() => openEditRole(role)} disabled={!canManageRoles}
                                className="text-xs font-medium text-slate-500 hover:text-slate-800 transition">
                                Edit
                              </button>
                              <span className="text-[10px] text-slate-300 italic">No delete</span>
                            </div>
                          ) : (
                            // Custom roles: full edit + delete
                            <div className="flex items-center justify-end gap-2">
                              <button type="button" onClick={() => openEditRole(role)} disabled={!canManageRoles}
                                className="text-xs font-medium text-slate-500 hover:text-slate-800 transition">
                                Edit
                              </button>
                              <button type="button" onClick={() => deleteRole(role.id)} disabled={!canManageRoles}
                                className="text-xs font-medium text-red-400 hover:text-red-600 transition">
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Permissions tab ── */}
          {activeTab === "permissions" && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              {permissions.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  No permissions yet. Click &quot;+ New permission&quot; to create one.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Name</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Resource</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Action</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Description</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {permissions.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3 font-medium text-slate-800">{p.name}</td>
                        <td className="px-5 py-3">
                          <span className="rounded-full bg-slate-100 text-slate-600 text-xs px-2 py-0.5">{p.resource}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {p.action.split(",").map(a => (
                              <span key={a} className="rounded-full bg-blue-50 text-blue-600 text-xs px-2 py-0.5">{a.trim()}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400">{p.description || "—"}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openEditPerm(p)} disabled={!canManageRoles}
                              className="text-xs text-slate-500 hover:text-slate-800 transition font-medium">
                              Edit
                            </button>
                            <button type="button" onClick={() => deletePerm(p.id)} disabled={!canManageRoles}
                              className="text-xs text-red-400 hover:text-red-600 transition">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Role form modal ── */}
      {showRoleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col" style={{ maxHeight: "90vh" }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingRole ? "Edit role" : "New role"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Configure role details and assign permissions.</p>
              </div>
              <button type="button" onClick={() => setShowRoleForm(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
                </svg>
              </button>
            </div>

            {/* Two-column body */}
            <div className="flex flex-1 overflow-hidden min-h-0">

              {/* Left — role details */}
              <div className="w-72 flex-shrink-0 border-r border-slate-100 px-7 py-6 space-y-5 overflow-y-auto">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Role Details</p>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">Role name</label>
                      <input value={roleName} onChange={(e) => setRoleName(e.target.value)}
                        placeholder="e.g. editor" autoComplete="off"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">Description</label>
                      <textarea value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)}
                        placeholder="What can this role do?" autoComplete="off" rows={3}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white resize-none" />
                    </div>
                  </div>
                </div>

                {/* Selected count summary */}
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Selected permissions</p>
                  {rolePerms.length === 0 ? (
                    <p className="text-xs text-slate-400">None selected yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {rolePerms.slice(0, 8).map((id) => {
                        const p = permissions.find(p => p.name === id);
                        return p ? (
                          <span key={id} className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-900 text-white rounded-full px-2 py-0.5">
                            {p.resource}:{p.action}
                            <button type="button" onClick={() => togglePerm(id)} className="opacity-70 hover:opacity-100 ml-0.5">×</button>
                          </span>
                        ) : null;
                      })}
                      {rolePerms.length > 8 && (
                        <span className="text-[10px] text-slate-400">+{rolePerms.length - 8} more</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right — permissions (scrollable) */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="px-7 pt-6 pb-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Permissions</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">{rolePerms.length} of {permissions.length} selected</span>
                      {rolePerms.length > 0 && (
                        <button type="button" onClick={() => setRolePerms([])}
                          className="text-[10px] text-red-400 hover:text-red-600 transition">
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-7 pb-6">
                  {permissions.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4">No permissions available. Create permissions first.</p>
                  ) : (
                    <div className="space-y-4">
                      {resources.map((resource) => {
                        const resourcePerms = permissions.filter(p => p.resource === resource);
                        if (!resourcePerms.length) return null;
                        const allSelected = resourcePerms.every(p => rolePerms.includes(p.name));
                        return (
                          <div key={resource}>
                            {/* Resource group header with select-all toggle */}
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{resource}</p>
                              <button type="button"
                                onClick={() => {
                                  const names = resourcePerms.map(p => p.name);
                                  if (allSelected) {
                                    setRolePerms(prev => prev.filter(n => !names.includes(n)));
                                  } else {
                                    setRolePerms(prev => [...new Set([...prev, ...names])]);
                                  }
                                }}
                                className="text-[10px] text-slate-400 hover:text-slate-700 transition">
                                {allSelected ? "Deselect all" : "Select all"}
                              </button>
                            </div>
                            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                              {resourcePerms.map((p) => (
                                <label key={p.id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition ${rolePerms.includes(p.name) ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                                  <input type="checkbox" checked={rolePerms.includes(p.name)} onChange={() => togglePerm(p.name)}
                                    className="h-4 w-4 rounded border-slate-300 accent-slate-900 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-800">{p.name}</p>
                                    {p.description && <p className="text-[10px] text-slate-400 mt-0.5">{p.description}</p>}
                                  </div>
                                  <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 flex-shrink-0 ${
                                    p.action === "manage" ? "bg-purple-50 text-purple-600" :
                                    p.action === "delete" ? "bg-red-50 text-red-500" :
                                    p.action === "write"  ? "bg-blue-50 text-blue-600" :
                                    "bg-slate-100 text-slate-500"
                                  }`}>{p.action}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer — buttons bottom right */}
            <div className="flex items-center justify-end gap-2 px-7 py-4 border-t border-slate-100 flex-shrink-0">
              <button type="button" onClick={() => setShowRoleForm(false)}
                className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button type="button" onClick={saveRole} disabled={!canManageRoles || savingRole || !roleName.trim()}
                className="h-9 px-5 rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                {savingRole ? "Saving..." : editingRole ? "Update role" : "Create role"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Permission form modal ── */}
      {showPermForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              {editingPerm ? "Edit permission" : "New permission"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Permission name</label>
                <input value={permName} onChange={(e) => setPermName(e.target.value)}
                  placeholder="e.g. agents:read" autoComplete="off"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Resource</label>
                <div className="relative">
                  <select value={permResource} onChange={(e) => setPermResource(e.target.value)}
                    className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm outline-none transition focus:border-slate-400">
                    {resources.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <svg viewBox="0 0 16 16" fill="currentColor" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400">
                    <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
                  </svg>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-700">
                  Actions <span className="text-slate-400 font-normal">(select one or more)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {ACTIONS.map((a) => (
                    <label key={a} className={["flex items-center gap-1.5 rounded-lg border px-3 py-2 cursor-pointer transition text-xs font-medium select-none",
                      permActions.includes(a)
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"].join(" ")}>
                      <input type="checkbox" className="hidden" checked={permActions.includes(a)} onChange={() => toggleAction(a)} />
                      {a}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input value={permDesc} onChange={(e) => setPermDesc(e.target.value)}
                  placeholder="What does this permission allow?" autoComplete="off"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setShowPermForm(false)}
                className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button type="button" onClick={savePerm}
                disabled={!canManageRoles || savingPerm || !permName.trim() || permActions.length === 0}
                className="flex-1 h-9 rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                {savingPerm ? "Saving..." : editingPerm ? "Update permission" : "Create permission"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
