"use client";

import { useEffect, useRef, useState } from "react";
import { cachedFetch, invalidate } from "@/lib/client-cache";
import { useParams, useRouter } from "next/navigation";

import { useAdmin } from "@/components/AdminProvider";
import { getPublicWidgetSettings, getSettings, updateSettings, sendChatMessage, getDocuments } from "@/lib/api";
import { AgentSettings, ChatMessage, KnowledgeDocument } from "@/lib/types";

// ─── Preset system prompts ───────────────────────────────────────────────────
const PRESET_PROMPTS = [
  {
    group: "Base",
    label: "Basic Instructions",
    value: `### Role
You are the company's AI assistant. Help users clearly, politely, and efficiently using the available business information.

### Goals
- Answer questions in a concise and professional way.
- Ask a clarifying question when the user's goal is unclear.
- Keep the conversation focused on the business, its offerings, and the user's needs.

### Style
- Be warm, confident, and easy to understand.
- Prefer direct answers over long explanations.
- When helpful, guide the user to the next best question or decision.`,
  },
  {
    group: "Examples",
    label: "Customer Support",
    value: `### Role
You are a customer support assistant for the business.

### Goals
- Resolve customer questions clearly and calmly.
- Explain policies, services, and next steps in simple language.
- When a request is incomplete, ask for the missing detail before answering.

### Style
- Be reassuring, professional, and solution-oriented.
- Keep replies structured and easy to scan.
- Avoid sounding robotic or overly sales-driven.`,
  },
  {
    group: "Examples",
    label: "Sales Qualification",
    value: `### Role
You are a sales-focused assistant helping users understand fit and next steps.

### Goals
- Understand the user's use case before recommending anything.
- Ask short discovery questions when requirements are missing.
- Keep recommendations practical, relevant, and easy to compare.

### Style
- Be consultative, clear, and confident.
- Do not push too early; first understand the need.
- Focus on matching needs to the most relevant option.`,
  },
  {
    group: "Examples",
    label: "Lead Capture",
    value: `### Role
You are a lead capture assistant for prospective customers.

### Goals
- Answer high-level questions clearly.
- Encourage the user toward a concrete next step when appropriate.
- Collect missing intent or requirement details through natural follow-up questions.

### Style
- Be welcoming, concise, and action-oriented.
- Keep momentum in the conversation.
- Ask one focused question at a time.`,
  },
  {
    group: "Examples",
    label: "Product Recommender",
    value: `### Role
You help users choose the most relevant product, service, or option.

### Goals
- Clarify the user's goals, constraints, or use case before recommending.
- When there are multiple options, explain the differences simply.
- Recommend only when enough information is available.

### Style
- Be helpful, neutral, and practical.
- Prefer short comparisons over long descriptions.
- If the user is unsure, guide them with simple discovery questions.`,
  },
  {
    group: "Examples",
    label: "Appointment Booking",
    value: `### Role
You assist users who want to schedule, request, or prepare for an appointment or demo.

### Goals
- Help the user understand the booking process.
- Ask only for the information needed to move forward.
- Keep responses clear, organized, and easy to act on.

### Style
- Be polite, efficient, and organized.
- Confirm important details clearly.
- Reduce friction and help the user complete the next step.`,
  },
  {
    group: "Examples",
    label: "Internal Knowledge Assistant",
    value: `### Role
You are an internal knowledge assistant helping users find accurate business information quickly.

### Goals
- Give precise, direct answers grounded in the available information.
- Summarize clearly when the source material is dense.
- Ask a clarifying question if the request is too broad or ambiguous.

### Style
- Be concise, factual, and easy to follow.
- Favor clarity over personality.
- Use short structured answers when that improves understanding.`,
  },
];

type Tab = "basic" | "content" | "style" | "ai" | "embed";
type EmbedType = "floating" | "iframe";
type Appearance = "light" | "dark";
// ── NEW: Platform type ────────────────────────────────────────────────────────
type PlatformTab = "html" | "astro" | "react" | "vue";

const TABS: { id: Tab; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "content", label: "Content" },
  { id: "style", label: "Style" },
  { id: "ai", label: "AI" },
  { id: "embed", label: "Embed" },
];

// ── NEW: Platform tab definitions ─────────────────────────────────────────────
const PLATFORM_TABS: { id: PlatformTab; label: string; icon: string }[] = [
  { id: "html",  label: "HTML / PHP / Django", icon: "🌐" },
  { id: "astro", label: "Astro",               icon: "🚀" },
  { id: "react", label: "React / Next.js",     icon: "⚛️" },
  { id: "vue",   label: "Vue / Nuxt",          icon: "💚" },
];

const STARTER_SUGGESTIONS = [
  "What do you offer?",
  "What are your services?",
  "What are your products?",
  "Which solution would you recommend?",
];

// ── NEW: Platform snippet generator ──────────────────────────────────────────
function getEmbedSnippet(
  platform: PlatformTab,
  agentId: string,
  primaryColor: string,
  appearance: string,
  backendUrl: string
): string {
  const config = `  window.chatbotConfig = {
    agentId: "${agentId}",
    primaryColor: "${primaryColor}",
    appearance: "${appearance}",
    apiBase: "${backendUrl}",
  };`;

  switch (platform) {
    case "html":
      return `<!-- Paste before </body> -->
<script>
${config}
</script>
<script src="${backendUrl}/widget.js" async></script>`;

    case "astro":
      return `<!-- Paste before </body> in your Layout.astro -->
<script is:inline>
${config}
</script>
<script src="${backendUrl}/widget.js" async is:inline></script>
<script is:inline>
  document.addEventListener('astro:page-load', () => {
    if (!document.querySelector('#cw-bubble')) {
      const s = document.createElement('script');
      s.src = "${backendUrl}/widget.js";
      s.async = true;
      document.body.appendChild(s);
    }
  });
</script>`;

    case "react":
      return `// Add to your root layout (layout.tsx or _app.tsx)
"use client";
import { useEffect } from 'react';

export default function ChatWidget() {
  useEffect(() => {
    (window as any).chatbotConfig = {
      agentId: "${agentId}",
      primaryColor: "${primaryColor}",
      appearance: "${appearance}",
      apiBase: "${backendUrl}",
    };
    if (!document.querySelector('#cw-bubble')) {
      const script = document.createElement('script');
      script.src = '${backendUrl}/widget.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);
  return null;
}

// Then add <ChatWidget /> inside your layout`;

    case "vue":
      return `<!-- Add to App.vue or your default layout -->
<script setup>
import { onMounted } from 'vue';

onMounted(() => {
  (window as any).chatbotConfig = {
    agentId: "${agentId}",
    primaryColor: "${primaryColor}",
    appearance: "${appearance}",
    apiBase: "${backendUrl}",
  };
  if (!document.querySelector('#cw-bubble')) {
    const script = document.createElement('script');
    script.src = '${backendUrl}/widget.js';
    script.async = true;
    document.body.appendChild(script);
  }
});
</script>`;
  }
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "• $1")
    .replace(/\n/g, "<br>");
}

export default function PlaygroundPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const isNew  = agentId === "new";
  const { agents, createAgentRecord, addToast, refreshAgents, refreshSummary } = useAdmin();
  const agent = agents.find((a) => a.id === agentId);

  const [activeTab, setActiveTab] = useState<Tab>("basic");
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Basic tab ──────────────────────────────────────────────────────────────
  const [agentName,      setAgentName]      = useState("");
  const [websiteName,    setWebsiteName]    = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  // ── Content tab ────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");

  // ── Style tab ──────────────────────────────────────────────────────────────
  const [appearance, setAppearance] = useState<Appearance>("light");
  const [primaryColor, setPrimaryColor] = useState("#0f172a");
  const [secondaryColor, setSecondaryColor] = useState("#f8fafc");

  // ── AI tab ─────────────────────────────────────────────────────────────────
  const [selectedPreset, setSelectedPreset] = useState("Basic Instructions");
  const [promptText, setPromptText] = useState(PRESET_PROMPTS[0].value);
  const [customPromptText, setCustomPromptText] = useState("");
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(false);

  // ── Embed tab ──────────────────────────────────────────────────────────────
  const [embedType, setEmbedType] = useState<EmbedType>("floating");
  // ── NEW: platform tab state ───────────────────────────────────────────────
  const [platformTab, setPlatformTab] = useState<PlatformTab>("html");

  // ── Live chat ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [starterSuggestions, setStarterSuggestions] = useState<string[]>(STARTER_SUGGESTIONS);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const buildWelcomeMessage = (): ChatMessage => ({
    id: "welcome-" + Date.now(),
    role: "assistant",
    content: welcomeMessage || "Hi! What can I help you with?",
    suggestions: starterSuggestions,
  });

  // Load settings on mount
  useEffect(() => {
    if (!agentId || isNew) return;

    const fetchAgentName = async () => {
      const found = agents.find((a) => a.id === agentId);
      if (found?.name) {
        setAgentName(found.name);
      } else {
        try {
          const { getAgent } = await import("@/lib/api");
          const ag = await getAgent(agentId);
          if (ag?.name) setAgentName(ag.name);
        } catch {}
      }
    };
    void fetchAgentName();

    void cachedFetch(`settings:${agentId}`, () => getSettings(agentId), 60_000).then((s) => {
      setSettings(s);
      setWelcomeMessage(s.welcome_message);
      setLeadCaptureEnabled(Boolean(s.lead_capture_enabled));
      if (s.display_name)   setDisplayName(s.display_name);
      if (s.website_name)   setWebsiteName(s.website_name);
      if (s.website_url)    setWebsiteUrl(s.website_url);
      if (s.primary_color)   setPrimaryColor(s.primary_color);
      if (s.secondary_color) setSecondaryColor(s.secondary_color);
      if (s.appearance)      setAppearance(s.appearance as "light" | "dark");
      const matched = PRESET_PROMPTS.find((p) => p.value.trim() === s.system_prompt.trim());
      if (matched) {
        setSelectedPreset(matched.label);
        setPromptText(matched.value);
        setCustomPromptText("");
      } else {
        setSelectedPreset("__custom__");
        setPromptText(s.system_prompt);
        setCustomPromptText(s.system_prompt);
      }
    }).catch((err) =>
      addToast({ title: "Unable to load settings", description: err instanceof Error ? err.message : "Please try again.", variant: "error" })
    );
  }, [agentId]);

  useEffect(() => {
    setStarterSuggestions(STARTER_SUGGESTIONS);
    if (!agentId || isNew) return;

    void cachedFetch(`widget-settings:${agentId}`, () => getPublicWidgetSettings(agentId), 60_000)
      .then((widgetSettings) => {
        if (widgetSettings.suggestions?.length) {
          setStarterSuggestions(widgetSettings.suggestions);
        }
      })
      .catch(() => {
        setStarterSuggestions(STARTER_SUGGESTIONS);
      });
  }, [agentId, isNew]);

  useEffect(() => {
    if (agent?.name && !displayName) setDisplayName(agent.name);
  }, [agent?.name]);

  const prevAgentId = useRef<string | null>(null);
  useEffect(() => {
    if (prevAgentId.current === agentId) return;
    prevAgentId.current = agentId;
    setMessages([buildWelcomeMessage()]);
    setConversationId(null);
  }, [agentId]);

  useEffect(() => {
    setMessages((current) => {
      if (conversationId || current.length !== 1 || current[0]?.role !== "assistant") {
        return current;
      }
      const nextContent = welcomeMessage || "Hi! What can I help you with?";
      const nextSuggestions = starterSuggestions.length ? starterSuggestions : STARTER_SUGGESTIONS;
      const currentSuggestions = current[0].suggestions ?? [];
      const sameSuggestions =
        currentSuggestions.length === nextSuggestions.length &&
        currentSuggestions.every((suggestion, index) => suggestion === nextSuggestions[index]);
      if (current[0].content === nextContent && sameSuggestions) {
        return current;
      }
      return [{ ...current[0], content: nextContent, suggestions: nextSuggestions }];
    });
  }, [conversationId, starterSuggestions, welcomeMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const handlePresetChange = (label: string) => {
    setSelectedPreset(label);
    if (label === "__custom__") {
      setPromptText(customPromptText);
      return;
    }

    const found = PRESET_PROMPTS.find((p) => p.label === label);
    if (found) setPromptText(found.value);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (isNew) {
        const name = agentName.trim();
        if (!name) {
          addToast({ title: "Agent name required", description: "Please enter a name for your agent.", variant: "error" });
          setActiveTab("basic");
          setSaving(false);
          return;
        }
        const newAgent = await createAgentRecord(name);
        await updateSettings(newAgent.id, {
          system_prompt:   promptText,
          welcome_message: welcomeMessage || "Hi! What can I help you with?",
          display_name:    displayName || name,
          website_name:    websiteName,
          website_url:     websiteUrl,
          primary_color:   primaryColor,
          secondary_color: secondaryColor,
          appearance:      appearance,
          temperature:     0.2,
          lead_capture_enabled: leadCaptureEnabled,
        });
        await refreshAgents();
        router.replace(`/agents/${newAgent.id}/chat`);
        return;
      }

      if (!settings) { setSaving(false); return; }

      if (agentName.trim() && agentName.trim() !== agent?.name) {
        const { updateAgent } = await import("@/lib/api");
        await updateAgent(agentId, agentName.trim());
        await refreshAgents();
      }

      const next = await updateSettings(agentId, {
        ...settings,
        system_prompt: promptText || settings.system_prompt,
        welcome_message: welcomeMessage || settings.welcome_message,
        display_name: displayName || settings.display_name || "",
        website_name: websiteName || settings.website_name || "",
        website_url: websiteUrl || settings.website_url || "",
        primary_color: primaryColor || settings.primary_color || "#0f172a",
        secondary_color: secondaryColor || settings.secondary_color || "#f8fafc",
        appearance: appearance || settings.appearance || "light",
        temperature: settings.temperature,
        lead_capture_enabled: leadCaptureEnabled,
      });
      setSettings(next);
      invalidate(`settings:${agentId}`);
      await refreshSummary();
      addToast({ title: "Settings saved" });
    } catch (err) {
      addToast({ title: "Unable to save", description: err instanceof Error ? err.message : "Please try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const resetChat = () => {
    setMessages([buildWelcomeMessage()]);
    setConversationId(null);
    setChatInput("");
  };

  const sendPrompt = async (prompt: string) => {
    if (isNew) return;
    const trimmed = prompt.trim();
    if (!trimmed || chatLoading) return;
    // Capture last bot message BEFORE adding the new user message to state
    const lastBotMsg = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: trimmed }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const data = await sendChatMessage({ agent_id: agentId, question: trimmed, conversation_id: conversationId, last_bot_message: lastBotMsg });
      setConversationId(data.conversation_id);
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer?.trim() || "I don't have enough information to answer that.",
          suggestions: data.suggestions || starterSuggestions,
        },
      ]);
      await Promise.all([refreshAgents(), refreshSummary()]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I'm having trouble reaching the backend. Please try again.",
          suggestions: starterSuggestions,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSend = async () => {
    await sendPrompt(chatInput);
  };

  // Derived chat preview styles
  const isDark = appearance === "dark";
  const chatBg = isDark ? "#0f172a" : secondaryColor;
  const bubbleBg = isDark ? "#1e293b" : "#ffffff";
  const bubbleBorder = isDark ? "#334155" : "#e2e8f0";
  const bubbleText = isDark ? "#f1f5f9" : "#1e293b";
  const dotColor = isDark ? "rgba(148,163,184,0.12)" : "rgba(203,213,225,0.5)";

  const backendUrl  = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8001";
  const embedSiteUrl = websiteUrl ? websiteUrl.replace(/\/$/, "") : "https://your-website.com";

  const iframeSnippet = `<iframe
  src="${backendUrl}/embed/${agentId}"
  width="100%"
  height="600"
  style="border:none;border-radius:12px;"
  allow="clipboard-write"
></iframe>`;

  // ── NEW: Platform hint map ────────────────────────────────────────────────
  const platformHint: Record<PlatformTab, { color: string; text: React.ReactNode }> = {
    html:  { color: "border-blue-100 bg-blue-50 text-blue-700",      text: <><strong>HTML / PHP / Django:</strong> Paste directly before <code className="rounded bg-blue-100 px-1">&lt;/body&gt;</code> in your template file.</> },
    astro: { color: "border-orange-100 bg-orange-50 text-orange-700", text: <><strong>Astro:</strong> Uses <code className="rounded bg-orange-100 px-1">is:inline</code> to prevent Astro bundling. Add to <code className="rounded bg-orange-100 px-1">Layout.astro</code>.</> },
    react: { color: "border-cyan-100 bg-cyan-50 text-cyan-700",      text: <><strong>React / Next.js:</strong> Uses <code className="rounded bg-cyan-100 px-1">useEffect</code> to inject after mount. Add to your root layout.</> },
    vue:   { color: "border-green-100 bg-green-50 text-green-700",    text: <><strong>Vue / Nuxt:</strong> Uses <code className="rounded bg-green-100 px-1">onMounted</code> to inject after mount. Add to <code className="rounded bg-green-100 px-1">App.vue</code>.</> },
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden">

      {/* ── Page title row ── */}
      <div className="flex items-center gap-3 mb-3 flex-shrink-0">
        <h1 className="text-base font-semibold text-slate-900">Playground</h1>
        {isNew ? (
          <span className="h-9 flex items-center px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-400">
            New Agent
          </span>
        ) : (
          <div className="relative">
            <select
              value={agentId}
              onChange={(e) => {
                const selected = e.target.value;
                if (selected && selected !== agentId) {
                  window.location.href = `/agents/${selected}/chat`;
                }
              }}
              className="h-9 appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white cursor-pointer"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <svg viewBox="0 0 16 16" fill="currentColor" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400">
              <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
            </svg>
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* ── Left panel: tabs + settings ─────────────────────────────────── */}
        <div className="flex w-[400px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white mr-4">

          {/* Tab bar */}
          <div className="flex border-b border-slate-100">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "relative flex-1 py-2.5 text-xs font-medium transition",
                  activeTab === tab.id
                    ? "text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-900"
                    : "text-slate-400 hover:text-slate-600",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

            {/* ── Basic ─────────────────────────────────────────────────── */}
            {activeTab === "basic" && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-slate-700">Trained</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Last updated just now</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                      <p className="text-[10px] font-medium text-slate-400">Data Sources</p>
                      <p className="mt-0.5 text-lg font-bold text-slate-900">{agent?.document_count ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                      <p className="text-[10px] font-medium text-slate-400">Conversations</p>
                      <p className="mt-0.5 text-lg font-bold text-slate-900">{agent?.conversation_count ?? 0}</p>
                    </div>
                  </div>
                </div>

                <Field label="Agent name" hint="The name of this agent shown in the admin panel.">
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="e.g. Support Agent"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </Field>

                <Field label="Website name" hint="The name of your website or business shown to users.">
                  <input
                    type="text"
                    value={websiteName}
                    onChange={(e) => setWebsiteName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </Field>

                <Field label="Website URL" hint="The URL where the chat widget will be embedded.">
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://your-website.com"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </Field>

                {websiteUrl && (
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="border-b border-slate-100 px-3.5 py-2.5">
                      <p className="text-xs font-medium text-slate-500">Embed preview</p>
                    </div>
                    <div className="px-3.5 py-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true">
                          <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z" fill="currentColor" />
                          <path d="M6.5 5.75A.75.75 0 0 1 7.25 5h1.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75H7.25a.75.75 0 0 1-.75-.75v-4.5Z" fill="currentColor" />
                        </svg>
                        <span>Widget will appear on</span>
                      </div>
                      <a href={websiteUrl} target="_blank" rel="noreferrer"
                        className="block truncate text-sm font-medium text-blue-600 hover:underline">
                        {websiteUrl}
                      </a>
                      {websiteName && <p className="text-xs text-slate-400">{websiteName}</p>}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Content ───────────────────────────────────────────────── */}
            {activeTab === "content" && (
              <>
                <Field label="Display name" hint="Shown in the chat widget header.">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={agent?.name ?? "Agent name"}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </Field>

                <Field label="Welcome message" hint="First message users see when chat opens.">
                  <textarea
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    rows={4}
                    placeholder="Hi! What can I help you with?"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </Field>
              </>
            )}

            {/* ── Style ─────────────────────────────────────────────────── */}
            {activeTab === "style" && (
              <>
                <Field label="Appearance" hint="Light or dark mode for the chat widget.">
                  <div className="flex gap-3">
                    <AppearanceCard value="light" selected={appearance === "light"} onClick={() => setAppearance("light")} />
                    <AppearanceCard value="dark" selected={appearance === "dark"} onClick={() => setAppearance("dark")} />
                  </div>
                </Field>

                <Field label="Primary color" hint="Header, user bubbles, send button.">
                  <div className="flex items-center gap-2">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200 p-0.5" />
                    <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-24 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white" />
                    {["#0f172a","#2563eb","#16a34a","#9333ea","#dc2626"].map((c) => (
                      <ColorSwatch key={c} color={c} active={primaryColor === c} onClick={() => setPrimaryColor(c)} />
                    ))}
                  </div>
                </Field>

                <Field label="Secondary color" hint="Chat background and assistant bubbles.">
                  <div className="flex items-center gap-2">
                    <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200 p-0.5" />
                    <input type="text" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-24 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white" />
                    {["#f8fafc","#f0fdf4","#eff6ff","#faf5ff","#1e293b"].map((c) => (
                      <ColorSwatch key={c} color={c} active={secondaryColor === c} onClick={() => setSecondaryColor(c)} />
                    ))}
                  </div>
                </Field>
              </>
            )}

            {/* ── AI ────────────────────────────────────────────────────── */}
            {activeTab === "ai" && (
              <>
                <Field label="System prompt" hint="Select a starting template, then edit freely below.">
                  <div className="relative">
                    <select
                      value={selectedPreset}
                      onChange={(e) => handlePresetChange(e.target.value)}
                      className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                    >
                      <optgroup label="Base">
                        <option value="Basic Instructions">Basic Instructions</option>
                      </optgroup>
                      <optgroup label="Examples">
                        {PRESET_PROMPTS.filter((p) => p.group === "Examples").map((p) => (
                          <option key={p.label} value={p.label}>{p.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Custom">
                        <option value="__custom__">Custom prompt</option>
                      </optgroup>
                    </select>
                    <svg viewBox="0 0 16 16" fill="currentColor" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400">
                      <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <textarea
                    value={promptText}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setPromptText(nextValue);
                      setCustomPromptText(nextValue);
                      setSelectedPreset("__custom__");
                    }}
                    rows={14}
                    placeholder="Enter your system prompt..."
                    className="mt-2.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </Field>

                <Field
                  label="Lead capture"
                  hint="When enabled, the assistant can invite interested users to share contact details and those details will appear in the Leads page."
                >
                  <button
                    type="button"
                    onClick={() => setLeadCaptureEnabled((current) => !current)}
                    className={[
                      "flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition",
                      leadCaptureEnabled
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white",
                    ].join(" ")}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {leadCaptureEnabled ? "Lead capture is on" : "Lead capture is off"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        The assistant will only ask when the conversation shows clear follow-up or buying intent.
                      </p>
                    </div>
                    <span
                      className={[
                        "relative inline-flex h-6 w-11 items-center rounded-full transition",
                        leadCaptureEnabled ? "bg-emerald-500" : "bg-slate-300",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "inline-block h-5 w-5 rounded-full bg-white transition",
                          leadCaptureEnabled ? "translate-x-5" : "translate-x-1",
                        ].join(" ")}
                      />
                    </span>
                  </button>
                </Field>
              </>
            )}

            {/* ── Embed ─────────────────────────────────────────────────── */}
            {activeTab === "embed" && (
              <>
                <Field label="Embed type" hint="How to add this chatbot to your website.">
                  <div className="flex gap-3">
                    <EmbedCard value="floating" selected={embedType === "floating"} onClick={() => setEmbedType("floating")} icon={<FloatingIcon />} title="Floating widget" description="Chat bubble in the corner" />
                    <EmbedCard value="iframe" selected={embedType === "iframe"} onClick={() => setEmbedType("iframe")} icon={<IframeIcon />} title="Inline iframe" description="Embed inside page content" />
                  </div>
                </Field>

                {/* ── NEW: Platform selector — only shown for floating widget ── */}
                {embedType === "floating" && (
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Your technology</p>
                    <p className="text-xs text-slate-400 mb-3">Select your framework to get the correct embed snippet.</p>

                    <div className="flex flex-col gap-1.5 mb-3">
                    <div
  className="flex border-b border-slate-100 mb-3 overflow-x-auto"
  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }} >
                      {PLATFORM_TABS.map((pt) => (
                        <button
                          key={pt.id}
                          type="button"
                          onClick={() => setPlatformTab(pt.id)}
                          className={[
                            "relative flex items-center gap-1.5 px-2 py-2.5 text-xs font-medium transition whitespace-nowrap",
                            platformTab === pt.id
                              ? "text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-900"
                              : "text-slate-400 hover:text-slate-600",
                          ].join(" ")}
                        >
                          <span>{pt.icon}</span>
                          <span>{pt.label}</span>
                        </button>
                      ))}
                    </div>
                    </div>

                    {/* Platform-specific hint */}
                    <div className={`rounded-lg border px-3 py-2.5 text-xs leading-5 mb-1 ${platformHint[platformTab].color}`}>
                      {platformHint[platformTab].text}
                    </div>
                  </div>
                )}

                <Field label="Embed code" hint="Copy and paste into your project.">
                  <CodeBlock code={
                    embedType === "iframe"
                      ? iframeSnippet
                      : getEmbedSnippet(platformTab, agentId, primaryColor, appearance, backendUrl)
                  } />
                </Field>

                {!websiteUrl && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-3 text-xs leading-5 text-blue-700">
                    Set your <strong>Website URL</strong> in the Basic tab to automatically populate the embed domain.
                  </div>
                )}
              </>
            )}

            {/* ── Save button — shown on all tabs except embed ── */}
            {activeTab !== "embed" && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || (!isNew && !settings) || (isNew && !agentName.trim())}
                  className="w-full h-8 rounded-lg bg-slate-950 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: widget-style chat preview ───────────────────────── */}
         <div
          className="relative flex-1 overflow-hidden"
          style={{
            background: isDark ? "#1e293b" : "#f1f5f9",
            backgroundImage: `radial-gradient(circle, ${isDark ? "rgba(148,163,184,0.08)" : "rgba(203,213,225,0.4)"} 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
            borderRadius: "12px",
          }}
        >
          {/* Widget window + bubble wrapper */}
        <div className="absolute flex flex-col items-end" style={{ top: "50%", left: "50%", transform: "translate(-50%, -52%)" }}>
          {/* Widget window */}
          <div
            className="flex flex-col overflow-hidden shadow-2xl"
            style={{
              width: "400px",
              height: "500px",
              borderRadius: "16px",
              border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
            }}
          >
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: primaryColor }}>
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                    <path fillRule="evenodd" d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2Zm3.707 6.293a1 1 0 0 0-1.414 0L9 11.586 7.707 10.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0 0-1.414Z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-white">{displayName || agent?.name || "Agent"}</span>
              </div>
              <button
                type="button"
                onClick={resetChat}
                title="Reset conversation"
                className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path d="M4 10a6 6 0 1 0 1.03-3.38M4 10V6m0 4H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4"
              style={{
                backgroundColor: chatBg,
                backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
                backgroundSize: "20px 20px",
              }}
            >
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div className={`flex max-w-[82%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
                        <div
                          className="w-full px-4 py-2.5 text-sm leading-6"
                          style={
                            isUser
                              ? { background: primaryColor, color: "#fff", borderRadius: "16px 16px 4px 16px" }
                              : { background: bubbleBg, color: bubbleText, border: `1px solid ${bubbleBorder}`, borderRadius: "4px 16px 16px 16px" }
                          }
                        >
                          <p
                            className="whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                          />
                        </div>
                        {!isUser && msg.suggestions?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {msg.suggestions.slice(0, 4).map((suggestion) => (
                              <button
                                key={`${msg.id}-${suggestion}`}
                                type="button"
                                onClick={() => void sendPrompt(suggestion)}
                                disabled={chatLoading}
                                className="rounded-full px-2.5 py-1 !text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                  border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                                  background: isDark ? "#0f172a" : "#ffffff",
                                  color: isDark ? "#e2e8f0" : "#334155",
                                }}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div
                      className="inline-flex items-center gap-1.5 px-4 py-2.5"
                      style={{ background: bubbleBg, border: `1px solid ${bubbleBorder}`, borderRadius: "4px 16px 16px 16px" }}
                    >
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Powered by */}
            <div
              className="flex justify-center py-1.5 flex-shrink-0"
              style={{ background: isDark ? "#0f172a" : "#fff", borderTop: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}` }}
            >
              <p className="text-[10px]" style={{ color: isDark ? "#475569" : "#94a3b8" }}>Powered by <a href="https://upbuff.com/" target="blank"><b>UpBuff AI</b></a></p>
            </div>

            {/* Input */}
            <div
              className="px-4 py-3 flex-shrink-0"
              style={{ background: isDark ? "#0f172a" : "#fff", borderTop: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}` }}
            >
              <div
                className="flex items-center gap-2 rounded-full px-4 py-2"
                style={{ border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, background: isDark ? "#1e293b" : "#f8fafc" }}
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                  placeholder="Message..."
                  className="flex-1 border-0 bg-transparent text-sm outline-none"
                  style={{ color: isDark ? "#f1f5f9" : "#1e293b" }}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: primaryColor }}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M8 2a.75.75 0 0 1 .75.75v8.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.22 3.22V2.75A.75.75 0 0 1 8 2Z" clipRule="evenodd" transform="rotate(-90 8 8)" />
                  </svg>
                </button>
              </div>
            </div>

          </div>{/* end widget window */}

          {/* Floating bubble — below widget, aligned right */}
          <div
            className="flex items-center justify-center rounded-full shadow-lg mt-3"
            style={{ width: "52px", height: "52px", background: primaryColor, cursor: "default" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "24px", height: "24px" }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          </div>{/* end widget+bubble wrapper */}
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ColorSwatch({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={color}
      className={["h-7 w-7 rounded-full border-2 transition", active ? "border-slate-900 scale-110" : "border-slate-200 hover:scale-105"].join(" ")}
      style={{ background: color }}
    />
  );
}

function AppearanceCard({ value, selected, onClick }: { value: "light" | "dark"; selected: boolean; onClick: () => void }) {
  const isLight = value === "light";
  return (
    <button type="button" onClick={onClick}
      className={["flex-1 rounded-xl border-2 p-3 text-left transition", selected ? "border-slate-900" : "border-slate-200 hover:border-slate-300"].join(" ")}>
      <div className={["rounded-lg p-2 space-y-1.5", isLight ? "bg-slate-100" : "bg-slate-800"].join(" ")}>
        <div className={["h-2 w-3/4 rounded-full", isLight ? "bg-slate-300" : "bg-slate-600"].join(" ")} />
        <div className={["h-2 w-1/2 rounded-full ml-auto", isLight ? "bg-slate-900" : "bg-blue-500"].join(" ")} />
        <div className={["h-2 w-2/3 rounded-full", isLight ? "bg-slate-300" : "bg-slate-600"].join(" ")} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-700 capitalize">{value}</p>
        {selected && (
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-slate-900">
            <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </button>
  );
}

function EmbedCard({ selected, onClick, icon, title, description }: {
  value: string; selected: boolean; onClick: () => void;
  icon: React.ReactNode; title: string; description: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={["flex-1 rounded-xl border-2 p-3.5 text-left transition", selected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"].join(" ")}>
      <div className={["mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg", selected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"].join(" ")}>{icon}</div>
      <p className="text-xs font-semibold text-slate-800">{title}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{description}</p>
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="relative rounded-xl border border-slate-200 bg-slate-950 overflow-hidden">
      <button type="button" onClick={handleCopy}
        className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700">
        {copied
          ? <><svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-emerald-400"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>Copied</>
          : <><svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5"><path d="M5.5 4.5h-1A1.5 1.5 0 0 0 3 6v6.5A1.5 1.5 0 0 0 4.5 14h7A1.5 1.5 0 0 0 13 12.5V6A1.5 1.5 0 0 0 11.5 4.5h-1M5.5 4.5A1.5 1.5 0 0 1 7 3h2a1.5 1.5 0 0 1 1.5 1.5M5.5 4.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>Copy</>}
      </button>
      <pre className="overflow-x-auto px-4 py-4 pt-5 text-xs leading-6 text-slate-300"><code>{code}</code></pre>
    </div>
  );
}

function FloatingIcon() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]"><path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 0 0 1.33 0l1.713-3.293a.633.633 0 0 1 .642-.413 41.102 41.102 0 0 0 3.55-.414c1.437-.232 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2ZM6.75 6a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 2.5a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" clipRule="evenodd" /></svg>;
}

function IframeIcon() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]"><path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v11.5A2.25 2.25 0 0 0 4.25 18h11.5A2.25 2.25 0 0 0 18 15.75V4.25A2.25 2.25 0 0 0 15.75 2H4.25ZM3.5 4.25a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75H4.25a.75.75 0 0 1-.75-.75v-1.5Zm.75 3.75a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H4.25Zm0 3a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H4.25Zm0 3a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5Z" clipRule="evenodd" /></svg>;
}
