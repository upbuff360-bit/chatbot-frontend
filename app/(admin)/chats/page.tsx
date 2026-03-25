"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAdmin } from "@/components/AdminProvider";
import ConversationsWorkspace, { ConversationWorkspaceItem } from "@/components/ConversationsWorkspace";
import { getConversation, getConversations, getConversationSummary } from "@/lib/api";
import { cachedFetch } from "@/lib/client-cache";
import { ConversationDetail } from "@/lib/types";

export default function ChatsPage() {
  const { agents, addToast, hasAnyForResource } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [filterAgentId, setFilterAgentId] = useState<string>("all");
  const [conversations, setConversations] = useState<ConversationWorkspaceItem[]>([]);
  const [selectedConversationKey, setSelectedConversationKey] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const canReadChats = hasAnyForResource("chats") || hasAnyForResource("agents");

  useEffect(() => {
    if (!canReadChats || !agents.length) {
      setLoading(false);
      setConversations([]);
      setSelectedConversationKey(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          agents.map(async (agent) => {
            const items = await cachedFetch(`conversations:${agent.id}`, () => getConversations(agent.id), 30_000);
            return items.map((item) => ({
              ...item,
              key: `${agent.id}:${item.id}`,
              agentId: agent.id,
              agentName: agent.name,
            }));
          }),
        );

        if (cancelled) return;

        const merged = results
          .flat()
          .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());

        setConversations(merged);
        setSelectedConversationKey((current) => {
          if (current && merged.some((item) => item.key === current)) return current;
          return merged[0]?.key ?? null;
        });
      } catch (error) {
        if (!cancelled) {
          addToast({
            title: "Unable to load chats",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [agents, canReadChats]);

  const filteredConversations = useMemo(
    () => conversations.filter((item) => filterAgentId === "all" || item.agentId === filterAgentId),
    [conversations, filterAgentId],
  );

  const selectedConversationItem =
    filteredConversations.find((item) => item.key === selectedConversationKey) ??
    conversations.find((item) => item.key === selectedConversationKey) ??
    null;

  useEffect(() => {
    if (!filteredConversations.length) {
      setSelectedConversationKey(null);
      return;
    }

    if (!selectedConversationKey || !filteredConversations.some((item) => item.key === selectedConversationKey)) {
      setSelectedConversationKey(filteredConversations[0].key);
    }
  }, [filteredConversations, selectedConversationKey]);

  useEffect(() => {
    if (!selectedConversationItem?.agentId) {
      setConversation(null);
      setAiSummary(null);
      return;
    }

    let cancelled = false;
    setConversation(null);
    setAiSummary(null);
    setSummaryLoading(true);

    void getConversation(selectedConversationItem.agentId, selectedConversationItem.id)
      .then((data) => {
        if (!cancelled) setConversation(data);
      })
      .catch((error) => {
        if (!cancelled) {
          addToast({
            title: "Unable to load messages",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "error",
          });
        }
      });

    void getConversationSummary(selectedConversationItem.agentId, selectedConversationItem.id)
      .then((summary) => {
        if (!cancelled) setAiSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setAiSummary(null);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedConversationItem?.agentId, selectedConversationItem?.id]);

  const toolbar = (
    <>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">Agent</label>
      <select
        value={filterAgentId}
        onChange={(event) => setFilterAgentId(event.target.value)}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
      >
        <option value="all">All agents</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <ConversationsWorkspace
      title="Chats"
      subtitle="Browse conversations across all agents and switch the list by agent when needed."
      toolbar={toolbar}
      loading={loading}
      conversations={filteredConversations}
      selectedConversationKey={selectedConversationKey}
      onSelectConversation={setSelectedConversationKey}
      conversation={conversation}
      aiSummary={aiSummary}
      summaryLoading={summaryLoading}
      emptyDescription={
        filterAgentId === "all" ? "Chats from every agent will appear here." : "No conversations found for this agent."
      }
      renderDetailAction={(item) =>
        item.agentId ? (
          <Link
            href={`/agents/${item.agentId}/conversations`}
            className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Open agent view
          </Link>
        ) : null
      }
    />
  );
}
