"use client";

import { ReactNode } from "react";

import MessageBubble from "@/components/MessageBubble";
import { ConversationDetail, ConversationSummary } from "@/lib/types";

export type ConversationWorkspaceItem = ConversationSummary & {
  key: string;
  agentId?: string;
  agentName?: string;
};

type ConversationsWorkspaceProps = {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  loading?: boolean;
  conversations: ConversationWorkspaceItem[];
  selectedConversationKey: string | null;
  onSelectConversation: (key: string) => void;
  conversation: ConversationDetail | null;
  aiSummary: string | null;
  summaryLoading: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  renderDetailAction?: (item: ConversationWorkspaceItem) => ReactNode;
};

type Message = { id: string; role: string; content: string; timestamp?: string };
type MessageGroup = { dayLabel: string; messages: Message[] };

function timeAgo(value: string): string {
  const diff = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 172800) return "yesterday";
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatFullDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function isToday(value: string) {
  return isSameDay(value, new Date().toISOString());
}

function isYesterday(value: string) {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return isSameDay(value, date.toISOString());
}

function dayLabel(value: string) {
  return isToday(value) ? "Today" : isYesterday(value) ? "Yesterday" : formatFullDate(value);
}

function groupMessagesByDay(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let current: MessageGroup | null = null;

  for (const message of messages) {
    const label = dayLabel(message.timestamp || new Date().toISOString());
    if (!current || current.dayLabel !== label) {
      current = { dayLabel: label, messages: [] };
      groups.push(current);
    }
    current.messages.push(message);
  }

  return groups;
}

function buildSummary(messages: Message[]) {
  const userMessages = messages.filter((message) => message.role === "user");
  const assistantMessages = messages.filter((message) => message.role === "assistant");
  return {
    userCount: userMessages.length,
    botCount: assistantMessages.length,
  };
}

export default function ConversationsWorkspace({
  title,
  subtitle,
  toolbar,
  loading = false,
  conversations,
  selectedConversationKey,
  onSelectConversation,
  conversation,
  aiSummary,
  summaryLoading,
  emptyTitle = "No conversations yet",
  emptyDescription = "The message history will appear here.",
  renderDetailAction,
}: ConversationsWorkspaceProps) {
  const selectedConversationItem = conversations.find((item) => item.key === selectedConversationKey) ?? null;
  const messageGroups = conversation ? groupMessagesByDay(conversation.messages) : [];
  const summary = conversation ? buildSummary(conversation.messages) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {toolbar ? <div className="w-full max-w-xs">{toolbar}</div> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-medium text-slate-500">
              {loading ? "Loading conversations..." : `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="max-h-[42rem] divide-y divide-slate-100 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-slate-500">Loading conversations...</p>
              </div>
            ) : conversations.length ? (
              conversations.map((item) => {
                const active = item.key === selectedConversationKey;
                const count = item.message_count ?? 0;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onSelectConversation(item.key)}
                    className={[
                      "w-full px-4 py-3 text-left transition",
                      active ? "bg-slate-950" : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className={`truncate text-sm font-medium ${active ? "text-white" : "text-slate-900"}`}>{item.title}</p>
                      {item.agentName ? (
                        <span
                          className={[
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            active ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-500",
                          ].join(" ")}
                        >
                          {item.agentName}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                      <span>{count} msg{count !== 1 ? "s" : ""}</span>
                      <span>&middot;</span>
                      <span title={formatFullDate(item.updated_at)}>{timeAgo(item.updated_at)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-slate-500">{emptyTitle}</p>
                <p className="mt-1 text-xs text-slate-400">{emptyDescription}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-[42rem] flex-col rounded-xl border border-slate-200 bg-white">
          {selectedConversationItem && conversation ? (
            <>
              <div className="border-b border-slate-100 px-5 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{conversation.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {isToday(conversation.updated_at)
                        ? `Today at ${formatTime(conversation.updated_at)}`
                        : isYesterday(conversation.updated_at)
                          ? `Yesterday at ${formatTime(conversation.updated_at)}`
                          : formatFullDate(conversation.updated_at)}
                    </p>
                  </div>
                  {renderDetailAction ? renderDetailAction(selectedConversationItem) : null}
                </div>
              </div>

              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200">
                    <svg viewBox="0 0 16 16" className="h-3 w-3 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M14 10a2 2 0 0 1-2 2H4l-3 3V3a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v7Z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Conversation Summary</p>
                    {summaryLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                        <span className="text-xs text-slate-400">Generating summary...</span>
                      </div>
                    ) : aiSummary ? (
                      <p className="text-xs leading-relaxed text-slate-600">{aiSummary}</p>
                    ) : (
                      <p className="text-xs italic text-slate-400">No summary available.</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {selectedConversationItem.agentName ? (
                      <>
                        <p className="text-[10px] text-slate-400">Agent</p>
                        <p className="text-sm font-semibold text-slate-700">{selectedConversationItem.agentName}</p>
                      </>
                    ) : null}
                    {summary ? (
                      <>
                        <p className={`${selectedConversationItem.agentName ? "mt-2" : ""} text-[10px] text-slate-400`}>Messages</p>
                        <p className="text-sm font-semibold text-slate-700">{summary.userCount + summary.botCount}</p>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="h-[32rem] flex-1 overflow-y-auto bg-slate-50 px-5 py-4">
                <div className="space-y-4">
                  {messageGroups.map((group) => (
                    <div key={group.dayLabel}>
                      <div className="my-4 flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="whitespace-nowrap px-1 text-[11px] font-medium text-slate-400">{group.dayLabel}</span>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                      <div className="space-y-3">
                        {group.messages.map((message) => (
                          <MessageBubble
                            key={message.id}
                            role={message.role as "user" | "assistant"}
                            content={message.content}
                            timestamp={message.timestamp}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center py-16 text-center">
              <div>
                <p className="text-sm font-medium text-slate-600">Select a conversation</p>
                <p className="mt-1 text-xs text-slate-400">The message history will appear here.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
