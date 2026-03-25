"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAdmin } from "@/components/AdminProvider";
import ShareAgentModal from "@/components/ShareAgentModal";
import { Agent } from "@/lib/types";

type AgentCardProps = {
  agent: Agent;
  onUpdate: (agentId: string, name: string) => Promise<unknown>;
  onDelete: (agentId: string) => Promise<void>;
};

type MenuActionItem = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
};

type MenuDividerItem = {
  divider: true;
};

type MenuItem = MenuActionItem | MenuDividerItem;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function AgentCard({ agent, onUpdate, onDelete }: AgentCardProps) {
  const router = useRouter();
  const { addToast } = useAdmin();
  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState(agent.name);
  const [saving,    setSaving]    = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const canManage = agent.can_manage !== false;

  // Close menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName || nextName === agent.name || saving) {
      setEditing(false);
      setName(agent.name);
      return;
    }
    setSaving(true);
    try {
      await onUpdate(agent.id, nextName);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(agent.display_id ?? agent.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const menuItems: MenuItem[] = [
    {
      label: "Playground",
      icon: (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="6"/><path d="M6 5.5l5 2.5-5 2.5V5.5Z" fill="currentColor" stroke="none"/>
        </svg>
      ),
      onClick: () => router.push(`/agents/${agent.id}/chat`),
    },
    {
      label: "Conversations",
      icon: (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M14 10a2 2 0 0 1-2 2H4l-3 3V3a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v7Z"/>
        </svg>
      ),
      onClick: () => router.push(`/agents/${agent.id}/conversations`),
    },
    {
      label: "Analytics",
      icon: (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 12 6 7l3 3 5-6"/>
        </svg>
      ),
      onClick: () => router.push(`/agents/${agent.id}/analytics`),
    },
    {
      label: "Knowledge",
      icon: (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 3h12v9H2zM5 12v2M11 12v2M3 6h10M3 9h6"/>
        </svg>
      ),
      onClick: () => router.push(`/agents/${agent.id}/knowledge/pdfs`),
    },
  ];

  if (canManage) {
    menuItems.push(
      { divider: true },
      {
        label: "Share",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M11.5 5a2.5 2.5 0 1 0-2.24-3.62M4.5 9A2.5 2.5 0 1 0 6.74 12.6M11.5 15a2.5 2.5 0 1 0-2.24-3.62M6.6 10.9l2.8 1.6M9.4 3.5 6.6 5.1"/>
          </svg>
        ),
        onClick: () => {
          setMenuOpen(false);
          setShareOpen(true);
        },
      },
      {
        label: "Rename",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M11 2.5a1.5 1.5 0 0 1 2.12 2.12L4.5 14H2v-2.5L11 2.5Z"/>
          </svg>
        ),
        onClick: () => { setEditing(true); setMenuOpen(false); },
      },
      {
        label: "Delete",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"/>
          </svg>
        ),
        onClick: () => { setMenuOpen(false); void onDelete(agent.id); },
        danger: true,
      },
    );
  }

  return (
    <>
      <article className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
        {/* Top row: name + kebab */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editing ? (
              <form className="flex items-center gap-2" onSubmit={handleRename}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  className="h-8 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                />
                <button type="submit" disabled={saving || !name.trim()}
                  className="h-8 rounded-lg bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-300">
                  {saving ? "..." : "Save"}
                </button>
                <button type="button" onClick={() => { setEditing(false); setName(agent.name); }}
                  className="h-8 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                  Cancel
                </button>
              </form>
            ) : (
              <p className="truncate text-sm font-semibold text-slate-900">{agent.name}</p>
            )}
            <p className="mt-0.5 text-xs text-slate-400">Created {formatDate(agent.created_at)}</p>
            {agent.is_shared ? (
              <div className="mt-1.5 inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                Shared with you
              </div>
            ) : null}

            {/* Agent ID */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-medium">ID:</span>
              <code className="text-[10px] text-slate-500 font-mono bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 truncate max-w-[150px]">
                {agent.display_id ?? agent.id}
              </code>
              <button type="button" onClick={copyId} title="Copy ID"
                className="flex-shrink-0 text-slate-400 hover:text-slate-700 transition">
                {copied ? (
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-emerald-500" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M2 8l4 4 8-8"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V3h8"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Kebab menu */}
          {!editing && (
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button type="button" onClick={() => setMenuOpen(v => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <circle cx="8" cy="3" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="8" cy="13" r="1.2"/>
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {menuItems.map((item, idx) =>
                    "divider" in item ? (
                      <div key={idx} className="my-1 border-t border-slate-100" />
                    ) : (
                      <button key={item.label} type="button"
                        onClick={() => { setMenuOpen(false); item.onClick(); }}
                        className={["flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition",
                          item.danger
                            ? "text-red-500 hover:bg-red-50"
                            : "text-slate-700 hover:bg-slate-50"
                        ].join(" ")}>
                        {item.icon}
                        {item.label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Metrics */}
        <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
          <div>
            <p className="text-xs text-slate-400">Documents</p>
            <p className="text-sm font-semibold text-slate-800">{agent.document_count}</p>
          </div>
          <div className="h-4 w-px bg-slate-100" />
          <div>
            <p className="text-xs text-slate-400">Conversations</p>
            <p className="text-sm font-semibold text-slate-800">{agent.conversation_count}</p>
          </div>
        </div>
      </article>
      <ShareAgentModal
        agent={agent}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onShared={(result) => {
          addToast({
            title: result.mode === "invited" ? "Invite sent" : "Agent shared",
            description: result.message,
          });
        }}
      />
    </>
  );
}
