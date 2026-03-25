"use client";

import { ChangeEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAdmin } from "@/components/AdminProvider";
import { useAuth } from "@/components/AuthProvider";
import { resolveAgentRoute } from "@/lib/agent-routes";

export default function Topbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { agents, selectedAgentId, setSelectedAgentId } = useAdmin();
  const { user, logout } = useAuth();

  const handleAgentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextAgentId = event.target.value || null;
    setSelectedAgentId(nextAgentId);
    if (nextAgentId) router.push(resolveAgentRoute(pathname, nextAgentId));
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="flex h-12 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 min-w-0">
          <span className="font-medium text-slate-700 truncate">Chatbot workspace</span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Agent selector */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 h-8">
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true">
              <path d="M10.5 13.5v-1.25a2.75 2.75 0 0 0-2.75-2.75h-3.5A2.75 2.75 0 0 0 1.5 12.25V13.5M6.25 6.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm8.25 7v-1a2.5 2.5 0 0 0-2-2.45M10.5 4.05A2.25 2.25 0 0 1 10.5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <select
              value={selectedAgentId ?? ""}
              onChange={handleAgentChange}
              className="bg-transparent text-xs font-medium text-slate-700 outline-none min-w-0 max-w-36"
            >
              <option value="">Select agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>

          {/* User info + logout */}
          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-medium text-slate-700 leading-none">{user.email}</span>
                <span className="text-[10px] text-slate-400 capitalize mt-0.5">{user.role}</span>
              </div>
              <div className="grid h-7 w-7 place-content-center rounded-full bg-slate-900 text-[11px] font-semibold text-white uppercase">
                {user.email[0]}
              </div>
              <button
                type="button"
                onClick={logout}
                title="Logout"
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 h-7 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6M10.5 11l3-3-3-3M13.5 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
