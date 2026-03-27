"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import AgentCard from "@/components/AgentCard";
import { useAdmin } from "@/components/AdminProvider";

export default function AgentsPage() {
  const router = useRouter();
  const { agents, loading, updateAgentRecord, deleteAgentRecord } = useAdmin();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"mine" | "shared">("mine");

  const myAgents = agents.filter((a) => !a.is_shared);
  const sharedAgents = agents.filter((a) => a.is_shared);

  const activeAgents = tab === "mine" ? myAgents : sharedAgents;

  const filtered = activeAgents.filter((a) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      (a.display_id ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-base font-semibold text-slate-900">Agents</h1>
        <button
          type="button"
          onClick={() => router.push("/agents/new/chat")}
          className="h-8 rounded-lg bg-slate-950 px-3.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          + New agent
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("mine")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "mine"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          My Agents
          <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
            {loading ? "—" : myAgents.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("shared")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "shared"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Shared with me
          <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
            {loading ? "—" : sharedAgents.length}
          </span>
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <svg viewBox="0 0 16 16" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="6.5" cy="6.5" r="4"/><path d="m9.5 9.5 3 3"/>
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or agent ID..."
          autoComplete="off"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-400 placeholder:text-slate-400"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Agent grid */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
        </div>
      ) : filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onUpdate={updateAgentRecord} onDelete={deleteAgentRecord} />
          ))}
        </div>
      ) : search ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center">
          <p className="text-sm font-medium text-slate-600">No agents found</p>
          <p className="mt-1 text-sm text-slate-400">No results for &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center">
          <p className="text-sm font-medium text-slate-600">
            {tab === "mine" ? "No agents yet" : "No shared agents"}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {tab === "mine"
              ? "Click \"+ New agent\" to create your first agent."
              : "Agents shared with you will appear here."}
          </p>
        </div>
      )}
    </div>
  );
}