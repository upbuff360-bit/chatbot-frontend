"use client";

import { useEffect, useRef, useState } from "react";

import { useAdmin } from "@/components/AdminProvider";
import MessageBubble from "@/components/MessageBubble";
import { sendChatMessage } from "@/lib/api";
import { ChatMessage } from "@/lib/types";

type ChatWidgetProps = {
  agentId: string;
  welcomeMessage: string;
  onConversationUpdated?: () => Promise<void> | void;
};

const STARTER_SUGGESTIONS = [
  "What do you offer?",
  "What are your services?",
  "What are your products?",
  "Which solution would you recommend?",
];

export default function ChatWidget({ agentId, welcomeMessage, onConversationUpdated }: ChatWidgetProps) {
  const { addToast, refreshAgents, refreshSummary } = useAdmin();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    setMessages([
      {
        id: "welcome-message",
        role: "assistant",
        content: welcomeMessage,
        suggestions: STARTER_SUGGESTIONS,
      },
    ]);
    setConversationId(null);
    setInput("");
  }, [agentId, welcomeMessage]);

  const handleSubmit = async (prefilled?: string) => {
    const trimmed = (prefilled ?? input).trim();
    if (!trimmed || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const data = await sendChatMessage({
        agent_id: agentId,
        question: trimmed,
        conversation_id: conversationId,
      });
      const answer = data.answer?.trim() || "I don't have enough information to answer that.";
      setConversationId(data.conversation_id);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: answer,
          suggestions: data.suggestions || STARTER_SUGGESTIONS,
        },
      ]);
      await Promise.all([refreshAgents(), refreshSummary(), onConversationUpdated?.()]);
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I'm having trouble reaching the backend right now. Please try again in a moment.",
          suggestions: STARTER_SUGGESTIONS,
        },
      ]);
      addToast({
        title: "Chat request failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Preview chat</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900">Live assistant experience</h3>
      </div>

      <div className="h-[28rem] space-y-4 overflow-y-auto bg-slate-50 px-5 py-5">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
            suggestions={message.suggestions}
            onSuggestionClick={(suggestion) => void handleSubmit(suggestion)}
          />
        ))}

        {loading ? (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              <span className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
              </span>
              Thinking...
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Ask this agent a question..."
            className="h-12 flex-1 border-0 bg-transparent px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}
