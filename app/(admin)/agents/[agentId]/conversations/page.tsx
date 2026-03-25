"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { useAdmin } from "@/components/AdminProvider";
import ConversationsWorkspace, { ConversationWorkspaceItem } from "@/components/ConversationsWorkspace";
import { getConversation, getConversations, getConversationSummary } from "@/lib/api";
import { cachedFetch } from "@/lib/client-cache";
import { ConversationDetail, ConversationSummary } from "@/lib/types";

export default function ConversationsPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { addToast } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (!agentId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const items = await cachedFetch(`conversations:${agentId}`, () => getConversations(agentId), 30_000);
        if (cancelled) return;
        setConversations(items);
        setSelectedConversationId((current) => {
          if (current && items.some((item) => item.id === current)) return current;
          return items[0]?.id ?? null;
        });
      } catch (error) {
        if (!cancelled) {
          addToast({
            title: "Unable to load conversations",
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
  }, [agentId]);

  useEffect(() => {
    if (!agentId || !selectedConversationId) {
      setConversation(null);
      setAiSummary(null);
      return;
    }

    let cancelled = false;
    setConversation(null);
    setAiSummary(null);
    setSummaryLoading(true);

    void getConversation(agentId, selectedConversationId)
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

    void getConversationSummary(agentId, selectedConversationId)
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
  }, [agentId, selectedConversationId]);

  const workspaceConversations = useMemo<ConversationWorkspaceItem[]>(
    () => conversations.map((item) => ({ ...item, key: item.id })),
    [conversations],
  );

  return (
    <ConversationsWorkspace
      title="Conversations"
      loading={loading}
      conversations={workspaceConversations}
      selectedConversationKey={selectedConversationId}
      onSelectConversation={setSelectedConversationId}
      conversation={conversation}
      aiSummary={aiSummary}
      summaryLoading={summaryLoading}
      emptyDescription="Use chat preview to start capturing."
    />
  );
}
