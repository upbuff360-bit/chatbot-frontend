"use client";

import { useEffect, useMemo, useState } from "react";

import { inviteAgentByEmail, searchAgentShareCandidates, shareAgent } from "@/lib/api";
import { Agent, AgentShareResult, UserSearchResult } from "@/lib/types";

type ShareAgentModalProps = {
  agent: Agent;
  open: boolean;
  onClose: () => void;
  onShared?: (result: AgentShareResult) => void;
};

function isCompleteEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ShareAgentModal({ agent, open, onClose, onShared }: ShareAgentModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedUser(null);
      setLoading(false);
      setSaving(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!isCompleteEmail(trimmed)) {
      setResults([]);
      setLoading(false);
      setError(null);
      if (selectedUser && selectedUser.email.toLowerCase() !== trimmed.toLowerCase()) {
        setSelectedUser(null);
      }
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);

      void searchAgentShareCandidates(agent.id, trimmed)
        .then((users) => {
          if (cancelled) return;
          setResults(users);

          const exactMatch = users.find((user) => user.email.toLowerCase() === trimmed.toLowerCase()) ?? null;
          if (selectedUser && exactMatch?.id !== selectedUser.id && selectedUser.email.toLowerCase() !== trimmed.toLowerCase()) {
            setSelectedUser(null);
          }
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setResults([]);
          setError(err instanceof Error ? err.message : "Unable to search users.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [agent.id, open, query, selectedUser]);

  const dropdownOpen = useMemo(() => {
    if (!query.trim() || !isCompleteEmail(query) || !!selectedUser) return false;
    return loading || results.length > 0;
  }, [loading, query, results.length, selectedUser]);

  const canInviteEmail = useMemo(() => {
    const trimmed = query.trim();
    return isCompleteEmail(trimmed) && !selectedUser && !loading && results.length === 0;
  }, [loading, query, results.length, selectedUser]);

  const submit = async () => {
    if (saving) return;
    const trimmed = query.trim();
    if (!selectedUser && !canInviteEmail) return;

    setSaving(true);
    setError(null);
    try {
      const result = selectedUser
        ? await shareAgent(agent.id, selectedUser.id)
        : await inviteAgentByEmail(agent.id, trimmed);
      onShared?.(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to share agent.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Share Agent</h2>
            <p className="mt-1 text-xs text-slate-400">Share {agent.name} with an existing user or send a signup invite by email.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-medium text-slate-700">Email ID</label>
          <div className="relative">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedUser(null);
                setError(null);
              }}
              placeholder="Search registered email"
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
            />

            {dropdownOpen ? (
              <div className="absolute left-0 right-0 top-11 z-10 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {loading ? (
                  <div className="px-3 py-3 text-xs text-slate-400">Searching users...</div>
                ) : (
                  <div className="max-h-56 overflow-y-auto py-1">
                    {results.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(user);
                          setQuery(user.email);
                          setError(null);
                        }}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{user.email}</p>
                          {user.name ? <p className="mt-0.5 truncate text-xs text-slate-400">{user.name}</p> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {selectedUser ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              <span className="text-xs font-medium text-slate-700">{selectedUser.email}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setQuery("");
                  setResults([]);
                }}
                className="text-xs text-slate-400 transition hover:text-slate-600"
              >
                Remove
              </button>
            </div>
          ) : null}

          {!selectedUser && canInviteEmail ? (
            <p className="mt-2 text-xs text-slate-500">No registered account found. Clicking invite will email a signup link to this address.</p>
          ) : null}

          {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={(!selectedUser && !canInviteEmail) || saving}
            className="flex-1 h-9 rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Sending..." : canInviteEmail && !selectedUser ? "Send invite" : "Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
